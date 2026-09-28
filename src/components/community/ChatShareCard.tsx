import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { MatchShare, RoutineShare } from "../../features/community/chatShare";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

/**
 * A routine or match result sent in a chat, drawn as a small scoreboard strip like the rest of
 * the app. A match reads from the sender's side: their score first. Tapping a routine opens it.
 */
export const ChatShareCard = ({
  share,
  senderName,
  onPress,
  width = 248,
}: {
  share: RoutineShare | MatchShare;
  /** Whose result it is, for a match: "You" or their name. */
  senderName: string;
  onPress?: () => void;
  width?: number;
}) => {
  const { colors } = useAppTheme();

  if (share.kind === "routine") {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityRole="button"
        accessibilityLabel={`Routine ${share.name}. Open it.`}
        style={({ pressed }) => [
          styles.card,
          { width, backgroundColor: colors.board, borderColor: colors.boardRaised, opacity: pressed ? 0.85 : 1 },
        ]}
      >
        <View style={[styles.kicker, { borderBottomColor: colors.boardRaised }]}>
          <MaterialCommunityIcons name="target" size={14} color={colors.boardRule} />
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kickerText, { color: colors.boardRule }]}>
            ROUTINE
          </Text>
        </View>
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          style={[styles.routineName, { color: colors.boardText }]}
          numberOfLines={2}
        >
          {share.name}
        </Text>
        {share.subtitle ? (
          <Text style={[styles.subtitle, { color: colors.boardMuted }]} numberOfLines={1}>
            {share.subtitle}
          </Text>
        ) : null}
        <View style={styles.open}>
          <Text style={[styles.openText, { color: colors.boardText }]}>Open routine</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.boardText} />
        </View>
      </Pressable>
    );
  }

  const won = share.result === "win";
  const lost = share.result === "loss";
  const verdict = won ? "WIN" : lost ? "LOSS" : "DRAW";
  const date = share.date
    ? new Date(share.date).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toUpperCase()
    : "";

  return (
    <View
      accessible
      accessibilityLabel={`${senderName} ${share.userScore}, ${share.opponent} ${share.opponentScore}. ${verdict.toLowerCase()}.`}
      style={[styles.card, { width, backgroundColor: colors.board, borderColor: colors.boardRaised }]}
    >
      <View style={[styles.kicker, { borderBottomColor: colors.boardRaised }]}>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kickerText, { color: colors.boardMuted }]}>
          {["RESULT", share.bestOf ? `BEST OF ${share.bestOf}` : null, date || null].filter(Boolean).join(" · ")}
        </Text>
        <View style={styles.flex} />
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          style={[styles.kickerText, { color: won ? colors.boardRule : colors.boardMuted }]}
        >
          {verdict}
        </Text>
      </View>
      {[
        { name: senderName, score: share.userScore, leading: share.userScore > share.opponentScore },
        { name: share.opponent, score: share.opponentScore, leading: share.opponentScore > share.userScore },
      ].map((side) => (
        <View key={side.name + side.score} style={styles.side}>
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.sideName, { color: side.leading ? colors.boardText : colors.boardMuted }]}
            numberOfLines={1}
          >
            {side.name.toUpperCase()}
          </Text>
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.sideScore, { color: side.leading ? colors.boardRule : colors.boardText }]}
          >
            {side.score}
          </Text>
        </View>
      ))}
      {share.highlights?.length || share.highBreak ? (
        <View style={[styles.highs, { borderTopColor: colors.boardRaised }]}>
          {(share.highlights?.length ? share.highlights : [`HIGH BREAK · ${share.highBreak}`]).map((label) => (
            <Text
              key={label}
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              style={[styles.chip, { color: colors.boardRule, borderColor: colors.boardRaised }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { maxWidth: "100%", borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  kicker: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kickerText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2 },
  routineName: {
    fontFamily: FONTS.boardHeavy,
    fontSize: 24,
    lineHeight: 26,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
  },
  subtitle: { fontSize: 13, paddingHorizontal: SPACING.md, marginTop: 2 },
  open: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.xs,
  },
  openText: { fontSize: 14, fontWeight: "800" },
  side: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: 4,
  },
  sideName: { flex: 1, fontFamily: FONTS.board, fontSize: 18, letterSpacing: 0.5 },
  sideScore: { fontFamily: FONTS.boardHeavy, fontSize: 28, minWidth: 28, textAlign: "right" },
  highs: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 4,
  },
  chip: {
    fontFamily: FONTS.boardLabel,
    fontSize: 12,
    letterSpacing: 1,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: 8,
    paddingVertical: 2,
    overflow: "hidden",
  },
});
