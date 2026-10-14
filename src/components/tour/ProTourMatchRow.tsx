import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  formatScore,
  matchStatus,
  playerName,
  roundLabel,
  type ProTourEvent,
  type ProTourMatch,
  type ProTourRoundNames,
} from "../../features/tour/liveScores";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

/** Always date and time together - "Today" stands in for the date once a match is today's. */
const formatWhen = (iso: string | null) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  const time = date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  const day = sameDay ? "Today" : date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return `${day} · ${time}`;
};

/**
 * One fixture, drawn as a broadcast scoreboard strip - the same graphic the app already uses for
 * a player's own matches (see Scoreboard.tsx), so the pro tour reads as part of the one broadcast
 * rather than a different, generic list. A tournament's own BoardPanel is the frame; this is what
 * sits inside it, one strip per fixture, with just the round (or kick-off time, or LIVE) between
 * the two names instead of repeating the tournament on every row.
 */
export const ProTourMatchRow = ({
  match,
  players,
  roundNames = {},
}: {
  match: ProTourMatch;
  players: Record<number, string>;
  roundNames?: ProTourRoundNames;
  /** Unused - kept so call sites that still pass an events map don't need to change. */
  events?: Record<number, ProTourEvent>;
}) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const status = matchStatus(match);
  const name1 = playerName(players, match.player1Id);
  const name2 = playerName(players, match.player2Id);
  const leading1 = status !== "upcoming" && match.score1 > match.score2;
  const leading2 = status !== "upcoming" && match.score2 > match.score1;

  const openPlayer = (playerId: number | null) => {
    if (playerId != null) navigation.navigate("ProTourPlayer", { playerId });
  };

  const middle =
    status === "live" ? "LIVE" : formatWhen(match.scheduledAt) || roundLabel(roundNames, match.eventId, match.round);

  const name = (label: string, side: "left" | "right", leading: boolean, playerId: number | null) => (
    <Pressable
      onPress={() => openPlayer(playerId)}
      disabled={playerId == null}
      hitSlop={6}
      accessibilityRole={playerId != null ? "button" : undefined}
      style={styles.nameCell}
    >
      <Text
        maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
        numberOfLines={1}
        style={[styles.name, { color: leading ? colors.boardText : colors.boardMuted, textAlign: side }]}
      >
        {label.toUpperCase()}
      </Text>
    </Pressable>
  );

  const score = (value: string, leading: boolean) => (
    <View style={styles.scoreCell}>
      <Text
        maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
        style={[styles.score, { color: leading ? colors.boardText : colors.boardMuted }]}
      >
        {value}
      </Text>
    </View>
  );

  return (
    <Pressable
      disabled={!match.liveUrl && !match.detailsUrl}
      onPress={() => void Linking.openURL((match.liveUrl || match.detailsUrl) as string)}
      accessibilityRole={match.liveUrl || match.detailsUrl ? "link" : undefined}
      style={({ pressed }) => [styles.strip, { backgroundColor: colors.board, opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.marker, { backgroundColor: leading1 ? colors.boardRule : "transparent" }]} />
      {name(name1, "left", leading1, match.player1Id)}
      {score(status === "upcoming" ? "–" : formatScore(match).split("-")[0], leading1)}

      <View style={styles.middle}>
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          numberOfLines={1}
          style={[styles.middleText, { color: status === "live" ? colors.danger : colors.boardMuted }]}
        >
          {middle}
        </Text>
      </View>

      {score(status === "upcoming" ? "–" : formatScore(match).split("-")[1], leading2)}
      {name(name2, "right", leading2, match.player2Id)}
      <View style={[styles.marker, { backgroundColor: leading2 ? colors.boardRule : "transparent" }]} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  strip: { flexDirection: "row", alignItems: "stretch", minHeight: 44, borderRadius: 6, overflow: "hidden" },
  marker: { width: 3 },
  nameCell: { flex: 1, justifyContent: "center", paddingHorizontal: SPACING.sm },
  name: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 0.6 },
  scoreCell: { minWidth: 30, alignItems: "center", justifyContent: "center" },
  score: { fontFamily: FONTS.board, fontSize: 20, fontVariant: ["tabular-nums"] },
  middle: { minWidth: 76, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xs },
  middleText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.4 },
});
