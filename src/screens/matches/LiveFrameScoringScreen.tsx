import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { LiveFrameEvent as SavedLiveFrameEvent, MatchesStackParamList } from "../../types";
import { useAuthStore, useMatchesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppDialog, type DialogRequest } from "../../components/ui/AppDialog";
import { FoulSheet } from "../../components/matches/FoulSheet";
import {
  BALL_POINTS,
  COLOR_SEQUENCE,
  concludeFrame,
  createInitialLiveFrameState,
  endVisit,
  getFrameWinner,
  getMinimumFoulValue,
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
import { clearLiveFrame, loadLiveFrame, saveLiveFrame } from "../../features/matches/liveFrameStorage";
import { RADIUS, SCRIM, SPACING } from "../../constants";

const BALL_META: Array<{ key: LiveBall; color: string; textColor: string }> = [
  { key: "red", color: "#C7343A", textColor: "#FFFFFF" },
  { key: "yellow", color: "#FFD75A", textColor: "#2A2400" },
  { key: "green", color: "#1FA15A", textColor: "#FFFFFF" },
  { key: "brown", color: "#8C5A3B", textColor: "#FFFFFF" },
  { key: "blue", color: "#2B76C6", textColor: "#FFFFFF" },
  { key: "pink", color: "#E764A1", textColor: "#FFFFFF" },
  { key: "black", color: "#1E1E1E", textColor: "#FFFFFF" },
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
  const { width: screenWidth } = useWindowDimensions();
  const { colors, isDark } = useAppTheme();
  const { user } = useAuthStore();
  const { getMatchById, getFrameRecordsByMatchId, getNextFrameNumber, saveFrameRecord, updateMatch, deleteMatch } = useMatchesStore();
  const match = getMatchById(route.params.matchId);

  const frameRecords = getFrameRecordsByMatchId(route.params.matchId);
  const frameNumber = useMemo(() => getNextFrameNumber(route.params.matchId), [getNextFrameNumber, route.params.matchId, frameRecords.length]);
  const [frame, setFrame] = useState<LiveFrameState>(() => createInitialLiveFrameState(frameNumber));
  const frameRef = useRef(frame);
  const hasRestoredFrameRef = useRef(false);
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
  const [activeTab, setActiveTab] = useState<"match" | "stats" | "log">("match");
  const [potNotice, setPotNotice] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogRequest | null>(null);

  const scorePulse = useRef(new Animated.Value(1)).current;
  const breakPulse = useRef(new Animated.Value(1)).current;
  const foulBannerY = useRef(new Animated.Value(-70)).current;
  const noticeBannerY = useRef(new Animated.Value(-70)).current;
  const userScoreScale = useRef(new Animated.Value(1)).current;
  const opponentScoreScale = useRef(new Animated.Value(1)).current;
  const previousScoresRef = useRef({ user: frame.userScore, opponent: frame.opponentScore });
  const allowExitWithoutGuardRef = useRef(false);

  // Seven balls across one row, sized to the screen and never below the 44pt touch target.
  const ballSize = Math.max(44, Math.min(58, Math.floor((screenWidth - 28 - 6 * 6) / 7)));
  const pointsRemaining = getPointsRemaining(frame);
  const ballOnLabel = (() => {
    if (frame.phase === "ended") return "-";
    if (frame.phase === "reds") return frame.awaitingColorAfterRed ? "Colour" : "Red";
    return COLOR_SEQUENCE[frame.nextColorIndex]?.replace(/^./, (c) => c.toUpperCase()) ?? "-";
  })();
  const snookersRequired = getSnookersRequired(frame);
  const isFrameComplete = frame.phase === "ended";
  const minimumFoulValue = getMinimumFoulValue(frame);
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
  const scoreDiff = Math.abs(frame.userScore - frame.opponentScore);
  const potCounts = useMemo(() => {
    const createEmptyCounts = (): Record<LiveBall, number> => ({
      red: 0,
      yellow: 0,
      green: 0,
      brown: 0,
      blue: 0,
      pink: 0,
      black: 0,
    });

    const user = createEmptyCounts();
    const opponent = createEmptyCounts();

    frame.events.forEach((event) => {
      if (event.kind !== "pot" || !event.ball) return;
      if (event.player === "user") user[event.ball] += 1;
      if (event.player === "opponent") opponent[event.ball] += 1;
    });

    return { user, opponent };
  }, [frame.events]);

  const playerCards = useMemo(
    () => [
      {
        key: "user" as const,
        name: userLabel,
        score: frame.userScore,
        highBreak: frame.highestBreakUser,
        isActive: frame.atTable === "user",
        potCounts: potCounts.user,
      },
      {
        key: "opponent" as const,
        name: opponentLabel,
        score: frame.opponentScore,
        highBreak: frame.highestBreakOpponent,
        isActive: frame.atTable === "opponent",
        potCounts: potCounts.opponent,
      },
    ],
    [frame.atTable, frame.highestBreakOpponent, frame.highestBreakUser, frame.opponentScore, frame.userScore, opponentLabel, potCounts.opponent, potCounts.user, userLabel]
  );

  const orderedPlayerCards = useMemo(
    () => [...playerCards].sort((a, b) => Number(b.isActive) - Number(a.isActive)),
    [playerCards]
  );

  const ui = useMemo(
    () =>
      isDark
        ? {
            page: "#040A08",
            panel: "#0A1613",
            panelAlt: "#09110F",
            panelSoft: "#0F211C",
            border: "#1D3830",
            borderStrong: "#2B5145",
            text: "#ECFFF6",
            textMuted: "#8DB3A4",
            accent: "#6EE0B1",
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

  // Restore a frame in progress if the app was closed or killed mid-frame.
  useEffect(() => {
    const matchId = route.params.matchId;
    let cancelled = false;
    loadLiveFrame(matchId).then((saved) => {
      if (cancelled) return;
      hasRestoredFrameRef.current = true;
      if (!saved) return;
      if (saved.frameNumber !== frameNumber || frameRef.current.events.length > 0) {
        if (saved.frameNumber < frameNumber) clearLiveFrame(matchId);
        return;
      }
      frameRef.current = saved;
      setFrame(saved);
    });
    return () => {
      cancelled = true;
    };
  }, [frameNumber, route.params.matchId]);

  useEffect(() => {
    if (!hasRestoredFrameRef.current) return;
    if (frame.events.length === 0) {
      clearLiveFrame(route.params.matchId);
      return;
    }
    saveLiveFrame(route.params.matchId, frame);
  }, [frame, route.params.matchId]);

  useEffect(() => {
    if (!match) return;
    const currentBestOf = getBestOfFrames(match.format, match.target_frames) ?? 7;
    setRaceToInput(String(currentBestOf));
  }, [match?.format, match?.target_frames]);

  useEffect(() => {
    const previous = previousScoresRef.current;
    const animations: Animated.CompositeAnimation[] = [];

    if (frame.userScore !== previous.user) {
      animations.push(
        Animated.sequence([
          Animated.timing(userScoreScale, { toValue: 1.12, duration: 120, useNativeDriver: true }),
          Animated.timing(userScoreScale, { toValue: 1, duration: 130, useNativeDriver: true }),
        ])
      );
    }

    if (frame.opponentScore !== previous.opponent) {
      animations.push(
        Animated.sequence([
          Animated.timing(opponentScoreScale, { toValue: 1.12, duration: 120, useNativeDriver: true }),
          Animated.timing(opponentScoreScale, { toValue: 1, duration: 130, useNativeDriver: true }),
        ])
      );
    }

    if (animations.length > 0) {
      Animated.parallel(animations).start();
    }

    previousScoresRef.current = { user: frame.userScore, opponent: frame.opponentScore };
  }, [frame.opponentScore, frame.userScore, opponentScoreScale, userScoreScale]);

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
      setDialog({
        title: "Could not update the match length",
        message: "The change was not saved. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "OK",
      });
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

  const showPotNotice = (text: string) => {
    setPotNotice(text);
    Animated.sequence([
      Animated.timing(noticeBannerY, { toValue: 0, duration: 180, useNativeDriver: true }),
      Animated.delay(1050),
      Animated.timing(noticeBannerY, { toValue: -70, duration: 220, useNativeDriver: true }),
    ]).start(() => setPotNotice(null));
  };

  const getBallGradient = (ball: LiveBall): readonly [string, string, string] => {
    if (ball === "red") return ["#F06169", "#B1222B", "#65090F"];
    if (ball === "yellow") return ["#FFE68B", "#D2AC2A", "#8D6500"];
    if (ball === "green") return ["#4DBA7D", "#1D7A4A", "#0C4A2B"];
    if (ball === "brown") return ["#B08563", "#7A4D32", "#4B2A19"];
    if (ball === "blue") return ["#67A7E8", "#2F6FB2", "#153C73"];
    if (ball === "pink") return ["#F7A9C7", "#DB6E9E", "#9F3D67"];
    return ["#737373", "#252525", "#070707"];
  };

  const applyFrameMutation = (mutator: (state: LiveFrameState) => LiveFrameState, options?: { scoreChange?: boolean }) => {
    // Read from a ref so rapid taps always build on the latest state, and keep side effects
    // out of the state updater (React may run updaters twice).
    const current = frameRef.current;
    const next = mutator(current);
    if (next === current) return;

    frameRef.current = next;
    setFrame(next);
    setUndoStack((stack) => [current, ...stack].slice(0, 180));

    if (options?.scoreChange) {
      animateScoreChange();
      if (next.currentBreak > current.currentBreak) animateBreakPulse();
    }
    if (next.respottedBlack && !current.respottedBlack) {
      showPotNotice("Scores level. Re-spotted black.");
    }
  };

  const handlePot = (ball: LiveBall) => {
    if (frame.phase === "reds") {
      if (!frame.awaitingColorAfterRed && ball !== "red") {
        showPotNotice("Red on. Pot a red first.");
        return;
      }

      if (frame.awaitingColorAfterRed && ball === "red") {
        showPotNotice("Colour on. Pot a colour before the next red.");
        return;
      }
    }

    if (frame.phase === "colors") {
      const expected = COLOR_SEQUENCE[frame.nextColorIndex];
      if (ball !== expected) {
        showPotNotice(`Next ball on: ${expected.toUpperCase()}.`);
        return;
      }
    }

    applyFrameMutation((state) => potBall(state, ball), { scoreChange: true });
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    frameRef.current = previous;
    setFrame(previous);
    setUndoStack(rest);
  };

  const handleReRack = () => {
    setDialog({
      title: "Re-rack this frame?",
      message: "The score, breaks and shot log for this frame are cleared, and you start again from 15 reds.",
      tone: "danger",
      icon: "restart",
      confirmLabel: "Re-rack",
      cancelLabel: "Keep playing",
      onConfirm: () => {
        setUndoStack([]);
        const reset = reRack(frameRef.current);
        frameRef.current = reset;
        setFrame(reset);
      },
    });
  };

  const openFoulSheet = () => {
    setFoulValue(minimumFoulValue);
    setFoulType("other");
    setFoulNote("");
    setIsFoulOpen(true);
  };

  const applyFoul = () => {
    const penalty = Math.max(foulValue, minimumFoulValue);
    applyFrameMutation((state) => recordFoul(state, foulValue, foulType, foulNote.trim() || undefined), { scoreChange: true });
    showFoulBanner(`${FOUL_LABELS[foulType]} (+${penalty})`);
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
    // Bank any break still in progress (e.g. a concession mid-break) before saving.
    const finalFrame = concludeFrame(frame);
    // Abandoned frames are replayed, so they don't count towards either player.
    const frameWinner = abandoned ? "draw" : getFrameWinner(finalFrame);
    try {
      setIsSaving(true);
      await saveFrameRecord(match.id, {
        frame_number: finalFrame.frameNumber,
        user_score: finalFrame.userScore,
        opponent_score: finalFrame.opponentScore,
        winner: frameWinner,
        highest_break_user: finalFrame.highestBreakUser,
        highest_break_opponent: finalFrame.highestBreakOpponent,
        breaks: finalFrame.breakHistory,
        events: buildFrameRecordEvents(),
        abandoned,
      });
      clearLiveFrame(match.id);

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

setDialog(
        projectedMatchWinner
          ? {
              title: "Match complete",
              message: `${projectedMatchWinner} wins it ${projectedWins.user}-${projectedWins.opponent}.`,
              tone: "success",
              icon: "trophy-outline",
              confirmLabel: "Back to match",
              onConfirm: () => navigation.goBack(),
            }
          : {
              title: abandoned ? "Frame abandoned" : "Frame saved",
              message: abandoned
                ? "Saved for your records. It does not count for either player."
                : `${frame.userScore}-${frame.opponentScore} to ${frameWinner === "user" ? userLabel : opponentLabel}.`,
              tone: "success",
              icon: abandoned ? "archive-outline" : "check-circle-outline",
              confirmLabel: "Next frame",
              cancelLabel: "Back to match",
              onConfirm: () => {
                const nextFrame = createInitialLiveFrameState(frame.frameNumber + 1, frame.atTable);
                frameRef.current = nextFrame;
                setFrame(nextFrame);
                setUndoStack([]);
              },
              onCancel: () => navigation.goBack(),
            }
      );
    } catch (error) {
      setDialog({
        title: "Could not save the frame",
        message: "Nothing was lost. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "OK",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEndFrame = () => {
    if (isFrameComplete) {
      persistFrame(false);
      return;
    }

    const leader = frame.userScore > frame.opponentScore ? userLabel : opponentLabel;
    setDialog({
      title: "End the frame here?",
      message: `The frame is not finished. It is saved at ${frame.userScore}-${frame.opponentScore}, so ${leader} takes it.`,
      icon: "flag-checkered",
      confirmLabel: "End frame",
      cancelLabel: "Keep playing",
      onConfirm: () => persistFrame(false),
    });
  };

  // An abandoned frame is replayed, so it counts for neither player.
  const handleAbandonFrame = () => {
    setDialog({
      title: "Abandon this frame?",
      message: "It is saved for your records but counts for neither player.",
      tone: "danger",
      icon: "archive-outline",
      confirmLabel: "Abandon frame",
      cancelLabel: "Keep playing",
      onConfirm: () => persistFrame(true),
    });
  };

  const handleOpenTableCapture = () => {
    if (!match) return;
    navigation.navigate("ARTableCapture" as any, { matchId: match.id, frameNumber: frame.frameNumber });
  };

  useEffect(() => {
    if (!match) return;

    const canAutoDiscardEmptyMatch =
      frameRecords.length === 0 &&
      frame.events.length === 0 &&
      match.user_score === 0 &&
      match.opponent_score === 0 &&
      frame.userScore === 0 &&
      frame.opponentScore === 0;

    const unsubscribe = navigation.addListener("beforeRemove", (event) => {
      if (allowExitWithoutGuardRef.current || !canAutoDiscardEmptyMatch || isSaving) return;

      event.preventDefault();
      setDialog({
        title: "Discard this match?",
        message: "No frames were played, so there is nothing to keep.",
        tone: "danger",
        icon: "trash-can-outline",
        confirmLabel: "Discard match",
        cancelLabel: "Keep it",
        onConfirm: async () => {
          try {
            await deleteMatch(match.id);
          } catch (error) {
            setDialog({
              title: "Could not discard the match",
              message: "Check your connection and try again.",
              tone: "danger",
              icon: "wifi-off",
              confirmLabel: "OK",
            });
            return;
          }

          allowExitWithoutGuardRef.current = true;
          navigation.dispatch(event.data.action);
        },
      });
    });

    return unsubscribe;
  }, [deleteMatch, frame.events.length, frame.opponentScore, frame.userScore, frameRecords.length, isSaving, match, navigation]);

  useEffect(() => {
    if (!match) {
      const timer = setTimeout(() => {
        navigation.navigate("MatchesList" as any);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [match, navigation]);

  if (!match) {
    return (
      <View style={[styles.missingWrap, { backgroundColor: colors.background }]}> 
        <Text style={[styles.missingText, { color: colors.textMuted }]}>Match not found</Text>
        <Text style={[styles.missingSubtext, { color: colors.textMuted }]}>Redirecting to matches...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: ui.page }]}> 
      <Animated.View style={[styles.foulBanner, { transform: [{ translateY: foulBannerY }] }]}> 
        <Text style={styles.foulBannerText}>{foulBannerText ?? ""}</Text>
      </Animated.View>
      <Animated.View style={[styles.noticeBanner, { transform: [{ translateY: noticeBannerY }] }]}> 
        <Text style={styles.noticeBannerText}>{potNotice ?? ""}</Text>
      </Animated.View>

      <ScrollView contentContainerStyle={[styles.content, { paddingTop: 12, paddingBottom: insets.bottom + 188 }]}> 
        <View style={[styles.scoreboard, { backgroundColor: ui.panel, borderColor: ui.border }]}>
          <View style={styles.scoreboardTop}>
            <Text style={[styles.scoreboardFrame, { color: ui.textMuted }]}>FRAME {frame.frameNumber}</Text>
            <Text style={[styles.scoreboardMatch, { color: ui.textMuted }]}>
              MATCH {matchFrameWins.user}-{matchFrameWins.opponent}
              {firstToWins ? ` · BEST OF ${bestOfFrames}` : ""}
            </Text>
          </View>

          <View style={styles.scoreRow}>
            {orderedPlayerCards.map((card, index) => {
              const scoreAnim = card.key === "user" ? userScoreScale : opponentScoreScale;

              return (
                <React.Fragment key={card.key}>
                  {index === 1 ? <View style={[styles.scoreDivider, { backgroundColor: ui.border }]} /> : null}
                  <Pressable
                    disabled={card.isActive || isFrameComplete}
                    onPress={() => applyFrameMutation((state) => switchPlayer(state))}
                    accessibilityRole="button"
                    accessibilityLabel={card.isActive ? `${card.name}, at the table` : `Switch to ${card.name}`}
                    style={styles.scoreColumn}
                  >
                    <Text
                      numberOfLines={1}
                      style={[styles.scoreName, { color: card.isActive ? ui.text : ui.textMuted }]}
                    >
                      {card.name}
                    </Text>
                    <Animated.Text
                      style={[
                        styles.scoreValue,
                        { color: card.isActive ? ui.text : ui.textMuted, transform: [{ scale: scoreAnim }] },
                      ]}
                    >
                      {card.score}
                    </Animated.Text>
                    <View style={[styles.scoreUnderline, { backgroundColor: card.isActive ? colors.primary : "transparent" }]} />
                    <Text style={[styles.scoreMeta, { color: ui.textMuted }]}>
                      {card.isActive ? "At the table" : `High break ${card.highBreak}`}
                    </Text>
                  </Pressable>
                </React.Fragment>
              );
            })}
          </View>

          <View style={[styles.liveStrip, { borderTopColor: ui.border }]}>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatLabel, { color: ui.textMuted }]}>BREAK</Text>
              <Animated.Text style={[styles.liveStatValue, { color: ui.accent, transform: [{ scale: breakPulse }] }]}>
                {frame.currentBreak}
              </Animated.Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatLabel, { color: ui.textMuted }]}>REMAINING</Text>
              <Text style={[styles.liveStatValue, { color: ui.text }]}>{pointsRemaining}</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatLabel, { color: ui.textMuted }]}>REDS</Text>
              <Text style={[styles.liveStatValue, { color: ui.text }]}>{frame.redsRemaining}</Text>
            </View>
            <View style={styles.liveStat}>
              <Text style={[styles.liveStatLabel, { color: ui.textMuted }]}>ON</Text>
              <Text style={[styles.liveStatValue, { color: ui.text }]}>{ballOnLabel}</Text>
            </View>
          </View>

          {snookersRequired ? (
            <View style={[styles.snookerBanner, { backgroundColor: ui.snookerBg, borderColor: ui.snookerBorder }]}>
              <Text style={[styles.snookerBannerText, { color: ui.snookerText }]}>
                {snookersRequired.player === "user" ? userLabel : opponentLabel} needs {snookersRequired.count}{" "}
                {snookersRequired.count === 1 ? "snooker" : "snookers"} ({snookersRequired.scoreDiff} behind,{" "}
                {snookersRequired.pointsRemaining} on the table)
              </Text>
            </View>
          ) : null}

          {frame.respottedBlack ? (
            <View style={[styles.snookerBanner, { backgroundColor: ui.panelSoft, borderColor: ui.borderStrong }]}>
              <Text style={[styles.snookerBannerText, { color: ui.text }]}>Scores level - black re-spotted</Text>
            </View>
          ) : null}

          {isMatchComplete ? (
            <Text style={[styles.matchCompleteText, { color: ui.accent }]}>
              Match complete: {matchFrameWins.user > matchFrameWins.opponent ? userLabel : opponentLabel} won.
            </Text>
          ) : null}
        </View>

        <View style={styles.tabRow}>
          {[
            { key: "match", label: "Match" },
            { key: "stats", label: "Stats" },
            { key: "log", label: "Log" },
          ].map((tab) => (
            <Pressable
              key={tab.key}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label} tab`}
              style={[
                styles.tabPill,
                { borderColor: ui.borderStrong, backgroundColor: ui.panelSoft },
                activeTab === tab.key && { backgroundColor: colors.primaryStrong, borderColor: colors.primary },
              ]}
              onPress={() => setActiveTab(tab.key as "match" | "stats" | "log")}
            >
              <Text style={[styles.tabPillText, { color: activeTab === tab.key ? colors.onPrimary : ui.textMuted }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {activeTab === "stats" ? (
          <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}>
            <View style={styles.raceRow}>
              <Text style={[styles.raceDescriptor, { color: ui.textMuted }]}>
                {firstToWins ? `Best of ${bestOfFrames}, first to ${firstToWins}` : "Frame count"}
              </Text>
              <TextInput
                value={raceToInput}
                onFocus={syncRaceInputFromMatch}
                onChangeText={setRaceToInput}
                onEndEditing={() => {
                  const typed = Math.max(1, parseInt(raceToInput) || 1);
                  applyRaceToUpdate(typed);
                }}
                keyboardType="numeric"
                editable={!isUpdatingRace}
                accessibilityLabel="Frames in this match"
                style={[styles.raceInput, { borderColor: ui.borderStrong, backgroundColor: ui.panelSoft, color: ui.text }]}
                placeholder="Best of"
                placeholderTextColor={ui.textMuted}
              />
            </View>
            {isUpdatingRace ? <Text style={[styles.matchContext, { color: ui.textMuted }]}>Updating match length...</Text> : null}
          </View>
        ) : null}

        {activeTab === "stats" ? (
          <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
            <Text style={[styles.sectionTitle, { color: ui.text }]}>Frame Stats</Text>
            <View style={styles.infoRow}>
              <View style={[styles.infoChip, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
                <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Reds</Text>
                <Text style={[styles.infoChipValue, { color: ui.text }]}>{frame.redsRemaining}</Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
                <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Remaining</Text>
                <Text style={[styles.infoChipValue, { color: ui.text }]}>{pointsRemaining}</Text>
              </View>
              <View style={[styles.infoChip, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}> 
                <Text style={[styles.infoChipLabel, { color: ui.textMuted }]}>Phase</Text>
                <Text style={[styles.infoChipValue, { color: ui.text }]}>{frame.phase.toUpperCase()}</Text>
              </View>
            </View>
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
                <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Visits</Text>
                <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.scoringVisits}</Text>
              </View>
              <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}>
                <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Avg Break</Text>
                <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.averageBreak.toFixed(1)}</Text>
              </View>
              <View style={[styles.analyticsCell, { backgroundColor: ui.panelSoft, borderColor: ui.border }]}>
                <Text style={[styles.analyticsLabel, { color: ui.textMuted }]}>Penalty</Text>
                <Text style={[styles.analyticsValue, { color: ui.text }]}>{frameStats.penaltiesAwarded}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {activeTab === "log" ? (
          <>
            <View style={[styles.eventCard, { backgroundColor: ui.panelAlt, borderColor: ui.border }]}> 
              <Text style={[styles.sectionTitle, { color: ui.text }]}>Frame Log</Text>
              {frame.events.length === 0 ? (
                <Text style={[styles.emptyLog, { color: ui.textMuted }]}>No events yet.</Text>
              ) : (
                frame.events.slice(0, 22).map((event) => {
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
              <Text style={[styles.sectionTitle, { color: ui.text }]}>Saved Frames</Text>
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
                      <Text style={[styles.savedFrameMeta, { color: ui.textMuted }]}>Tap to view full log</Text>
                    </Pressable>
                  ))
              )}
            </View>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.stickyInputWrap}> 
        <View style={[styles.inputPanel, { backgroundColor: ui.panelAlt, borderColor: "transparent" }]}> 
          <View style={styles.ballRow}>
            {BALL_META.map((ballMeta) => (
              <Pressable
                key={ballMeta.key}
                onPress={() => handlePot(ballMeta.key)}
                accessibilityRole="button"
                accessibilityLabel={`Pot the ${ballMeta.key}, ${BALL_POINTS[ballMeta.key]} points`}
                style={({ pressed }) => [
                  styles.ballButton,
                  { width: ballSize, height: ballSize, transform: [{ scale: pressed ? 0.92 : 1 }] },
                ]}
              >
                <LinearGradient
                  colors={getBallGradient(ballMeta.key)}
                  start={{ x: 0.2, y: 0.12 }}
                  end={{ x: 0.8, y: 1 }}
                  style={styles.ballSurface}
                >
                  <View style={[styles.ballHighlight, { width: ballSize * 0.3, height: ballSize * 0.19 }]} />
                  <Text style={[styles.ballPoints, { color: ballMeta.textColor }]}>{BALL_POINTS[ballMeta.key]}</Text>
                </LinearGradient>
              </Pressable>
            ))}
          </View>

          <View style={styles.actionPillRow}>
            <Pressable style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }, undoStack.length === 0 && styles.disabledPill]} onPress={handleUndo} disabled={undoStack.length === 0}>
              <Text style={[styles.actionPillText, { color: ui.text }]}>Undo</Text>
            </Pressable>
            <Pressable style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }]} onPress={openFoulSheet} disabled={isFrameComplete}>
              <Text style={[styles.actionPillText, { color: ui.text }]}>Foul</Text>
            </Pressable>
            <Pressable style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }]} onPress={() => applyFrameMutation((state) => endVisit(state))}>
              <Text style={[styles.actionPillText, { color: ui.text }]}>Safety</Text>
            </Pressable>
          </View>

          <View style={styles.actionPillRow}>
            <Pressable style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }]} onPress={() => applyFrameMutation((state) => endVisit(state))}>
              <Text style={[styles.actionPillText, { color: ui.text }]}>End Break</Text>
            </Pressable>
            <Pressable style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }]} onPress={() => applyFrameMutation((state) => switchPlayer(state))}>
              <Text style={[styles.actionPillText, { color: ui.text }]}>Switch</Text>
            </Pressable>
            <Pressable
              style={[styles.actionPill, { borderColor: ui.borderStrong, backgroundColor: ui.panelAlt }]}
              onPress={handleOpenTableCapture}
              accessibilityRole="button"
              accessibilityLabel="Capture the table position in AR"
            >
              <Text style={[styles.actionPillText, { color: ui.text }]}>Scan Table</Text>
            </Pressable>
          </View>

          <Pressable
            style={[styles.saveButton, { backgroundColor: colors.primaryStrong, borderColor: colors.primary }]}
            onPress={handleEndFrame}
            disabled={isSaving}
            accessibilityRole="button"
            accessibilityLabel={isFrameComplete ? "Save this frame" : "End this frame at the current score"}
          >
            <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>
              {isSaving ? "Saving..." : isFrameComplete ? "Save frame" : "End frame"}
            </Text>
          </Pressable>

          <View style={styles.quietRow}>
            <Pressable onPress={handleReRack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Re-rack this frame">
              <Text style={[styles.quietAction, { color: ui.textMuted }]}>Re-rack</Text>
            </Pressable>
            <Text style={[styles.quietDot, { color: ui.textMuted }]}>·</Text>
            <Pressable onPress={handleAbandonFrame} hitSlop={8} accessibilityRole="button" accessibilityLabel="Abandon this frame">
              <Text style={[styles.quietAction, { color: ui.textMuted }]}>Abandon frame</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <FoulSheet
        visible={isFoulOpen}
        minimumValue={minimumFoulValue}
        value={foulValue}
        onValueChange={setFoulValue}
        foulType={foulType}
        onFoulTypeChange={setFoulType}
        note={foulNote}
        onNoteChange={setFoulNote}
        awardedTo={frame.atTable === "user" ? opponentLabel : userLabel}
        onApply={applyFoul}
        onCancel={() => setIsFoulOpen(false)}
      />

      <AppDialog
        visible={dialog !== null}
        {...(dialog ?? { title: "", confirmLabel: "OK" })}
        onDismiss={() => setDialog(null)}
      />

      <Modal visible={!!selectedSavedFrame} transparent animationType="fade" onRequestClose={() => setSelectedSavedFrameId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedSavedFrameId(null)} accessibilityLabel="Close">
          <Pressable
            style={[styles.modalCard, styles.savedLogModal, { backgroundColor: ui.panel, borderColor: ui.border }]}
            onPress={() => null}
            accessibilityViewIsModal
          >
            <View style={[styles.modalAccentBar, { backgroundColor: ui.accent }]} />
            <View style={styles.savedLogBody}>
            <Text style={[styles.modalTitle, { color: ui.text }]}>Frame {selectedSavedFrame?.frame_number} log</Text>
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
            <Pressable
              onPress={() => setSelectedSavedFrameId(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={({ pressed }) => [
                styles.savedLogClose,
                { backgroundColor: ui.panelSoft, borderColor: ui.border, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Text style={[styles.savedLogCloseText, { color: ui.text }]}>Close</Text>
            </Pressable>
            </View>
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
  scoreboard: {
    borderRadius: 18,
    borderWidth: 1,
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 12,
    marginBottom: 12,
  },
  scoreboardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  scoreboardFrame: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.2,
  },
  scoreboardMatch: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  scoreColumn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
    minHeight: 96,
  },
  scoreDivider: {
    width: 1,
    alignSelf: "stretch",
    marginHorizontal: 8,
  },
  scoreName: {
    fontSize: 13,
    fontWeight: "700",
    maxWidth: "100%",
  },
  scoreValue: {
    fontSize: 46,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    letterSpacing: -1.5,
    marginTop: 2,
  },
  scoreUnderline: {
    height: 3,
    width: 36,
    borderRadius: 999,
    marginTop: 6,
  },
  scoreMeta: {
    fontSize: 11,
    marginTop: 6,
  },
  liveStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    marginTop: 12,
    paddingTop: 10,
  },
  liveStat: {
    flex: 1,
    alignItems: "center",
  },
  liveStatLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.8,
  },
  liveStatValue: {
    fontSize: 18,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
    marginTop: 2,
  },
  snookerBanner: {
    marginTop: 10,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  snookerBannerText: {
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
    textAlign: "center",
  },
  quietRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    minHeight: 40,
  },
  quietAction: {
    fontSize: 13,
    fontWeight: "600",
  },
  quietDot: {
    fontSize: 13,
  },
  matchHeader: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: "center",
  },
  tabRow: {
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    gap: 8,
  },
  tabPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  matchTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  matchFramescore: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: "900",
  },
  matchContext: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
  },
  raceDescriptor: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  playerZone: {
    marginTop: 12,
    gap: 10,
  },
  playerPressArea: {
    width: "100%",
  },
  playerMatchCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 170,
    justifyContent: "space-between",
  },
  playerMatchCardActive: {
    shadowOpacity: 0.38,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 5,
  },
  playerMatchCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerMatchName: {
    fontSize: 15,
    fontWeight: "800",
  },
  playerBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.7,
  },
  playerMatchScore: {
    marginTop: 6,
    fontSize: 46,
    fontWeight: "900",
    lineHeight: 50,
  },
  breakHighlight: {
    marginTop: 4,
    fontSize: 20,
    fontWeight: "900",
  },
  breakSupporting: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  playerCardFooter: {
    marginTop: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  recentBallRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
  },
  recentEmpty: {
    fontSize: 11,
    fontWeight: "600",
  },
  recentBallDot: {
    width: 13,
    height: 13,
    borderRadius: 999,
    borderWidth: 1,
  },
  recentBallCounter: {
    width: 20,
    height: 20,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  recentBallCounterText: {
    fontSize: 10,
    fontWeight: "900",
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
    marginTop: 10,
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
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
  ballRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "center",
    marginTop: 4,
  },
  ballButton: {
    borderRadius: 999,
    shadowColor: "#000000",
    shadowOpacity: 0.25,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  ballSurface: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ballHighlight: {
    position: "absolute",
    top: "16%",
    left: "20%",
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.35)",
  },
  ballPoints: {
    fontSize: 13,
    fontWeight: "900",
  },
  ballLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  inputPanel: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  stickyInputWrap: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 0,
    shadowColor: "#000000",
    shadowOpacity: 0.24,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 8,
  },
  inputTitle: {
    fontSize: 16,
    fontWeight: "900",
  },
  inputSubtitle: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
  },
  actionPillRow: {
    marginTop: 6,
    flexDirection: "row",
    gap: 6,
  },
  actionPill: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 9,
    minHeight: 34,
    justifyContent: "center",
    alignItems: "center",
  },
  disabledPill: {
    opacity: 0.4,
  },
  actionPillText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  controlsWrap: {
    marginTop: 14,
    gap: 8,
  },
  secondaryControlsWrap: {
    marginTop: 6,
    flexDirection: "row",
    gap: 6,
  },
  reRackButton: {
    flex: 1,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "#706B5A",
    backgroundColor: "#3B3523",
    paddingVertical: 8,
    alignItems: "center",
  },
  reRackText: {
    color: "#F2E7B5",
    fontSize: 11,
    fontWeight: "700",
  },
  saveButton: {
    marginTop: 8,
    minHeight: 48,
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: "#1E6A4E",
    borderWidth: 1,
    borderColor: "#42A57A",
    paddingVertical: 8,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#EAF8F2",
    fontSize: 11,
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
  noticeBanner: {
    position: "absolute",
    top: 44,
    alignSelf: "center",
    zIndex: 19,
    backgroundColor: "#102A22",
    borderColor: "#3C7B66",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  noticeBannerText: {
    color: "#DFF8EE",
    fontSize: 12,
    fontWeight: "800",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  modalAccentBar: {
    height: 4,
  },
  savedLogModal: {
    maxHeight: "78%",
    borderWidth: 1,
  },
  savedLogBody: {
    padding: SPACING.xl,
  },
  savedLogScroll: {
    marginVertical: SPACING.md,
  },
  savedLogClose: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  savedLogCloseText: {
    fontSize: 15,
    fontWeight: "700",
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
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
  missingSubtext: {
    fontSize: 13,
    fontWeight: "400",
    marginTop: 8,
  },
});
