import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useMatchesStore } from "../../store";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { AVERAGE_FROM, breakStats, MILESTONES } from "../../features/matches/breaks";
import { parseDateValue } from "../../utils/date";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

const shortDate = (value: string) =>
  parseDateValue(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "2-digit" });

/** Every break made in live-scored frames: the high break, the milestones, the best five. */
export const BreaksPanel = () => {
  const { colors } = useAppTheme();
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const stats = useMemo(() => breakStats(matches, liveFramesByMatch), [matches, liveFramesByMatch]);

  if (!stats.highest) {
    return (
      <BoardPanel kicker="BREAKS">
        <Text style={[styles.empty, { color: colors.boardMuted }]}>
          {stats.framesTracked
            ? "No breaks yet in your live-scored frames. They show here as you make them."
            : "Score a frame live, ball by ball, and every break you make is counted here."}
        </Text>
      </BoardPanel>
    );
  }

  const { highest } = stats;
  const top = stats.breaks.slice(0, 5);

  return (
    <BoardPanel kicker="BREAKS" aside={`${stats.framesTracked} LIVE ${stats.framesTracked === 1 ? "FRAME" : "FRAMES"}`}>
      <View style={styles.head}>
        <View style={styles.headCell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.boardMuted }]}>
            HIGH BREAK
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.high, { color: colors.boardRule }]}>
            {highest.points}
          </Text>
          <Text numberOfLines={1} style={[styles.note, { color: colors.boardMuted }]}>
            v {highest.opponent}, {shortDate(highest.date)}
          </Text>
        </View>
        <View style={[styles.divider, { backgroundColor: colors.boardRaised }]} />
        <View style={styles.headCell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.boardMuted }]}>
            AVERAGE
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.high, { color: colors.boardText }]}>
            {stats.average === null ? "–" : Math.round(stats.average)}
          </Text>
          <Text numberOfLines={1} style={[styles.note, { color: colors.boardMuted }]}>
            Of breaks of {AVERAGE_FROM} or more
          </Text>
        </View>
      </View>

      <View style={[styles.milestones, { borderColor: colors.boardRaised }]}>
        {MILESTONES.map((mark) => (
          <View key={mark} style={styles.milestone}>
            <Text
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              style={[styles.milestoneCount, { color: colors.boardText }]}
            >
              {stats.milestones[mark]}
            </Text>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.boardMuted }]}>
              {mark}+
            </Text>
          </View>
        ))}
      </View>

      <Text
        maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
        style={[styles.label, styles.topTitle, { color: colors.boardMuted }]}
      >
        BEST {top.length}
      </Text>
      {top.map((made, index) => (
        <View
          key={`${made.matchId}-${made.frameNumber}-${index}`}
          style={[
            styles.topRow,
            index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.boardRaised } : null,
          ]}
        >
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.topPoints, { color: index === 0 ? colors.boardRule : colors.boardText }]}
          >
            {made.points}
          </Text>
          <Text numberOfLines={1} style={[styles.topWho, { color: colors.boardText }]}>
            v {made.opponent}
          </Text>
          <Text style={[styles.note, { color: colors.boardMuted }]}>
            Frame {made.frameNumber}, {shortDate(made.date)}
          </Text>
        </View>
      ))}
    </BoardPanel>
  );
};

const styles = StyleSheet.create({
  empty: { fontSize: 14, lineHeight: 20, marginTop: SPACING.xs },
  head: { flexDirection: "row", marginTop: SPACING.xs },
  headCell: { flex: 1, minWidth: 0 },
  divider: { width: 1, marginHorizontal: SPACING.md },
  label: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  high: { fontFamily: FONTS.boardHeavy, fontSize: 44, lineHeight: 48 },
  note: { fontSize: 12, fontWeight: "600" },
  milestones: {
    flexDirection: "row",
    marginTop: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  milestone: { flex: 1, alignItems: "center" },
  milestoneCount: { fontFamily: FONTS.board, fontSize: 24, lineHeight: 28 },
  topTitle: { marginTop: SPACING.md, marginBottom: SPACING.xs },
  topRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 36 },
  topPoints: { fontFamily: FONTS.board, fontSize: 22, width: 44 },
  topWho: { flex: 1, fontSize: 14, fontWeight: "700" },
});
