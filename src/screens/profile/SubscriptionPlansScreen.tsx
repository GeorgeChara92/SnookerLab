import React, { useEffect, useMemo, useState } from "react";
import { Alert, Animated, Easing, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { SUBSCRIPTION_LIMITS, TIER_LABELS } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import {
  addBillingCustomerInfoListener,
  fetchCurrentOfferings,
  getBillingCustomerInfo,
  getBillingUnavailableReason,
  getTierPriceText,
  initBilling,
  isBillingConfigured,
  isUsingRevenueCatTestKey,
  openNativeSubscriptionSettings,
  presentCustomerCenter,
  purchaseTierMonthly,
  restoreBillingPurchases,
  syncTierToSupabaseUser,
  tierFromCustomerInfo,
} from "../../services/billing";
import type { SubscriptionTier } from "../../types";

type PaidTier = Exclude<SubscriptionTier, "free">;

const tierRank: Record<SubscriptionTier, number> = {
  free: 0,
  half_century: 1,
  century: 2,
};

export const SubscriptionPlansScreen = () => {
  const { colors } = useAppTheme();
  const { user, setUser } = useAuthStore();

  const [offerings, setOfferings] = useState<any>(null);
  const [purchasingTier, setPurchasingTier] = useState<PaidTier | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [openingCustomerCenter, setOpeningCustomerCenter] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const sectionAnims = useMemo(() => Array.from({ length: 5 }, () => new Animated.Value(0)), []);

  const currentTier: SubscriptionTier =
    user?.subscription_tier === "half_century" || user?.subscription_tier === "century" ? user.subscription_tier : "free";

  const billingEnabled = isBillingConfigured();
  const usingTestKey = isUsingRevenueCatTestKey();

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      if (!user?.id || !billingEnabled) return;
      try {
        await initBilling(user.id);
        const nextOfferings = await fetchCurrentOfferings();
        if (mounted) setOfferings(nextOfferings);

        const info = await getBillingCustomerInfo();
        const tier = tierFromCustomerInfo(info);
        const updatedUser = await syncTierToSupabaseUser(tier);
        if (mounted && updatedUser) setUser(updatedUser);
      } catch (error) {
        console.warn("Billing init failed:", {
          message: (error as any)?.message,
          detail: (error as any)?.detail,
          adaptyCode: (error as any)?.adaptyCode,
        });
      }
    };

    void boot();
    return () => {
      mounted = false;
    };
  }, [billingEnabled, setUser, user?.id]);

  useEffect(() => {
    const steps = sectionAnims.map((value) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 360,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      })
    );
    Animated.stagger(70, steps).start();
  }, [sectionAnims]);

  useEffect(() => {
    if (!user?.id || !billingEnabled) return;

    const unsubscribe = addBillingCustomerInfoListener(async (info) => {
      try {
        const tier = tierFromCustomerInfo(info);
        const updatedUser = await syncTierToSupabaseUser(tier);
        if (updatedUser) setUser(updatedUser);
      } catch (error) {
        console.warn("Failed to sync billing listener state:", {
          message: (error as any)?.message,
          detail: (error as any)?.detail,
          adaptyCode: (error as any)?.adaptyCode,
        });
      }
    });

    return unsubscribe;
  }, [billingEnabled, setUser, user?.id]);

  const purchase = async (tier: PaidTier) => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to purchase a subscription.");
      return;
    }
    if (!billingEnabled) {
      Alert.alert("Billing unavailable", getBillingUnavailableReason() ?? "Billing not configured for this build.");
      return;
    }

    try {
      setPurchasingTier(tier);
      await initBilling(user.id);
      const activeOfferings = offerings ?? (await fetchCurrentOfferings());
      setOfferings(activeOfferings);
      const customerInfo = await purchaseTierMonthly(tier, activeOfferings);
      const resolvedTier = tierFromCustomerInfo(customerInfo);
      const updatedUser = await syncTierToSupabaseUser(resolvedTier);
      if (updatedUser) setUser(updatedUser);
      Alert.alert("Subscription updated", `Active plan: ${TIER_LABELS[resolvedTier]}.`);
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert("Purchase failed", typeof error?.message === "string" ? error.message : "Unable to complete purchase.");
      }
    } finally {
      setPurchasingTier(null);
    }
  };

  const chooseTier = async (tier: PaidTier) => {
    if (tier === currentTier) return;

    const isDowngrade = tierRank[tier] < tierRank[currentTier];
    if (isDowngrade) {
      Alert.alert(
        "Manage downgrade in Store Subscriptions",
        "Downgrades and cancellations are managed in App Store/Play subscriptions and usually take effect at your next renewal.",
        [
          { text: "Not now", style: "cancel" },
          {
            text: "Open Store Subscriptions",
            onPress: () => {
              void openCustomerCenter();
            },
          },
        ]
      );
      return;
    }

    await purchase(tier);
  };

  const restore = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to restore purchases.");
      return;
    }
    if (!billingEnabled) {
      Alert.alert("Billing unavailable", getBillingUnavailableReason() ?? "Billing not configured for this build.");
      return;
    }

    try {
      setRestoring(true);
      await initBilling(user.id);
      const customerInfo = await restoreBillingPurchases();
      const resolvedTier = tierFromCustomerInfo(customerInfo);
      const updatedUser = await syncTierToSupabaseUser(resolvedTier);
      if (updatedUser) setUser(updatedUser);
      Alert.alert("Restore complete", `Active plan: ${TIER_LABELS[resolvedTier]}.`);
    } catch (error: any) {
      Alert.alert("Restore failed", typeof error?.message === "string" ? error.message : "Could not restore purchases.");
    } finally {
      setRestoring(false);
    }
  };

  const openCustomerCenter = async () => {
    if (!billingEnabled) {
      Alert.alert("Billing unavailable", getBillingUnavailableReason() ?? "Billing not configured for this build.");
      return;
    }

    try {
      setOpeningCustomerCenter(true);
      await presentCustomerCenter();
    } catch (error: any) {
      Alert.alert(
        "Subscription settings unavailable",
        typeof error?.message === "string" ? error.message : "Could not open subscription settings.",
        [
          { text: "Close", style: "cancel" },
          {
            text: "Open Store Subscriptions",
            onPress: () => {
              void openNativeSubscriptionSettings().catch(() => {
                Alert.alert("Unavailable", "Could not open store subscription settings.");
              });
            },
          },
        ]
      );
    } finally {
      setOpeningCustomerCenter(false);
    }
  };

  const refreshTierFromBilling = async () => {
    if (!user?.id) return;
    try {
      setRefreshing(true);
      await initBilling(user.id);
      const info = await getBillingCustomerInfo();
      const resolvedTier = tierFromCustomerInfo(info);
      const updatedUser = await syncTierToSupabaseUser(resolvedTier);
      if (updatedUser) setUser(updatedUser);
      Alert.alert("Plan updated", `Current plan: ${TIER_LABELS[resolvedTier]}.`);
    } catch (error: any) {
      Alert.alert("Refresh failed", typeof error?.message === "string" ? error.message : "Could not refresh plan status.");
    } finally {
      setRefreshing(false);
    }
  };

  const cycleLine = useMemo(() => {
    if (!user?.subscription_anchor_date) return "Usage resets every month.";
    const date = new Date(user.subscription_anchor_date);
    return `Usage resets monthly from ${date.toLocaleDateString()}`;
  }, [user?.subscription_anchor_date]);

  const freeLimits = SUBSCRIPTION_LIMITS.free;
  const halfLimits = SUBSCRIPTION_LIMITS.half_century;
  const centuryLimits = SUBSCRIPTION_LIMITS.century;

  const halfPriceText = getTierPriceText("half_century", offerings);
  const centuryPriceText = getTierPriceText("century", offerings);

  const renderPlanTag = (tier: SubscriptionTier) => {
    if (tier === currentTier) return "Current";
    if (tier === "century") return "Best Value";
    return null;
  };

  const renderFeature = (label: string, muted = false) => (
    <View style={styles.featureRow}>
      <MaterialCommunityIcons name="check-circle" size={16} color={muted ? colors.textMuted : colors.primary} />
      <Text style={[styles.featureText, { color: muted ? colors.textMuted : colors.text }]}>{label}</Text>
    </View>
  );

  const motion = (index: number) => ({
    opacity: sectionAnims[index],
    transform: [
      {
        translateY: sectionAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [12, 0],
        }),
      },
    ],
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Animated.View style={motion(0)}>
      <View style={[styles.heroShell, { backgroundColor: colors.primaryStrong }]}> 
        <View style={styles.heroGlowA} />
        <View style={styles.heroGlowB} />
        <Text style={[styles.kicker, { color: "#BDE6D7" }]}>SNOOKERLAB PRO</Text>
        <Text style={[styles.heroTitle, { color: "#FFFFFF" }]}>Choose your plan</Text>
        <Text style={[styles.heroBody, { color: "#D5EFE6" }]}>Unlock coaching depth, higher usage limits, and a smoother training workflow.</Text>
        <View style={styles.statRow}>
          <View style={[styles.statBadge, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)" }]}> 
            <Text style={[styles.statLabel, { color: "#D5EFE6" }]}>Current</Text>
            <Text style={[styles.statValue, { color: "#FFFFFF" }]}>{TIER_LABELS[currentTier]}</Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.18)" }]}> 
            <Text style={[styles.statLabel, { color: "#D5EFE6" }]}>AI Left</Text>
            <Text style={[styles.statValue, { color: "#FFFFFF" }]}>{currentTier === "free" ? freeLimits.aiAnalysesPerPeriod : currentTier === "half_century" ? halfLimits.aiAnalysesPerPeriod : centuryLimits.aiAnalysesPerPeriod}</Text>
          </View>
        </View>
        <Text style={[styles.cycleLine, { color: "#D5EFE6" }]}>{cycleLine}</Text>
      </View>
      </Animated.View>

      <Animated.View style={motion(1)}>
      <AppCard style={styles.planCard}>
        <View style={styles.planHeadRow}>
          <Text style={[styles.planTitle, { color: colors.text }]}>Free</Text>
          {renderPlanTag("free") ? (
            <View style={[styles.planTag, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.planTagText, { color: colors.primary }]}>{renderPlanTag("free")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.priceLine, { color: colors.textMuted }]}>$0 forever</Text>
        {renderFeature(`Matches: ${freeLimits.matchesPerPeriod} / month`, true)}
        {renderFeature(`Tournaments: ${freeLimits.tournamentsPerPeriod} / month`, true)}
        {renderFeature(`AI analyses: ${freeLimits.aiAnalysesPerPeriod} / month`, true)}
      </AppCard>
      </Animated.View>

      <Animated.View style={motion(2)}>
      <AppCard style={[styles.planCard, styles.highlightCard, { borderColor: colors.primary }]}> 
        <View style={styles.planHeadRow}>
          <Text style={[styles.planTitle, { color: colors.primary }]}>Half-Century</Text>
          {renderPlanTag("half_century") ? (
            <View style={[styles.planTag, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.planTagText, { color: colors.primary }]}>{renderPlanTag("half_century")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.priceLine, { color: colors.text }]}>{halfPriceText ? `${halfPriceText} / month` : "Monthly"}</Text>
        <Text style={[styles.planPitch, { color: colors.textMuted }]}>For regular players who want frequent AI check-ins.</Text>
        {renderFeature(`Matches: ${halfLimits.matchesPerPeriod ?? "Unlimited"}${halfLimits.matchesPerPeriod ? " / month" : ""}`)}
        {renderFeature(`Tournaments: ${halfLimits.tournamentsPerPeriod ?? "Unlimited"}${halfLimits.tournamentsPerPeriod ? " / month" : ""}`)}
        {renderFeature(`AI analyses: ${halfLimits.aiAnalysesPerPeriod} / month`)}
        <View style={styles.ctaWrap}>
          <AppButton
            label={currentTier === "half_century" ? "Current Plan" : "Choose Half-Century"}
            onPress={() => {
              void chooseTier("half_century");
            }}
            disabled={currentTier === "half_century"}
            loading={purchasingTier === "half_century"}
          />
        </View>
      </AppCard>
      </Animated.View>

      <Animated.View style={motion(3)}>
      <AppCard style={[styles.planCard, styles.featuredCentury, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}> 
        <View style={styles.centuryGlowLeft} />
        <View style={styles.centuryGlowRight} />
        <View style={styles.planHeadRow}>
          <Text style={[styles.planTitle, { color: colors.primary }]}>Century</Text>
          {renderPlanTag("century") ? (
            <View style={[styles.planTag, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.planTagText, { color: colors.primary }]}>{renderPlanTag("century")}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.priceLine, { color: colors.text }]}>{centuryPriceText ? `${centuryPriceText} / month` : "Monthly"}</Text>
        <Text style={[styles.planPitch, { color: colors.textMuted }]}>For committed players who want full tracking freedom and top AI volume.</Text>
        {renderFeature(`Matches: ${centuryLimits.matchesPerPeriod ?? "Unlimited"}`)}
        {renderFeature(`Tournaments: ${centuryLimits.tournamentsPerPeriod ?? "Unlimited"}`)}
        {renderFeature(`AI analyses: ${centuryLimits.aiAnalysesPerPeriod} / month`)}
        <View style={styles.ctaWrap}>
          <AppButton
            label={currentTier === "century" ? "Current Plan" : "Choose Century"}
            onPress={() => {
              void chooseTier("century");
            }}
            disabled={currentTier === "century"}
            loading={purchasingTier === "century"}
          />
        </View>
      </AppCard>
      </Animated.View>

      <Animated.View style={motion(4)}>
      <AppCard style={styles.supportCard}>
        <Text style={[styles.supportTitle, { color: colors.text }]}>Manage Subscription</Text>
        <Text style={[styles.supportBody, { color: colors.textMuted }]}>Cancel or downgrade in your App Store/Play subscriptions. Upgrades apply immediately; downgrades usually apply at next renewal. All limits are measured per month.</Text>
        {usingTestKey ? (
          <Text style={[styles.testKeyHint, { color: colors.danger }]}>This build is using a non-live Adapty key. Purchase flow may be test/sandbox only.</Text>
        ) : null}
        <View style={styles.supportActions}>
          <View style={styles.supportActionItem}>
            <AppButton label="Restore" variant="secondary" onPress={restore} loading={restoring} />
          </View>
          <View style={styles.supportActionItem}>
            <AppButton label="Store Subscriptions" variant="secondary" onPress={openCustomerCenter} loading={openingCustomerCenter} />
          </View>
        </View>
        <View style={styles.supportActions}>
          <View style={styles.supportActionItem}>
            <AppButton label="Refresh Plan Status" variant="secondary" onPress={refreshTierFromBilling} loading={refreshing} />
          </View>
        </View>
      </AppCard>
      </Animated.View>

      {!billingEnabled ? (
        <Text style={[styles.warn, { color: colors.danger }]}>{getBillingUnavailableReason() ?? "Billing unavailable in this build."}</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 30 },
  heroShell: {
    borderRadius: 20,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroGlowA: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
    top: -70,
    right: -40,
  },
  heroGlowB: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -60,
    left: -30,
  },
  kicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8 },
  heroTitle: { marginTop: 6, fontSize: 30, fontWeight: "800", lineHeight: 36 },
  heroBody: { marginTop: 8, fontSize: 13, lineHeight: 19, maxWidth: "90%" },
  statRow: { marginTop: 12, flexDirection: "row", gap: 8 },
  statBadge: { flex: 1, borderWidth: 1, borderRadius: 12, padding: 10 },
  statLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  statValue: { marginTop: 4, fontSize: 17, fontWeight: "800" },
  cycleLine: { marginTop: 8, fontSize: 12 },
  planCard: { marginBottom: 10, borderRadius: 16 },
  highlightCard: { borderWidth: 1 },
  featuredCentury: { borderWidth: 1, overflow: "hidden" },
  centuryGlowLeft: {
    position: "absolute",
    top: -18,
    left: -8,
    width: 68,
    height: 68,
    borderRadius: 999,
    backgroundColor: "rgba(15,90,67,0.08)",
  },
  centuryGlowRight: {
    position: "absolute",
    bottom: -28,
    right: -12,
    width: 84,
    height: 84,
    borderRadius: 999,
    backgroundColor: "rgba(15,90,67,0.10)",
  },
  planHeadRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  planTitle: { fontSize: 19, fontWeight: "800" },
  planTag: { borderWidth: 1, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 8 },
  planTagText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" },
  priceLine: { marginTop: 6, fontSize: 16, fontWeight: "800" },
  planPitch: { marginTop: 6, fontSize: 12, lineHeight: 16 },
  featureRow: { marginTop: 6, flexDirection: "row", alignItems: "center", gap: 8 },
  featureText: { fontSize: 12, lineHeight: 17 },
  ctaWrap: { marginTop: 10 },
  supportCard: { marginTop: 2 },
  supportTitle: { fontSize: 16, fontWeight: "800" },
  supportBody: { marginTop: 6, fontSize: 12, lineHeight: 17 },
  testKeyHint: { marginTop: 8, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  supportActions: { marginTop: 10, flexDirection: "row", gap: 8 },
  supportActionItem: { flex: 1 },
  warn: { marginTop: 12, fontSize: 12, lineHeight: 16, fontWeight: "700" },
});
