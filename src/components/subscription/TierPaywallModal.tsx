import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { RADIUS, SCRIM, SPACING, SUBSCRIPTION_LIMITS, TIER_LABELS } from "../../constants";
import type { SubscriptionTier } from "../../types";

type TierPaywallModalProps = {
  visible: boolean;
  onClose: () => void;
  currentTier: SubscriptionTier;
  featureLabel: string;
  onUnlock?: () => void;
};

export const TierPaywallModal = ({ visible, onClose, currentTier, featureLabel, onUnlock }: TierPaywallModalProps) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  const handleUnlock = () => {
    if (onUnlock) {
      onUnlock();
      return;
    }

    onClose();
    navigation.navigate("ProfileModal", { screen: "SubscriptionPlans" });
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close">
        <Pressable
          onPress={() => null}
          accessibilityViewIsModal
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={[styles.accentBar, { backgroundColor: colors.accent }]} />

          <View style={styles.body}>
            <Text style={[styles.kicker, { color: colors.accent }]}>UNLOCK FEATURE</Text>
            <Text style={[styles.title, { color: colors.text }]}>{featureLabel} is limited on your plan</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              You are on {TIER_LABELS[currentTier]}. A bigger plan gives you more each month.
            </Text>

            {(["free", "half_century", "century"] as SubscriptionTier[]).map((tier) => {
              const limits = SUBSCRIPTION_LIMITS[tier];
              const active = tier === currentTier;

              return (
                <View
                  key={tier}
                  style={[
                    styles.tierRow,
                    {
                      borderColor: active ? colors.primary : colors.border,
                      backgroundColor: active ? colors.surfaceMuted : colors.surface,
                    },
                  ]}
                >
                  <View style={styles.tierInfo}>
                    <Text style={[styles.tierName, { color: colors.text }]}>{TIER_LABELS[tier]}</Text>
                    <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
                      Matches: {limits.matchesPerPeriod ?? "Unlimited"} a month
                    </Text>
                    <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
                      Tournaments: {limits.tournamentsPerPeriod ?? "Unlimited"} a month
                    </Text>
                    <Text style={[styles.tierMeta, { color: colors.textMuted }]}>
                      AI analyses: {limits.aiAnalysesPerPeriod ?? "Unlimited"} a month
                    </Text>
                  </View>
                  {active ? <Text style={[styles.currentBadge, { color: colors.primary }]}>Current</Text> : null}
                </View>
              );
            })}

            <Pressable
              onPress={handleUnlock}
              accessibilityRole="button"
              accessibilityLabel="See the plans"
              style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>See the plans</Text>
            </Pressable>

            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Maybe later" style={styles.cancel}>
              <Text style={[styles.cancelText, { color: colors.textMuted }]}>Maybe later</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
  },
  modalCard: {
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  accentBar: {
    height: 4,
  },
  body: {
    padding: SPACING.xl,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
  },
  tierRow: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  tierInfo: {
    flex: 1,
  },
  tierName: { fontSize: 15, fontWeight: "800", marginBottom: SPACING.xs },
  tierMeta: { fontSize: 13, lineHeight: 18 },
  currentBadge: { fontSize: 12, fontWeight: "800" },
  primary: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.md,
  },
  primaryText: {
    fontSize: 15,
    fontWeight: "800",
  },
  cancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
});
