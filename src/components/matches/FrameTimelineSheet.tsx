import React, { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { LiveFrameEvent, LiveFrameRecord } from "../../types";
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
      return event.ball
        ? `${event.ball.charAt(0).toUpperCase() + event.ball.slice(1)} potted${event.points ? ` (${event.points})` : ""}`
        : "Pot";
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

/**
 * Events are kept newest first as they are scored; the timeline reads oldest first. Sorted by
 * time, with the stored order breaking ties, so older records in either order read right.
 */
const inPlayOrder = (events: LiveFrameEvent[]) =>
  events
    .map((event, index) => ({ event, index }))
    .sort((a, b) => a.event.timestamp.localeCompare(b.event.timestamp) || b.index - a.index)
    .map(({ event }) => event);

/** A frame visit by visit: every pot, foul and break, from the break-off to the last ball. */
export const FrameTimelineSheet = ({ frame, onClose }: { frame: LiveFrameRecord | undefined; onClose: () => void }) => {
  const { colors } = useAppTheme();
  const frameVisits = useMemo(() => {
    if (!frame?.events) return [];
    return groupEventsIntoVisits(inPlayOrder(frame.events));
  }, [frame]);

  const frameStats = useMemo(() => {
    if (!frame?.events) return null;

    const potEvents = frame.events.filter((e) => e.kind === "pot");
    const userPots = potEvents.filter((e) => e.player === "user");
    const opponentPots = potEvents.filter((e) => e.player === "opponent");

    const userBreaks = (frame.breaks ?? []).filter((b) => b.player === "user");
    const opponentBreaks = (frame.breaks ?? []).filter((b) => b.player === "opponent");

    const highestUserBreak = Math.max(0, ...userBreaks.map((b) => b.points));
    const highestOpponentBreak = Math.max(0, ...opponentBreaks.map((b) => b.points));

    return {
      totalPots: potEvents.length,
      userPots: userPots.length,
      opponentPots: opponentPots.length,
      highestUserBreak,
      highestOpponentBreak,
      userVisits: frameVisits.filter((v) => v.player === "user").length,
      opponentVisits: frameVisits.filter((v) => v.player === "opponent").length,
      fouls: frame.events.filter((e) => e.kind === "foul").length,
    };
  }, [frame, frameVisits]);

  return (
    <Modal visible={!!frame} transparent animationType="slide" onRequestClose={() => onClose()}>
      <Pressable style={styles.modalOverlay} onPress={() => onClose()} accessibilityLabel="Close">
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => null}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />

          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Frame {frame?.frame_number} timeline</Text>
            <Pressable
              style={styles.modalCloseBtn}
              onPress={() => onClose()}
              accessibilityRole="button"
              accessibilityLabel="Close the frame timeline"
            >
              <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
            </Pressable>
          </View>

          {frameStats && frame && (
            <View style={[styles.statsGrid, { backgroundColor: colors.surfaceMuted }]}>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>
                  {frame.user_score} - {frame.opponent_score}
                </Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Final Score</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.primary }]}>{frameStats.highestUserBreak}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Your High Break</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{frameStats.userVisits}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Your Visits</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.text }]}>{frameStats.totalPots}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Pots</Text>
              </View>
            </View>
          )}

          <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {frameVisits.length === 0 ? (
              <Text style={[styles.modalEmpty, { color: colors.textMuted }]}>No events recorded for this frame.</Text>
            ) : (
              frameVisits.map((visit, visitIndex) => (
                <View key={visit.id} style={styles.visitBlock}>
                  <View style={[styles.visitHeader, { backgroundColor: colors.surfaceMuted }]}>
                    <View style={styles.visitHeaderLeft}>
                      <Text style={[styles.visitNumber, { color: colors.textMuted }]}>Visit {visitIndex + 1}</Text>
                      <Text
                        style={[styles.visitPlayer, { color: visit.player === "user" ? colors.primary : colors.text }]}
                      >
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
                            <View
                              style={[styles.timelineLine, { backgroundColor: isLast ? "transparent" : colors.border }]}
                            />
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
                                color={event.kind === "pot" && event.ball ? colors.balls[event.ball].base : colors.text}
                              />
                            </View>
                          </View>
                          <View style={[styles.timelineContent, { backgroundColor: colors.background }]}>
                            <View style={styles.timelineContentRow}>
                              <Text style={[styles.eventLabel, { color: isFoul ? colors.danger : colors.text }]}>
                                {getEventLabel(event)}
                              </Text>
                              <Text style={[styles.eventTime, { color: colors.textMuted }]}>
                                {new Date(event.timestamp).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </Text>
                            </View>
                            {event.ball && event.kind === "pot" && (
                              <View style={styles.ballIndicator}>
                                <View
                                  style={[styles.ballDot, { backgroundColor: BALL_COLORS[event.ball] ?? "#999" }]}
                                />
                                <Text style={[styles.ballText, { color: colors.textMuted }]}>
                                  {event.ball.charAt(0).toUpperCase() + event.ball.slice(1)} ({BALL_POINTS[event.ball]}{" "}
                                  pts)
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
                        {visit.endedBy === "switch"
                          ? "↔ Switch"
                          : visit.endedBy === "foul"
                            ? "⚠ Ended by foul"
                            : visit.endedBy}
                      </Text>
                    </View>
                  )}
                </View>
              ))
            )}
          </ScrollView>

          <Pressable
            onPress={() => onClose()}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={styles.modalCancel}
          >
            <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
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
});
