import React, { useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { AppCard } from "../../components/ui/AppCard";
import { AppButton } from "../../components/ui/AppButton";
import { SUBSCRIPTION_LIMITS, TIER_LABELS } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import {
  addBillingCustomerInfoListener,
  fetchCurrentOfferings,
  getBillingUnavailableReason,
  getBillingCustomerInfo,
  hasProEntitlement,
  initBilling,
  isBillingConfigured,
  presentCustomerCenter,
  presentProPaywall,
  purchaseProMonthly,
  restoreBillingPurchases,
  syncTierToSupabaseUser,
  tierFromCustomerInfo,
} from "../../services/billing";
import type { SubscriptionTier } from "../../types";

export const SubscriptionPlansScreen = () => {
  const { colors } = useAppTheme();
  const { user, setUser } = useAuthStore();
  const [purchasing, setPurchasing] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [openingPaywall, setOpeningPaywall] = useState(false);
  const [openingCustomerCenter, setOpeningCustomerCenter] = useState(false);
  const [offerings, setOfferings] = useState<any>(null);

  const currentTier: SubscriptionTier =
    user?.subscription_tier === "half_century" || user?.subscription_tier === "century" ? user.subscription_tier : "free";

  const billingEnabled = isBillingConfigured();

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
        console.warn("Billing init failed:", error);
      }
    };

    void boot();
    return () => {
      mounted = false;
    };
  }, [billingEnabled, setUser, user?.id]);

  useEffect(() => {
    if (!user?.id || !billingEnabled) return;

    const unsubscribe = addBillingCustomerInfoListener(async (info) => {
      try {
        const tier = tierFromCustomerInfo(info);
        const updatedUser = await syncTierToSupabaseUser(tier);
        if (updatedUser) setUser(updatedUser);
      } catch (error) {
        console.warn("Failed to sync RevenueCat listener state:", error);
      }
    });

    return unsubscribe;
  }, [billingEnabled, setUser, user?.id]);

  const purchase = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to purchase a subscription.");
      return;
    }

    if (!billingEnabled) {
      Alert.alert("Billing not configured", "RevenueCat keys are missing for this build.");
      return;
    }

    try {
      setPurchasing(true);
      await initBilling(user.id);
      const activeOfferings = offerings ?? (await fetchCurrentOfferings());
      setOfferings(activeOfferings);
      const customerInfo = await purchaseProMonthly(activeOfferings);
      const resolvedTier = tierFromCustomerInfo(customerInfo);
      const updatedUser = await syncTierToSupabaseUser(resolvedTier);
      if (updatedUser) setUser(updatedUser);
      Alert.alert("Subscription updated", hasProEntitlement(customerInfo) ? "SnookerLab Pro is active." : "Subscription updated.");
    } catch (error: any) {
      const isCancelled = !!error?.userCancelled;
      if (!isCancelled) {
        Alert.alert("Purchase failed", typeof error?.message === "string" ? error.message : "Unable to complete purchase.");
      }
    } finally {
      setPurchasing(false);
    }
  };

  const restore = async () => {
    if (!user?.id) {
      Alert.alert("Sign in required", "Please sign in to restore purchases.");
      return;
    }

    if (!billingEnabled) {
      Alert.alert("Billing not configured", "RevenueCat keys are missing for this build.");
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

  const openPaywall = async () => {
    if (!billingEnabled) {
      Alert.alert("Billing not configured", "RevenueCat keys are missing for this build.");
      return;
    }

    try {
      setOpeningPaywall(true);
      await presentProPaywall();
      const info = await getBillingCustomerInfo();
      const resolvedTier = tierFromCustomerInfo(info);
      const updatedUser = await syncTierToSupabaseUser(resolvedTier);
      if (updatedUser) setUser(updatedUser);
    } catch (error: any) {
      Alert.alert("Paywall failed", typeof error?.message === "string" ? error.message : "Could not open paywall.");
    } finally {
      setOpeningPaywall(false);
    }
  };

  const openCustomerCenter = async () => {
    if (!billingEnabled) {
      Alert.alert("Billing not configured", "RevenueCat keys are missing for this build.");
      return;
    }

    try {
      setOpeningCustomerCenter(true);
      await presentCustomerCenter();
    } catch (error: any) {
      Alert.alert("Customer Center unavailable", typeof error?.message === "string" ? error.message : "Could not open Customer Center.");
    } finally {
      setOpeningCustomerCenter(false);
    }
  };

  const cycleLine = useMemo(() => {
    if (!user?.subscription_anchor_date) return "Cycle resets monthly.";
    const date = new Date(user.subscription_anchor_date);
    return `Cycle anchor: ${date.toLocaleDateString()}`;
  }, [user?.subscription_anchor_date]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Choose Your Plan</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Current plan: {TIER_LABELS[currentTier]} · {cycleLine}</Text>

      {(["free", "half_century", "century"] as SubscriptionTier[]).map((tier) => {
        const limits = SUBSCRIPTION_LIMITS[tier];
        const isCurrent = tier === currentTier;

        return (
          <AppCard key={tier} style={styles.card}>
            <View style={styles.headerRow}>
              <Text style={[styles.planName, { color: colors.text }]}>{TIER_LABELS[tier]}</Text>
              {isCurrent ? <Text style={[styles.current, { color: colors.primary }]}>Current</Text> : null}
            </View>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Matches: {limits.matchesPerPeriod ?? "Unlimited"} / cycle</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Tournaments: {limits.tournamentsPerPeriod ?? "Unlimited"} / cycle</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>AI Analyses: {limits.aiAnalysesPerPeriod ?? "Unlimited"} / cycle</Text>

            {tier === "century" ? (
              <View style={styles.ctaWrap}>
                <AppButton
                  label={isCurrent ? "SnookerLab Pro Active" : "Subscribe Monthly (Pro)"}
                  onPress={purchase}
                  disabled={isCurrent}
                  loading={purchasing}
                />
              </View>
            ) : tier === "half_century" ? (
              <Text style={[styles.comingSoon, { color: colors.textMuted }]}>Manual/legacy tier. RevenueCat purchase currently maps to Pro.</Text>
            ) : null}
          </AppCard>
        );
      })}

      <View style={styles.rowButtons}>
        <View style={styles.rowButtonItem}>
          <AppButton label="Open Paywall" variant="secondary" onPress={openPaywall} loading={openingPaywall} />
        </View>
        <View style={styles.rowButtonItem}>
          <AppButton label="Customer Center" variant="secondary" onPress={openCustomerCenter} loading={openingCustomerCenter} />
        </View>
      </View>

      <AppButton label="Restore Purchases" variant="secondary" onPress={restore} loading={restoring} />
      {!billingEnabled ? (
        <Text style={[styles.warn, { color: colors.danger }]}>{getBillingUnavailableReason() ?? "Billing unavailable in this build."}</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 13, lineHeight: 18 },
  card: { marginBottom: 12 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  planName: { fontSize: 19, fontWeight: "800" },
  current: { fontSize: 12, fontWeight: "800" },
  meta: { fontSize: 13, lineHeight: 18 },
  ctaWrap: { marginTop: 10 },
  rowButtons: { marginTop: 6, marginBottom: 10, flexDirection: "row", gap: 8 },
  rowButtonItem: { flex: 1 },
  comingSoon: { marginTop: 10, fontSize: 12, fontWeight: "600" },
  warn: { marginTop: 12, fontSize: 12, lineHeight: 16, fontWeight: "700" },
});
