import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { BoardSummary } from "../../features/community/sharedRoutines";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

/**
 * One routine's leaderboard as a single compact line: the routine, how many players and the
 * score to beat, and the player's own place on the right.
 */
export const BoardRow = ({
  icon,
  name,
  summary,
  onPress,
  first,
}: {
  icon: string;
  name: string;
  summary: BoardSummary | undefined;
  onPress: () => void;
  /** No divider above the first row. */
  first?: boolean;
}) => {
  const { colors } = useAppTheme();
  const players = summary?.players ?? 0;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${name}. ${players} ${players === 1 ? "player" : "players"}${
        summary?.myRank ? `. You are number ${summary.myRank}` : ""
      }`}
      style={({ pressed }) => [
        styles.row,
        !first ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
        { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
      ]}
    >
      <Text style={styles.icon}>{icon}</Text>
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={1}>
          {players
            ? `${players} ${players === 1 ? "player" : "players"} · top ${summary?.leader?.raw}`
            : "No scores yet"}
        </Text>
      </View>
      {summary?.myRank ? (
        <View style={[styles.rank, { backgroundColor: summary.myRank === 1 ? colors.boardRule : colors.board }]}>
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.rankText, { color: summary.myRank === 1 ? colors.board : colors.boardText }]}
          >
            #{summary.myRank}
          </Text>
        </View>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 52, paddingHorizontal: SPACING.md },
  icon: { fontSize: 18, width: 24, textAlign: "center" },
  text: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  rank: {
    minWidth: 40,
    height: 26,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  rankText: { fontFamily: FONTS.boardHeavy, fontSize: 15 },
});
