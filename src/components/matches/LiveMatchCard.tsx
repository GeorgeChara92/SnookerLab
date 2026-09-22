import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { isLiveNow, type LiveScore } from "../../features/matches/liveScore";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

/** The red dot and LIVE, or FINAL once it is over. */
export const LiveBadge = ({ score }: { score: Pick<LiveScore, "status" | "updatedAt"> }) => {
  const { colors } = useAppTheme();
  const live = isLiveNow(score);
  return (
    <View style={[styles.badge, { backgroundColor: live ? "#C8102E" : colors.boardRaised }]}>
      {live ? <View style={styles.dot} /> : null}
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={styles.badgeText}>
        {live ? "LIVE" : score.status === "finished" ? "FINAL" : "PAUSED"}
      </Text>
    </View>
  );
};

/**
 * A match someone is scoring, as a small scoreboard: both names and frames, and underneath the
 * frame in progress and the break. Tapping opens it in full.
 */
export const LiveMatchCard = ({
  score,
  playerName,
  onPress,
  width = 260,
}: {
  score: LiveScore;
  playerName: string;
  onPress: () => void;
  width?: number;
}) => {
  const { colors } = useAppTheme();
  const live = isLiveNow(score);
  const sides = [
    { name: playerName, frames: score.framesUser, atTable: score.atTable === "user" },
    { name: score.opponentName, frames: score.framesOpponent, atTable: score.atTable === "opponent" },
  ];
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${live ? "Live" : "Final"}: ${playerName} ${score.framesUser}, ${score.opponentName} ${score.framesOpponent}. Open it.`}
      style={({ pressed }) => [
        styles.card,
        {
          width,
          backgroundColor: colors.board,
          borderColor: live ? colors.boardRule : colors.boardRaised,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.head}>
        <LiveBadge score={score} />
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.format, { color: colors.boardMuted }]}>
          {score.bestOf ? `BEST OF ${score.bestOf}` : "MATCH"}
        </Text>
      </View>
      {sides.map((side) => (
        <View key={side.name} style={styles.side}>
          <View style={[styles.table, { backgroundColor: side.atTable ? colors.boardRule : "transparent" }]} />
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.name, { color: colors.boardText }]}
            numberOfLines={1}
          >
            {side.name.toUpperCase()}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.frames, { color: colors.boardText }]}>
            {side.frames}
          </Text>
        </View>
      ))}
      {live ? (
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          style={[styles.now, { color: colors.boardMuted }]}
          numberOfLines={1}
        >
          FRAME {score.frameNumber} · {score.pointsUser}–{score.pointsOpponent}
          {score.currentBreak ? ` · BREAK ${score.currentBreak}` : ""}
        </Text>
      ) : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  badgeText: { color: "#FFFFFF", fontFamily: FONTS.board, fontSize: 12, letterSpacing: 1.2 },
  format: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  side: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  table: { width: 4, height: 18, borderRadius: 2 },
  name: { flex: 1, fontFamily: FONTS.board, fontSize: 17, letterSpacing: 0.5 },
  frames: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 28 },
  now: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1 },
});
