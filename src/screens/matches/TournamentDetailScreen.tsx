import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, Vibration, View } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useTournamentsStore } from "../../store";
import type { MatchesStackParamList, TournamentFixture, TournamentFrameScore } from "../../types";
import { computeLeagueStandings } from "../../features/tournaments/leagueStandings";
import { buildBracketRounds } from "../../features/tournaments/knockout";
import { RADIUS, SPACING } from "../../constants";

const triggerHaptic = async (type: "light" | "success") => {
  try {
    if (type === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    Vibration.vibrate(type === "light" ? 10 : 18);
  }
};

const FixtureRow = ({
  fixture,
  onSave,
  colors,
  delay,
  collapsible = false,
  initialExpanded = true,
}: {
  fixture: TournamentFixture;
  onSave: (fixtureId: string, frameScores: TournamentFrameScore[]) => void;
  colors: any;
  delay: number;
  collapsible?: boolean;
  initialExpanded?: boolean;
}) => {
  const dialog = useDialog();
  const isByeA = /^BYE\b/i.test(fixture.participant_a);
  const isByeB = /^BYE\b/i.test(fixture.participant_b);
  const isAutoAdvanced = (isByeA && !isByeB) || (isByeB && !isByeA);
  const isLive = fixture.status === "pending" && fixture.participant_a !== "TBD" && fixture.participant_b !== "TBD" && !isAutoAdvanced;
  const statusLabel = fixture.status === "completed" ? "Completed" : isLive ? "Live" : "Upcoming";
  const requiredFrameWins = Math.floor(fixture.best_of_frames / 2) + 1;
  const [isExpanded, setIsExpanded] = useState(initialExpanded);
  const [frames, setFrames] = React.useState(() => {
    const saved = fixture.frame_scores ?? [];
    return Array.from({ length: fixture.best_of_frames }, (_, index) => {
      const existing = saved.find((frame) => frame.frame_number === index + 1);
      return {
        frame_number: index + 1,
        score_a: existing ? String(existing.score_a) : "",
        score_b: existing ? String(existing.score_b) : "",
      };
    });
  });
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(12)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 260, delay, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 260, delay, useNativeDriver: true }),
    ]).start();
  }, [delay, opacity, shift]);

  React.useEffect(() => {
    const saved = fixture.frame_scores ?? [];
    setFrames(
      Array.from({ length: fixture.best_of_frames }, (_, index) => {
        const existing = saved.find((frame) => frame.frame_number === index + 1);
        return {
          frame_number: index + 1,
          score_a: existing ? String(existing.score_a) : "",
          score_b: existing ? String(existing.score_b) : "",
        };
      })
    );
  }, [fixture.best_of_frames, fixture.frame_scores]);

  const saveResult = () => {
    const parsed: TournamentFrameScore[] = [];

    for (const frame of frames) {
      if (!frame.score_a.trim() || !frame.score_b.trim()) continue;
      const scoreA = Number(frame.score_a);
      const scoreB = Number(frame.score_b);
      if (!Number.isFinite(scoreA) || !Number.isFinite(scoreB)) continue;
      if (scoreA === scoreB) continue;

      parsed.push({
        frame_number: frame.frame_number,
        score_a: scoreA,
        score_b: scoreB,
        winner: scoreA > scoreB ? "a" : "b",
      });

      const aWins = parsed.filter((item) => item.winner === "a").length;
      const bWins = parsed.filter((item) => item.winner === "b").length;
      if (aWins >= requiredFrameWins || bWins >= requiredFrameWins) break;
    }

    const aWins = parsed.filter((item) => item.winner === "a").length;
    const bWins = parsed.filter((item) => item.winner === "b").length;
    if (!parsed.length) {
      dialog.alert({
        title: "No frames to save",
        message: "Enter both scores for at least one finished frame. A level frame cannot be saved, so play the re-spotted black out first.",
        icon: "numeric",
        confirmLabel: "Enter scores",
      });
      return;
    }

    triggerHaptic("light");
    onSave(fixture.id, parsed);
  };

  return (
    <Animated.View
      style={[
        styles.fixtureCard,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity,
          transform: [{ translateY: shift }],
        },
      ]}
    >
      <View style={styles.fixtureHeadRow}>
        <Text style={[styles.bestOfBadge, { color: colors.textMuted }]}>BEST OF {fixture.best_of_frames}</Text>
        <View
          style={[
            styles.statusPill,
            fixture.status === "completed"
              ? { backgroundColor: colors.surfaceMuted, borderColor: colors.border }
              : isLive
                ? { backgroundColor: colors.primaryStrong, borderColor: colors.primary }
                : { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.statusPillText, { color: fixture.status === "completed" ? colors.textMuted : isLive ? colors.onPrimary : colors.textMuted }]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={[styles.tie, { borderColor: colors.border }]}>
        {[
          { name: fixture.participant_a, score: fixture.score_a, isBye: isByeA },
          { name: fixture.participant_b, score: fixture.score_b, isBye: isByeB },
        ].map((player, index) => {
          const isWinner = fixture.winner === player.name && !player.isBye;
          return (
            <View
              key={`${fixture.id}-seat-${index}`}
              style={[styles.tieSeat, index === 0 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.tieName,
                  {
                    color: player.isBye || player.name === "TBD" ? colors.textMuted : colors.text,
                    fontWeight: isWinner ? "800" : "600",
                  },
                ]}
              >
                {player.isBye ? "Bye" : player.name === "TBD" ? "To be decided" : player.name}
              </Text>
              {isWinner ? <MaterialCommunityIcons name="check" size={16} color={colors.primary} /> : null}
              <Text style={[styles.tieScore, { color: isWinner ? colors.primary : colors.textMuted }]}>
                {typeof player.score === "number" ? player.score : "-"}
              </Text>
            </View>
          );
        })}
      </View>

      {collapsible ? (
        <Pressable
          style={styles.expandRow}
          onPress={() => setIsExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={isExpanded ? "Hide the frame scores" : "Edit the frame scores"}
        >
          <Text style={[styles.expandLabel, { color: colors.textMuted }]}>{isExpanded ? "Hide frames" : "Edit frames"}</Text>
          <MaterialCommunityIcons name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={colors.primary} />
        </Pressable>
      ) : null}

      {isAutoAdvanced ? (
        <Text style={[styles.matchScoreText, { color: colors.textMuted }]}>Bye - through to the next round</Text>
      ) : isExpanded ? (
        <>
          <View style={styles.resultRow}>
            <Text style={[styles.frameLabel, { color: colors.textMuted }]}>Enter frame scores</Text>
          </View>

          <View style={styles.frameList}>
            {frames.map((frame, index) => (
              <View key={`frame-${fixture.id}-${frame.frame_number}`} style={styles.frameRow}>
                <Text style={[styles.frameIndex, { color: colors.textMuted }]}>F{frame.frame_number}</Text>
                <TextInput
                  value={frame.score_a}
                  onChangeText={(value) =>
                    setFrames((prev) => prev.map((item, i) => (i === index ? { ...item, score_a: value } : item)))
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.scoreInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
                />
                <Text style={[styles.hyphen, { color: colors.textMuted }]}>-</Text>
                <TextInput
                  value={frame.score_b}
                  onChangeText={(value) =>
                    setFrames((prev) => prev.map((item, i) => (i === index ? { ...item, score_b: value } : item)))
                  }
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  style={[styles.scoreInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
                />
              </View>
            ))}
          </View>

          <Pressable style={[styles.saveChip, { backgroundColor: colors.primary }]} onPress={saveResult}>
            <Text style={[styles.saveChipText, { color: colors.onPrimary }]}>Save Frames</Text>
          </Pressable>

        </>
      ) : null}

      {fixture.score_a !== undefined && fixture.score_b !== undefined ? (
        <Text style={[styles.matchScoreText, { color: colors.textMuted }]}>Scoreline: {fixture.score_a} - {fixture.score_b}</Text>
      ) : null}

      {fixture.winner && ((fixture.score_a ?? 0) >= requiredFrameWins || (fixture.score_b ?? 0) >= requiredFrameWins) ? (
        <Text style={[styles.winnerText, { color: colors.primary }]}>Winner: {fixture.winner}</Text>
      ) : null}
    </Animated.View>
  );
};

export const TournamentDetailScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const route = useRoute<RouteProp<MatchesStackParamList, "TournamentDetail">>();
  const { tournamentId } = route.params;
  const { colors, isDark } = useAppTheme();
  const dialog = useDialog();
  const { getTournamentById, updateFixtureResult, deleteTournament } = useTournamentsStore();
  const tournament = getTournamentById(tournamentId);
  const [selectedLeaguePlayer, setSelectedLeaguePlayer] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [leagueTab, setLeagueTab] = useState<"fixtures" | "table">("fixtures");
  const [showChampionModal, setShowChampionModal] = useState(false);
  const [showActionsModal, setShowActionsModal] = useState(false);
  const [collapsedKnockoutRounds, setCollapsedKnockoutRounds] = useState<Record<number, boolean>>({});
  const [collapsedLeagueMatchdays, setCollapsedLeagueMatchdays] = useState<Record<number, boolean>>({});
  const heroProgressAnim = useRef(new Animated.Value(0)).current;
  const previousCompletedRef = useRef(tournament?.status === "completed");

  const roundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return "Final";
    if (round === totalRounds - 1) return "Semi Final";
    if (round === totalRounds - 2) return "Quarter Final";
    return `Round ${round}`;
  };

  const rounds = useMemo(() => {
    if (!tournament) return [];
    const map = new Map<number, TournamentFixture[]>();
    tournament.fixtures.forEach((fixture) => {
      const list = map.get(fixture.round_number) ?? [];
      list.push(fixture);
      map.set(fixture.round_number, list);
    });
    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([round, fixtures]) => ({ round, fixtures }));
  }, [tournament]);

  const bracketRounds = useMemo(
    () => (tournament && tournament.tournament_type === "knockout" ? buildBracketRounds(tournament.fixtures) : []),
    [tournament]
  );

  const standings = useMemo(() => {
    if (!tournament || tournament.tournament_type !== "league") return [];

    return computeLeagueStandings(tournament.participants, tournament.fixtures);
  }, [tournament]);

  const leagueFixtures = useMemo(() => {
    if (!tournament || tournament.tournament_type !== "league") return [];
    return tournament.fixtures
      .filter((fixture) =>
        selectedLeaguePlayer === "All"
          ? true
          : fixture.participant_a === selectedLeaguePlayer || fixture.participant_b === selectedLeaguePlayer
      )
      .sort((a, b) => a.fixture_index - b.fixture_index);
  }, [selectedLeaguePlayer, tournament]);

  const groupedLeagueFixtures = useMemo(() => {
    if (!tournament || tournament.tournament_type !== "league") return [] as Array<{ day: number; fixtures: TournamentFixture[] }>;
    const activeParticipants = tournament.participants.filter((name) => !/^BYE\b/i.test(name));
    const matchesPerDay = Math.max(1, Math.floor(activeParticipants.length / 2));
    const groups = new Map<number, TournamentFixture[]>();

    leagueFixtures.forEach((fixture, index) => {
      const day = Math.floor(index / matchesPerDay) + 1;
      const existing = groups.get(day) ?? [];
      groups.set(day, [...existing, fixture]);
    });

    return Array.from(groups.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([day, fixtures]) => ({ day, fixtures }));
  }, [leagueFixtures, tournament]);

  const completion = useMemo(() => {
    if (!tournament) return { completed: false, champion: null as string | null, done: 0, total: 0 };

    const done = tournament.fixtures.filter((fixture) => fixture.status === "completed").length;
    const total = tournament.fixtures.length;

    if (tournament.tournament_type === "knockout") {
      const finalRound = Math.max(...tournament.fixtures.map((fixture) => fixture.round_number), 1);
      const finalFixture = tournament.fixtures.find((fixture) => fixture.round_number === finalRound);
      const champion = finalFixture?.status === "completed" ? finalFixture.winner ?? null : null;
      return { completed: !!champion, champion, done, total };
    }

    const completed = total > 0 && done === total;
    const champion = completed && standings.length ? standings[0].name : null;
    return { completed, champion, done, total };
  }, [standings, tournament]);

  const progressRatio = completion.total > 0 ? completion.done / completion.total : 0;

  const stageLabel = useMemo(() => {
    if (!tournament) return "";
    if (completion.completed) return "Completed";

    if (tournament.tournament_type === "knockout") {
      const nextRound = rounds.find((round) => round.fixtures.some((fixture) => fixture.status !== "completed"));
      return nextRound ? roundLabel(nextRound.round, rounds.length) : "Opening Round";
    }

    const firstPendingIndex = groupedLeagueFixtures.findIndex((group) => group.fixtures.some((fixture) => fixture.status !== "completed"));
    if (firstPendingIndex >= 0) return `Matchday ${groupedLeagueFixtures[firstPendingIndex].day}`;
    return groupedLeagueFixtures.length ? `Matchday ${groupedLeagueFixtures[groupedLeagueFixtures.length - 1].day}` : "Matchday 1";
  }, [completion.completed, groupedLeagueFixtures, rounds, tournament]);

  const heroDisplayName = useMemo(() => {
    const trimmed = tournament?.name?.trim() ?? "";
    if (!trimmed) return "🏆 Tournament";
    const emojiOnly = /^[^A-Za-z0-9]+$/u.test(trimmed);
    if (emojiOnly) return `${trimmed} Tournament`;
    return trimmed;
  }, [tournament?.name]);

  useEffect(() => {
    Animated.timing(heroProgressAnim, {
      toValue: progressRatio,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [heroProgressAnim, progressRatio]);

  useEffect(() => {
    if (!previousCompletedRef.current && completion.completed) {
      setShowChampionModal(true);
      triggerHaptic("success");
      previousCompletedRef.current = true;
    }

    previousCompletedRef.current = completion.completed;
    return undefined;
  }, [completion.completed]);

  if (!tournament) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Tournament not found.</Text>
      </View>
    );
  }

  const handleFreshStart = () => {
    if (tournament.tournament_type === "knockout") {
      dialog.choose({
        title: "Start again with the same field?",
        message: "The same players go back in the hat for a new round one. How should the fixtures be drawn?",
        icon: "shuffle-variant",
        confirmLabel: "Draw at random",
        secondaryLabel: "Pair them myself",
        cancelLabel: "Not now",
        onConfirm: () => {
          navigation.navigate("NewTournament", {
            prefill: {
              name: tournament.name,
              participants: tournament.participants,
              tournamentType: tournament.tournament_type,
              entryMode: tournament.entry_mode,
              pairingMode: "random",
              bestOfFrames: tournament.best_of_frames,
              previousChampion: completion.champion ?? undefined,
              autoRunDraw: true,
            },
          });
        },
        onSecondary: () => {
          navigation.navigate("NewTournament", {
            prefill: {
              name: tournament.name,
              participants: tournament.participants,
              tournamentType: tournament.tournament_type,
              entryMode: tournament.entry_mode,
              pairingMode: "manual",
              bestOfFrames: tournament.best_of_frames,
              previousChampion: completion.champion ?? undefined,
            },
          });
        },
      });
      return;
    }

    navigation.navigate("NewTournament", {
      prefill: {
        name: tournament.name,
        participants: tournament.participants,
        tournamentType: tournament.tournament_type,
        entryMode: tournament.entry_mode,
        pairingMode: tournament.pairing_mode,
        bestOfFrames: tournament.best_of_frames,
        previousChampion: completion.champion ?? undefined,
      },
    });
  };

  const handleDeleteTournament = () => {
    dialog.confirm({
      title: "Delete this tournament?",
      message: "The draw, every fixture and all the frame scores go with it. This cannot be undone.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete tournament",
      cancelLabel: "Keep it",
      onConfirm: async () => {
        try {
          await deleteTournament(tournament.id);
          navigation.goBack();
        } catch (error) {
          dialog.alert({
            title: "Could not delete the tournament",
            message: "It is still here. Check your connection and try again.",
            tone: "danger",
            icon: "wifi-off",
          });
        }
      },
    });
  };

  const realPlayerCount = tournament.participants.filter((item) => !/^BYE\b/i.test(item)).length;

  const openHeroActions = () => {
    setShowActionsModal(true);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroTopRow}>
          <View style={styles.heroTitleWrap}>
            <Text style={[styles.heroKicker, { color: colors.textMuted }]}>
              {tournament.tournament_type === "knockout" ? "KNOCKOUT" : "LEAGUE"} · {tournament.entry_mode.toUpperCase()}
            </Text>
            <Text style={[styles.heroTitle, { color: colors.text }]} numberOfLines={2}>
              {heroDisplayName}
            </Text>
          </View>

          <Pressable
            style={[styles.iconAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={openHeroActions}
            accessibilityRole="button"
            accessibilityLabel="Tournament options"
          >
            <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.heroFactsRow}>
          <View style={styles.heroFact}>
            <Text style={[styles.heroFactValue, { color: colors.text }]}>{realPlayerCount}</Text>
            <Text style={[styles.heroFactLabel, { color: colors.textMuted }]}>Players</Text>
          </View>
          <View style={[styles.heroFactDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroFact}>
            <Text style={[styles.heroFactValue, { color: colors.text }]}>{tournament.best_of_frames}</Text>
            <Text style={[styles.heroFactLabel, { color: colors.textMuted }]}>Best of</Text>
          </View>
          <View style={[styles.heroFactDivider, { backgroundColor: colors.border }]} />
          <View style={styles.heroFact}>
            <Text style={[styles.heroFactValue, { color: colors.text }]} numberOfLines={1}>{stageLabel}</Text>
            <Text style={[styles.heroFactLabel, { color: colors.textMuted }]}>Stage</Text>
          </View>
        </View>

        <View style={styles.heroProgressRow}>
          <View style={[styles.heroProgressTrack, { backgroundColor: colors.surfaceMuted }]}>
            <Animated.View
              style={[
                styles.heroProgressFill,
                {
                  width: heroProgressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
                  backgroundColor: completion.completed ? colors.accent : colors.primary,
                },
              ]}
            />
          </View>
          <Text style={[styles.heroProgressText, { color: colors.textMuted }]}>
            {completion.done} of {completion.total} played
          </Text>
        </View>

        {completion.champion ? (
          <View style={[styles.championBanner, { backgroundColor: colors.accentWash, borderColor: colors.accent }]}>
            <MaterialCommunityIcons name="trophy" size={18} color={colors.accent} />
            <Text style={[styles.championBannerText, { color: colors.text }]}>
              {completion.champion} wins {tournament.name}
            </Text>
          </View>
        ) : null}

        {tournament.previous_champion ? (
          <Text style={[styles.heroFootnote, { color: colors.textMuted }]}>
            Previous champion: {tournament.previous_champion}
          </Text>
        ) : null}
      </View>

      {tournament.tournament_type === "knockout" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bracket</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.bracketRow}>
              {bracketRounds.map((round) => (
                <View key={round.title} style={styles.bracketColumn}>
                  <Text style={[styles.bracketTitle, { color: colors.textMuted }]}>{round.title.toUpperCase()}</Text>

                  {round.ties.map((tie) => {
                    if (tie.isEmpty) {
                      return (
                        <View
                          key={tie.id}
                          style={[styles.bracketTie, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: 0.5 }]}
                        >
                          <Text style={[styles.bracketEmpty, { color: colors.textMuted }]}>No tie</Text>
                        </View>
                      );
                    }

                    return (
                      <View
                        key={tie.id}
                        style={[
                          styles.bracketTie,
                          {
                            borderColor: tie.status === "completed" ? colors.border : colors.borderStrong,
                            backgroundColor: colors.surface,
                          },
                        ]}
                      >
                        {[tie.a, tie.b].map((player, seatIndex) => (
                          <View
                            key={`${tie.id}-${seatIndex}`}
                            style={[
                              styles.bracketSeat,
                              seatIndex === 0 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null,
                            ]}
                          >
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.bracketSeatName,
                                {
                                  color: player.isPending || !player.name ? colors.textMuted : colors.text,
                                  fontWeight: player.isWinner ? "800" : "600",
                                },
                              ]}
                            >
                              {player.name ?? (player.isPending ? "To be decided" : "Bye")}
                            </Text>
                            {typeof player.score === "number" ? (
                              <Text
                                style={[
                                  styles.bracketSeatScore,
                                  { color: player.isWinner ? colors.primary : colors.textMuted },
                                ]}
                              >
                                {player.score}
                              </Text>
                            ) : null}
                          </View>
                        ))}
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {tournament.tournament_type === "league" ? (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <View style={styles.leagueTabRow}>
              <Pressable
                style={[
                  styles.leagueTab,
                  { borderColor: leagueTab === "fixtures" ? colors.primary : colors.border, backgroundColor: leagueTab === "fixtures" ? colors.surfaceMuted : colors.surface },
                ]}
                onPress={() => setLeagueTab("fixtures")}
              >
                <Text style={[styles.leagueTabText, { color: leagueTab === "fixtures" ? colors.primary : colors.textMuted }]}>Fixtures</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.leagueTab,
                  { borderColor: leagueTab === "table" ? colors.primary : colors.border, backgroundColor: leagueTab === "table" ? colors.surfaceMuted : colors.surface },
                ]}
                onPress={() => setLeagueTab("table")}
              >
                <Text style={[styles.leagueTabText, { color: leagueTab === "table" ? colors.primary : colors.textMuted }]}>Table</Text>
              </Pressable>
            </View>

            {leagueTab === "table" ? (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>League Table</Text>
                <View style={styles.tableHeader}>
                  <Text style={[styles.tableHeaderName, { color: colors.textMuted }]}>Player</Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>P</Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>W</Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>L</Text>
                  <Text style={[styles.tableHeaderCellWide, { color: colors.textMuted }]}>FF</Text>
                  <Text style={[styles.tableHeaderCellWide, { color: colors.textMuted }]}>FA</Text>
                  <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>Pts</Text>
                </View>
                {standings.map((row, index) => (
                  <View key={row.name} style={[styles.tableRow, { backgroundColor: index % 2 === 0 ? colors.surfaceMuted : "transparent", borderRadius: 8 }]}> 
                    <Text style={[styles.tableName, { color: colors.text }]} numberOfLines={1}>
                      {index + 1}. {row.name}
                    </Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>{row.p}</Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>{row.w}</Text>
                    <Text style={[styles.tableCell, { color: colors.text }]}>{row.l}</Text>
                    <Text style={[styles.tableCellWide, { color: colors.text }]}>{row.f}</Text>
                    <Text style={[styles.tableCellWide, { color: colors.text }]}>{row.a}</Text>
                    <Text style={[styles.tablePts, { color: index < 2 ? colors.primary : colors.text }]}>{row.pts}</Text>
                  </View>
                ))}
              </>
            ) : (
              <>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>League Fixtures</Text>
            <View style={styles.dropdownWrap}>
              <Pressable
                onPress={() => setIsFilterOpen((prev) => !prev)}
                style={[styles.dropdownTrigger, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              >
                <Text style={[styles.dropdownLabel, { color: colors.text }]}>{selectedLeaguePlayer === "All" ? "All Players" : selectedLeaguePlayer}</Text>
                <Text style={[styles.dropdownCaret, { color: colors.primary }]}>{isFilterOpen ? "▲" : "▼"}</Text>
              </Pressable>
              {isFilterOpen ? (
                <View style={[styles.dropdownMenu, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  {["All", ...tournament.participants].map((name) => (
                    <Pressable
                      key={name}
                      onPress={() => {
                        setSelectedLeaguePlayer(name);
                        setIsFilterOpen(false);
                      }}
                      style={styles.dropdownItem}
                    >
                      <Text
                        style={[
                          styles.dropdownItemText,
                          { color: selectedLeaguePlayer === name ? colors.primary : colors.text },
                        ]}
                      >
                        {name === "All" ? "All Players" : name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>

                {groupedLeagueFixtures.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No fixtures available for this filter.</Text>
                ) : (
                  groupedLeagueFixtures.map((group) => (
                    <View key={`day-${group.day}`} style={styles.matchdayBlock}>
                      <Pressable
                        style={[styles.fixtureCollapseHeader, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                        onPress={() =>
                          setCollapsedLeagueMatchdays((prev) => ({
                            ...prev,
                            [group.day]: !prev[group.day],
                          }))
                        }
                      >
                        <Text style={[styles.matchdayTitle, { color: colors.textMuted }]}>Matchday {group.day}</Text>
                        <Text style={[styles.matchdayCaret, { color: colors.textMuted }]}>{collapsedLeagueMatchdays[group.day] ? "▼" : "▲"}</Text>
                      </Pressable>
                      {!collapsedLeagueMatchdays[group.day]
                        ? group.fixtures.map((fixture, fixtureIndex) => (
                            <FixtureRow
                              key={fixture.id}
                              fixture={fixture}
                              delay={40 * (fixtureIndex + 1)}
                              colors={colors}
                              collapsible
                              initialExpanded={false}
                              onSave={(fixtureId, frameScores) => updateFixtureResult(tournament.id, fixtureId, { frameScores })}
                            />
                          ))
                        : null}
                    </View>
                  ))
                )}
              </>
            )}
          </View>
        </>
      ) : null}

      {tournament.tournament_type === "knockout"
        ? rounds.map((round, roundIndex) => (
          <View key={`round-${round.round}`} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Pressable
                style={[styles.fixtureCollapseHeader, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                onPress={() =>
                  setCollapsedKnockoutRounds((prev) => ({
                    ...prev,
                    [round.round]: !prev[round.round],
                  }))
                }
              >
                <Text style={[styles.sectionTitle, { color: colors.text, marginBottom: 0 }]}>{roundLabel(round.round, rounds.length)}</Text>
                <Text style={[styles.matchdayCaret, { color: colors.textMuted }]}>{collapsedKnockoutRounds[round.round] ? "▼" : "▲"}</Text>
              </Pressable>
              {!collapsedKnockoutRounds[round.round] ? (
                round.fixtures.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>No matches in this round yet.</Text>
                ) : (
                  round.fixtures
                    .sort((a, b) => a.fixture_index - b.fixture_index)
                    .map((fixture, fixtureIndex) => (
                      <FixtureRow
                        key={fixture.id}
                        fixture={fixture}
                        delay={60 * (fixtureIndex + 1 + roundIndex)}
                        colors={colors}
                        onSave={(fixtureId, frameScores) => updateFixtureResult(tournament.id, fixtureId, { frameScores })}
                      />
                    ))
                )
              ) : null}
            </View>
          ))
        : null}

    </ScrollView>

    <Modal visible={showActionsModal} transparent animationType="slide" onRequestClose={() => setShowActionsModal(false)}>
      <Pressable style={styles.sheetBackdrop} onPress={() => setShowActionsModal(false)} accessibilityLabel="Close options">
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => null}
          accessibilityViewIsModal
        >
          <View style={[styles.sheetGrabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>{tournament.name}</Text>
          <Text style={[styles.sheetSubtitle, { color: colors.textMuted }]}>
            {realPlayerCount} players · {completion.done} of {completion.total} played
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.sheetItem,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
            ]}
            onPress={() => {
              setShowActionsModal(false);
              handleFreshStart();
            }}
            accessibilityRole="button"
            accessibilityLabel="Start the same field again"
          >
            <MaterialCommunityIcons name="restart" size={20} color={colors.text} />
            <View style={styles.sheetItemText}>
              <Text style={[styles.sheetItemTitle, { color: colors.text }]}>Start again</Text>
              <Text style={[styles.sheetItemMeta, { color: colors.textMuted }]}>Same players, a fresh draw</Text>
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.sheetItem,
              { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
            ]}
            onPress={() => {
              setShowActionsModal(false);
              handleDeleteTournament();
            }}
            accessibilityRole="button"
            accessibilityLabel="Delete this tournament"
          >
            <MaterialCommunityIcons name="trash-can-outline" size={20} color={colors.danger} />
            <View style={styles.sheetItemText}>
              <Text style={[styles.sheetItemTitle, { color: colors.danger }]}>Delete tournament</Text>
              <Text style={[styles.sheetItemMeta, { color: colors.textMuted }]}>The bracket and every result go with it</Text>
            </View>
          </Pressable>

          <Pressable onPress={() => setShowActionsModal(false)} style={styles.sheetCancel} accessibilityRole="button">
            <Text style={[styles.sheetCancelText, { color: colors.textMuted }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>

    <Modal visible={showChampionModal && !!completion.champion} transparent animationType="fade" onRequestClose={() => setShowChampionModal(false)}>
      <View style={styles.championOverlay}>
        <View style={[styles.championCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.championTitle, { color: colors.primary }]}>Champion</Text>
          <Text style={[styles.championName, { color: colors.text }]}>{completion.champion}</Text>
          <Text style={[styles.championSubtitle, { color: colors.textMuted }]}>Tournament complete with {completion.done} fixtures recorded.</Text>

          <View style={styles.championActions}>
            <Pressable style={[styles.championButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => setShowChampionModal(false)}>
              <Text style={[styles.championButtonText, { color: colors.text }]}>View Summary</Text>
            </Pressable>
            <Pressable
              style={[styles.championButton, { backgroundColor: colors.primary, borderColor: colors.primaryStrong }]}
              onPress={() => {
                setShowChampionModal(false);
                navigation.navigate("NewTournament", {
                  prefill: {
                    name: tournament.name,
                    participants: tournament.participants,
                    tournamentType: tournament.tournament_type,
                    entryMode: tournament.entry_mode,
                    pairingMode: tournament.pairing_mode,
                    bestOfFrames: tournament.best_of_frames,
                    previousChampion: completion.champion ?? undefined,
                  },
                });
              }}
            >
              <Text style={[styles.championButtonText, { color: colors.onPrimary }]}>Start New Tournament</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  confettiLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  confettiPiece: {
    position: "absolute",
    top: 0,
    fontSize: 18,
  },
  content: { padding: 16, paddingBottom: 24 },
  hero: { borderRadius: 16, padding: 14, marginBottom: 12 },
  heroAmbientGlow: {
    position: "absolute",
    right: -40,
    top: -30,
    width: 180,
    height: 180,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  heroTopActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  heroNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    paddingRight: 8,
  },
  heroIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
    paddingRight: 8,
  },
  heroLeadIcon: {
    fontSize: 26,
  },
  heroTitleWrap: {
    flex: 1,
  },
  heroStageText: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "700",
  },
  heroBadge: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
  },
  heroActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  iconAction: {
    borderRadius: 999,
    width: 36,
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconActionText: { fontSize: 12, fontWeight: "700" },
  heroTitle: { fontSize: 24, fontWeight: "800" },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  heroKicker: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  heroFactsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: SPACING.lg,
  },
  heroFact: {
    flex: 1,
    alignItems: "center",
  },
  heroFactValue: {
    fontSize: 20,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  heroFactLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  heroFactDivider: {
    width: 1,
    height: 28,
  },
  heroProgressText: {
    fontSize: 12,
    marginTop: SPACING.sm,
  },
  championBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.lg,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  championBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  heroFootnote: {
    fontSize: 12,
    marginTop: SPACING.md,
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(4, 10, 8, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  sheetGrabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.lg,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  sheetSubtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: SPACING.lg,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: 56,
  },
  sheetItemText: {
    flex: 1,
  },
  sheetItemTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sheetItemMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  sheetCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  heroMeta: { marginTop: 6, fontSize: 13, fontWeight: "600" },
  heroChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  heroChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroChipText: {
    fontSize: 11,
    fontWeight: "800",
  },
  heroStatusRow: {
    marginTop: 4,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroProgressLabel: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  heroProgressRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  heroProgressTrack: {
    flex: 1,
    height: 8,
    borderRadius: 999,
    overflow: "hidden",
  },
  heroProgressFill: {
    height: "100%",
    borderRadius: 999,
  },
  heroProgressMetaRow: {
    marginTop: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  championText: { marginTop: 8, fontSize: 16, fontWeight: "800" },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  tie: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    marginTop: SPACING.md,
  },
  tieSeat: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 48,
  },
  tieName: {
    flex: 1,
    fontSize: 15,
  },
  tieScore: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    minWidth: 20,
    textAlign: "right",
  },
  fixtureHeadRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  bestOfBadge: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  fixturePlayersRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  playerCell: {
    flex: 1,
    alignItems: "center",
  },
  fixtureCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  fixtureName: { flex: 1, fontSize: 13, fontWeight: "700", textAlign: "center" },
  playerSubMeta: {
    marginTop: 2,
    fontSize: 18,
    fontWeight: "800",
  },
  vsText: { fontSize: 12, fontWeight: "700" },
  expandRow: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expandLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  resultRow: { marginTop: 8 },
  frameLabel: { fontSize: 12, fontWeight: "700" },
  frameList: { marginTop: 8, gap: 6 },
  frameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  frameIndex: { width: 26, fontSize: 11, fontWeight: "700" },
  scoreInput: {
    width: 58,
    borderWidth: 1,
    borderRadius: 9,
    paddingHorizontal: 8,
    paddingVertical: 8,
    textAlign: "center",
    fontWeight: "700",
  },
  hyphen: { fontWeight: "700" },
  saveChip: { marginTop: 10, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, alignSelf: "flex-start" },
  saveChipText: { fontSize: 12, fontWeight: "700" },
  liveChip: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  liveChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  matchScoreText: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  winnerText: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  bracketRow: { flexDirection: "row", gap: 12, paddingBottom: 4 },
  bracketColumn: { width: 176, justifyContent: "space-around" },
  bracketTitle: { fontSize: 10, fontWeight: "800", letterSpacing: 1, marginBottom: 8 },
  bracketTie: {
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  bracketSeat: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 9,
    paddingHorizontal: 10,
    gap: 8,
  },
  bracketSeatName: { fontSize: 13, flexShrink: 1 },
  bracketSeatScore: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  bracketWalkover: { fontSize: 11, marginTop: 2 },
  bracketEmpty: { fontSize: 12, fontStyle: "italic" },
  leagueTabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  leagueTab: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
  },
  leagueTabText: {
    fontSize: 12,
    fontWeight: "800",
  },
  tableHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  tableHeaderName: { flex: 1.6, fontSize: 11, fontWeight: "700" },
  tableHeaderCell: { width: 26, textAlign: "center", fontSize: 11, fontWeight: "700" },
  tableHeaderCellWide: { width: 34, textAlign: "center", fontSize: 11, fontWeight: "700" },
  tableRow: { marginTop: 6, flexDirection: "row", alignItems: "center" },
  tableName: { flex: 1.6, fontSize: 12, fontWeight: "700", paddingRight: 6 },
  tableCell: { width: 26, textAlign: "center", fontSize: 12, fontWeight: "700" },
  tableCellWide: { width: 34, textAlign: "center", fontSize: 12, fontWeight: "700" },
  tablePts: { width: 32, textAlign: "center", fontSize: 12, fontWeight: "800" },
  matchdayBlock: {
    marginBottom: 10,
  },
  fixtureCollapseHeader: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  matchdayTitle: {
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  matchdayCaret: {
    fontSize: 12,
    fontWeight: "800",
  },
  dropdownWrap: { marginBottom: 10 },
  dropdownTrigger: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownLabel: { fontSize: 12, fontWeight: "700" },
  dropdownCaret: { fontSize: 12, fontWeight: "700" },
  dropdownMenu: {
    marginTop: 6,
    borderWidth: 1,
    borderRadius: 10,
  },
  dropdownItem: {
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  dropdownItemText: {
    fontSize: 12,
    fontWeight: "700",
  },
  championOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.56)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  championCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  championTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  championName: {
    marginTop: 8,
    fontSize: 28,
    fontWeight: "900",
  },
  championSubtitle: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "600",
  },
  championActions: {
    marginTop: 14,
    flexDirection: "row",
    gap: 8,
  },
  championButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  championButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 18,
  },
  actionsCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  actionsTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  actionsItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    marginTop: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  actionsItemText: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionsCancel: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    alignItems: "center",
  },
  actionsCancelText: {
    fontSize: 12,
    fontWeight: "700",
  },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14 },
});
