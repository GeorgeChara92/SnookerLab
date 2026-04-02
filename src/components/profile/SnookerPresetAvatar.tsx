import React from "react";
import { StyleSheet, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { getPresetAvatarId } from "../../constants/profileAvatars";

type Props = {
  presetId?: string;
  size?: number;
};

export const SnookerPresetAvatar = ({ presetId, size = 44 }: Props) => {
  const avatarId = getPresetAvatarId(presetId);
  const config = PRESET_AVATAR_CONFIG[avatarId] ?? PRESET_AVATAR_CONFIG["black-ball"];

  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: config.background,
          borderColor: config.border,
        },
      ]}
    >
      <MaterialCommunityIcons name={config.icon} size={Math.round(size * 0.56)} color={config.color} />
    </View>
  );
};

type AvatarConfig = {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  background: string;
  border: string;
  color: string;
};

const PRESET_AVATAR_CONFIG: Record<string, AvatarConfig> = {
  "player-pro": {
    icon: "account-tie",
    background: "#EEF2FF",
    border: "#C7D2FE",
    color: "#3730A3",
  },
  "player-classic": {
    icon: "account",
    background: "#ECFEFF",
    border: "#A5F3FC",
    color: "#155E75",
  },
  "player-ace": {
    icon: "account-star",
    background: "#FFF7ED",
    border: "#FED7AA",
    color: "#9A3412",
  },
  "player-captain": {
    icon: "account-group",
    background: "#F0F9FF",
    border: "#BAE6FD",
    color: "#0C4A6E",
  },
  "black-ball": {
    icon: "billiards",
    background: "#E8F6F1",
    border: "#B9E3D3",
    color: "#0F5132",
  },
  "pack-reds": {
    icon: "billiards-rack",
    background: "#FEF2F2",
    border: "#FECACA",
    color: "#991B1B",
  },
  "trophy-cue": {
    icon: "trophy-outline",
    background: "#FEFCE8",
    border: "#FDE68A",
    color: "#854D0E",
  },
  "corner-pot": {
    icon: "bullseye-arrow",
    background: "#EFF6FF",
    border: "#BFDBFE",
    color: "#1D4ED8",
  },
  "cue-master": {
    icon: "golf-tee",
    background: "#FFFBEB",
    border: "#FDE68A",
    color: "#92400E",
  },
  "scoreboard": {
    icon: "scoreboard-outline",
    background: "#F1F5F9",
    border: "#CBD5E1",
    color: "#0F172A",
  },
  "safety-first": {
    icon: "shield-outline",
    background: "#ECFEFF",
    border: "#A5F3FC",
    color: "#155E75",
  },
  "match-medal": {
    icon: "medal-outline",
    background: "#FEFCE8",
    border: "#FDE68A",
    color: "#854D0E",
  },
  "frame-race": {
    icon: "flag-checkered",
    background: "#F8FAFC",
    border: "#CBD5E1",
    color: "#1E293B",
  },
  "break-builder": {
    icon: "chart-line",
    background: "#EFF6FF",
    border: "#BFDBFE",
    color: "#1D4ED8",
  },
  "time-pressure": {
    icon: "timer-sand",
    background: "#FFF7ED",
    border: "#FED7AA",
    color: "#9A3412",
  },
  "focus-mode": {
    icon: "crosshairs-gps",
    background: "#F0FDF4",
    border: "#BBF7D0",
    color: "#166534",
  },
  "rest-play": {
    icon: "golf",
    background: "#F5F3FF",
    border: "#DDD6FE",
    color: "#5B21B6",
  },
  "screw-back": {
    icon: "undo",
    background: "#EFF6FF",
    border: "#BFDBFE",
    color: "#1D4ED8",
  },
  "stun-run": {
    icon: "arrow-right",
    background: "#ECFDF5",
    border: "#A7F3D0",
    color: "#065F46",
  },
  "double-kiss": {
    icon: "swap-horizontal",
    background: "#FFFBEB",
    border: "#FDE68A",
    color: "#92400E",
  },
  "thin-cut": {
    icon: "content-cut",
    background: "#FEF2F2",
    border: "#FECACA",
    color: "#991B1B",
  },
  "final-black": {
    icon: "circle-outline",
    background: "#F1F5F9",
    border: "#CBD5E1",
    color: "#0F172A",
  },
};

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
});
