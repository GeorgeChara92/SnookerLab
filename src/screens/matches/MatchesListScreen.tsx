import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useMatchesStore, useTournamentsStore } from "../../store";
import type { Match, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { TierPaywallModal } from "../../components/subscription";

type OpponentGroup = {
  opponentName: string;
  matchesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  framesFor: number;
  framesAgainst: number;
  lastPlayed?: string;
  recentForm: string[];
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const MatchesListScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matches } = useMatchesStore();
  const { tournaments } = useTournamentsStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  const activeTournaments = tournaments.filter((item) => item.status !== "completed");
  const completedTournaments = tournaments.filter((item) => item.status === "completed");

  const sortedMatches = useMemo(
    () => [...matches].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches]
  );

  const recentMatches = useMemo(() => sortedMatches.slice(0, 5), [sortedMatches]);

const overallStats = useMemo(() => {
    const wins = matches.filter((m) => m.result === "win").length;
    const losses = matches.filter((m) => m.result === "loss").length;
    const draws = matches.filter((m) => m.result === "draw").length;
    const total = matches.length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;

    // Count frames won/lost - use frames_played for manual entries, or 1 if single frame
    let framesWon = 0;
    let framesLost = 0;
    let pointsFor = 0;
    let pointsAgainst = 0;

    matches.forEach((m) => {
      // For manual entry (best of 1), frames_played is 1 and score is actual points
      // For live scoring, user_score/opponent_score are frame counts
      if (m.target_frames === 1 || m.frames_played === 1) {
        // Manual entry - count as 1 frame, winner determined by who had more points
        framesWon += m.result === "win" ? 1 : 0;
        framesLost += m.result === "loss" ? 1 : 0;
        pointsFor += m.user_score;
        pointsAgainst += m.opponent_score;
      } else {
        // Live scoring - user_score/opponent_score are frame wins
        framesWon += m.user_score;
        framesLost += m.opponent_score;
        // Points would come from frame records, not tracked at match level for live
      }
    });

    const form = sortedMatches
      .slice(0, 5)
      .map((m) => m.result?.toUpperCase?.()[0] ?? "")
      .filter((r) => r);

    return {
      wins,
      losses,
      draws,
      total,
      winRate,
      framesWon,
      framesLost,
      pointsFor,
      pointsAgainst,
      recentForm: form,
    };
  }, [matches, sortedMatches]);

  const groups = useMemo(() => {
    const map = new Map<string, OpponentGroup>();

    matches.forEach((match: Match) => {
      const existing = map.get(match.opponent_name) ?? {
        opponentName: match.opponent_name,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        draws: 0,
        framesFor: 0,
        framesAgainst: 0,
        lastPlayed: undefined,
        recentForm: [],
      };

      existing.matchesPlayed += 1;
      
      // For manual entry (best of 1), frames are 1 each, scores are points
      // For live scoring, user_score/opponent_score are frame wins
      if (match.target_frames === 1 || match.frames_played === 1) {
        // Manual entry - 1 frame, result determines frame win/loss
        existing.framesFor += match.result === "win" ? 1 : match.result === "draw" ? 0.5 : 0;
        existing.framesAgainst += match.result === "loss" ? 1 : match.result === "draw" ? 0.5 : 0;
      } else {
        // Live scoring - scores are frame counts
        existing.framesFor += match.user_score;
        existing.framesAgainst += match.opponent_score;
      }

      if (match.result === "win") existing.wins += 1;
      if (match.result === "loss") existing.losses += 1;
      if (match.result === "draw") existing.draws += 1;

      if (!existing.lastPlayed || new Date(match.date) > new Date(existing.lastPlayed)) {
        existing.lastPlayed = match.date;
      }

      map.set(match.opponent_name, existing);
    });

    const sorted = Array.from(map.values()).sort((a, b) => {
      if (b.matchesPlayed !== a.matchesPlayed) return b.matchesPlayed - a.matchesPlayed;
      return (b.wins - b.losses) - (a.wins - a.losses);
    });

    sorted.forEach((group) => {
      const groupMatches = matches
        .filter((m) => m.opponent_name === group.opponentName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      group.recentForm = groupMatches
        .slice(0, 5)
        .map((m) => m.result?.toUpperCase?.()[0] ?? "")
        .filter((r) => r);
    });

    return sorted;
  }, [matches]);

  const topOpponent = useMemo(() => {
    if (groups.length === 0) return null;
    return groups.reduce((best, current) => {
      const currentDiff = current.framesFor - current.framesAgainst;
      const bestDiff = best.framesFor - best.framesAgainst;
      if (currentDiff > bestDiff) return current;
      return best;
    });
  }, [groups]);

  const getChampionLabel = (tournament: (typeof tournaments)[number]) => {
    if (tournament.tournament_type === "knockout") {
      const finalRound = Math.max(...tournament.fixtures.map((fixture) => fixture.round_number), 1);
      const finalFixture = tournament.fixtures.find((fixture) => fixture.round_number === finalRound);
      return finalFixture?.winner ?? tournament.previous_champion ?? "See details";
    }
    return tournament.previous_champion ?? "See details";
  };

  const getTournamentStage = (tournament: (typeof tournaments)[number]) => {
    if (tournament.status === "completed") return "Completed";
    if (tournament.tournament_type === "knockout") {
      const currentRound = Math.max(...tournament.fixtures.map((f) => f.round_number), 1);
      const totalRounds = Math.ceil(Math.log2(tournament.participants?.length ?? 4));
      const stages = ["Final", "Semi-final", "Quarter-final", "Last 16", "Last 32", "First Round"];
      return stages[totalRounds - currentRound] ?? `Round ${currentRound}`;
    }
    return "In Progress";
  };

  const openPaywall = (feature: string) => setPaywallFeature(feature);

  const renderFormBadge = (result: string, index: number) => {
    if (!result) return null;
    const isWin = result === "W";
    const isLoss = result === "L";
    const isDraw = result === "D";

    return (
      <View
        key={index}
        style={[
          styles.formBadge,
          {
            backgroundColor: isWin
              ? colors.primary + "20"
              : isLoss
              ? colors.danger + "20"
              : colors.surfaceMuted,
          },
        ]}
      >
        <Text
          style={[
            styles.formBadgeText,
            { color: isWin ? colors.primary : isLoss ? colors.danger : colors.textMuted },
          ]}
        >
          {result}
        </Text>
      </View>
    );
  };

  const renderSummaryCard = () => (
    <View style={[styles.summaryCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.summaryHeader}>
        <Text style={[styles.summaryTitle, { color: colors.text }]}>Match Record</Text>
        <View style={[styles.winRateBadge, { backgroundColor: colors.primary + "20" }]}>
          <Text style={[styles.winRateText, { color: colors.primary }]}>{overallStats.winRate}%</Text>
        </View>
      </View>

      <View style={styles.summaryStats}>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryValue, { color: colors.primary }]}>{overallStats.wins}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Wins</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryValue, { color: colors.danger }]}>{overallStats.losses}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Losses</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>{overallStats.draws}</Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Draws</Text>
        </View>
        <View style={styles.summaryStat}>
          <Text style={[styles.summaryValue, { color: colors.text }]}>
            {overallStats.framesWon}-{overallStats.framesLost}
          </Text>
          <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Frames</Text>
        </View>
      </View>

      {overallStats.recentForm.length > 0 && (
        <View style={styles.formRow}>
          <Text style={[styles.formLabel, { color: colors.textMuted }]}>Recent Form</Text>
          <View style={styles.formBadges}>
            {overallStats.recentForm.map((result, index) => renderFormBadge(result, index))}
          </View>
        </View>
      )}
    </View>
  );

  const renderInsightCard = () => {
    if (matches.length === 0) return null;

    const insights: string[] = [];

    if (overallStats.winRate >= 60) {
      insights.push(`Strong ${overallStats.winRate}% win rate across ${overallStats.total} matches`);
    } else if (overallStats.winRate < 40 && overallStats.total >= 3) {
      insights.push("Focus on practice to improve your match results");
    }

    if (topOpponent && topOpponent.wins > topOpponent.losses) {
      const diff = topOpponent.framesFor - topOpponent.framesAgainst;
      insights.push(`Best record vs ${topOpponent.opponentName} (+${diff} frames)`);
    }

    if (insights.length === 0) {
      insights.push(`Track your progress across ${overallStats.total} matches`);
    }

    return (
      <View style={[styles.insightCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.primary + "40" }]}>
        <Text style={styles.insightIcon}>💡</Text>
        <View style={styles.insightContent}>
          <Text style={[styles.insightTitle, { color: colors.text }]}>Performance Insight</Text>
          <Text style={[styles.insightText, { color: colors.textMuted }]}>{insights[0]}</Text>
        </View>
      </View>
    );
  };

  const renderRecentMatches = () => {
    if (recentMatches.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Matches</Text>
        {recentMatches.map((match) => {
          const isWin = match.result === "win";
          const isLoss = match.result === "loss";
          const isManualEntry = match.target_frames === 1 || match.frames_played === 1;
          const bestOf = match.target_frames ?? match.frames_played;

          return (
            <Pressable
              key={match.id}
              style={[styles.matchRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate("MatchDetail", { matchId: match.id })}
            >
              <View style={styles.matchLeft}>
                <View
                  style={[
                    styles.resultBadge,
                    {
                      backgroundColor: isWin
                        ? colors.primary + "20"
                        : isLoss
                        ? colors.danger + "20"
                        : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.resultBadgeText,
                      { color: isWin ? colors.primary : isLoss ? colors.danger : colors.textMuted },
                    ]}
                  >
                    {isWin ? "W" : isLoss ? "L" : "D"}
                  </Text>
                </View>
                <View style={styles.matchInfo}>
                  <View style={styles.matchTitleRow}>
                    <Text style={[styles.matchOpponent, { color: colors.text }]} numberOfLines={1}>
                      {match.opponent_name}
                    </Text>
                    <View
                      style={[
                        styles.matchTypeBadge,
                        {
                          backgroundColor: isManualEntry
                            ? colors.surfaceMuted
                            : colors.primary + "15",
                          borderColor: isManualEntry ? colors.border : colors.primary + "40",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.matchTypeText,
                          { color: isManualEntry ? colors.textMuted : colors.primary },
                        ]}
                      >
                        {isManualEntry ? "Manual" : "Live"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.matchDate, { color: colors.textMuted }]}>
                    {formatDate(match.date)}
                    {!isManualEntry && bestOf && ` · Best of ${bestOf}`}
                  </Text>
                </View>
              </View>
              <Text
                style={[
                  styles.matchScore,
                  { color: isWin ? colors.primary : isLoss ? colors.danger : colors.text },
                ]}
              >
                {match.user_score}-{match.opponent_score}
              </Text>
            </Pressable>
          );
        })}
      </View>
    );
  };

  const renderTournaments = () => {
    if (activeTournaments.length === 0 && completedTournaments.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Tournaments</Text>

        {activeTournaments.slice(0, 2).map((tournament) => (
          <Pressable
            key={tournament.id}
            style={[styles.tournamentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
          >
            <View style={styles.tournamentTop}>
              <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={1}>
                {tournament.name}
              </Text>
              <View style={[styles.tournamentStageBadge, { backgroundColor: colors.primary + "20" }]}>
                <Text style={[styles.tournamentStageText, { color: colors.primary }]}>
                  {getTournamentStage(tournament)}
                </Text>
              </View>
            </View>
            <Text style={[styles.tournamentMeta, { color: colors.textMuted }]}>
              {tournament.tournament_type.toUpperCase()} · Best of {tournament.best_of_frames}
            </Text>
          </Pressable>
        ))}

        {completedTournaments.slice(0, 2).map((tournament) => (
          <Pressable
            key={tournament.id}
            style={[styles.tournamentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate("TournamentDetail", { tournamentId: tournament.id })}
          >
            <View style={styles.tournamentTop}>
              <Text style={[styles.tournamentName, { color: colors.text }]} numberOfLines={1}>
                {tournament.name}
              </Text>
              <Text style={[styles.tournamentChampion, { color: colors.primary }]}>
                🏆 {getChampionLabel(tournament)}
              </Text>
            </View>
            <Text style={[styles.tournamentMeta, { color: colors.textMuted }]}>
              {tournament.tournament_type.toUpperCase()} · Completed
            </Text>
          </Pressable>
        ))}

        {(activeTournaments.length > 2 || completedTournaments.length > 2) && (
          <Text style={[styles.seeAllText, { color: colors.primary }]}>
            {activeTournaments.length + completedTournaments.length} total tournaments
          </Text>
        )}
      </View>
    );
  };

  const renderOpponents = () => (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>
        Opponents {groups.length > 0 ? `(${groups.length})` : ""}
      </Text>

      {groups.length === 0 ? (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Record your first match to start tracking your performance.
          </Text>
        </View>
      ) : (
        groups.slice(0, 10).map((opponent) => {
          const frameDiff = opponent.framesFor - opponent.framesAgainst;
          const isPositive = frameDiff > 0;
          const isNeutral = frameDiff === 0;

          return (
            <Pressable
              key={opponent.opponentName}
              style={[styles.opponentCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => navigation.navigate("OpponentMatches", { opponentName: opponent.opponentName })}
            >
              <View style={styles.opponentTop}>
                <View style={styles.opponentLeft}>
                  <Text style={[styles.opponentName, { color: colors.text }]} numberOfLines={1}>
                    {opponent.opponentName}
                  </Text>
                  <Text style={[styles.opponentMatches, { color: colors.textMuted }]}>
                    {opponent.matchesPlayed} match{opponent.matchesPlayed !== 1 ? "es" : ""}
                  </Text>
                </View>
                <View
                  style={[
                    styles.frameDiffBadge,
                    {
                      backgroundColor: isPositive
                        ? colors.primary + "20"
                        : isNeutral
                        ? colors.surfaceMuted
                        : colors.danger + "20",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.frameDiffText,
                      { color: isPositive ? colors.primary : isNeutral ? colors.textMuted : colors.danger },
                    ]}
                  >
                    {isPositive ? "+" : ""}
                    {frameDiff}
                  </Text>
                </View>
              </View>

              <View style={styles.opponentStats}>
                <View style={styles.opponentStat}>
                  <Text style={[styles.opponentStatValue, { color: colors.primary }]}>{opponent.wins}</Text>
                  <Text style={[styles.opponentStatLabel, { color: colors.textMuted }]}>W</Text>
                </View>
                <View style={styles.opponentStat}>
                  <Text style={[styles.opponentStatValue, { color: colors.danger }]}>{opponent.losses}</Text>
                  <Text style={[styles.opponentStatLabel, { color: colors.textMuted }]}>L</Text>
                </View>
                <View style={styles.opponentStat}>
                  <Text style={[styles.opponentStatValue, { color: colors.text }]}>{opponent.draws}</Text>
                  <Text style={[styles.opponentStatLabel, { color: colors.textMuted }]}>D</Text>
                </View>
                {opponent.recentForm.length > 0 && (
                  <View style={styles.opponentForm}>
                    {opponent.recentForm.map((result, index) => renderFormBadge(result, index))}
                  </View>
                )}
              </View>

              {opponent.lastPlayed && (
                <Text style={[styles.opponentLast, { color: colors.textMuted }]}>
                  Last: {formatDate(opponent.lastPlayed)}
                </Text>
              )}
            </Pressable>
          );
        })
      )}

      {groups.length > 10 && (
        <Text style={[styles.seeAllText, { color: colors.primary }]}>
          +{groups.length - 10} more opponents
        </Text>
      )}
    </View>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.actionsRow}>
        <Pressable
          style={[
            styles.primaryButton,
            { 
              backgroundColor: subscription.canCreateMatch ? colors.primary : colors.surfaceMuted,
              opacity: subscription.canCreateMatch ? 1 : 0.85,
            },
          ]}
          onPress={() => (subscription.canCreateMatch ? navigation.navigate("NewMatch") : openPaywall("Monthly Match Limit"))}
        >
          {subscription.canCreateMatch ? (
            <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>+ New Match</Text>
          ) : (
            <View style={styles.lockedContent}>
              <Text style={[styles.lockedIcon, { color: colors.textMuted }]}>🔒</Text>
              <Text style={[styles.lockedText, { color: colors.text }]}>New Match</Text>
            </View>
          )}
        </Pressable>
        <Pressable
          style={[
            styles.secondaryButton,
            { 
              backgroundColor: colors.surfaceMuted, 
              borderColor: colors.border,
              opacity: subscription.canCreateTournament ? 1 : 0.85,
            },
          ]}
          onPress={() =>
            subscription.canCreateTournament ? navigation.navigate("NewTournament") : openPaywall("Monthly Tournament Limit")
          }
        >
          {subscription.canCreateTournament ? (
            <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Tournament</Text>
          ) : (
            <View style={styles.lockedContent}>
              <Text style={[styles.lockedIcon, { color: colors.textMuted }]}>🔒</Text>
              <Text style={[styles.lockedText, { color: colors.text }]}>Tournament</Text>
            </View>
          )}
        </Pressable>
      </View>

      <Text style={[styles.limitHint, { color: colors.textMuted }]}>
        {subscription.tierLabel} plan · {subscription.remaining.matches ?? "∞"} matches · {subscription.remaining.tournaments ?? "∞"} tournaments
      </Text>

      {matches.length > 0 && renderSummaryCard()}
      {matches.length > 0 && renderInsightCard()}
      {renderRecentMatches()}
      {renderTournaments()}
      {renderOpponents()}

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
  container: {
    flex: 1,
    padding: 16,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1.5,
  },
  secondaryButtonText: {
    fontWeight: "600",
    fontSize: 15,
  },
  lockedContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  lockedIcon: {
    fontSize: 14,
  },
  lockedText: {
    fontSize: 15,
    fontWeight: "600",
  },
  limitHint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
  },
  summaryCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  summaryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  winRateBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 20,
  },
  winRateText: {
    fontSize: 14,
    fontWeight: "700",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  summaryStat: {
    alignItems: "center",
    flex: 1,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: "800",
  },
  summaryLabel: {
    fontSize: 11,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(120,120,120,0.2)",
  },
  formLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginRight: 12,
  },
  formBadges: {
    flexDirection: "row",
    gap: 6,
  },
  formBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  formBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  insightCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  insightIcon: {
    fontSize: 18,
  },
  insightContent: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 2,
  },
  insightText: {
    fontSize: 13,
    lineHeight: 18,
  },
  matchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  matchLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  resultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  resultBadgeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  matchInfo: {
    flex: 1,
  },
  matchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  matchOpponent: {
    fontSize: 14,
    fontWeight: "600",
  },
  matchTypeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  matchTypeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  matchDate: {
    fontSize: 11,
    marginTop: 2,
  },
  matchScore: {
    fontSize: 16,
    fontWeight: "700",
  },
  tournamentCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  tournamentTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  tournamentStageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  tournamentStageText: {
    fontSize: 11,
    fontWeight: "700",
  },
  tournamentChampion: {
    fontSize: 12,
    fontWeight: "600",
  },
  tournamentMeta: {
    fontSize: 11,
    marginTop: 4,
  },
  seeAllText: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
  },
  opponentCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  opponentTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  opponentLeft: {
    flex: 1,
    marginRight: 12,
  },
  opponentName: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 2,
  },
  opponentMatches: {
    fontSize: 12,
  },
  frameDiffBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  frameDiffText: {
    fontSize: 13,
    fontWeight: "700",
  },
  opponentStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  opponentStat: {
    alignItems: "center",
  },
  opponentStatValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  opponentStatLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  opponentForm: {
    flexDirection: "row",
    gap: 4,
    marginLeft: 8,
  },
  opponentLast: {
    fontSize: 11,
    marginTop: 10,
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
});