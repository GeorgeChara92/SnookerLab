import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { CommunityAvatar } from "./CommunityAvatar";
import { nameOf } from "../../features/community/types";
import type { BoardEntry } from "../../features/community/sharedRoutines";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** Gold, silver and bronze for the top three places. */
const PODIUM = ["#E3C15A", "#C7CFD6", "#C98A4B"];

/** One place on a leaderboard: rank, player, score. The player's own row stands out. */
export const LeaderboardRow = ({
  entry,
  isMe,
  onPress,
}: {
  entry: BoardEntry;
  isMe: boolean;
  onPress?: () => void;
}) => {
  const { colors } = useAppTheme();
  const podium = entry.rank <= 3 ? PODIUM[entry.rank - 1] : null;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${entry.rank}. ${nameOf(entry.profile)}, ${entry.raw}`}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: isMe ? colors.board : pressed ? colors.surfaceMuted : colors.surface,
          borderColor: isMe ? colors.boardRule : colors.border,
        },
      ]}
    >
      <View style={[styles.rank, podium ? { backgroundColor: podium } : null]}>
        {podium && entry.rank === 1 ? (
          <MaterialCommunityIcons name="crown" size={16} color="#1A1405" />
        ) : (
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.rankText, { color: podium ? "#1A1405" : isMe ? colors.boardText : colors.textMuted }]}
          >
            {entry.rank}
          </Text>
        )}
      </View>
      <CommunityAvatar profile={entry.profile} size={36} />
      <View style={styles.who}>
        <Text style={[styles.name, { color: isMe ? colors.boardText : colors.text }]} numberOfLines={1}>
          {isMe ? "You" : nameOf(entry.profile)}
        </Text>
        {entry.profile.handle ? (
          <Text style={[styles.handle, { color: isMe ? colors.boardMuted : colors.textMuted }]} numberOfLines={1}>
            @{entry.profile.handle}
          </Text>
        ) : null}
      </View>
      <Text
        maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
        style={[styles.value, { color: isMe ? colors.boardRule : colors.text }]}
      >
        {entry.raw}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  rankText: { fontFamily: FONTS.boardHeavy, fontSize: 17 },
  who: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "800" },
  handle: { fontSize: 12 },
  value: { fontFamily: FONTS.boardHeavy, fontSize: 22 },
});
