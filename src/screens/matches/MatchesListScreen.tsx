import React, { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { SyncBanner } from "../../components/ui/SyncBanner";
import { FormStrip, MatchRow, SectionHeader } from "../../components/matches/MatchRows";
import { TierPaywallModal } from "../../components/subscription";
import { useMatchesStore, useTournamentsStore } from "../../store";
import type { MatchesStackParamList, Tournament } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { BoardPanel, ScoreStrip } from "../../components/scoreboard/Scoreboard";
import {
  byNewest,
  groupByOpponent,
  initialsOf,
  relativeDate,
  summariseMatches,
} from "../../features/matches/matchSummary";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** How many of each list show before "Show all". Enough to be useful, few enough to scroll past. */
const PREVIEW = { matches: 3, tournaments: 3, opponents: 4 };

/** A win rate over two matches is noise, so the headline number waits for a few results. */
const MIN_FOR_WIN_RATE = 3;

const tournamentProgress = (tournament: Tournament) => {
  const total = tournament.fixtures.length;
  const done = tournament.fixtures.filter((fixture) => fixture.status === "completed").length;
  return { done, total };
};

const tournamentChampion = (tournament: Tournament): string | null => {
  if (tournament.status !== "completed") return null;
  if (tournament.tournament_type === "knockout") {
    const finalRound = Math.max(...tournament.fixtures.map((fixture) => fixture.round_number), 1);
    return tournament.fixtures.find((fixture) => fixture.round_number === finalRound)?.winner ?? null;
  }
  return null;
};

export const MatchesListScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matches } = useMatchesStore();
  const { tournaments } = useTournamentsStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);
  const [expanded, setExpanded] = useState({ matches: false, tournaments: false, opponents: false });

  const sortedMatches = useMemo(() => [...matches].sort(byNewest), [matches]);
  const record = useMemo(() => summariseMatches(matches), [matches]);
  const opponents = useMemo(() => groupByOpponent(matches), [matches]);
  const firstPlayed = sortedMatches.length
    ? new Date(sortedMatches[sortedMatches.length - 1].date)
        .toLocaleDateString("en-GB", { month: "short", year: "numeric" })
        .toUpperCase()
    : null;

  // Unfinished tournaments first, newest first within each.
  const sortedTournaments = useMemo(
    () =>
      [...tournaments].sort((a, b) => {
        if (a.status !== b.status) return a.status === "completed" ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }),
    [tournaments]
  );

  const toggle = (key: keyof typeof expanded) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const startMatch = () =>
    subscription.canCreateMatch ? navigation.navigate("NewMatch") : setPaywallFeature("Monthly Match Limit");
  const startTournament = () =>
    subscription.canCreateTournament
      ? navigation.navigate("NewTournament")
      : setPaywallFeature("Monthly Tournament Limit");

  // Only worth saying when there is a limit to run into.
  const limitNote = [
    subscription.remaining.matches !== null
      ? `${subscription.remaining.matches} ${subscription.remaining.matches === 1 ? "match" : "matches"}`
      : null,
    subscription.remaining.tournaments !== null
      ? `${subscription.remaining.tournaments} ${subscription.remaining.tournaments === 1 ? "tournament" : "tournaments"}`
      : null,
  ].filter(Boolean);

  // One line of insight, and only when there is enough history for it to mean something.
  const bestRival = opponents.find((opponent) => opponent.played >= 2 && opponent.framesWon > opponent.framesLost);
  const insight =
    record.played >= 5 && bestRival
      ? `Your best record is against ${bestRival.name}: ${bestRival.framesWon}–${bestRival.framesLost} in frames.`
      : null;

  const visibleMatches = expanded.matches ? sortedMatches : sortedMatches.slice(0, PREVIEW.matches);
  const visibleTournaments = expanded.tournaments ? sortedTournaments : sortedTournaments.slice(0, PREVIEW.tournaments);
  const visibleOpponents = expanded.opponents ? opponents : opponents.slice(0, PREVIEW.opponents);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <SyncBanner scope="matches" noun="score" />

      {/* ---------------------------------------------------------------- actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={startMatch}
          accessibilityRole="button"
          accessibilityLabel={subscription.canCreateMatch ? "Start a new match" : "New match, locked on your plan"}
          style={({ pressed }) => [
            styles.primaryAction,
            {
              backgroundColor: subscription.canCreateMatch ? colors.primary : colors.surfaceMuted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={subscription.canCreateMatch ? "plus" : "lock-outline"}
            size={20}
            color={subscription.canCreateMatch ? colors.onPrimary : colors.textMuted}
          />
          <Text
            style={[
              styles.primaryActionText,
              { color: subscription.canCreateMatch ? colors.onPrimary : colors.textMuted },
            ]}
          >
            New match
          </Text>
        </Pressable>

        <Pressable
          onPress={startTournament}
          accessibilityRole="button"
          accessibilityLabel={
            subscription.canCreateTournament ? "Set up a tournament" : "New tournament, locked on your plan"
          }
          style={({ pressed }) => [
            styles.secondaryAction,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
          ]}
        >
          <MaterialCommunityIcons
            name={subscription.canCreateTournament ? "trophy-outline" : "lock-outline"}
            size={20}
            color={colors.text}
          />
          <Text style={[styles.secondaryActionText, { color: colors.text }]}>Tournament</Text>
        </Pressable>
      </View>

      {limitNote.length ? (
        <Text style={[styles.limitNote, { color: colors.textMuted }]}>
          {limitNote.join(" and ")} left this month on {subscription.tierLabel}
        </Text>
      ) : null}

      {matches.length === 0 ? (
        /* ---------------------------------------------------------------- first run */
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="scoreboard-outline" size={28} color={colors.primary} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Score one live, frame by frame, or enter a result after you have played. Your record and
            head-to-heads build from there.
          </Text>
        </View>
      ) : (
        /* ---------------------------------------------------------------- record */
        <BoardPanel
          kicker="CAREER"
          aside={
            record.played >= MIN_FOR_WIN_RATE
              ? `${record.winRate}% WON`
              : firstPlayed
                ? `SINCE ${firstPlayed}`
                : undefined
          }
          style={styles.career}
        >
          {/* Won and lost either side, matches played in the middle: read it as "2 (2) 0". */}
          <ScoreStrip
            size="hero"
            left={{ name: "Won", score: record.wins, leading: record.wins >= record.losses && record.wins > 0 }}
            right={{ name: "Lost", score: record.losses, leading: record.losses > record.wins }}
            middle={`(${record.played})`}
            style={styles.careerStrip}
          />

          <View style={[styles.careerFoot, { borderTopColor: colors.boardRaised }]}>
            <View style={styles.footCell}>
              <Text style={[styles.footLabel, { color: colors.boardMuted }]}>FRAMES</Text>
              <Text style={[styles.footValue, { color: colors.boardText }]}>
                {record.framesWon}–{record.framesLost}
              </Text>
            </View>
            <View style={styles.footCell}>
              <Text style={[styles.footLabel, { color: colors.boardMuted }]}>DRAWN</Text>
              <Text style={[styles.footValue, { color: colors.boardText }]}>{record.draws}</Text>
            </View>
            <View style={[styles.footCell, styles.footForm]}>
              <Text style={[styles.footLabel, { color: colors.boardMuted }]}>FORM</Text>
              <FormStrip form={record.form} size={22} />
            </View>
          </View>

          {insight ? (
            <Text style={[styles.insight, { color: colors.boardMuted }]}>{insight}</Text>
          ) : null}
        </BoardPanel>
      )}

      {/* ---------------------------------------------------------------- matches */}
      {sortedMatches.length ? (
        <>
          <SectionHeader
            title="Recent matches"
            actionLabel={
              sortedMatches.length > PREVIEW.matches
                ? expanded.matches
                  ? "Show fewer"
                  : `Show all ${sortedMatches.length}`
                : undefined
            }
            onAction={() => toggle("matches")}
          />
          {visibleMatches.map((match) => (
            <MatchRow
              key={match.id}
              match={match}
              onPress={() => navigation.navigate("MatchDetail", { matchId: match.id })}
            />
          ))}
        </>
      ) : null}

      {/* ---------------------------------------------------------------- tournaments */}
      {sortedTournaments.length ? (
        <>
          <SectionHeader
            title="Tournaments"
            actionLabel={
              sortedTournaments.length > PREVIEW.tournaments
                ? expanded.tournaments
                  ? "Show fewer"
                  : `Show all ${sortedTournaments.length}`
                : undefined
            }
            onAction={() => toggle("tournaments")}
          />
          {visibleTournaments.map((tournament) => {
            const { done, total } = tournamentProgress(tournament);
            const complete = tournament.status === "completed";
            const champion = tournamentChampion(tournament);
            const progress = total ? done / total : 0;

            return (
              <Pressable
                key={tournament.id}
                onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
                accessibilityRole="button"
                accessibilityLabel={`${tournament.name}, ${tournament.tournament_type}, ${done} of ${total} played`}
                style={({ pressed }) => [
                  styles.tournamentRow,
                  { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                ]}
              >
                <View
                  style={[
                    styles.tournamentIcon,
                    { backgroundColor: complete ? colors.accentWash : colors.surfaceMuted },
                  ]}
                >
                  <MaterialCommunityIcons
                    name={complete ? "trophy" : tournament.tournament_type === "knockout" ? "tournament" : "table-large"}
                    size={20}
                    color={complete ? colors.accent : colors.primary}
                  />
                </View>

                <View style={styles.tournamentBody}>
                  <View style={styles.tournamentTitleRow}>
                    <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={1}>
                      {tournament.name}
                    </Text>
                    <Text style={[styles.tournamentDate, { color: colors.textMuted }]}>
                      {relativeDate(tournament.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.tournamentMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {tournament.tournament_type === "knockout" ? "Knockout" : "League"} ·{" "}
                    {tournament.participants.filter((name) => !/^BYE\b/i.test(name)).length} players ·{" "}
                    {complete
                      ? champion
                        ? `Won by ${champion}`
                        : "Complete"
                      : `${done} of ${total} played`}
                  </Text>
                  {!complete ? (
                    <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
                        ]}
                      />
                    </View>
                  ) : null}
                </View>

                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </Pressable>
            );
          })}
        </>
      ) : null}

      {/* ---------------------------------------------------------------- opponents */}
      {opponents.length ? (
        <>
          <SectionHeader
            title="Opponents"
            actionLabel={
              opponents.length > PREVIEW.opponents
                ? expanded.opponents
                  ? "Show fewer"
                  : `Show all ${opponents.length}`
                : undefined
            }
            onAction={() => toggle("opponents")}
          />
          {visibleOpponents.map((opponent) => {
            const diff = opponent.framesWon - opponent.framesLost;
            return (
              <Pressable
                key={opponent.name}
                onPress={() => navigation.navigate("OpponentMatches", { opponentName: opponent.name })}
                accessibilityRole="button"
                accessibilityLabel={`${opponent.name}: won ${opponent.wins}, lost ${opponent.losses}, drawn ${opponent.draws}`}
                style={({ pressed }) => [
                  styles.opponentRow,
                  { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                ]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.avatarText, { color: colors.text }]}>{initialsOf(opponent.name)}</Text>
                </View>

                <View style={styles.opponentBody}>
                  <Text style={[styles.opponentName, { color: colors.text }]} numberOfLines={1}>
                    {opponent.name}
                  </Text>
                  <Text style={[styles.opponentMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {opponent.played} {opponent.played === 1 ? "match" : "matches"}
                    {opponent.lastPlayed ? ` · last ${relativeDate(opponent.lastPlayed).toLowerCase()}` : ""}
                  </Text>
                </View>

                <View style={styles.opponentRecord}>
                  <Text style={[styles.opponentScore, { color: colors.text }]}>
                    {opponent.wins}–{opponent.losses}
                    {opponent.draws ? `–${opponent.draws}` : ""}
                  </Text>
                  <Text
                    style={[
                      styles.opponentDiff,
                      { color: diff > 0 ? colors.primary : diff < 0 ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {diff > 0 ? `+${diff}` : diff} frames
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </>
      ) : null}

      <TierPaywallModal
        visible={!!paywallFeature}
        onClose={() => setPaywallFeature(null)}
        currentTier={subscription.tier}
        featureLabel={paywallFeature ?? "Premium Features"}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: 0 },

  actions: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  primaryAction: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 52,
    borderRadius: RADIUS.md,
  },
  primaryActionText: { fontSize: 16, fontWeight: "800" },
  secondaryAction: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 52,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryActionText: { fontSize: 16, fontWeight: "700" },
  limitNote: { fontSize: 12, fontWeight: "600", marginTop: SPACING.sm },

  emptyCard: {
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.xl,
    marginTop: SPACING.lg,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.xs,
  },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },

  career: { marginTop: SPACING.lg },
  careerStrip: { borderTopWidth: 0, borderBottomWidth: 0 },
  careerFoot: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
  },
  footCell: { flex: 1, gap: 4 },
  footForm: { flex: 1.4, alignItems: "flex-end" },
  footLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.6 },
  footValue: { fontFamily: FONTS.board, fontSize: 22, fontVariant: ["tabular-nums"] },
  insight: {
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    marginTop: SPACING.md,
  },

  tournamentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 72,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tournamentIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  tournamentBody: { flex: 1 },
  tournamentTitleRow: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
  tournamentName: { flexShrink: 1, fontSize: 16, fontWeight: "700" },
  tournamentDate: { fontSize: 12, fontWeight: "600" },
  tournamentMeta: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden", marginTop: SPACING.sm },
  progressFill: { height: "100%", borderRadius: 2 },

  opponentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: HIT_TARGET - 4,
    height: HIT_TARGET - 4,
    borderRadius: (HIT_TARGET - 4) / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontFamily: FONTS.board, fontSize: 17, letterSpacing: 0.6 },
  opponentBody: { flex: 1 },
  opponentName: { fontSize: 16, fontWeight: "700" },
  opponentMeta: { fontSize: 12, fontWeight: "600", marginTop: 3 },
  opponentRecord: { alignItems: "flex-end" },
  opponentScore: { fontFamily: FONTS.board, fontSize: 24, fontVariant: ["tabular-nums"] },
  opponentDiff: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8, marginTop: -2 },
});
