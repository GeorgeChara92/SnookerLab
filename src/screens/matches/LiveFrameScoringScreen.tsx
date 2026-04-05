import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LiveFrameEvent as SavedLiveFrameEvent, MatchesStackParamList } from "../../types";
import { useAuthStore, useMatchesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import {
  BALL_POINTS,
  COLOR_SEQUENCE,
  createInitialLiveFrameState,
  endVisit,
  getFrameWinner,
  getPointsRemaining,
  getSnookersRequired,
  potBall,
  reRack,
  recordFoul,
  switchPlayer,
  type LiveBall,
  type LiveFoulType,
  type LiveFrameState,
} from "../../features/matches/liveFrameEngine";

const BALL_META: Array<{ key: LiveBall; color: string; textColor: string }> = [
  { key: "red", color: "#C7343A", textColor: "#FFFFFF" },
  { key: "yellow", color: "#FFD75A", textColor: "#2A2400" },
  { key: "green", color: "#1FA15A", textColor: "#FFFFFF" },
  { key: "brown", color: "#8C5A3B", textColor: "#FFFFFF" },
  { key: "blue", color: "#2B76C6", textColor: "#FFFFFF" },
  { key: "pink", color: "#E764A1", textColor: "#FFFFFF" },
  { key: "black", color: "#1E1E1E", textColor: "#FFFFFF" },
];

const BALL_ROWS: LiveBall[][] = [
  ["red", "yellow", "green", "brown"],
  ["blue", "pink", "black"],
];

const FOUL_OPTIONS: Array<{ value: 4 | 5 | 6 | 7; label: string }> = [
  { value: 4, label: "4" },
  { value: 5, label: "5" },
  { value: 6, label: "6" },
  { value: 7, label: "7" },
];

const FOUL_TYPES: Array<{ key: LiveFoulType; label: string }> = [
  { key: "in_off", label: "In-off" },
  { key: "foul_and_miss", label: "Foul and a miss" },
  { key: "push_shot", label: "Push shot" },
  { key: "touching_ball", label: "Touching ball" },
  { key: "wrong_ball", label: "Wrong ball" },
  { key: "other", label: "Other foul" },
];

const FOUL_LABELS: Record<LiveFoulType, string> = {
  in_off: "In-off",
  foul_and_miss: "Foul and a miss",
  push_shot: "Push shot",
  touching_ball: "Touching ball",
  wrong_ball: "Wrong ball",
  other: "Other foul",
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getBestOfFrames = (format: string, targetFrames?: number) => {
  if (!targetFrames || targetFrames <= 0) return undefined;
  if (format === "best_of") return targetFrames;
  if (format === "first_to") return targetFrames * 2 - 1;
  return targetFrames;
};

const getFirstToWins = (bestOfFrames?: number) => {
  if (!bestOfFrames || bestOfFrames <= 0) return undefined;
  return Math.floor(bestOfFrames / 2) + 1;
};

const summarizeFrameStats = (state: LiveFrameState) => {
  const pots = state.events.filter((event) => event.kind === "pot");
  const fouls = state.events.filter((event) => event.kind === "foul");
  const scoringVisits = state.breakHistory.length + (state.currentBreak > 0 ? 1 : 0);
  const totalBreakPoints = state.breakHistory.reduce((sum, entry) => sum + entry.points, 0) + state.currentBreak;
  const averageBreak = scoringVisits > 0 ? totalBreakPoints / scoringVisits : 0;

  return {
    potsCount: pots.length,
    foulCount: fouls.length,
    scoringVisits,
    averageBreak,
    penaltiesAwarded: fouls.reduce((sum, event) => sum + (event.foulValue ?? 0), 0),
  };
};

export const LiveFrameScoringScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "LiveFrameScoring">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuthStore();
  const { getMatchById, getFrameRecordsByMatchId, getNextFrameNumber, saveFrameRecord, updateMatch } = useMatchesStore();
  const match = getMatchById(route.params.matchId);

  const frameRecords = getFrameRecordsByMatchId(route.params.matchId);
  const frameNumber = useMemo(() => getNextFrameNumber(route.params.matchId), [getNextFrameNumber, route.params.matchId, frameRecords.length]);
  const [frame, setFrame] = useState<LiveFrameState>(() => createInitialLiveFrameState(frameNumber));
  const [undoStack, setUndoStack] = useState<LiveFrameState[]>([]);
  const [isFoulOpen, setIsFoulOpen] = useState(false);
  const [foulValue, setFoulValue] = useState<4 | 5 | 6 | 7>(4);
  const [foulType, setFoulType] = useState<LiveFoulType>("other");
  const [foulNote, setFoulNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUpdatingRace, setIsUpdatingRace] = useState(false);
  const [raceToInput, setRaceToInput] = useState("4");
  const [foulBannerText, setFoulBannerText] = useState<string | null>(null);
  const [selectedSavedFrameId, setSelectedSavedFrameId] = useState<string | null>(null);

  const scorePulse = useRef(new Animated.Value(1)).current;
  const breakPulse = useRef(new Animated.Value(1)).current;
  const foulBannerY = useRef(new Animated.Value(-70)).current;

  const pointsRemaining = getPointsRemaining(frame);
  const snookersRequired = getSnookersRequired(frame);
  const isFrameComplete = frame.phase === "ended";
  const bestOfFrames = getBestOfFrames(match?.format ?? "", match?.target_frames) ?? 7;
  const firstToWins = getFirstToWins(bestOfFrames);

  const userLabel = user?.username?.trim() || "You";
  const opponentLabel = match?.opponent_name ?? "Opponent";

  const matchFrameWins = useMemo(() => {
    return frameRecords.reduce(
      (acc, record) => {
        if (record.winner === "user") acc.user += 1;
        if (record.winner === "opponent") acc.opponent += 1;
        return acc;
      },
      { user: 0, opponent: 0 }
    );
  }, [frameRecords]);

  const isMatchComplete = useMemo(() => {
    if (!firstToWins) return false;
    return matchFrameWins.user >= firstToWins || matchFrameWins.opponent >= firstToWins;
  }, [firstToWins, matchFrameWins.opponent, matchFrameWins.user]);

  const frameStats = useMemo(() => summarizeFrameStats(frame), [frame]);
  const selectedSavedFrame = useMemo(() => frameRecords.find((record) => record.id === selectedSavedFrameId), [frameRecords, selectedSavedFrameId]);

  const ui = useMemo(
    () =>
      isDark
        ? {
            page: "#081310",
            panel: "#0F201A",
            panelAlt: "#0E1B17",
            panelSoft: "#11231D",
            border: "#2C4D41",
            borderStrong: "#3B5E52",
            text: "#ECFFF7",
            textMuted: "#9BC7B8",
            accent: "#7CE0B8",
            snookerBg: "#4C1F1F",
            snookerBorder: "#975050",
            snookerText: "#FCD8D8",
          }
        : {
            page: "#EDF3F0",
            panel: "#FFFFFF",
            panelAlt: "#F5F9F7",
            panelSoft: "#FFFFFF",
            border: "#D4DFDA",
            borderStrong: "#BCD0C9",
            text: "#102A24",
            textMuted: "#5A6F68",
            accent: "#0F5A43",
            snookerBg: "#FCECEC",
            snookerBorder: "#E1B8B8",
            snookerText: "#7D2A2A",
          },
    [isDark]
  );

  useEffect(() => {
    if (!match) return;
    const currentBestOf = getBestOfFrames(match.format, match.target_frames) ?? 7;
    setRaceToInput(String(currentBestOf));
  }, [match?.format, match?.target_frames]);

  const syncRaceInputFromMatch = () => {
    if (!match) return;
    const currentBestOf = getBestOfFrames(match.format, match.target_frames) ?? 7;
    setRaceToInput(String(currentBestOf));
  };

  const applyRaceToUpdate = async (value: number) => {
    if (!match || value < 1) return;
    try {
      setIsUpdatingRace(true);
      await updateMatch(match.id, {
        format: "best_of",
        target_frames: value,
        sync_status: "pending",
      });
      setRaceToInput(String(value));
    } catch (error) {
      Alert.alert("Update failed", "Could not update match frame target right now.");
    } finally {
      setIsUpdatingRace(false);
    }
  };

  const animateScoreChange = () => {
    Animated.sequence([
      Animated.timing(scorePulse, { toValue: 1.05, duration: 130, useNativeDriver: true }),
      Animated.timing(scorePulse, { toValue: 1, duration: 130, useNativeDriver: true }),
    ]).start();
  };

  const animateBreakPulse = () => {
    Animated.sequence([
      Animated.timing(breakPulse, { toValue: 1.08, duration: 120, useNativeDriver: true }),
      Animated.timing(breakPulse, { toValue: 1, duration: 120, useNativeDriver: true }),
    ]).start();
  };

  const showFoulBanner = (text: string) => {
    setFoulBannerText(text);
    Animated.sequence([
      Animated.timing(foulBannerY, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.delay(1000),
      Animated.timing(foulBannerY, { toValue: -70, duration: 220, useNativeDriver: true }),
    ]).start(() => setFoulBannerText(null));
  };

  const applyFrameMutation = (mutator: (state: LiveFrameState) => LiveFrameState, options?: { scoreChange?: boolean }) => {
    setFrame((current) => {
      const next = mutator(current);
      if (next === current) return current;
      setUndoStack((stack) => [current, ...stack].slice(0, 180));
      if (options?.scoreChange) {
        animateScoreChange();
        if (next.currentBreak > current.currentBreak) animateBreakPulse();
      }
      return next;
    });
  };

  const handlePot = (ball: LiveBall) => {
    if (frame.phase === "colors") {
      const expected = COLOR_SEQUENCE[frame.nextColorIndex];
      if (ball !== expected) {
        Alert.alert("Colors sequence", `Next ball on is ${expected.toUpperCase()}.`);
        return;
      }
    }

    applyFrameMutation((state) => potBall(state, ball), { scoreChange: true });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    setFrame(previous);
    setUndoStack(rest);
  };

  const handleReRack = () => {
    Alert.alert("Re-rack frame", "This will reset score, breaks, and event log for this frame.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Re-rack",
        style: "destructive",
        onPress: () => {
          setUndoStack([]);
          setFrame((current) => reRack(current));
        },
      },
    ]);
  };

  const applyFoul = () => {
    applyFrameMutation((state) => recordFoul(state, foulValue, foulType, foulNote.trim() || undefined), { scoreChange: true });
    showFoulBanner(`${FOUL_LABELS[foulType]} (+${foulValue})`);
    setFoulNote("");
    setIsFoulOpen(false);
  };

  const buildFrameRecordEvents = (): SavedLiveFrameEvent[] => [
    {
      id: makeId(),
      kind: "frame_saved",
      timestamp: new Date().toISOString(),
      player: frame.atTable,
    },
    ...(frame.events as SavedLiveFrameEvent[]),
  ];

  const persistFrame = async (abandoned: boolean) => {
    if (!match) return;
    try {
      setIsSaving(true);
      await saveFrameRecord(match.id, {
        frame_number: frame.frameNumber,
        user_score: frame.userScore,
        opponent_score: frame.opponentScore,
        winner: getFrameWinner(frame),
        highest_break_user: frame.highestBreakUser,
        highest_break_opponent: frame.highestBreakOpponent,
        breaks: frame.breakHistory,
        events: buildFrameRecordEvents(),
        abandoned,
      });

      const frameWinner = getFrameWinner(frame);
      const projectedWins = {
        user: matchFrameWins.user + (frameWinner === "user" ? 1 : 0),
        opponent: matchFrameWins.opponent + (frameWinner === "opponent" ? 1 : 0),
      };
      const projectedMatchWinner =
        firstToWins && projectedWins.user >= firstToWins
          ? userLabel
          : firstToWins && projectedWins.opponent >= firstToWins
            ? opponentLabel
            : null;

      Alert.alert(
        projectedMatchWinner ? "Match complete" : "Frame saved",
        projectedMatchWinner
          ? `${projectedMatchWinner} wins the match ${projectedWins.user}-${projectedWins.opponent}.`
          : abandoned
            ? "Frame saved as abandoned."
            : "Frame saved successfully.",
        [
        {
          text: "Next frame",
          style: projectedMatchWinner ? "cancel" : "default",
          isPreferred: !projectedMatchWinner,
          onPress: () => {
            const nextFrameNo = frame.frameNumber + 1;
            setFrame(createInitialLiveFrameState(nextFrameNo, frame.atTable));
            setUndoStack([]);
          },
        },
        { text: "Done", onPress: () => navigation.goBack() },
        ]
      );
    } catch (error) {
      Alert.alert("Save failed", "Could not save this frame right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFrame = () => {
    if (snookersRequired) {
      Alert.alert("End frame", "Trailing player requires snookers. End and save frame now?", [
        { text: "Cancel", style: "cancel" },
        { text: "End Frame", style: "destructive", onPress: () => persistFrame(false) },
      ]);
      return;
    }

    if (isFrameComplete) {
      persistFrame(false);
      return;
    }

    Alert.alert("Save incomplete frame?", "Frame is not finished. Save it as an abandoned frame?", [
      { text: "Cancel", style: "cancel" },
      { text: "Save Abandoned", onPress: () => persistFrame(true) },
    ]);
  };

  if (!match) {
    return (
      <View style={[styles.missingWrap, { backgroundColor: colors.background }]}> 
        <Text style={[styles.missingText, { color: colors.textMuted }]}>Match not found.</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ui.page }]}> 
      <Animated.View style={[styles.foulBanner, { transform: [{ translateY: foulBannerY }] }]}> 
        <Text style={styles.foulBannerText}>{foulBannerText ?? ""}</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 18 }]}> 
        <View style={styles.topMetaRow}>
          <Text style={[styles.topMetaText, { color: ui.textMuted }]}>Frame {frame.frameNumber}</Text>
          <Text style={[styles.topMetaText, { color: ui.textMuted }]}>Match {matchFrameWins.user}-{matchFrameWins.opponent}</Text>
        </View>

        {firstToWins ? (
          <View style={[styles.matchRaceBanner, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
            <Text style={[styles.matchRaceText, { color: ui.text }]}>Best out of {bestOfFrames} (First to {firstToWins})</Text>
            <Text style={[styles.matchRaceMeta, { color: ui.textMuted }]}> 
              {userLabel} {matchFrameWins.user} - {matchFrameWins.opponent} {opponentLabel}
            </Text>
            {isMatchComplete ? (
              <Text style={[styles.matchCompleteText, { color: ui.accent }]}> 
                Match complete: {matchFrameWins.user > matchFrameWins.opponent ? userLabel : opponentLabel} won.
              </Text>
            ) : null}
            <View style={styles.raceAdjustWrap}>
              {Array.from({ length: 10 }, (_, index) => index * 2 + 1).map((race) => (
                <Pressable
                  key={race}
                  style={[
                    styles.raceChip,
                    { backgroundColor: ui.panelSoft, borderColor: ui.borderStrong },
                    String(race) === raceToInput && [styles.raceChipActive, { backgroundColor: colors.primaryStrong, borderColor: colors.primary }],
                  ]}
                  onPress={() => {
                    setRaceToInput(String(race));
                    applyRaceToUpdate(race);
                  }}
                >
                  <Text style={[styles.raceChipText, { color: ui.textMuted }, String(race) === raceToInput && [styles.raceChipTextActive, { color: colors.onPrimary }]]}>{race}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.raceRow}>
              <TextInput
                value={raceToInput}
                onFocus={syncRaceInputFromMatch}
                onChangeText={setRaceToInput}
                onEndEditing={() => {
                  const typed = Math.max(1, parseInt(raceToInput) || 1);
                  if (typed <= 19) {
                    applyRaceToUpdate(typed);
                  }
                }}
                keyboardType="numeric"
                style={[styles.raceInput, { borderColor: ui.borderStrong, backgroundColor: ui.panelSoft, color: ui.text }]}
                placeholder="Best out of"
                placeholderTextColor={ui.textMuted}
              />
              {(Math.max(1, parseInt(raceToInput) || 1) > 19) ? (
                <Pressable
                  style={[styles.raceApplyButton, { backgroundColor: colors.primaryStrong, borderColor: colors.primary }, isUpdatingRace && { opacity: 0.7 }]}
                  onPress={() => applyRaceToUpdate(Math.max(1, parseInt(raceToInput) || 1))}
                  disabled={isUpdatingRace}
                >
                  <Text style={[styles.raceApplyText, { color: colors.onPrimary }]}>{isUpdatingRace ? "Applying..." : "Set Best Of"}</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}

        <Animated.View style={[styles.scoreboardCard, { transform: [{ scale: scorePulse }], backgroundColor: ui.panel, borderColor: ui.border }]}> 
          <View style={[styles.playerPanel, { backgroundColor: ui.panelSoft, borderColor: ui.borderStrong }, frame.atTable === "user" && [styles.playerPanelActive, { borderColor: colors.primary }]]}>
            <Text style={[styles.playerName, { color: ui.textMuted }]}>{userLabel}</Text>
            <Text style={[styles.playerScore, { color: ui.text }]}>{frame.userScore}</Text>
            <Text style={[styles.breakMeta, { color: ui.textMuted }]}>High {frame.highestBreakUser}</Text>
          </View>

          <View style={styles.centerMeta}>
            <Text style={[styles.centerLabel, { color: ui.textMuted }]}>At Table</Text>
            <Text style={[styles.centerValue, { color: ui.text }]}>{frame.atTable === "user" ? userLabel : opponentLabel}</Text>
            <Animated.Text style={[styles.currentBreakText, { transform: [{ scale: breakPulse }], color: ui.accent }]}>Break {frame.currentBreak}</Animated.Text>
          </View>

          <View style={[styles.playerPanel, { backgroundColor: ui.panelSoft, borderColor: ui.borderStrong }, frame.atTable === "opponent" && [styles.playerPanelActive, { borderColor: colors.primary }]]}>
            <Text style={[styles.playerName, { color: ui.textMuted }]}>{opponentLabel}</Text>
            <Text style={[styles.playerScore, { color: ui.text }]}>{frame.opponentScore}</Text>
            <Text style={[styles.breakMeta, { color: ui.textMuted }]}>High {frame.highestBreakOpponent}</Text>
          </View>
        </Animated.View>

        <View style={styles.infoRow}>
          <View style={[styles.infoChip, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
            <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Reds Left</Text>
            <Text style={[styles.infoChipValue, { color: ui.text }]}>{frame.redsRemaining}</Text>
          </View>
          <View style={[styles.infoChip, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
            <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Points Remaining</Text>
            <Text style={[styles.infoChipValue, { color: ui.text }]}>{pointsRemaining}</Text>
          </View>
          <View style={[styles.infoChip, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
            <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Phase</Text>
            <Text style={[styles.infoChipValue, { color: ui.text }]}>{frame.phase.toUpperCase()}</Text>
          </View>
        </View>

        {snookersRequired ? (
          <View style={[styles.snookerBanner, { backgroundColor: ui.snookerBg, borderColor: ui.snookerBorder }]}> 
            <Text style={[styles.snookerBannerText, { color: ui.snookerText }]}> 
              {(snookersRequired.player === "user" ? userLabel : opponentLabel)} requires {snookersRequired.count} snooker
              {snookersRequired.count > 1 ? "s" : ""}
            </Text>
          </View>
        ) : null}

        <View style={styles.ballGrid}>
          {BALL_ROWS.map((row, rowIndex) => (
            <View key={`ball-row-${rowIndex}`} style={styles.ballRow}>
              {row.map((ballKey) => {
                const ballMeta = BALL_META.find((item) => item.key === ballKey)!;
                return (
                  <Pressable
                    key={ballMeta.key}
                    onPress={() => handlePot(ballMeta.key)}
                    style={({ pressed }) => [
                      styles.ballButton,
                      {
                        backgroundColor: ballMeta.color,
                        opacity: pressed ? 0.8 : 1,
                        transform: [{ scale: pressed ? 0.97 : 1 }],
                      },
                    ]}
                  >
                    <Text style={[styles.ballPoints, { color: ballMeta.textColor }]}>+{BALL_POINTS[ballMeta.key]}</Text>
                    <Text style={[styles.ballLabel, { color: ballMeta.textColor }]}>{ballMeta.key.toUpperCase()}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        <View style={styles.controlsWrap}>
          <AppButton label="End Visit" onPress={() => applyFrameMutation((state) => endVisit(state))} variant="secondary" />
          <AppButton label="Switch Player" onPress={() => applyFrameMutation((state) => switchPlayer(state))} variant="secondary" />
          <AppButton label="Foul" onPress={() => setIsFoulOpen(true)} variant="danger" />
          <AppButton label="Undo" onPress={handleUndo} disabled={undoStack.length === 0} variant="secondary" />
        </View>

        <View style={styles.secondaryControlsWrap}>
          <Pressable style={[styles.reRackButton, { backgroundColor: isDark ? "#3B3523" : "#EFE8D2", borderColor: isDark ? "#706B5A" : "#CDBD8F" }]} onPress={handleReRack}>
            <Text style={[styles.reRackText, { color: isDark ? "#F2E7B5" : "#6F5A20" }]}>Re-rack</Text>
          </Pressable>
          <Pressable style={[styles.saveButton, { backgroundColor: colors.primaryStrong, borderColor: colors.primary }]} onPress={handleSaveFrame} disabled={isSaving}>
            <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}> 
              {isSaving ? "Saving..." : snookersRequired ? "End Frame" : isFrameComplete ? "Save Frame" : "Save Abandoned"}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
          <Text style={[styles.sectionTitle, { color: ui.text }]}>Frame Analytics</Text>
          <View style={styles.analyticsGrid}>
            <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
              <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Pots</Text>
              <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.potsCount}</Text>
            </View>
            <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
              <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Fouls</Text>
              <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.foulCount}</Text>
            </View>
            <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
              <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Scoring Visits</Text>
              <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.scoringVisits}</Text>
            </View>
            <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
              <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Avg Break</Text>
              <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.averageBreak.toFixed(1)}</Text>
            </View>
            <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
              <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Penalty Pts</Text>
              <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.penaltiesAwarded}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
          <Text style={[styles.sectionTitle, { color: ui.text }]}>Frame Log</Text>
          {frame.events.length === 0 ? (
            <Text style={[styles.emptyLog, { color: ui.textMuted }]}>No events yet. Start potting to build the frame log.</Text>
          ) : (
            frame.events.slice(0, 18).map((event) => {
              const stamp = new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
              let message = "";

              if (event.kind === "pot") message = `${event.player === "user" ? userLabel : opponentLabel} potted ${event.ball} (+${event.points})`;
              if (event.kind === "foul") message = `${event.player === "user" ? userLabel : opponentLabel} foul ${event.foulValue} (${event.foulType ? FOUL_LABELS[event.foulType] : "foul"})`;
              if (event.kind === "visit_end") message = `${event.player === "user" ? userLabel : opponentLabel} ended visit`;
              if (event.kind === "switch") message = `Turn switched from ${event.player === "user" ? userLabel : opponentLabel}`;
              if (event.kind === "re_rack") message = "Frame re-racked";

              return (
                <View key={event.id} style={styles.eventRow}>
                  <Text style={[styles.eventMessage, { color: ui.text }]}>{message}</Text>
                  <Text style={[styles.eventTime, { color: ui.textMuted }]}>{stamp}</Text>
                </View>
              );
            })
          )}
        </View>

        <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
          <Text style={[styles.sectionTitle, { color: ui.text }]}>Saved Match Log</Text>
          {frameRecords.length === 0 ? (
            <Text style={[styles.emptyLog, { color: ui.textMuted }]}>No saved frames yet.</Text>
          ) : (
            frameRecords
              .slice()
              .sort((a, b) => b.frame_number - a.frame_number)
              .map((record) => (
                <Pressable key={record.id} style={[styles.savedFrameRow, { backgroundColor: ui.panelSoft, borderColor: ui.border }]} onPress={() => setSelectedSavedFrameId(record.id)}>
                  <Text style={[styles.savedFrameTitle, { color: ui.text }]}>Frame {record.frame_number}</Text>
                  <Text style={[styles.savedFrameScore, { color: ui.text }]}>{record.user_score}-{record.opponent_score}</Text>
                  <Text style={[styles.savedFrameMeta, { color: ui.textMuted }]}>Tap to view full event log</Text>
                </Pressable>
              ))
          )}
        </View>
      </ScrollView>

      <Modal visible={isFoulOpen} transparent animationType="fade" onRequestClose={() => setIsFoulOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setIsFoulOpen(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Record Foul</Text>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Penalty Points</Text>
            <View style={styles.optionRow}>
              {FOUL_OPTIONS.map((option) => (
                <Pressable
                  key={option.value}
                  style={[styles.optionPill, foulValue === option.value && { backgroundColor: colors.primary }]}
                  onPress={() => setFoulValue(option.value)}
                >
                  <Text style={[styles.optionPillLabel, foulValue === option.value && { color: colors.onPrimary }]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.modalLabel, { color: colors.textMuted }]}>Foul Type</Text>
            <View style={styles.typeWrap}>
              {FOUL_TYPES.map((type) => (
                <Pressable
                  key={type.key}
                  style={[styles.typePill, foulType === type.key && { backgroundColor: colors.primaryStrong }]}
                  onPress={() => setFoulType(type.key)}
                >
                  <Text style={[styles.typePillText, foulType === type.key && { color: colors.onPrimary }]}>{type.label}</Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              value={foulNote}
              onChangeText={setFoulNote}
              placeholder="Optional note"
              placeholderTextColor={colors.textMuted}
              style={[styles.noteInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
            />

            <View style={styles.modalActions}>
              <AppButton label="Cancel" variant="secondary" onPress={() => setIsFoulOpen(false)} />
              <AppButton label="Apply Foul" variant="danger" onPress={applyFoul} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedSavedFrame} transparent animationType="fade" onRequestClose={() => setSelectedSavedFrameId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedSavedFrameId(null)}>
          <Pressable style={[styles.modalCard, styles.savedLogModal, { backgroundColor: ui.panel, borderColor: ui.border }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: ui.text }]}>Frame {selectedSavedFrame?.frame_number} Log</Text>
            <ScrollView style={styles.savedLogScroll}>
              {(selectedSavedFrame?.events ?? []).length === 0 ? (
                <Text style={[styles.emptyLog, { color: ui.textMuted }]}>No events stored.</Text>
              ) : (
                (selectedSavedFrame?.events ?? []).map((event) => {
                  let message = "";
                  if (event.kind === "pot") message = `${event.player === "user" ? userLabel : opponentLabel} potted ${event.ball} (+${event.points})`;
                  if (event.kind === "foul") message = `${event.player === "user" ? userLabel : opponentLabel} foul ${event.foulValue} (${event.foulType ? FOUL_LABELS[event.foulType as LiveFoulType] : "foul"})`;
                  if (event.kind === "visit_end") message = `${event.player === "user" ? userLabel : opponentLabel} ended visit`;
                  if (event.kind === "switch") message = `Turn switched from ${event.player === "user" ? userLabel : opponentLabel}`;
                  if (event.kind === "re_rack") message = "Frame re-racked";
                  if (event.kind === "frame_saved") message = "Frame saved";

                  return (
                    <View key={event.id} style={styles.eventRow}>
                      <Text style={[styles.eventMessage, { color: ui.text }]}>{message}</Text>
                      <Text style={[styles.eventTime, { color: ui.textMuted }]}>{new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
            <AppButton label="Close" variant="secondary" onPress={() => setSelectedSavedFrameId(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 14,
  },
  topMetaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  topMetaText: {
    color: "#9BC7B8",
    fontSize: 12,
    fontWeight: "700",
  },
  matchRaceBanner: {
    marginBottom: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2B4A3F",
    backgroundColor: "#0E1C17",
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  matchRaceText: {
    color: "#D7F2E7",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  matchRaceMeta: {
    marginTop: 4,
    color: "#9DC4B7",
    fontSize: 13,
    fontWeight: "700",
  },
  matchCompleteText: {
    marginTop: 5,
    color: "#7CE0B8",
    fontSize: 12,
    fontWeight: "800",
  },
  raceAdjustWrap: {
    marginTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 6,
  },
  raceChip: {
    width: "18.5%",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3B5E52",
    backgroundColor: "#173028",
    alignItems: "center",
    paddingVertical: 6,
  },
  raceChipActive: {
    borderColor: "#4CD7A3",
    backgroundColor: "#1A6B4D",
  },
  raceChipText: {
    color: "#CFE9DE",
    fontSize: 12,
    fontWeight: "800",
  },
  raceChipTextActive: {
    color: "#F0FFF8",
  },
  raceRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  raceInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#36584D",
    backgroundColor: "#10231C",
    color: "#E9FFF6",
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    fontWeight: "700",
  },
  raceApplyButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#4DAE85",
    backgroundColor: "#1B6A4D",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  raceApplyText: {
    color: "#EFFFF8",
    fontSize: 12,
    fontWeight: "800",
  },
  scoreboardCard: {
    borderRadius: 16,
    backgroundColor: "#0F201A",
    borderWidth: 1,
    borderColor: "#2C4D41",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerPanel: {
    width: "34%",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: "#102A22",
    borderWidth: 1,
    borderColor: "#2B4A3F",
  },
  playerPanelActive: {
    borderColor: "#56D8A1",
    shadowColor: "#56D8A1",
    shadowOpacity: 0.45,
    shadowRadius: 9,
  },
  playerName: {
    color: "#D8EFE8",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center",
  },
  playerScore: {
    marginTop: 8,
    color: "#FFFFFF",
    fontSize: 34,
    fontWeight: "800",
    textAlign: "center",
  },
  breakMeta: {
    marginTop: 6,
    color: "#A7CEC1",
    fontSize: 12,
    textAlign: "center",
    fontWeight: "700",
  },
  centerMeta: {
    width: "28%",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  centerLabel: {
    color: "#96BCAF",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  centerValue: {
    marginTop: 4,
    color: "#DDF7EE",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  currentBreakText: {
    marginTop: 8,
    color: "#7CE0B8",
    fontSize: 16,
    fontWeight: "800",
  },
  infoRow: {
    marginTop: 12,
    flexDirection: "row",
    gap: 8,
  },
  infoChip: {
    flex: 1,
    backgroundColor: "#0F201A",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2C4D41",
    paddingVertical: 8,
    alignItems: "center",
  },
  infoChipLabel: {
    color: "#8CB9AA",
    fontSize: 10,
    fontWeight: "700",
  },
  infoChipValue: {
    marginTop: 4,
    color: "#EEFFF8",
    fontSize: 18,
    fontWeight: "800",
  },
  snookerBanner: {
    marginTop: 10,
    borderRadius: 12,
    backgroundColor: "#4C1F1F",
    borderWidth: 1,
    borderColor: "#975050",
    padding: 10,
  },
  snookerBannerText: {
    color: "#FCD8D8",
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  ballGrid: {
    marginTop: 12,
    gap: 8,
  },
  ballRow: {
    flexDirection: "row",
    gap: 8,
  },
  ballButton: {
    flex: 1,
    minHeight: 64,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.45)",
  },
  ballPoints: {
    fontSize: 14,
    fontWeight: "800",
  },
  ballLabel: {
    marginTop: 1,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  controlsWrap: {
    marginTop: 14,
    gap: 8,
  },
  secondaryControlsWrap: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  reRackButton: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#706B5A",
    backgroundColor: "#3B3523",
    paddingVertical: 12,
    alignItems: "center",
  },
  reRackText: {
    color: "#F2E7B5",
    fontSize: 14,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#1E6A4E",
    borderWidth: 1,
    borderColor: "#42A57A",
    paddingVertical: 12,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#EAF8F2",
    fontSize: 14,
    fontWeight: "800",
  },
  eventCard: {
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#2C4D41",
    backgroundColor: "#0E1B17",
    padding: 12,
  },
  analyticsGrid: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  analyticsCell: {
    width: "31%",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2C4D41",
    backgroundColor: "#11231D",
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  analyticsLabel: {
    color: "#88AEA1",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  analyticsValue: {
    marginTop: 4,
    color: "#E4FAF1",
    fontSize: 16,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#DDF8EE",
    fontSize: 15,
    fontWeight: "800",
  },
  eventRow: {
    marginTop: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  eventMessage: {
    color: "#C5E3D8",
    flex: 1,
    fontSize: 12,
  },
  eventTime: {
    color: "#84AF9F",
    fontSize: 11,
    fontWeight: "700",
  },
  emptyLog: {
    marginTop: 8,
    color: "#89A89D",
    fontSize: 12,
  },
  savedFrameRow: {
    marginTop: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#2B4A3F",
    backgroundColor: "#11231D",
    paddingVertical: 9,
    paddingHorizontal: 10,
  },
  savedFrameTitle: {
    color: "#D9F5EA",
    fontSize: 12,
    fontWeight: "800",
  },
  savedFrameScore: {
    marginTop: 2,
    color: "#F2FFFA",
    fontSize: 17,
    fontWeight: "800",
  },
  savedFrameMeta: {
    marginTop: 3,
    color: "#8CB9AA",
    fontSize: 11,
    fontWeight: "700",
  },
  foulBanner: {
    position: "absolute",
    top: 8,
    alignSelf: "center",
    zIndex: 20,
    backgroundColor: "#7E2426",
    borderColor: "#CC5E5E",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  foulBannerText: {
    color: "#FFECEC",
    fontSize: 12,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 14,
    padding: 14,
  },
  savedLogModal: {
    maxHeight: "78%",
    backgroundColor: "#0F201A",
    borderWidth: 1,
    borderColor: "#2B4A3F",
  },
  savedLogScroll: {
    marginVertical: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalLabel: {
    marginTop: 10,
    marginBottom: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  optionRow: {
    flexDirection: "row",
    gap: 6,
  },
  optionPill: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4D655E",
    paddingVertical: 9,
    alignItems: "center",
  },
  optionPillLabel: {
    color: "#27433A",
    fontWeight: "800",
  },
  typeWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  typePill: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#4D655E",
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  typePillText: {
    color: "#27433A",
    fontSize: 12,
    fontWeight: "700",
  },
  noteInput: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  modalActions: {
    marginTop: 12,
    gap: 8,
  },
  missingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  missingText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
