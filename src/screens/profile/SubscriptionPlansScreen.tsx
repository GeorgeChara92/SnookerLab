import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, AppState, Dimensions, Easing, Linking, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
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
  getTierPriceText,
  initBilling,
  isBillingConfigured,
  isUsingRevenueCatTestKey,
  openNativeSubscriptionSettings,
  presentCustomerCenter,
  purchaseTierMonthly,
  resolveTierFromPurchaseResult,
  restoreBillingPurchases,
  subscriptionStateFromCustomerInfo,
  syncSubscriptionWithServer,
  tierFromCustomerInfo,
  type BillingSubscriptionState,
} from "../../services/billing";
import type { SubscriptionTier } from "../../types";

const formatRenewalDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

type PaidTier = Exclude<SubscriptionTier, "free">;

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snooker-lab.vercel.app/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snooker-lab.vercel.app/terms";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const tierRank: Record<SubscriptionTier, number> = {
  free: 0,
  half_century: 1,
  century: 2,
};

const ValueProp = ({
  icon,
  title,
  description,
  colors,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  title: string;
  description: string;
  colors: any;
}) => (
  <View style={styles.valueProp}>
    <View style={[styles.valueIcon, { backgroundColor: colors.primary + "15" }]}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
    </View>
    <View style={styles.valueContent}>
      <Text style={[styles.valueTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.valueDesc, { color: colors.textMuted }]}>{description}</Text>
    </View>
  </View>
);

const PlanCard = ({
  tier,
  label,
  price,
  features,
  isCurrent,
  isRecommended,
  isDowngrade,
  onSelect,
  loading,
  colors,
}: {
  tier: SubscriptionTier;
  label: string;
  price: string;
  features: string[];
  isCurrent: boolean;
  isRecommended?: boolean;
  isDowngrade: boolean;
  onSelect: () => void;
  loading: boolean;
  colors: any;
}) => (
  <Pressable
    onPress={onSelect}
    style={[
      styles.planCard,
      {
        backgroundColor: colors.surface,
        borderColor: isRecommended ? colors.primary : colors.border,
        borderWidth: isRecommended ? 2 : 1,
        transform: [{ scale: isRecommended ? 1 : 0.98 }],
      },
    ]}
  >
    {isRecommended && (
      <View style={[styles.recommendedTag, { backgroundColor: colors.primary }]}>
        <Text style={[styles.recommendedTagText, { color: colors.onPrimary }]}>MOST POPULAR</Text>
      </View>
    )}
    <View style={styles.planHeader}>
      <Text style={[styles.planName, { color: isRecommended ? colors.primary : colors.text }]}>{label}</Text>
      {isCurrent && (
        <View style={[styles.currentBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
          <Text style={[styles.currentBadgeText, { color: colors.primary }]}>CURRENT</Text>
        </View>
      )}
    </View>
    <View style={styles.planPriceRow}>
      <Text style={[styles.planPrice, { color: colors.text }]}>{price}</Text>
      {price !== "$0" && <Text style={[styles.planPerMonth, { color: colors.textMuted }]}>/month</Text>}
    </View>
    <View style={styles.planFeatures}>
      {features.map((feature, i) => (
        <View key={i} style={styles.featureRow}>
          <MaterialCommunityIcons
            name={tier === "free" ? "circle-outline" : "check-circle"}
            size={16}
            color={tier === "free" ? colors.textMuted : colors.primary}
          />
          <Text style={[styles.featureText, { color: tier === "free" ? colors.textMuted : colors.text }]}>{feature}</Text>
        </View>
      ))}
    </View>
    {!isCurrent && (
      <AppButton
        label={isDowngrade ? "Downgrade" : `Upgrade to ${label}`}
        variant={isRecommended ? "primary" : "secondary"}
        onPress={onSelect}
        loading={loading}
        disabled={loading}
      />
    )}
  </Pressable>
);

export const SubscriptionPlansScreen = () => {
  const { colors } = useAppTheme();
  const { user, setUser } = useAuthStore();
  const subscription = useSubscriptionAccess();

  const [offerings, setOfferings] = useState<any>(null);
  const [purchasingTier, setPurchasingTier] = useState<PaidTier | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [billingState, setBillingState] = useState<BillingSubscriptionState | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const lastNotifiedRef = useRef<string | null>(null);

  // The server's tier is what actually unlocks features, so that is what the page shows.
  const currentTier: SubscriptionTier =
    user?.subscription_tier === "half_century" || user?.subscription_tier === "century" ? user.subscription_tier : "free";

  const billingEnabled = isBillingConfigured();
  const usingTestKey = isUsingRevenueCatTestKey();

  const fadeInAnims = useMemo(() => Array.from({ length: 5 }, () => new Animated.Value(0)), []);

  /**
   * Re-reads the store, asks the server to verify it, and tells the user when something
   * changed. Runs on focus and whenever the app comes back to the foreground, so returning
   * from the App Store subscription sheet updates the page instead of leaving it stale.
   */
  const refreshBilling = useCallback(
    async (options?: { withOfferings?: boolean; announce?: boolean }) => {
      if (!user?.id || !billingEnabled) return;

      try {
        setIsRefreshing(true);
        await initBilling(user.id);

        if (options?.withOfferings) {
          setOfferings(await fetchCurrentOfferings());
        }

        const info = await getBillingCustomerInfo();
        const state = subscriptionStateFromCustomerInfo(info);
        setBillingState(state);

        const updatedUser = await syncSubscriptionWithServer();
        if (updatedUser) setUser(updatedUser);

        if (options?.announce !== false) {
          const signature = `${state.tier}:${state.willRenew}:${state.expiresAt ?? ""}`;
          if (lastNotifiedRef.current && lastNotifiedRef.current !== signature) {
            const endsOn = formatRenewalDate(state.expiresAt);
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
          lastNotifiedRef.current = signature;
        }
      } catch (error) {
        console.warn("Billing refresh failed:", {
          message: (error as any)?.message,
          detail: (error as any)?.detail,
          code: (error as any)?.code,
        });
      } finally {
        setIsRefreshing(false);
      }
    },
    [billingEnabled, setUser, user?.id]
  );

  useEffect(() => {
    void refreshBilling({ withOfferings: true, announce: false });
  }, [refreshBilling]);

  // Coming back from the store's subscription sheet lands here.
  useFocusEffect(
    useCallback(() => {
      void refreshBilling();
    }, [refreshBilling])
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") void refreshBilling();
    });
    return () => subscription.remove();
  }, [refreshBilling]);

  useEffect(() => {
    Animated.stagger(
      80,
      fadeInAnims.map((anim) =>
        Animated.timing(anim, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        })
      )
    ).start();
  }, [fadeInAnims]);

  useEffect(() => {
    if (!user?.id || !billingEnabled) return;

    const unsubscribe = addBillingCustomerInfoListener(() => {
      void refreshBilling();
    });

    return unsubscribe;
  }, [billingEnabled, refreshBilling, user?.id]);

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
      const purchaseResult = await purchaseTierMonthly(tier, activeOfferings);
      const resolvedTier = resolveTierFromPurchaseResult(purchaseResult, tier);
      await refreshBilling({ announce: false });
      Alert.alert("Welcome to Pro!", `You're now on the ${TIER_LABELS[resolvedTier]} plan.`);
    } catch (error: any) {
      if (!error?.userCancelled) {
        Alert.alert("Purchase failed", typeof error?.message === "string" ? error.message : "Unable to complete purchase.");
      }
    } finally {
      setPurchasingTier(null);
    }
  };

  const promptStoreDowngrade = (targetLabel: string) => {
    Alert.alert(
      `Switch to ${targetLabel}`,
      "Downgrades and cancellations are handled in your App Store subscriptions, and take effect at the end of the period you've paid for. Your current plan stays active until then.",
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
  };

  const chooseTier = async (tier: PaidTier) => {
    if (tier === currentTier) return;

    if (tierRank[tier] < tierRank[currentTier]) {
      promptStoreDowngrade(TIER_LABELS[tier]);
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
      await refreshBilling({ announce: false });
      Alert.alert("Purchases restored", `Active plan: ${TIER_LABELS[resolvedTier]}.`);
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
    }
  };

  const freeLimits = SUBSCRIPTION_LIMITS.free;
  const halfLimits = SUBSCRIPTION_LIMITS.half_century;
  const centuryLimits = SUBSCRIPTION_LIMITS.century;

  const halfPriceText = getTierPriceText("half_century", offerings);
  const centuryPriceText = getTierPriceText("century", offerings);

  const matchesUsed = subscription.usage.matches;
  const matchesLimit = subscription.limits.matchesPerPeriod;
  const aiUsed = subscription.usage.aiAnalyses;
  const aiLimit = subscription.limits.aiAnalysesPerPeriod;

  const renewalDateText = formatRenewalDate(billingState?.expiresAt ?? null);
  const planStatusText = (() => {
    if (currentTier === "free") return "You're on the Free plan.";
    const label = TIER_LABELS[currentTier];
    if (billingState && !billingState.willRenew) {
      return renewalDateText
        ? `${label} · cancelled, active until ${renewalDateText}`
        : `${label} · cancelled, active until the end of this period`;
    }
    return renewalDateText ? `${label} · renews on ${renewalDateText}` : `${label} · active`;
  })();

  const animStyle = (index: number) => ({
    opacity: fadeInAnims[index],
    transform: [
      {
        translateY: fadeInAnims[index].interpolate({
          inputRange: [0, 1],
          outputRange: [20, 0],
        }),
      },
    ],
  });

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      {/* Hero Section */}
      <Animated.View style={[styles.heroSection, animStyle(0)]}>
        <View style={[styles.heroGradient, { backgroundColor: colors.primaryStrong }]}>
          <View style={styles.heroGlow1} />
          <View style={styles.heroGlow2} />
          <Text style={styles.heroKicker}>SNOOKERLAB PRO</Text>
          <Text style={styles.heroTitle}>Take your game further</Text>
          <Text style={styles.heroSubtitle}>AI coaching, advanced stats, and structured practice tools designed for serious players.</Text>
        </View>
      </Animated.View>

      {/* Usage Context - Show if on free and hitting limits */}
      {currentTier === "free" && (
        <Animated.View style={[styles.usageCard, { backgroundColor: colors.surface, borderColor: colors.border }, animStyle(1)]}>
          <View style={styles.usageHeader}>
            <MaterialCommunityIcons name="chart-arc" size={20} color={colors.primary} />
            <Text style={[styles.usageTitle, { color: colors.text }]}>Your Usage This Month</Text>
          </View>
          <View style={styles.usageStats}>
            <View style={styles.usageStat}>
              <Text style={[styles.usageLabel, { color: colors.textMuted }]}>Matches</Text>
              <Text style={[styles.usageValue, { color: colors.text }]}>
                {matchesUsed} / {matchesLimit ?? "∞"}
              </Text>
              {matchesLimit && (
                <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.usageBarFill,
                      {
                        backgroundColor: matchesUsed / matchesLimit > 0.8 ? colors.danger : colors.primary,
                        width: `${Math.min(100, (matchesUsed / matchesLimit) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
            <View style={styles.usageStat}>
              <Text style={[styles.usageLabel, { color: colors.textMuted }]}>AI Analyses</Text>
              <Text style={[styles.usageValue, { color: colors.text }]}>
                {aiUsed} / {aiLimit ?? "∞"}
              </Text>
              {aiLimit && (
                <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.usageBarFill,
                      {
                        backgroundColor: aiUsed / aiLimit > 0.8 ? colors.danger : colors.primary,
                        width: `${Math.min(100, (aiUsed / aiLimit) * 100)}%`,
                      },
                    ]}
                  />
                </View>
              )}
            </View>
          </View>
          {(matchesLimit && matchesUsed >= matchesLimit) || (aiLimit && aiUsed >= aiLimit) ? (
            <Text style={[styles.usageWarning, { color: colors.danger }]}>You've reached your limit. Upgrade to continue.</Text>
          ) : (
            <Text style={[styles.usageHint, { color: colors.textMuted }]}>Upgrade for unlimited access</Text>
          )}
        </Animated.View>
      )}

      {/* Value Propositions */}
      <Animated.View style={[styles.valueSection, animStyle(2)]}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>WHY UPGRADE?</Text>
        <ValueProp
          icon="brain"
          title="AI Coach Feedback"
          description="Get personalized analysis on your technique and shot selection"
          colors={colors}
        />
        <ValueProp
          icon="chart-line-variant"
          title="Advanced Performance Tracking"
          description="Track your progress across sessions, matches, and routines"
          colors={colors}
        />
        <ValueProp
          icon="target"
          title="Smart Practice Builder"
          description="Get routines tailored to your weaknesses and goals"
          colors={colors}
        />
        <ValueProp
          icon="trophy"
          title="Competitive Insights"
          description="Understand your match performance and identify trends"
          colors={colors}
        />
      </Animated.View>

      {/* Plan Cards */}
      <Animated.View style={animStyle(3)}>
        <Text style={[styles.sectionTitle, { color: colors.textMuted, marginBottom: 12 }]}>CHOOSE YOUR PLAN</Text>

        {planStatusText ? (
          <Text style={[styles.planStatusText, { color: colors.textMuted }]}>
            {planStatusText}
            {isRefreshing ? " · checking…" : ""}
          </Text>
        ) : null}

        {/* Free Plan */}
        <PlanCard
          tier="free"
          label="Free"
          price="$0"
          features={[`${freeLimits.matchesPerPeriod} matches/month`, `${freeLimits.aiAnalysesPerPeriod} AI analysis/month`, "Basic stats"]}
          isCurrent={currentTier === "free"}
          isDowngrade={currentTier !== "free"}
          onSelect={() => {
            if (currentTier !== "free") promptStoreDowngrade("Free");
          }}
          loading={false}
          colors={colors}
        />

        {/* Half-Century Plan */}
        <View style={styles.planSpacer} />
        <PlanCard
          tier="half_century"
          label="Half-Century"
          price={halfPriceText ?? "$4.99"}
          features={[
            `${halfLimits.matchesPerPeriod ?? "Unlimited"} matches`,
            `${halfLimits.aiAnalysesPerPeriod} AI analyses`,
            "Advanced stats",
            "Priority support",
          ]}
          isCurrent={currentTier === "half_century"}
          isRecommended={currentTier === "free"}
          isDowngrade={tierRank.half_century < tierRank[currentTier]}
          onSelect={() => void chooseTier("half_century")}
          loading={purchasingTier === "half_century"}
          colors={colors}
        />

        {/* Century Plan */}
        <View style={styles.planSpacer} />
        <PlanCard
          tier="century"
          label="Century"
          price={centuryPriceText ?? "$9.99"}
          features={["Unlimited matches", `${centuryLimits.aiAnalysesPerPeriod} AI analyses`, "Full analytics suite", "Early access to features"]}
          isCurrent={currentTier === "century"}
          isDowngrade={tierRank.century < tierRank[currentTier]}
          onSelect={() => void chooseTier("century")}
          loading={purchasingTier === "century"}
          colors={colors}
        />
      </Animated.View>

      {/* Trust & Terms */}
      <Animated.View style={[styles.trustSection, animStyle(4)]}>
        <View style={styles.trustRow}>
          <MaterialCommunityIcons name="shield-check" size={16} color={colors.textMuted} />
          <Text style={[styles.trustText, { color: colors.textMuted }]}>Secure payment via App Store</Text>
        </View>
        <View style={styles.trustRow}>
          <MaterialCommunityIcons name="close-circle-outline" size={16} color={colors.textMuted} />
          <Text style={[styles.trustText, { color: colors.textMuted }]}>Cancel anytime</Text>
        </View>
        <View style={styles.trustRow}>
          <MaterialCommunityIcons name="refresh" size={16} color={colors.textMuted} />
          <Text style={[styles.trustText, { color: colors.textMuted }]}>Restore purchases available</Text>
        </View>

        <View style={styles.actionRow}>
          <Pressable onPress={restore} style={styles.actionLink}>
            <Text style={[styles.actionLinkText, { color: colors.primary }]}>Restore Purchases</Text>
          </Pressable>
          <Text style={[styles.actionDot, { color: colors.textMuted }]}>·</Text>
          <Pressable onPress={openCustomerCenter} style={styles.actionLink}>
            <Text style={[styles.actionLinkText, { color: colors.primary }]}>Manage Subscription</Text>
          </Pressable>
        </View>

        <View style={styles.termsRow}>
          <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(PRIVACY_URL).catch(() => {})}>
            Privacy Policy
          </Text>
          <Text style={[styles.termsDot, { color: colors.textMuted }]}> · </Text>
          <Text style={[styles.termsLink, { color: colors.primary }]} onPress={() => Linking.openURL(TERMS_URL).catch(() => {})}>
            Terms of Use
          </Text>
        </View>
      </Animated.View>

      {usingTestKey && (
        <Text style={[styles.testKeyWarning, { color: colors.danger }]}>
          This build is using a non-standard RevenueCat API key for this platform.
        </Text>
      )}

      {!billingEnabled && (
        <Text style={[styles.billingWarning, { color: colors.danger }]}>
          {getBillingUnavailableReason() ?? "Billing unavailable in this build."}
        </Text>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  // Hero
  heroSection: { marginBottom: 20 },
  heroGradient: {
    borderRadius: 24,
    padding: 24,
    overflow: "hidden",
  },
  heroGlow1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.1)",
    top: -60,
    right: -40,
  },
  heroGlow2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.08)",
    bottom: -50,
    left: -30,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    color: "#BDE6D7",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: "#D5EFE6",
    lineHeight: 22,
  },

  // Usage Card
  usageCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  usageTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  usageStats: {
    flexDirection: "row",
    gap: 20,
  },
  usageStat: {
    flex: 1,
  },
  usageLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  usageValue: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 6,
  },
  usageBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  usageWarning: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
    textAlign: "center",
  },
  usageHint: {
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },

  // Value Props
  valueSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  valueProp: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    marginBottom: 16,
  },
  valueIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  valueContent: {
    flex: 1,
  },
  valueTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 3,
  },
  valueDesc: {
    fontSize: 13,
    lineHeight: 18,
  },

  // Plan Cards
  planCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    overflow: "hidden",
  },
  planStatusText: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
  planSpacer: {
    height: 12,
  },
  recommendedTag: {
    position: "absolute",
    top: 0,
    left: 20,
    right: 20,
    paddingVertical: 6,
    alignItems: "center",
  },
  recommendedTagText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  planHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    marginTop: 12,
  },
  planName: {
    fontSize: 20,
    fontWeight: "800",
  },
  currentBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  currentBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  planPriceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginBottom: 16,
  },
  planPrice: {
    fontSize: 28,
    fontWeight: "800",
  },
  planPerMonth: {
    fontSize: 14,
    marginLeft: 4,
  },
  planFeatures: {
    marginBottom: 16,
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },
  featureText: {
    fontSize: 14,
  },

  // Trust Section
  trustSection: {
    marginTop: 24,
    alignItems: "center",
  },
  trustRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  trustText: {
    fontSize: 13,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 8,
  },
  actionLink: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  actionLinkText: {
    fontSize: 14,
    fontWeight: "600",
  },
  actionDot: {
    fontSize: 14,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  termsLink: {
    fontSize: 13,
    fontWeight: "500",
  },
  termsDot: {
    fontSize: 13,
  },

  testKeyWarning: {
    marginTop: 16,
    fontSize: 12,
    textAlign: "center",
    fontWeight: "600",
  },
  billingWarning: {
    marginTop: 16,
    fontSize: 13,
    textAlign: "center",
    fontWeight: "600",
  },
});
