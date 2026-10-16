import React, { useCallback, useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useShallow } from "zustand/react/shallow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { useProTourFollowStore } from "../../store/proTourFollowStore";
import {
  matchStatus,
  playerName,
  roundInfo,
  roundShortTitle,
  roundTitle,
  tournamentKey,
  tournamentName,
  tournamentStatus,
  type ProTourEvent,
} from "../../features/tour/liveScores";
import { LiveDot } from "./ProTourUI";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const DAY = 86_400_000;
const startOf = (event: ProTourEvent) => (event.startDate ? new Date(event.startDate).getTime() : 0);
const endOf = (event: ProTourEvent) => (event.endDate ? new Date(event.endDate).getTime() : startOf(event)) + DAY;
const isMain = (event: ProTourEvent) => !event.mainId || event.mainId === event.id;

/**
 * The pro tour in one scoreboard strip, for the screens people land on: a live score when there's
 * a match on (a followed player's first), otherwise the tournament on now or the next one. Tapping
 * it opens Live & results. Kept live only while its screen is in view.
 */
export const ProTourTicker = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useAppTheme();
  const { matches, events, players, rounds, fetchedAt } = useProTourStore(
    useShallow((state) => ({ matches: state.matches, events: state.events, players: state.players, rounds: state.rounds, fetchedAt: state.fetchedAt }))
  );
  const following = useProTourFollowStore((state) => state.ids);
  useFocusEffect(useCallback(() => subscribeProTourLive(), []));

  const pick = useMemo(() => {
    const now = Date.now();
    const live = matches.filter((m) => matchStatus(m) === "live");
    const liveMatch = live.find((m) => following.includes(m.player1Id ?? -1) || following.includes(m.player2Id ?? -1)) ?? live[0] ?? null;
    const main = Object.values(events).filter((e) => isMain(e) && e.startDate);
    const running = main.filter((e) => startOf(e) <= now && now < endOf(e)).sort((a, b) => startOf(a) - startOf(b))[0] ?? null;
    const next = main.filter((e) => startOf(e) > now).sort((a, b) => startOf(a) - startOf(b))[0] ?? null;
    return { liveMatch, liveCount: live.length, running, next };
    // fetchedAt: "now" moves on with each refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matches, events, following, fetchedAt]);

  const { liveMatch, liveCount, running, next } = pick;
  let kicker: string;
  let body: React.ReactNode;
  let label: string;
  if (liveMatch) {
    const tid = tournamentKey(events[liveMatch.eventId], liveMatch.eventId);
    const round = roundShortTitle(roundTitle(roundInfo(rounds, liveMatch.eventId, liveMatch.round), liveMatch.round));
    const p1 = playerName(players, liveMatch.player1Id);
    const p2 = playerName(players, liveMatch.player2Id);
    kicker = [liveMatch.onBreak ? "INTERVAL" : "LIVE", tournamentName(events, tid, liveMatch.eventId), round].join(" · ").toUpperCase();
    label = `Live: ${p1} ${liveMatch.score1}, ${p2} ${liveMatch.score2}. Open live scores.`;
    body = (
      <View style={styles.scoreLine}>
        <Text numberOfLines={1} style={[styles.name, styles.left, { color: colors.boardText }]}>
          {p1}
        </Text>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.score, { color: colors.boardText, backgroundColor: colors.boardRaised }]}>
          {liveMatch.score1}–{liveMatch.score2}
        </Text>
        <Text numberOfLines={1} style={[styles.name, { color: colors.boardText }]}>
          {p2}
        </Text>
      </View>
    );
  } else {
    const event = running ?? next;
    const status = event ? tournamentStatus(event, false) : null;
    kicker = event ? `${running ? "ON NOW" : "NEXT UP"} · ${status?.label ?? ""}`.toUpperCase() : "PRO TOUR";
    const title = event?.name ?? "Live scores, fixtures and rankings";
    label = `${running ? "On now" : event ? "Next up" : "Pro tour"}: ${title}. Open live scores.`;
    body = (
      <Text numberOfLines={1} maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.title, { color: colors.boardText }]}>
        {title}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.strip, { backgroundColor: colors.board, borderColor: colors.boardRule, opacity: pressed ? 0.88 : 1 }]}
    >
      <View style={[styles.mark, { backgroundColor: colors.boardRaised }]}>
        {liveMatch ? <LiveDot size={8} /> : <MaterialCommunityIcons name="trophy-variant" size={18} color={colors.boardRule} />}
      </View>
      <View style={styles.text}>
        <Text numberOfLines={1} maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: liveMatch ? colors.danger : colors.boardRule }]}>
          {kicker}
        </Text>
        {body}
      </View>
      {liveCount > 1 ? (
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.more, { color: colors.boardMuted, borderColor: colors.boardRaised }]}>
          +{liveCount - 1}
        </Text>
      ) : null}
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.boardMuted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: 8,
    paddingLeft: 8,
    paddingRight: 6,
    minHeight: 56,
  },
  mark: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1.1 },
  title: { fontSize: 15, fontWeight: "800" },
  scoreLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { flex: 1, fontSize: 14, fontWeight: "800" },
  left: { textAlign: "right" },
  score: {
    fontFamily: FONTS.board,
    fontSize: 16,
    fontVariant: ["tabular-nums"],
    borderRadius: 4,
    paddingHorizontal: 6,
    overflow: "hidden",
  },
  more: { fontFamily: FONTS.board, fontSize: 13, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 1 },
});
