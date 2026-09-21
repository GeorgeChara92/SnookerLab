import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import type { MatchResult, MatchesStackParamList, LiveFrameEvent } from "../../types";
import { useDialog } from "../../components/ui/DialogProvider";
import { ShareMatchSheet } from "../../components/matches/ShareMatchSheet";
import { countsAsResult } from "../../features/matches/matchSummary";
import { useAppTheme } from "../../hooks/useAppTheme";
import { RADIUS, SCRIM, SPACING } from "../../constants";

type Visit = {
  id: string;
  player: "user" | "opponent";
  events: LiveFrameEvent[];
  breakPoints: number;
  endedBy: string;
};

const BALL_COLORS: Record<string, string> = {
  red: "#E53935",
  yellow: "#FDD835",
  green: "#43A047",
  brown: "#6D4C41",
  blue: "#1E88E5",
  pink: "#D81B60",
  black: "#212121",
};

const BALL_POINTS: Record<string, number> = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
};

const getEventIcon = (event: LiveFrameEvent): string => {
  switch (event.kind) {
    case "pot":
      return "circle";
    case "foul":
      return "alert-outline";
    case "visit_end":
      return "pause";
    case "switch":
      return "swap-horizontal";
    case "frame_saved":
      return "check";
    case "re_rack":
      return "restart";
    default:
      return "circle-small";
  }
};

const getEventLabel = (event: LiveFrameEvent): string => {
  switch (event.kind) {
    case "pot":
      return event.ball ? `${event.ball.charAt(0).toUpperCase() + event.ball.slice(1)} potted${event.points ? ` (${event.points})` : ""}` : "Pot";
    case "foul":
      return `Foul${event.foulValue ? ` (${event.foulValue})` : ""}${event.note ? ` - ${event.note}` : ""}`;
    case "visit_end":
      return "End of visit";
    case "switch":
      return "Switch";
    case "frame_saved":
      return "Frame saved";
    case "re_rack":
      return "Re-rack";
    default:
      return event.kind;
  }
};

export const MatchDetailScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "MatchDetail">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matchId } = route.params;

  const { getMatchById, updateMatch, deleteMatch, getFrameRecordsByMatchId } = useMatchesStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const match = useMemo(() => getMatchById(matchId), [getMatchById, matchId]);

  const [opponentName, setOpponentName] = useState(match?.opponent_name ?? "");
  const [location, setLocation] = useState(match?.location ?? "");
  const [userScore, setUserScore] = useState(String(match?.user_score ?? 0));
  const [opponentScore, setOpponentScore] = useState(String(match?.opponent_score ?? 0));
  const [notes, setNotes] = useState(match?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const frameRecords = getFrameRecordsByMatchId(matchId).sort((a, b) => b.frame_number - a.frame_number);
  const selectedFrame = frameRecords.find((frame) => frame.id === selectedFrameId);
  const hasManualScoreline = (match?.user_score ?? 0) > 0 || (match?.opponent_score ?? 0) > 0 || (match?.frames_played ?? 0) > 0;

  const getBestOfFrames = (format: string, targetFrames?: number) => {
    if (targetFrames && targetFrames > 0) return targetFrames;
    if (format.startsWith("best_of_")) {
      const parsed = parseInt(format.replace("best_of_", ""));
      return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
  };

  const bestOfFrames = getBestOfFrames(match?.format ?? "", match?.target_frames);
  const firstToWins = bestOfFrames ? Math.floor(bestOfFrames / 2) + 1 : undefined;
  const isMatchComplete = firstToWins ? (match?.user_score ?? 0) >= firstToWins || (match?.opponent_score ?? 0) >= firstToWins : false;
  const canOpenLiveScoring = (!hasManualScoreline || frameRecords.length > 0) && !isMatchComplete;

  const selectedFrameVisits = useMemo(() => {
    if (!selectedFrame?.events) return [];
    return groupEventsIntoVisits(selectedFrame.events);
  }, [selectedFrame]);

  const selectedFrameStats = useMemo(() => {
    if (!selectedFrame?.events) return null;

    const potEvents = selectedFrame.events.filter((e) => e.kind === "pot");
    const userPots = potEvents.filter((e) => e.player === "user");
    const opponentPots = potEvents.filter((e) => e.player === "opponent");

    const userBreaks = (selectedFrame.breaks ?? []).filter((b) => b.player === "user");
    const opponentBreaks = (selectedFrame.breaks ?? []).filter((b) => b.player === "opponent");

    const highestUserBreak = Math.max(0, ...userBreaks.map((b) => b.points));
    const highestOpponentBreak = Math.max(0, ...opponentBreaks.map((b) => b.points));

    return {
      totalPots: potEvents.length,
      userPots: userPots.length,
      opponentPots: opponentPots.length,
      highestUserBreak,
      highestOpponentBreak,
      userVisits: selectedFrameVisits.filter((v) => v.player === "user").length,
      opponentVisits: selectedFrameVisits.filter((v) => v.player === "opponent").length,
      fouls: selectedFrame.events.filter((e) => e.kind === "foul").length,
    };
  }, [selectedFrame, selectedFrameVisits]);

  if (!match) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>Match not found.</Text>
      </View>
    );
  }

  const userScoreNum = Number(userScore) || 0;
  const opponentScoreNum = Number(opponentScore) || 0;

  const getResult = (): MatchResult => {
    if (userScoreNum > opponentScoreNum) return "win";
    if (userScoreNum < opponentScoreNum) return "loss";
    return "draw";
  };

  const onSave = async () => {
    try {
      setIsSaving(true);
      
      await updateMatch(match.id, {
        opponent_name: opponentName.trim() || match.opponent_name,
        location: location.trim() || undefined,
        user_score: userScoreNum,
        opponent_score: opponentScoreNum,
        frames_played: frameRecords.length > 0 ? frameRecords.length : match.frames_played,
        result: getResult(),
        notes: notes.trim() || undefined,
        sync_status: "pending",
      });

      dialog.alert({
        title: "Match updated",
        message: "The scoreline and details are saved.",
        tone: "success",
        icon: "check-circle-outline",
        confirmLabel: "Done",
      });
      navigation.goBack();
    } catch (error) {
      dialog.alert({
        title: "Could not save the match",
        message: "Your changes are still on screen. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = () => {
    dialog.confirm({
      title: "Delete this match?",
      message: "Every frame, break and pot logged against it goes too. This cannot be undone.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete match",
      cancelLabel: "Keep it",
      onConfirm: async () => {
        try {
          await deleteMatch(match.id);
          navigation.goBack();
        } catch (error) {
          dialog.alert({
            title: "Could not delete the match",
            message: "It is still here. Check your connection and try again.",
            tone: "danger",
            icon: "wifi-off",
          });
        }
      },
    });
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable style={styles.dismissKeyboard} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
        </Pressable>

        {countsAsResult(match) ? (
          <Pressable
            onPress={() => setShareOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.shareButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="export-variant" size={20} color={colors.onPrimary} />
            <Text style={[styles.shareButtonText, { color: colors.onPrimary }]}>Share result</Text>
          </Pressable>
        ) : null}

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Edit Match</Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>Played on {new Date(match.date).toLocaleDateString()}</Text>

          <Text style={[styles.label, { color: colors.text }]}>Opponent</Text>
          <TextInput style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]} value={opponentName} onChangeText={setOpponentName} />

          <Text style={[styles.label, { color: colors.text }]}>Location</Text>
          <TextInput style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]} value={location} onChangeText={setLocation} placeholder="Club / Venue" placeholderTextColor={colors.textMuted} />

          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={[styles.label, { color: colors.text }]}>Your Score</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                value={userScore}
                onChangeText={setUserScore}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.scoreCol}>
              <Text style={[styles.label, { color: colors.text }]}>Opponent Score</Text>
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                value={opponentScore}
                onChangeText={setOpponentScore}
                keyboardType="numeric"
              />
            </View>
          </View>

          <Text style={[styles.currentResult, { color: colors.primary }]}>Current Result: {getResult().toUpperCase()}</Text>

          <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
            placeholder="Optional match notes"
            placeholderTextColor={colors.textMuted}
          />

          {canOpenLiveScoring ? (
            <Pressable
              style={[styles.liveButton, { backgroundColor: colors.primaryStrong, borderColor: colors.border }]}
              onPress={() => navigation.navigate("LiveFrameScoring", { matchId: match.id })}
            >
              <Text style={[styles.liveButtonTitle, { color: colors.onPrimary }]}>Open Live Frame Scoring</Text>
              <Text style={[styles.liveButtonMeta, { color: colors.onPrimary }]}>Track frame ball-by-ball with fouls, breaks, and snookers required.</Text>
            </Pressable>
          ) : (
            <View style={[styles.liveDisabledCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.liveDisabledTitle, { color: colors.text }]}>Live scoring unavailable</Text>
              <Text style={[styles.liveDisabledMeta, { color: colors.textMuted }]}>This match is completed or has a manual scoreline. Start a new live match to continue frame-by-frame tracking.</Text>
            </View>
          )}

          <View style={[styles.framesSection, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.framesTitle, { color: colors.text }]}>Saved Frames</Text>
            {frameRecords.length === 0 ? (
              <Text style={[styles.framesEmpty, { color: colors.textMuted }]}>No frame records saved yet.</Text>
            ) : (
              frameRecords.slice(0, 8).map((frame) => (
                <Pressable key={frame.id} style={styles.frameRow} onPress={() => setSelectedFrameId(frame.id)}>
                  <View style={styles.frameRowTop}>
                    <Text style={[styles.frameLabel, { color: colors.text }]}>Frame {frame.frame_number}</Text>
                    <Text style={[styles.frameScore, { color: colors.text }]}>{frame.user_score} - {frame.opponent_score}</Text>
                  </View>
                  <Text style={[styles.frameMeta, { color: colors.textMuted }]}>
                    High break: {frame.highest_break_user} / {frame.highest_break_opponent} · Tap for timeline
                  </Text>
                </Pressable>
              ))
            )}
          </View>
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <Pressable style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={onSave}>
          <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Save Changes</Text>
        </Pressable>

        <Pressable style={[styles.deleteButton, { backgroundColor: colors.surfaceMuted }]} onPress={onDelete}>
          <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete Match</Text>
        </Pressable>
      </View>

      <Modal visible={!!selectedFrame} transparent animationType="slide" onRequestClose={() => setSelectedFrameId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedFrameId(null)} accessibilityLabel="Close">
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => null}
            accessibilityViewIsModal
          >
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Frame {selectedFrame?.frame_number} timeline</Text>
              <Pressable
                style={styles.modalCloseBtn}
                onPress={() => setSelectedFrameId(null)}
                accessibilityRole="button"
                accessibilityLabel="Close the frame timeline"
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {selectedFrameStats && selectedFrame && (
              <View style={[styles.statsGrid, { backgroundColor: colors.surfaceMuted }]}>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{selectedFrame.user_score} - {selectedFrame.opponent_score}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Final Score</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.primary }]}>{selectedFrameStats.highestUserBreak}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Your High Break</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{selectedFrameStats.userVisits}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Your Visits</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={[styles.statValue, { color: colors.text }]}>{selectedFrameStats.totalPots}</Text>
                  <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Pots</Text>
                </View>
              </View>
            )}

            <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
              {selectedFrameVisits.length === 0 ? (
                <Text style={[styles.modalEmpty, { color: colors.textMuted }]}>No events recorded for this frame.</Text>
              ) : (
                selectedFrameVisits.map((visit, visitIndex) => (
                  <View key={visit.id} style={styles.visitBlock}>
                    <View style={[styles.visitHeader, { backgroundColor: colors.surfaceMuted }]}>
                      <View style={styles.visitHeaderLeft}>
                        <Text style={[styles.visitNumber, { color: colors.textMuted }]}>Visit {visitIndex + 1}</Text>
                        <Text style={[styles.visitPlayer, { color: visit.player === "user" ? colors.primary : colors.text }]}>
                          {visit.player === "user" ? "You" : "Opponent"}
                        </Text>
                      </View>
                      {visit.breakPoints > 0 && (
                        <View style={[styles.breakBadge, { backgroundColor: colors.primary + "20" }]}>
                          <Text style={[styles.breakLabel, { color: colors.primary }]}>Break {visit.breakPoints}</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.timeline}>
                      {visit.events.map((event, eventIndex) => {
                        const isLast = eventIndex === visit.events.length - 1;
                        const isFoul = event.kind === "foul";
                        const isFrameSaved = event.kind === "frame_saved";
                        const successColor = "#22C55E";

                        return (
                          <View key={event.id} style={styles.timelineRow}>
                            <View style={styles.timelineMarker}>
                              <View style={[styles.timelineLine, { backgroundColor: isLast ? "transparent" : colors.border }]} />
                              <View
                                style={[
                                  styles.timelineDot,
                                  {
                                    backgroundColor: isFoul
                                      ? colors.danger
                                      : isFrameSaved
                                      ? successColor
                                      : event.kind === "pot"
                                      ? colors.primary
                                      : colors.surfaceMuted,
                                    borderColor: isFoul
                                      ? colors.danger
                                      : isFrameSaved
                                      ? successColor
                                      : event.kind === "pot"
                                      ? colors.primary
                                      : colors.border,
                                  },
                                ]}
                              >
                                <MaterialCommunityIcons
                                  name={getEventIcon(event) as any}
                                  size={event.kind === "pot" ? 12 : 14}
                                  color={
                                    event.kind === "pot" && event.ball
                                      ? colors.balls[event.ball].base
                                      : colors.text
                                  }
                                />
                              </View>
                            </View>
                            <View style={[styles.timelineContent, { backgroundColor: colors.background }]}>
                              <View style={styles.timelineContentRow}>
                                <Text style={[styles.eventLabel, { color: isFoul ? colors.danger : colors.text }]}>
                                  {getEventLabel(event)}
                                </Text>
                                <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                                  {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </Text>
                              </View>
                              {event.ball && event.kind === "pot" && (
                                <View style={styles.ballIndicator}>
                                  <View style={[styles.ballDot, { backgroundColor: BALL_COLORS[event.ball] ?? "#999" }]} />
                                  <Text style={[styles.ballText, { color: colors.textMuted }]}>
                                    {event.ball.charAt(0).toUpperCase() + event.ball.slice(1)} ({BALL_POINTS[event.ball]} pts)
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>

                    {visit.endedBy && visit.endedBy !== "visit_end" && (
                      <View style={[styles.visitEnd, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={[styles.visitEndText, { color: colors.textMuted }]}>
                          {visit.endedBy === "switch" ? "↔ Switch" : visit.endedBy === "foul" ? "⚠ Ended by foul" : visit.endedBy}
                        </Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </ScrollView>

            <Pressable
              onPress={() => setSelectedFrameId(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
              style={styles.modalCancel}
            >
              <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
      {countsAsResult(match) ? (
        <ShareMatchSheet match={match} visible={shareOpen} onClose={() => setShareOpen(false)} />
      ) : null}
    </KeyboardAvoidingView>
  );
};

function groupEventsIntoVisits(events: LiveFrameEvent[]): Visit[] {
  const visits: Visit[] = [];
  let currentVisit: LiveFrameEvent[] = [];
  let currentPlayer: "user" | "opponent" | null = null;
  let visitBreak = 0;

  const finishVisit = (endedBy: string) => {
    if (currentVisit.length > 0 && currentPlayer) {
      visits.push({
        id: currentVisit[0].id,
        player: currentPlayer,
        events: [...currentVisit],
        breakPoints: visitBreak,
        endedBy,
      });
    }
    currentVisit = [];
    currentPlayer = null;
    visitBreak = 0;
  };

  for (const event of events) {
    if (event.kind === "switch") {
      finishVisit("switch");
      continue;
    }

    if (event.kind === "visit_end") {
      finishVisit("visit_end");
      continue;
    }

    if (event.kind === "re_rack" || event.kind === "frame_saved") {
      finishVisit(event.kind);
      visits.push({
        id: event.id,
        player: event.player ?? "user",
        events: [event],
        breakPoints: 0,
        endedBy: event.kind,
      });
      continue;
    }

    if (event.player && event.player !== currentPlayer) {
      if (currentVisit.length > 0) {
        finishVisit("switch");
      }
      currentPlayer = event.player;
    }

    if (!currentPlayer && event.player) {
      currentPlayer = event.player;
    }

    currentVisit.push(event);

    if (event.kind === "pot" && event.player === currentPlayer) {
      visitBreak += event.points ?? 0;
    }

    if (event.kind === "foul") {
      finishVisit("foul");
    }
  }

  finishVisit("frame_end");

  return visits;
}

const styles = StyleSheet.create({
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 50,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  shareButtonText: { fontSize: 16, fontWeight: "800" },
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  dismissKeyboard: {
    alignSelf: "flex-end",
    backgroundColor: "#D9E2EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  dismissKeyboardText: {
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    marginTop: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 10,
  },
  scoreCol: {
    flex: 1,
  },
  currentResult: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 88,
  },
  liveButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  liveButtonTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  liveButtonMeta: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.9,
  },
  liveDisabledCard: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  liveDisabledTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  liveDisabledMeta: {
    marginTop: 4,
    fontSize: 12,
  },
  framesSection: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  framesTitle: {
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
  },
  framesEmpty: {
    marginTop: 4,
    fontSize: 13,
  },
  frameRow: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(120,120,120,0.2)",
  },
  frameRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  frameLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  frameScore: {
    fontSize: 16,
    fontWeight: "800",
  },
  frameMeta: {
    marginTop: 4,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    maxHeight: "85%",
    flex: 1,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.md,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  modalCloseBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  modalCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsGrid: {
    flexDirection: "row",
    marginHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 18,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    marginTop: 2,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  modalScroll: {
    flex: 1,
  },
  modalScrollContent: {
    paddingHorizontal: SPACING.xl,
    paddingBottom: SPACING.lg,
  },
  modalEmpty: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 40,
  },
  visitBlock: {
    marginBottom: 16,
  },
  visitHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  visitHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  visitNumber: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  visitPlayer: {
    fontSize: 14,
    fontWeight: "700",
  },
  breakBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  breakLabel: {
    fontSize: 13,
    fontWeight: "800",
  },
  timeline: {
    marginTop: 8,
    marginLeft: 12,
  },
  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  timelineMarker: {
    width: 28,
    alignItems: "center",
    position: "relative",
  },
  timelineLine: {
    position: "absolute",
    top: 20,
    bottom: 0,
    width: 2,
    left: 13,
  },
  timelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  timelineDotIcon: {
    fontSize: 12,
  },
  timelineContent: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginLeft: 4,
  },
  timelineContentRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  eventLabel: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  eventTime: {
    fontSize: 11,
    fontWeight: "500",
    marginLeft: 8,
  },
  ballIndicator: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  ballDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 6,
  },
  ballText: {
    fontSize: 12,
  },
  visitEnd: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    marginLeft: 40,
  },
  visitEndText: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  empty: {
    fontSize: 16,
    padding: 16,
  },
});
