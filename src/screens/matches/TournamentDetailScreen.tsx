import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useTournamentsStore } from "../../store";
import type { MatchesStackParamList, TournamentFixture, TournamentFrameScore } from "../../types";

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
  const isByeA = /^BYE\b/i.test(fixture.participant_a);
  const isByeB = /^BYE\b/i.test(fixture.participant_b);
  const isAutoAdvanced = (isByeA && !isByeB) || (isByeB && !isByeA);
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
      Alert.alert("Enter frame scores", "Add at least one completed frame before saving.");
      return;
    }

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
      <View style={styles.rowBetween}>
        <Text style={[styles.fixtureName, { color: colors.text }]}>{fixture.participant_a}</Text>
        <Text style={[styles.vsText, { color: colors.textMuted }]}>vs</Text>
        <Text style={[styles.fixtureName, { color: colors.text }]}>{fixture.participant_b}</Text>
      </View>

      {collapsible ? (
        <Pressable style={styles.expandRow} onPress={() => setIsExpanded((prev) => !prev)}>
          <Text style={[styles.expandLabel, { color: colors.textMuted }]}>{isExpanded ? "Hide Frames" : "Edit Frames"}</Text>
          <Text style={[styles.expandLabel, { color: colors.primary }]}>{isExpanded ? "▲" : "▼"}</Text>
        </Pressable>
      ) : null}

      {isAutoAdvanced ? (
        <Text style={[styles.matchScoreText, { color: colors.textMuted }]}>Auto-advanced via BYE</Text>
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
        <Text style={[styles.matchScoreText, { color: colors.textMuted }]}>Frames: {fixture.score_a} - {fixture.score_b}</Text>
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
  const { colors } = useAppTheme();
  const { getTournamentById, updateFixtureResult, deleteTournament } = useTournamentsStore();
  const tournament = getTournamentById(tournamentId);
  const [selectedLeaguePlayer, setSelectedLeaguePlayer] = useState<string>("All");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const { width } = useWindowDimensions();
  const confettiAnimations = useRef(
    Array.from({ length: 18 }, () => ({
      y: new Animated.Value(-20),
      x: new Animated.Value(0),
      rotate: new Animated.Value(0),
    }))
  ).current;
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

  const virtualKnockoutRounds = useMemo(() => {
    if (!tournament || tournament.tournament_type !== "knockout") return [];

    const roundsList: Array<{ title: string; names: string[] }> = [];
    let current = tournament.fixtures
      .filter((fixture) => fixture.round_number === 1)
      .flatMap((fixture) => [fixture.participant_a, fixture.participant_b]);

    roundsList.push({ title: "Round 1", names: current });

    let stage = 2;
    while (current.length > 2) {
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const left = current[i];
        const right = current[i + 1];
        const matching = tournament.fixtures.find(
          (fixture) =>
            fixture.round_number === stage - 1 &&
            ((fixture.participant_a === left && fixture.participant_b === right) ||
              (fixture.participant_a === right && fixture.participant_b === left))
        );

        next.push(matching?.winner ?? `Winner ${i / 2 + 1}`);
      }
      roundsList.push({ title: stage === 3 ? "Semi Final" : stage > 3 ? "Final" : `Round ${stage}`, names: next });
      current = next;
      stage += 1;
    }

    if (current.length === 2) {
      roundsList.push({ title: "Final", names: current });
    }

    return roundsList;
  }, [tournament]);

  const standings = useMemo(() => {
    if (!tournament || tournament.tournament_type !== "league") return [];

    const table = new Map<string, { p: number; w: number; d: number; l: number; f: number; a: number; pts: number }>();
    tournament.participants.forEach((name) => table.set(name, { p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0 }));

    tournament.fixtures.forEach((fixture) => {
      if (fixture.status !== "completed" || fixture.score_a === undefined || fixture.score_b === undefined) return;

      const a = table.get(fixture.participant_a);
      const b = table.get(fixture.participant_b);
      if (!a || !b) return;

      a.p += 1;
      b.p += 1;
      a.f += fixture.score_a;
      a.a += fixture.score_b;
      b.f += fixture.score_b;
      b.a += fixture.score_a;

      a.pts += fixture.score_a * 3;
      b.pts += fixture.score_b * 3;

      if (fixture.score_a > fixture.score_b) {
        a.w += 1;
        b.l += 1;
      } else if (fixture.score_a < fixture.score_b) {
        b.w += 1;
        a.l += 1;
      } else {
        a.d += 1;
        b.d += 1;
      }
    });

    return Array.from(table.entries())
      .map(([name, record]) => ({ name, ...record }))
      .sort((x, y) => y.pts - x.pts || y.f - y.a - (x.f - x.a));
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

  useEffect(() => {
    if (!previousCompletedRef.current && completion.completed) {
      setShowCelebration(true);
      previousCompletedRef.current = true;

      confettiAnimations.forEach((particle, index) => {
        particle.y.setValue(-20);
        particle.x.setValue((index % 2 === 0 ? -1 : 1) * (20 + (index % 5) * 12));
        particle.rotate.setValue(0);

        Animated.parallel([
          Animated.timing(particle.y, {
            toValue: 520 + (index % 4) * 20,
            duration: 1700 + index * 30,
            useNativeDriver: true,
          }),
          Animated.timing(particle.x, {
            toValue: ((index % 3) - 1) * (80 + index * 2),
            duration: 1700,
            useNativeDriver: true,
          }),
          Animated.timing(particle.rotate, {
            toValue: 1,
            duration: 1700,
            useNativeDriver: true,
          }),
        ]).start();
      });

      const timeout = setTimeout(() => setShowCelebration(false), 2200);
      return () => clearTimeout(timeout);
    }

    previousCompletedRef.current = completion.completed;
    return undefined;
  }, [completion.completed, confettiAnimations]);

  if (!tournament) {
    return (
      <View style={[styles.emptyWrap, { backgroundColor: colors.background }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Tournament not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      {showCelebration ? (
        <View pointerEvents="none" style={styles.confettiLayer}>
          {confettiAnimations.map((particle, index) => (
            <Animated.Text
              key={`confetti-${index}`}
              style={[
                styles.confettiPiece,
                {
                  left: width / 2,
                  transform: [
                    { translateX: particle.x },
                    { translateY: particle.y },
                    {
                      rotate: particle.rotate.interpolate({
                        inputRange: [0, 1],
                        outputRange: ["0deg", `${180 + index * 22}deg`],
                      }),
                    },
                  ],
                },
              ]}
            >
              {index % 3 === 0 ? "🎉" : index % 3 === 1 ? "✨" : "🎊"}
            </Animated.Text>
          ))}
        </View>
      ) : null}
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.primaryStrong }]}> 
        <View style={styles.heroTopActions}>
          <Pressable
            style={[styles.iconAction, { backgroundColor: "rgba(255,255,255,0.16)" }]}
            onPress={() => {
              if (tournament.tournament_type === "knockout") {
                Alert.alert("Fresh Start", "How should round one fixtures be generated?", [
                  {
                    text: "Manual",
                    onPress: () => {
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
                  },
                  {
                    text: "Random",
                    onPress: () => {
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
                  },
                  { text: "Cancel", style: "cancel" },
                ]);
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
            }}
          >
            <MaterialCommunityIcons name="restart" size={18} color={colors.onPrimary} />
            <Text style={[styles.iconActionText, { color: colors.onPrimary }]}>Fresh Start</Text>
          </Pressable>

          <Pressable
            style={[styles.iconAction, { backgroundColor: "rgba(127,29,29,0.65)" }]}
            onPress={() => {
              Alert.alert("Delete Tournament", "This tournament and all fixtures will be removed.", [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await deleteTournament(tournament.id);
                      navigation.goBack();
                    } catch (error) {
                      Alert.alert("Delete failed", "Could not delete this tournament right now.");
                    }
                  },
                },
              ]);
            }}
          >
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.onPrimary} />
          </Pressable>
        </View>

        <Text style={[styles.heroTitle, { color: colors.onPrimary }]}>{tournament.name}</Text>
        <Text style={[styles.heroMeta, { color: "#C7E1D7" }]}> 
          {tournament.tournament_type.toUpperCase()} · {tournament.entry_mode.toUpperCase()} · Best of {tournament.best_of_frames}
        </Text>
        <Text style={[styles.heroMeta, { color: "#C7E1D7" }]}>Completed Fixtures: {completion.done}/{completion.total}</Text>
        {completion.champion ? (
          <Text style={[styles.championText, { color: colors.onPrimary }]}>Champion: {completion.champion}</Text>
        ) : null}
        {tournament.previous_champion ? (
          <Text style={[styles.heroMeta, { color: "#C7E1D7" }]}>Previous champion: {tournament.previous_champion}</Text>
        ) : null}
      </View>

      {tournament.tournament_type === "knockout" ? (
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Live Bracket Projection</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.bracketRow}>
              {virtualKnockoutRounds.map((round, index) => (
                <Animated.View
                  key={round.title + index}
                  style={[styles.bracketColumn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                >
                  <Text style={[styles.bracketTitle, { color: colors.text }]}>{round.title}</Text>
                  {round.names.map((name, i) => (
                    <Text key={`${round.title}-${i}`} style={[styles.bracketName, { color: colors.textMuted }]}>• {name}</Text>
                  ))}
                </Animated.View>
              ))}
            </View>
          </ScrollView>
        </View>
      ) : null}

      {tournament.tournament_type === "league" ? (
        <>
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>League Table</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderName, { color: colors.textMuted }]}>Player</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>P</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>W</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>D</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>L</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>+/-</Text>
              <Text style={[styles.tableHeaderCell, { color: colors.textMuted }]}>Pts</Text>
            </View>
            {standings.map((row, index) => (
              <View
                key={row.name}
                style={[
                  styles.tableRow,
                  completion.completed && index === 0
                    ? { backgroundColor: colors.surfaceMuted, borderRadius: 8, paddingVertical: 4 }
                    : null,
                ]}
              >
                <Text style={[styles.tableName, { color: colors.text }]} numberOfLines={1}>
                  {index + 1}. {row.name}
                </Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{row.p}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{row.w}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{row.d}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{row.l}</Text>
                <Text style={[styles.tableCell, { color: colors.text }]}>{row.f - row.a}</Text>
                <Text style={[styles.tablePts, { color: colors.primary }]}>{row.pts}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
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

            {leagueFixtures.map((fixture, fixtureIndex) => (
              <FixtureRow
                key={fixture.id}
                fixture={fixture}
                delay={40 * (fixtureIndex + 1)}
                colors={colors}
                collapsible
                initialExpanded={false}
                onSave={(fixtureId, frameScores) => updateFixtureResult(tournament.id, fixtureId, { frameScores })}
              />
            ))}
          </View>
        </>
      ) : null}

      {tournament.tournament_type === "knockout"
        ? rounds.map((round, roundIndex) => (
        <View key={`round-${round.round}`} style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{roundLabel(round.round, rounds.length)}</Text>
          {round.fixtures
            .sort((a, b) => a.fixture_index - b.fixture_index)
            .map((fixture, fixtureIndex) => (
              <FixtureRow
                key={fixture.id}
                fixture={fixture}
                delay={60 * (fixtureIndex + 1 + roundIndex)}
                colors={colors}
                onSave={(fixtureId, frameScores) => updateFixtureResult(tournament.id, fixtureId, { frameScores })}
              />
            ))}
        </View>
      ))
        : null}

    </ScrollView>
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
  heroTopActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  iconAction: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  iconActionText: { fontSize: 12, fontWeight: "700" },
  heroTitle: { fontSize: 24, fontWeight: "800" },
  heroMeta: { marginTop: 6, fontSize: 13, fontWeight: "600" },
  championText: { marginTop: 8, fontSize: 16, fontWeight: "800" },
  section: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  fixtureCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  fixtureName: { flex: 1, fontSize: 13, fontWeight: "700", textAlign: "center" },
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
  matchScoreText: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  winnerText: { marginTop: 8, fontSize: 12, fontWeight: "700" },
  bracketRow: { flexDirection: "row", gap: 8, paddingBottom: 4 },
  bracketColumn: { width: 170, borderWidth: 1, borderRadius: 12, padding: 10 },
  bracketTitle: { fontSize: 13, fontWeight: "800", marginBottom: 4 },
  bracketName: { fontSize: 12, marginBottom: 3 },
  tableHeader: { flexDirection: "row", alignItems: "center", marginBottom: 4 },
  tableHeaderName: { flex: 1.6, fontSize: 11, fontWeight: "700" },
  tableHeaderCell: { width: 26, textAlign: "center", fontSize: 11, fontWeight: "700" },
  tableRow: { marginTop: 6, flexDirection: "row", alignItems: "center" },
  tableName: { flex: 1.6, fontSize: 12, fontWeight: "700", paddingRight: 6 },
  tableCell: { width: 26, textAlign: "center", fontSize: 12, fontWeight: "700" },
  tablePts: { width: 32, textAlign: "center", fontSize: 12, fontWeight: "800" },
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
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14 },
});
