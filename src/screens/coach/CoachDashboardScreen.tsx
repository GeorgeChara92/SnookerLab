import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCommunityStore } from "../../store/communityStore";
import { useCoachStore } from "../../store/coachStore";
import { nameOf } from "../../features/community/types";
import { clientKeyOf, isSessionLive, type CoachBooking } from "../../features/coach/types";
import { addBookingToCalendar } from "../../features/coach/calendarSync";
import { startDirect } from "../../features/community/chat";
import { RescheduleSheet } from "../../components/coach/RescheduleSheet";
import { useAuthStore } from "../../store";
import {
  ClientAvatar,
  SectionLabel,
  Tag,
  lastRecapOf,
  minutesBetween,
  relativeDay,
  timeOf,
  untilLabel,
} from "../../components/coach/CoachUI";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";

/** A coach's own agenda: requests waiting for an answer, moves waiting on a client, then every
 * confirmed session by day. The broader picture (trends, write-ups, reviews) lives on Dashboard,
 * so this stays a quick daily check rather than a second dashboard. */
export const CoachDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsCoach, sessionRecaps, respondToBooking, loaded, markCoachResolutionsSeen } = useCoachStore(
    useShallow((state) => ({
      bookingsAsCoach: state.bookingsAsCoach,
      sessionRecaps: state.sessionRecaps,
      respondToBooking: state.respondToBooking,
      loaded: state.loaded,
      markCoachResolutionsSeen: state.markCoachResolutionsSeen,
    })),
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingToCalendar, setAddingToCalendar] = useState<string | null>(null);
  const [messaging, setMessaging] = useState<string | null>(null);
  // The request a new time is being suggested for.
  const [moving, setMoving] = useState<CoachBooking | null>(null);
  const me = useAuthStore((state) => state.user?.id ?? null);

  useFocusEffect(useCallback(() => markCoachResolutionsSeen(), [markCoachResolutionsSeen]));

  const { pending, waiting, days } = useMemo(() => {
    const now = new Date();
    const byStart = (a: CoachBooking, b: CoachBooking) => a.startsAt.localeCompare(b.startsAt);
    const upcoming = bookingsAsCoach.filter((booking) => booking.status === "accepted" && new Date(booking.endsAt) > now).sort(byStart);
    // Confirmed sessions grouped under their day, in order.
    const grouped: Array<{
      key: string;
      label: string;
      bookings: CoachBooking[];
    }> = [];
    for (const booking of upcoming) {
      const key = new Date(booking.startsAt).toDateString();
      const last = grouped[grouped.length - 1];
      if (last?.key === key) last.bookings.push(booking);
      else
        grouped.push({
          key,
          label: relativeDay(booking.startsAt, now),
          bookings: [booking],
        });
    }
    return {
      pending: bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach").sort(byStart),
      waiting: bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "player").sort(byStart),
      days: grouped,
    };
  }, [bookingsAsCoach]);

  const respond = async (booking: CoachBooking, status: "accepted" | "declined") => {
    setBusyId(booking.id);
    const result = await respondToBooking(booking.id, status);
    setBusyId(null);
    if (!result.ok)
      dialog.alert({
        title: "Could not update that request",
        message: result.message,
        tone: "danger",
      });
  };

  const playerName = (booking: CoachBooking) => booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]);

  // Ask a question before accepting - what they want from the session, their level, a time that
  // suits better - in the same chat as the rest of their messages.
  const message = async (booking: CoachBooking) => {
    if (!booking.playerId) return;
    setMessaging(booking.id);
    const result = await startDirect(booking.playerId);
    setMessaging(null);
    if (result.ok) navigation.navigate("CoachChats", { screen: "Chat", params: { conversationId: result.value } });
    else dialog.alert({ title: `You cannot message ${playerName(booking)}`, message: result.message, icon: "message-lock-outline" });
  };

  const addToCalendar = async (booking: CoachBooking) => {
    setAddingToCalendar(booking.id);
    const result = await addBookingToCalendar(booking, `Coaching session with ${playerName(booking)}`);
    setAddingToCalendar(null);
    if (!result.ok)
      dialog.alert({
        title: "Could not add to calendar",
        message: result.message,
        tone: "danger",
      });
  };

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      {/* ---------------------------------------------------------------- requests */}
      <SectionLabel title="Requests" count={pending.length || undefined} />
      {pending.length ? (
        pending.map((booking) => {
          const moved = Boolean(booking.rescheduleReason);
          return (
            <View
              key={booking.id}
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.primary,
                },
              ]}
            >
              <View style={styles.cardHead}>
                <ClientAvatar profile={profiles[booking.playerId ?? ""]} guest={!booking.playerId} size={44} />
                <View style={styles.cardText}>
                  <Tag label={moved ? "WANTS TO MOVE" : "NEW REQUEST"} tone="primary" />
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {playerName(booking)}
                  </Text>
                  <Text style={[styles.cardTime, { color: colors.textMuted }]} numberOfLines={1}>
                    {relativeDay(booking.startsAt)} · {timeOf(booking.startsAt)}–{timeOf(booking.endsAt)} · {untilLabel(booking.startsAt)}
                  </Text>
                </View>
              </View>
              {booking.note || booking.rescheduleReason ? (
                <View style={[styles.note, { backgroundColor: colors.surfaceMuted }]}>
                  <Text style={[styles.noteText, { color: colors.text }]}>“{booking.rescheduleReason ?? booking.note}”</Text>
                </View>
              ) : null}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => respond(booking, "declined")}
                  disabled={busyId === booking.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Decline ${playerName(booking)}`}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      borderWidth: 1,
                      borderColor: colors.border,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.actionText, { color: colors.text }]}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond(booking, "accepted")}
                  disabled={busyId === booking.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Accept ${playerName(booking)}`}
                  style={({ pressed }) => [
                    styles.actionButton,
                    {
                      backgroundColor: colors.primary,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  {busyId === booking.id ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.actionText, { color: colors.onPrimary }]}>Accept</Text>
                  )}
                </Pressable>
              </View>
              {/* Before answering: talk it over, or offer a time that works better. */}
              <View style={styles.moreActions}>
                {booking.playerId ? (
                  <Pressable
                    onPress={() => message(booking)}
                    disabled={messaging === booking.id}
                    accessibilityRole="button"
                    accessibilityLabel={`Message ${playerName(booking)}`}
                    style={({ pressed }) => [styles.moreButton, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
                  >
                    {messaging === booking.id ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <MaterialCommunityIcons name="chat-outline" size={18} color={colors.primary} />
                    )}
                    <Text style={[styles.moreText, { color: colors.primary }]}>Message</Text>
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={() => setMoving(booking)}
                  accessibilityRole="button"
                  accessibilityLabel={`Suggest a different time to ${playerName(booking)}`}
                  style={({ pressed }) => [styles.moreButton, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
                >
                  <MaterialCommunityIcons name="calendar-clock" size={18} color={colors.primary} />
                  <Text style={[styles.moreText, { color: colors.primary }]}>New time</Text>
                </Pressable>
              </View>
            </View>
          );
        })
      ) : (
        <View style={[styles.quiet, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.quietText, { color: colors.textMuted }]}>Nothing waiting on you.</Text>
        </View>
      )}

      {/* ---------------------------------------------------------------- moves you've proposed */}
      {waiting.length ? (
        <>
          <SectionLabel title="Waiting on clients" count={waiting.length} />
          <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {waiting.map((booking, index) => (
              <View
                key={booking.id}
                style={[
                  styles.waitRow,
                  index
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }
                    : null,
                ]}
              >
                <ClientAvatar profile={profiles[booking.playerId ?? ""]} guest={!booking.playerId} size={36} />
                <View style={styles.cardText}>
                  <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                    {playerName(booking)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    Moving to {relativeDay(booking.startsAt)} · {timeOf(booking.startsAt)}
                  </Text>
                  {booking.rescheduleReason ? (
                    <Text style={[styles.rowMeta, { color: colors.textSubtle }]} numberOfLines={2}>
                      “{booking.rescheduleReason}”
                    </Text>
                  ) : null}
                </View>
                <Tag label="WAITING" />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------------- the diary */}
      <SectionLabel title="Coming up" />
      {days.length ? (
        days.map((day) => (
          <View key={day.key} style={styles.day}>
            <Text
              maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
              style={[styles.dayLabel, { color: day.label === "Today" ? colors.primary : colors.text }]}
            >
              {day.label}
            </Text>
            <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {day.bookings.map((booking, index) => {
                const live = isSessionLive(booking);
                const recap = lastRecapOf(clientKeyOf(booking), bookingsAsCoach, sessionRecaps);
                return (
                  <View
                    key={booking.id}
                    style={[
                      styles.slot,
                      live ? { backgroundColor: colors.board } : null,
                      index
                        ? {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          }
                        : null,
                    ]}
                  >
                    <Pressable
                      onPress={() => navigation.getParent()?.navigate("LiveSession", { bookingId: booking.id })}
                      accessibilityRole="button"
                      accessibilityLabel={`${timeOf(booking.startsAt)}, ${playerName(booking)}. Start session`}
                      style={styles.slotMain}
                    >
                      <View style={styles.timeColumn}>
                        <Text
                          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                          style={[styles.time, { color: live ? colors.boardText : colors.text }]}
                        >
                          {timeOf(booking.startsAt)}
                        </Text>
                        <Text
                          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                          style={[
                            styles.duration,
                            {
                              color: live ? colors.boardMuted : colors.textMuted,
                            },
                          ]}
                        >
                          {minutesBetween(booking.startsAt, booking.endsAt)} MIN
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.timeRule,
                          {
                            backgroundColor: live ? colors.boardRule : colors.primary,
                          },
                        ]}
                      />
                      <ClientAvatar profile={profiles[booking.playerId ?? ""]} guest={!booking.playerId} size={36} />
                      <View style={styles.cardText}>
                        <View style={styles.nameLine}>
                          <Text
                            style={[
                              styles.rowName,
                              {
                                color: live ? colors.boardText : colors.text,
                                flexShrink: 1,
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {playerName(booking)}
                          </Text>
                          {live ? <Tag label="ON NOW" tone="live" /> : !booking.playerId ? <Tag label="GUEST" /> : null}
                        </View>
                        <Text
                          style={[
                            styles.rowMeta,
                            {
                              color: live ? colors.boardMuted : colors.textMuted,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {recap?.focus.length
                            ? `Last time: ${recap.focus.slice(0, 2).join(", ")}`
                            : (booking.note ?? "First session together")}
                        </Text>
                      </View>
                      <MaterialCommunityIcons name="play-circle" size={30} color={live ? colors.boardRule : colors.primary} />
                    </Pressable>
                    <Pressable
                      onPress={() => addToCalendar(booking)}
                      disabled={addingToCalendar === booking.id}
                      accessibilityRole="button"
                      accessibilityLabel="Add to calendar"
                      hitSlop={8}
                      style={styles.calendarButton}
                    >
                      {addingToCalendar === booking.id ? (
                        <ActivityIndicator size="small" color={colors.textMuted} />
                      ) : (
                        <MaterialCommunityIcons name="calendar-plus" size={20} color={live ? colors.boardMuted : colors.textMuted} />
                      )}
                    </Pressable>
                  </View>
                );
              })}
            </View>
          </View>
        ))
      ) : (
        <Pressable
          onPress={() => navigation.navigate("CoachCalendar")}
          accessibilityRole="button"
          style={[styles.quiet, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="calendar-blank-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.quietText, { color: colors.textMuted }]}>No confirmed sessions yet. Open some slots on Calendar.</Text>
        </Pressable>
      )}
      {moving && me ? (
        <RescheduleSheet
          visible
          anyTime
          coachId={me}
          bookingId={moving.id}
          onClose={() => setMoving(null)}
          onDone={() => {
            setMoving(null);
            dialog.alert({
              title: "New time suggested",
              message: `${playerName(moving)} can accept it or pick another. It's under "Waiting on clients" until they do.`,
              icon: "calendar-clock",
            });
          }}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.sm },

  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  cardText: { flex: 1, minWidth: 0, gap: 3 },
  cardName: { fontSize: 17, fontWeight: "800" },
  cardTime: { fontSize: 13 },
  note: {
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  noteText: { fontSize: 14, lineHeight: 20, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: SPACING.sm },
  moreActions: { flexDirection: "row", gap: SPACING.sm, justifyContent: "center" },
  moreButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: HIT_TARGET, borderRadius: RADIUS.md },
  moreText: { fontSize: 14, fontWeight: "800" },
  actionButton: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 15, fontWeight: "800" },

  quiet: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
  },
  quietText: { flex: 1, fontSize: 14 },

  list: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    padding: SPACING.md,
  },
  rowName: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 13 },

  day: { gap: 6 },
  dayLabel: { fontSize: 15, fontWeight: "800", marginTop: 4 },
  slot: {
    flexDirection: "row",
    alignItems: "center",
    paddingRight: SPACING.sm,
  },
  slotMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.md,
  },
  timeColumn: { width: 50, alignItems: "flex-start" },
  time: {
    fontFamily: FONTS.boardHeavy,
    fontSize: 20,
    lineHeight: 22,
    fontVariant: ["tabular-nums"],
  },
  duration: { fontFamily: FONTS.boardLabel, fontSize: 10, letterSpacing: 0.8 },
  timeRule: { width: 3, alignSelf: "stretch", borderRadius: 2, marginRight: 2 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  calendarButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
  },
});
