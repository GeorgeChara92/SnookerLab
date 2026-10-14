import React, { useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { groupMatches, playerName, roundLabel, tournamentKey, tournamentName } from "../../features/tour/liveScores";
import { ProTourMatchRow } from "../../components/tour/ProTourMatchRow";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

const formatDateRange = (start: string | null, end: string | null) => {
  if (!start) return null;
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) return null;
  const startText = startDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  if (!end) return startText;
  const endDate = new Date(end);
  if (Number.isNaN(endDate.getTime()) || endDate.toDateString() === startDate.toDateString()) return startText;
  const sameMonth = endDate.getMonth() === startDate.getMonth() && endDate.getFullYear() === startDate.getFullYear();
  const endText = endDate.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
  const startShort = sameMonth
    ? startDate.toLocaleDateString(undefined, { day: "numeric" })
    : startDate.toLocaleDateString(undefined, { day: "numeric", month: "long" });
  return `${startShort} – ${endText}`;
};

/** A tournament's full picture: every fixture (not just the handful shown inline on Live &
 *  Results), its venue and dates, and what snooker.org knows about the field (sponsor, size,
 *  defending champion) where it has that data. */
export const ProTourTournamentScreen = () => {
  const { colors } = useAppTheme();
  const route = useRoute<RouteProp<CommunityStackParamList, "ProTourTournament">>();
  const { tournamentId } = route.params;
  const { matches, events, players, roundNames } = useProTourStore();

  useEffect(() => subscribeProTourLive(), []);

  const tournamentMatches = useMemo(
    () => matches.filter((match) => tournamentKey(events[match.eventId], match.eventId) === tournamentId),
    [matches, events, tournamentId]
  );

  const rounds = useMemo(
    () => [...new Set(tournamentMatches.map((match) => match.round))].sort((a, b) => a - b),
    [tournamentMatches]
  );
  const [selectedRound, setSelectedRound] = useState<number | "all">("all");
  const shownMatches =
    selectedRound === "all" ? tournamentMatches : tournamentMatches.filter((match) => match.round === selectedRound);
  const { live, upcoming, finished } = groupMatches(shownMatches);

  // A tournament can span a few sub-events (qualifying groups); any one of them sharing this round
  // number is a fine sample to look its name up by - round naming is consistent within one event.
  const roundNameFor = (round: number) => {
    const sample = tournamentMatches.find((match) => match.round === round);
    return sample ? roundLabel(roundNames, sample.eventId, round) : `Round ${round}`;
  };

  const event = events[tournamentId] ?? events[tournamentMatches[0]?.eventId];
  const name = tournamentName(events, tournamentId) === `Event ${tournamentId}` ? event?.name ?? `Event ${tournamentId}` : tournamentName(events, tournamentId);
  const dateRange = formatDateRange(event?.startDate ?? null, event?.endDate ?? null);
  const place = [event?.venue, event?.city, event?.country].filter(Boolean).join(", ") || null;
  const champion = event?.defendingChampionId ? playerName(players, event.defendingChampionId) : null;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <BoardPanel kicker={name} aside={dateRange ?? undefined}>
        {place ? <Text style={[styles.detail, { color: colors.boardMuted }]}>{place}</Text> : null}
        <View style={styles.statRow}>
          {event?.numCompetitors ? <Stat label="Players" value={String(event.numCompetitors)} /> : null}
          {champion ? <Stat label="Defending champion" value={champion} /> : null}
          {event?.sponsor ? <Stat label="Sponsor" value={event.sponsor} /> : null}
        </View>
        {event?.wikipediaUrl ? (
          <Pressable onPress={() => void Linking.openURL(event.wikipediaUrl as string)} accessibilityRole="link">
            <Text style={[styles.link, { color: colors.boardMuted }]}>WIKIPEDIA</Text>
          </Pressable>
        ) : null}
      </BoardPanel>

      {rounds.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rounds}>
          {(["all", ...rounds] as const).map((value) => {
            const selected = value === selectedRound;
            return (
              <Pressable
                key={value}
                onPress={() => setSelectedRound(value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[
                  styles.roundPill,
                  { backgroundColor: selected ? colors.board : colors.surface, borderColor: selected ? colors.boardRule : colors.border },
                ]}
              >
                <Text style={[styles.roundPillText, { color: selected ? colors.boardRule : colors.textMuted }]}>
                  {value === "all" ? "ALL ROUNDS" : roundNameFor(value).toUpperCase()}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {[
        { title: "LIVE NOW", data: live },
        { title: "FIXTURES", data: upcoming },
        { title: "RESULTS", data: finished },
      ]
        .filter((section) => section.data.length > 0)
        .map((section) => (
          <View key={section.title} style={styles.section}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <View style={[styles.matchList, { backgroundColor: colors.board }]}>
              {section.data.map((match) => (
                <ProTourMatchRow key={match.id} match={match} players={players} roundNames={roundNames} />
              ))}
            </View>
          </View>
        ))}

      {!tournamentMatches.length ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          No fixtures cached for this tournament yet - check back shortly.
        </Text>
      ) : null}
    </ScrollView>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.stat}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statValue, { color: colors.boardRule }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.boardMuted }]}>{label.toUpperCase()}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2, gap: SPACING.lg },
  detail: { fontFamily: FONTS.boardLabel, fontSize: 13, marginBottom: SPACING.md },
  statRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.lg },
  stat: { gap: 2, minWidth: 90 },
  statValue: { fontFamily: FONTS.board, fontSize: 18 },
  statLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 0.8 },
  link: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8, marginTop: SPACING.md },
  rounds: { gap: SPACING.sm, paddingRight: SPACING.lg },
  roundPill: { borderWidth: 1, borderRadius: 999, paddingHorizontal: SPACING.md, minHeight: 34, justifyContent: "center" },
  roundPillText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8 },
  section: { gap: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  matchList: { gap: 1, borderRadius: 6, overflow: "hidden" },
  note: { fontSize: 13, textAlign: "center" },
});
