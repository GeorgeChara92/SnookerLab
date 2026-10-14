import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/ui/AppButton";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import {
  addBillingCustomerInfoListener,
  fetchCurrentOfferings,
  getBillingUnavailableReason,
  getCoachOffer,
  getBillingCustomerInfo,
  hasCoachEntitlement,
  initBilling,
  isBillingConfigured,
  openNativeSubscriptionSettings,
  purchaseCoachSubscription,
  restoreBillingPurchases,
  syncSubscriptionWithServer,
  type BillingOfferings,
  type BillingPeriod,
} from "../../services/billing";

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snookeredapp.com/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snookeredapp.com/terms";

const AUTO_REFRESH_INTERVAL_MS = 15000;

const FEATURES = [
  "Your own booking calendar and diary",
  "A client list, including walk-ins with no account of their own",
  "Broadcast groups for drills, videos and PDFs",
  "Private session notes and routine scores",
];

/** How much cheaper the annual price works out per year, vs paying monthly for 12 months. */
const annualSaving = (monthlyPrice: number, annualPrice: number) => Math.round((1 - annualPrice / (monthlyPrice * 12)) * 100);

/**
 * The Coach plan: orthogonal to the player tier (see subscription_tier) - a coach can be on any
 * player plan, or free, and separately subscribes to this to unlock the booking diary itself.
 * Same shape as SubscriptionPlansScreen, cut down to one plan rather than a tier comparison.
 */
export const CoachSubscriptionScreen = () => {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { user, setUser } = useAuthStore();

  const [offerings, setOfferings] = useState<BillingOfferings | null>(null);
  const [subscribed, setSubscribed] = useState(user?.coach_subscription_active ?? false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [period, setPeriod] = useState<BillingPeriod>("monthly");
  const [busy, setBusy] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const inFlightRef = useRef(false);
  const lastRunRef = useRef(0);

  const billingEnabled = isBillingConfigured();
  const unavailableReason = getBillingUnavailableReason();

  const refresh = useCallback(
    async (options?: { force?: boolean }) => {
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
        setSubscribed(hasCoachEntitlement(info));

        const updatedUser = await syncSubscriptionWithServer();
        if (updatedUser) setUser(updatedUser);
        setStatus("ready");
      } catch (error) {
        console.warn("Coach billing refresh failed:", { message: (error as any)?.message, code: (error as any)?.code });
        setStatus((previous) => (previous === "loading" ? "error" : previous));
      } finally {
        inFlightRef.current = false;
      }
    },
    [billingEnabled, setUser, user?.id]
  );

  useEffect(() => {
    void refresh({ force: true });
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
      dialog.alert({
        title: "Could not open the App Store",
        message: "Open Settings, then Apple Account, then Subscriptions to manage it there.",
        tone: "danger",
        icon: "open-in-new",
      });
    }
  };

  const subscribe = async () => {
    if (!user?.id) {
      dialog.alert({ title: "Sign in to subscribe", message: "You need an account so your plan follows you between devices." });
      return;
    }
    if (!offerings) {
      dialog.alert({
        title: "Plans could not be loaded",
        message: "Pull down to refresh and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
      return;
    }

    try {
      setBusy(true);
      await initBilling(user.id);
      await purchaseCoachSubscription(period, offerings);
      // Same reasoning as the player plans screen: the server's own read of RevenueCat can lag a
      // purchase that just succeeded locally by a few seconds, so keep refreshing a few times,
      // a short beat apart, until it actually agrees.
      for (let attempt = 0; attempt < 5; attempt += 1) {
        await refresh({ force: true });
        if (useAuthStore.getState().user?.coach_subscription_active) break;
        if (attempt < 4) await new Promise((resolve) => setTimeout(resolve, 1500));
      }
      dialog.alert({
        title: "You're on the Coach plan",
        message: "Your booking diary is unlocked straight away.",
        tone: "success",
        icon: "check-circle-outline",
      });
    } catch (error: any) {
      if (!error?.userCancelled) {
        dialog.alert({
          title: "Purchase did not go through",
          message: "Nothing has been charged. Try again in a moment.",
          tone: "danger",
          icon: "credit-card-off-outline",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!user?.id) {
      dialog.alert({ title: "Sign in to restore", message: "Purchases are restored to the account you are signed in with." });
      return;
    }

    try {
      setIsRestoring(true);
      await initBilling(user.id);
      await restoreBillingPurchases();
      await refresh({ force: true });
      dialog.alert({
        title: "Purchases restored",
        message: "Any active subscription now applies to this account.",
        tone: "success",
        icon: "restore",
      });
    } catch {
      dialog.alert({
        title: "Could not restore purchases",
        message: "Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
    } finally {
      setIsRestoring(false);
    }
  };

  const monthlyOffer = getCoachOffer("monthly", offerings);
  const annualOffer = getCoachOffer("annual", offerings);
  const offer = period === "monthly" ? monthlyOffer : annualOffer;
  const saving = period === "annual" && monthlyOffer && annualOffer ? annualSaving(monthlyOffer.price, annualOffer.price) : null;
  const priceUnavailable = billingEnabled && status === "ready" && !offer;

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={onPullToRefresh} tintColor={colors.primary} />}
    >
      <View style={[styles.currentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.kicker, { color: colors.textMuted }]}>COACH PLAN</Text>
        <Text style={[styles.currentTier, { color: colors.text }]}>{subscribed ? "Subscribed" : "Not subscribed"}</Text>
        <Text style={[styles.statusLine, { color: colors.textMuted }]}>
          {subscribed
            ? "Your booking diary, clients, groups and session notes are unlocked."
            : "Subscribe to unlock your booking diary, clients, groups and session notes."}
        </Text>
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
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading the plan…</Text>
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

      {status === "loading" ? null : (
        <>
          <View style={[styles.periodToggle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            {(["monthly", "annual"] as const).map((option) => {
              const selected = period === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setPeriod(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Billed ${option}`}
                  style={[styles.periodOption, selected ? { backgroundColor: colors.surface, borderColor: colors.primary } : null]}
                >
                  <Text style={[styles.periodOptionText, { color: selected ? colors.primary : colors.textMuted }]}>
                    {option === "monthly" ? "Monthly" : "Annual"}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={[styles.planCard, { backgroundColor: colors.surface, borderColor: subscribed ? colors.primary : colors.border }]}>
            <View style={styles.planHeader}>
              <View style={styles.planHeaderText}>
                <Text style={[styles.planName, { color: colors.text }]}>Coach</Text>
                <Text style={[styles.planTagline, { color: colors.textMuted }]}>Run your own coaching diary.</Text>
              </View>
              <View style={styles.planPriceBlock}>
                <Text style={[styles.planPrice, { color: colors.text }]}>{offer?.priceText ?? "—"}</Text>
                {offer ? (
                  <Text style={[styles.planPeriod, { color: colors.textMuted }]}>{period === "monthly" ? "per month" : "per year"}</Text>
                ) : null}
              </View>
            </View>

            {saving ? <Text style={[styles.planSaving, { color: colors.primary }]}>Save {saving}% vs paying monthly</Text> : null}

            {subscribed ? (
              <View style={[styles.currentBadge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.currentBadgeText, { color: colors.onPrimary }]}>SUBSCRIBED</Text>
              </View>
            ) : null}

            <View style={styles.featureList}>
              {FEATURES.map((feature) => (
                <View key={feature} style={styles.featureRow}>
                  <MaterialCommunityIcons name="check" size={16} color={colors.primary} />
                  <Text style={[styles.featureText, { color: colors.text }]}>{feature}</Text>
                </View>
              ))}
            </View>

            {priceUnavailable ? (
              <Text style={[styles.planNote, { color: colors.textMuted }]}>Price unavailable right now. Pull down to refresh.</Text>
            ) : null}

            {!subscribed ? (
              <View style={styles.planAction}>
                <AppButton
                  label="Subscribe"
                  variant="primary"
                  loading={busy}
                  disabled={!billingEnabled || !offer || busy}
                  onPress={() => void subscribe()}
                />
              </View>
            ) : null}
          </View>
        </>
      )}

      <View style={styles.footer}>
        <View style={styles.footerAction}>
          <AppButton label="Restore purchases" variant="secondary" loading={isRestoring} onPress={() => void restore()} />
        </View>
        {subscribed ? (
          <View style={styles.footerAction}>
            <AppButton label="Manage subscription" variant="secondary" onPress={() => void openStoreSubscriptions()} />
          </View>
        ) : null}

        <Text style={[styles.smallPrint, { color: colors.textMuted }]}>
          Subscriptions renew through the App Store until cancelled. Cancel any time in your App Store settings.
        </Text>

        <View style={styles.legalRow}>
          <Pressable onPress={() => void Linking.openURL(TERMS_URL)} hitSlop={8} accessibilityRole="link" accessibilityLabel="Read the terms of use">
            <Text style={[styles.legalLink, { color: colors.primary }]}>Terms</Text>
          </Pressable>
          <Text style={[styles.legalDot, { color: colors.textMuted }]}>·</Text>
          <Pressable onPress={() => void Linking.openURL(PRIVACY_URL)} hitSlop={8} accessibilityRole="link" accessibilityLabel="Read the privacy policy">
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
  notice: { flexDirection: "row", gap: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 16 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  loadingBlock: { alignItems: "center", paddingVertical: 24, gap: 8 },
  loadingText: { fontSize: 13 },
  periodToggle: { flexDirection: "row", borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 16 },
  periodOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "transparent",
    paddingVertical: 9,
  },
  periodOptionText: { fontSize: 14, fontWeight: "700" },
  planSaving: { fontSize: 12, fontWeight: "700", marginTop: 10 },
  planCard: { borderRadius: 16, borderWidth: 1, padding: 18, marginBottom: 14 },
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
