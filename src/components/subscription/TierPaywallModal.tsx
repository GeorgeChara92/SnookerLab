import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppButton } from "../ui/AppButton";
import { AppCard } from "../ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { SUBSCRIPTION_LIMITS, TIER_LABELS } from "../../constants";
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
      <View style={styles.backdrop}>
        <Pressable style={styles.backdropPress} onPress={onClose} />
      </View>

      <View style={styles.modalWrap} pointerEvents="box-none">
        <AppCard style={styles.modalCard}>
          <Text style={[styles.kicker, { color: colors.primary }]}>UNLOCK FEATURE</Text>
          <Text style={[styles.title, { color: colors.text }]}>{featureLabel} is limited on your plan</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>You are currently on {TIER_LABELS[currentTier]}. Upgrade to unlock more monthly usage.</Text>

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
                <View>
                  <Text style={[styles.tierName, { color: colors.text }]}>{TIER_LABELS[tier]}</Text>
                  <Text style={[styles.tierMeta, { color: colors.textMuted }]}>Matches: {limits.matchesPerPeriod ?? "Unlimited"} / month</Text>
                  <Text style={[styles.tierMeta, { color: colors.textMuted }]}>Tournaments: {limits.tournamentsPerPeriod ?? "Unlimited"} / month</Text>
                  <Text style={[styles.tierMeta, { color: colors.textMuted }]}>AI analyses: {limits.aiAnalysesPerPeriod ?? "Unlimited"} / month</Text>
                </View>
                {active ? <Text style={[styles.currentBadge, { color: colors.primary }]}>Current</Text> : null}
              </View>
            );
          })}

          <AppButton label="Unlock" onPress={handleUnlock} />
          <Pressable style={styles.closeLink} onPress={onClose}>
            <Text style={[styles.closeText, { color: colors.textMuted }]}>Maybe later</Text>
          </Pressable>
        </AppCard>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 14, 12, 0.62)",
  },
  backdropPress: {
    flex: 1,
  },
  modalWrap: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 18,
  },
  kicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    lineHeight: 26,
  },
  subtitle: {
    fontSize: 13,
    marginTop: 6,
    lineHeight: 18,
    marginBottom: 12,
  },
  tierRow: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  tierName: { fontSize: 14, fontWeight: "800", marginBottom: 4 },
  tierMeta: { fontSize: 12, lineHeight: 16 },
  currentBadge: { fontSize: 12, fontWeight: "800" },
  closeLink: { alignItems: "center", marginTop: 10 },
  closeText: { fontSize: 12, fontWeight: "700" },
});
