import React from "react";
import { View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { SubscriptionTier } from "../../types";

/** Gold for Century, a quieter tone for Half-Century - a subscriber tier is now something to show,
 * not just raised limits nobody else can see. */
const BADGE_COLOR: Record<"half_century" | "century", string> = {
  half_century: "#9AA5B1",
  century: "#D4A72C",
};

/**
 * A small corner badge on an avatar for a paying subscriber - nothing for Free, so it only ever
 * marks something genuinely earned. borderColour should match whatever this avatar sits on; it
 * defaults to the screen background, which is right for most list rows but not e.g. a coloured
 * card.
 */
export const SubscriberBadge = ({
  tier,
  size = 44,
  borderColour,
  corner = "bottom-right",
}: {
  tier: SubscriptionTier;
  size?: number;
  borderColour?: string;
  /** "bottom-left", for an avatar that already has something else in the bottom-right corner. */
  corner?: "bottom-right" | "bottom-left";
}) => {
  const { colors } = useAppTheme();
  if (tier !== "half_century" && tier !== "century") return null;

  const badgeSize = Math.max(14, Math.round(size * 0.34));
  return (
    <View
      style={{
        position: "absolute",
        ...(corner === "bottom-left" ? { left: -1 } : { right: -1 }),
        bottom: -1,
        width: badgeSize,
        height: badgeSize,
        borderRadius: badgeSize / 2,
        backgroundColor: BADGE_COLOR[tier],
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1.5,
        borderColor: borderColour ?? colors.background,
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialCommunityIcons name={tier === "century" ? "crown" : "star"} size={Math.round(badgeSize * 0.6)} color="#1A1A1A" />
    </View>
  );
};
