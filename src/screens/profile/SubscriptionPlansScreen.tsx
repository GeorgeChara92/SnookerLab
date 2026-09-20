import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/ui/AppButton";
import { SUBSCRIPTION_LIMITS, TIER_LABELS } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAuthStore } from "../../store";
import {
  addBillingCustomerInfoListener,
  fetchCurrentOfferings,
  getBillingCustomerInfo,
  getBillingUnavailableReason,
  getTierOffer,
  initBilling,
  isBillingConfigured,
  openNativeSubscriptionSettings,
  purchaseTierMonthly,
  restoreBillingPurchases,
  subscriptionStateFromCustomerInfo,
  syncSubscriptionWithServer,
  type BillingSubscriptionState,
  type BillingOfferings,
} from "../../services/billing";
import type { SubscriptionTier } from "../../types";

type PaidTier = Exclude<SubscriptionTier, "free">;

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snooker-lab.vercel.app/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snooker-lab.vercel.app/terms";

/** Automatic refreshes (focus, foreground, store events) are throttled to this. */
const AUTO_REFRESH_INTERVAL_MS = 15000;

const TIER_RANK: Record<SubscriptionTier, number> = { free: 0, half_century: 1, century: 2 };

const limitText = (value: number | null, noun: string) =>
  value === null ? `Unlimited ${noun}` : `${value} ${noun} a month`;

const PLANS: Array<{ tier: SubscriptionTier; tagline: string; extras: string[] }> = [
  {
    tier: "free",
    tagline: "Track your practice and see where you stand.",
    extras: ["Practice routines and sessions", "Basic stats"],
  },
  {
    tier: "half_century",
    tagline: "For players practising every week.",
    extras: ["Advanced performance tracking", "Full routine library"],
  },
  {
    tier: "century",
    tagline: "Everything, for players chasing centuries.",
    extras: ["Full analytics suite", "Early access to new features"],
  },
];

const planFeatures = (tier: SubscriptionTier, extras: string[]) => {
  const limits = SUBSCRIPTION_LIMITS[tier];
  return [
    limitText(limits.matchesPerPeriod, "matches"),
    limitText(limits.tournamentsPerPeriod, "tournaments"),
    limitText(limits.aiAnalysesPerPeriod, "AI analyses"),
    ...extras,
  ];
};

const formatDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

export const SubscriptionPlansScreen = () => {
  const { colors } = useAppTheme();
  const { user, setUser } = useAuthStore();
  const subscription = useSubscriptionAccess();

  const [offerings, setOfferings] = useState<BillingOfferings | null>(null);
  const [billingState, setBillingState] = useState<BillingSubscriptionState | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [busyTier, setBusyTier] = useState<PaidTier | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);
  const lastSignatureRef = useRef<string | null>(null);

  const billingEnabled = isBillingConfigured();
  const unavailableReason = getBillingUnavailableReason();

  // The server's tier is what unlocks features, so it is what the page reflects.
  const currentTier: SubscriptionTier =
    user?.subscription_tier === "half_century" || user?.subscription_tier === "century" ? user.subscription_tier : "free";

  /**
   * Reads the store, has the server verify it against RevenueCat, and reports any change.
   * Automatic callers are throttled; a pull-to-refresh always runs.
   */
  const refresh = useCallback(
    async (options?: { force?: boolean; announce?: boolean }) => {
      if (!user?.id || !billingEnabled) {
        setStatus("ready");
        return;
      }
      if (inFlightRef.current) return;
      if (!options?.force && Date.now() - lastRunRef.current < AUTO_REFRESH_INTERVAL_MS) return;

      inFlightRef.current = true;
      lastRunRef.current = Date.now();

      try {
        await initBilling(user.id);
        const [nextOfferings, info] = await Promise.all([fetchCurrentOfferings(), getBillingCustomerInfo()]);
        setOfferings(nextOfferings);

        const state = subscriptionStateFromCustomerInfo(info);
        setBillingState(state);

        const updatedUser = await syncSubscriptionWithServer();
        if (updatedUser) setUser(updatedUser);
        setStatus("ready");

        const signature = `${state.tier}:${state.willRenew}:${state.expiresAt ?? ""}`;
        if (options?.announce !== false && lastSignatureRef.current && lastSignatureRef.current !== signature) {
          const endsOn = formatDate(state.expiresAt);
          if (state.tier === "free") {
            Alert.alert("Subscription ended", "You're now on the Free plan.");
          } else if (!state.willRenew) {
            Alert.alert(
              "Subscription cancelled",
              endsOn
                ? `Your ${TIER_LABELS[state.tier]} plan stays active until ${endsOn}, then you move to Free.`
                : `Your ${TIER_LABELS[state.tier]} plan stays active until the end of the current period.`
            );
          } else {
            Alert.alert("Plan updated", `You're now on the ${TIER_LABELS[state.tier]} plan.`);
          }
        }
        lastSignatureRef.current = signature;
      } catch (error) {
        console.warn("Billing refresh failed:", { message: (error as any)?.message, code: (error as any)?.code });
        setStatus((previous) => (previous === "loading" ? "error" : previous));
      } finally {
        inFlightRef.current = false;
      }
    },
    [billingEnabled, setUser, user?.id]
  );

  useEffect(() => {
    void refresh({ force: true, announce: false });
  }, [refresh]);

  // Returning from the App Store subscription sheet lands back here.
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  useEffect(() => {
    if (!billingEnabled) return;
    return addBillingCustomerInfoListener(() => {
      void refresh();
    });
  }, [billingEnabled, refresh]);

  const onPullToRefresh = async () => {
    setIsRefreshing(true);
    await refresh({ force: true });
    setIsRefreshing(false);
  };

  const openStoreSubscriptions = async () => {
    try {
      await openNativeSubscriptionSettings();
    } catch {
      Alert.alert("Unavailable", "Could not open your store subscription settings.");
    }
  };

  const confirmStoreChange = (targetLabel: string) => {
    Alert.alert(
      `Switch to ${targetLabel}`,
      "Downgrades and cancellations are handled in your App Store subscriptions and take effect at the end of the period you've already paid for.",
      [
        { text: "Not now", style: "cancel" },
        { text: "Open App Store", onPress: () => void openStoreSubscriptions() },
      ]
    );
  };

  const purchase = async (tier: PaidTier) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to subscribe.");
      return;
    }
    if (!offerings) {
      Alert.alert("Plans unavailable", "Subscription plans could not be loaded. Pull down to try again.");
      return;
    }

    try {
      setBusyTier(tier);
      await initBilling(user.id);
      await purchaseTierMonthly(tier, offerings);
      await refresh({ force: true, announce: false });
      Alert.alert("You're all set", `You're now on the ${TIER_LABELS[tier]} plan.`);
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert("Purchase failed", "That purchase didn't go through. Nothing has been charged.");
      }
    } finally {
      setBusyTier(null);
    }
  };

  const restore = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to restore purchases.");
      return;
    }

    try {
      setIsRestoring(true);
      await initBilling(user.id);
      await restoreBillingPurchases();
      await refresh({ force: true, announce: false });
      Alert.alert("Purchases restored", "Any active subscription has been applied to this account.");
    } catch {
      Alert.alert("Restore failed", "Could not restore purchases. Please try again.");
    } finally {
      setIsRestoring(false);
    }
  };

  const statusLine = useMemo(() => {
    if (currentTier === "free") return "You're on the Free plan.";
    const endsOn = formatDate(billingState?.expiresAt ?? null);
    if (billingState && !billingState.willRenew) {
      return endsOn ? `Cancelled. Active until ${endsOn}.` : "Cancelled. Active until the end of this period.";
    }
    return endsOn ? `Renews on ${endsOn}.` : "Active.";
  }, [billingState, currentTier]);

  const usageRows = useMemo(
    () => [
      { label: "Matches", used: subscription.usage.matches, limit: subscription.limits.matchesPerPeriod },
      { label: "Tournaments", used: subscription.usage.tournaments, limit: subscription.limits.tournamentsPerPeriod },
      { label: "AI analyses", used: subscription.usage.aiAnalyses, limit: subscription.limits.aiAnalysesPerPeriod },
    ],
    [subscription]
  );

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onPullToRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.currentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.textMuted }]}>YOUR PLAN</Text>
        <Text style={[styles.currentTier, { color: colors.text }]}>{TIER_LABELS[currentTier]}</Text>
        <Text style={[styles.statusLine, { color: colors.textMuted }]}>{statusLine}</Text>

        <View style={[styles.usageBlock, { borderTopColor: colors.border }]}>
          {usageRows.map((row) => (
            <View key={row.label} style={styles.usageRow}>
              <Text style={[styles.usageLabel, { color: colors.textMuted }]}>{row.label}</Text>
              <Text style={[styles.usageValue, { color: colors.text }]}>
                {row.used} / {row.limit ?? "∞"}
              </Text>
            </View>
          ))}
          <Text style={[styles.usageCaption, { color: colors.textMuted }]}>
            Used since {formatDate(subscription.periodStart.toISOString()) ?? "the start of this period"}
          </Text>
        </View>
      </View>

      {!billingEnabled ? (
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="information-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            {unavailableReason ?? "Subscriptions are unavailable in this build."}
          </Text>
        </View>
      ) : null}

      {status === "loading" ? (
        <View style={styles.loadingBlock}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading plans…</Text>
        </View>
      ) : null}

      {status === "error" ? (
        <View style={[styles.notice, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="sync-alert" size={18} color={colors.textMuted} />
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            Couldn't refresh your plan just now. Your access is unchanged. Pull down to try again.
          </Text>
        </View>
      ) : null}

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>ALL PLANS</Text>

      {PLANS.map((plan) => {
        const isCurrent = plan.tier === currentTier;
        const offer = plan.tier === "free" ? null : getTierOffer(plan.tier as PaidTier, offerings);
        const isUpgrade = TIER_RANK[plan.tier] > TIER_RANK[currentTier];
        const priceUnavailable = plan.tier !== "free" && billingEnabled && status === "ready" && !offer;

        return (
          <View
            key={plan.tier}
            style={[
              styles.planCard,
              { backgroundColor: colors.surface, borderColor: isCurrent ? colors.primary : colors.border },
              isCurrent && styles.planCardCurrent,
            ]}
          >
            <View style={styles.planHeader}>
              <View style={styles.planHeaderText}>
                <Text style={[styles.planName, { color: colors.text }]}>{TIER_LABELS[plan.tier]}</Text>
                <Text style={[styles.planTagline, { color: colors.textMuted }]}>{plan.tagline}</Text>
              </View>
              <View style={styles.planPriceBlock}>
                <Text style={[styles.planPrice, { color: colors.text }]}>
                  {plan.tier === "free" ? "Free" : offer?.priceText ?? "—"}
                </Text>
                {plan.tier !== "free" && offer ? (
                  <Text style={[styles.planPeriod, { color: colors.textMuted }]}>per month</Text>
                ) : null}
              </View>
            </View>

            {isCurrent ? (
              <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.currentBadgeText, { color: colors.onPrimary }]}>CURRENT PLAN</Text>
              </View>
            ) : null}

            <View style={styles.featureList}>
              {planFeatures(plan.tier, plan.extras).map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                </View>
              ))}
            </View>

            {priceUnavailable ? (
              <Text style={[styles.planNote, { color: colors.textMuted }]}>
                Price unavailable right now. Pull down to refresh.
              </Text>
            ) : null}

            {!isCurrent ? (
              <View style={styles.planAction}>
                <AppButton
                  label={isUpgrade ? `Choose ${TIER_LABELS[plan.tier]}` : `Switch to ${TIER_LABELS[plan.tier]}`}
                  variant={isUpgrade ? "primary" : "secondary"}
                  loading={busyTier === plan.tier}
                  disabled={!billingEnabled || (isUpgrade && (!offer || busyTier !== null))}
                  onPress={() => {
                    if (isUpgrade) void purchase(plan.tier as PaidTier);
                    else confirmStoreChange(TIER_LABELS[plan.tier]);
                  }}
                />
              </View>
            ) : null}
          </View>
        );
      })}

      <View style={styles.footer}>
        <View style={styles.footerAction}>
          <AppButton label="Restore purchases" variant="secondary" loading={isRestoring} onPress={() => void restore()} />
        </View>
        {currentTier !== "free" ? (
          <View style={styles.footerAction}>
            <AppButton
              label="Manage subscription"
              variant="secondary"
              onPress={() => void openStoreSubscriptions()}
            />
          </View>
        ) : null}

        <Text style={[styles.smallPrint, { color: colors.textMuted }]}>
          Subscriptions renew monthly through the App Store until cancelled. Cancel any time in your App Store settings.
        </Text>

        <View style={styles.legalRow}>
          <Pressable
            onPress={() => void Linking.openURL(TERMS_URL)}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel="Read the terms of use"
          >
            <Text style={[styles.legalLink, { color: colors.primary }]}>Terms</Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.textMuted }]}>·</Text>
          <Pressable
            onPress={() => void Linking.openURL(PRIVACY_URL)}
            hitSlop={8}
            accessibilityRole="link"
            accessibilityLabel="Read the privacy policy"
          >
            <Text style={[styles.legalLink, { color: colors.primary }]}>Privacy</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  kicker: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2 },
  currentCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 20 },
  currentTier: { fontSize: 28, fontWeight: "800", marginTop: 6 },
  statusLine: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  usageBlock: { marginTop: 16, paddingTop: 14, borderTopWidth: 1 },
  usageRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 5 },
  usageLabel: { fontSize: 14 },
  usageValue: { fontSize: 14, fontWeight: "700" },
  usageCaption: { fontSize: 12, marginTop: 8 },
  notice: { flexDirection: "row", gap: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  loadingBlock: { alignItems: "center", paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 12 },
  planCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14 },
  planCardCurrent: { borderWidth: 2 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  planHeaderText: { flex: 1 },
  planName: { fontSize: 19, fontWeight: "800" },
  planTagline: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  planPriceBlock: { alignItems: "flex-end" },
  planPrice: { fontSize: 20, fontWeight: "800" },
  planPeriod: { fontSize: 12, marginTop: 2 },
  currentBadge: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginTop: 12 },
  currentBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  featureList: { marginTop: 14, gap: 8 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 14, flex: 1 },
  planNote: { fontSize: 12, marginTop: 12 },
  planAction: { marginTop: 16 },
  footer: { marginTop: 8, gap: 12 },
  footerAction: {},
  smallPrint: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  legalRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  legalLink: { fontSize: 13, fontWeight: "600" },
  legalDot: { fontSize: 13 },
});
