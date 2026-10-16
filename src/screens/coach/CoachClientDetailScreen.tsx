import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { SwipeToDelete } from "../../components/ui/SwipeToDelete";
import { useCoachStore } from "../../store/coachStore";
import { startDirect } from "../../features/community/chat";
import { clientKeyOf, type CoachBooking } from "../../features/coach/types";
import { HomeworkRow } from "../../components/coach/HomeworkRow";
import { RoutinePickerSheet } from "./LiveSessionScreen";
import type { CoachClientsStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const STATUS_LABEL: Record<Exclude<CoachBooking["status"], "pending">, string> = {
  accepted: "Confirmed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const statusLabel = (booking: CoachBooking) =>
  booking.status === "pending"
    ? booking.awaitingResponseFrom === "coach"
      ? "Waiting on you"
      : "Waiting on them"
    : STATUS_LABEL[booking.status];

/** One client's history of sessions with this coach, and a way to message them. */
export const CoachClientDetailScreen = () => {
  const route = useRoute<RouteProp<CoachClientsStackParamList, "ClientDetail">>();
  const navigation = useNavigation<any>();
  const { clientId, clientName } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsCoach, sessionNotes, sessionRecaps, deleteBooking, allHomework, homeworkProgress, addHomework, archiveHomework, loadHomeworkProgress, ownerId } =
    useCoachStore(
      useShallow((state) => ({
        bookingsAsCoach: state.bookingsAsCoach,
        sessionNotes: state.sessionNotes,
        sessionRecaps: state.sessionRecaps,
        deleteBooking: state.deleteBooking,
        allHomework: state.homework,
        homeworkProgress: state.homeworkProgress,
        addHomework: state.addHomework,
        archiveHomework: state.archiveHomework,
        loadHomeworkProgress: state.loadHomeworkProgress,
        ownerId: state.ownerId,
      }))
    );
  const [messaging, setMessaging] = useState(false);
  const [settingHomework, setSettingHomework] = useState(false);

  const history = useMemo(
    () => bookingsAsCoach.filter((booking) => clientKeyOf(booking) === clientId).sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [bookingsAsCoach, clientId]
  );
  const isGuest = history.length > 0 && history[0].playerId == null;
  const homework = useMemo(
    () => (isGuest ? [] : allHomework.filter((item) => item.playerId === clientId && item.coachId === ownerId)),
    [allHomework, clientId, isGuest, ownerId]
  );
  const firstName = clientName.split(" ")[0] || clientName;

  useEffect(() => {
    if (!isGuest) void loadHomeworkProgress(clientId);
  }, [clientId, isGuest, loadHomeworkProgress]);

  const removeHomework = (id: string, name: string) =>
    dialog.confirm({
      title: `Take ${name} off ${firstName}'s homework?`,
      message: "It comes off their list. Their scores on it are kept.",
      tone: "danger",
      confirmLabel: "Remove",
      cancelLabel: "Keep it",
      onConfirm: () => archiveHomework(id),
    });

  const message = async () => {
    if (isGuest) return;
    setMessaging(true);
    const result = await startDirect(clientId);
    setMessaging(false);
    if (result.ok) navigation.navigate("Chat", { conversationId: result.value });
    else dialog.alert({ title: `You cannot message ${clientName}`, message: result.message, icon: "message-lock-outline" });
  };

  const removeHistory = (booking: CoachBooking) =>
    dialog.confirm({
      title: "Delete this session?",
      message: `This removes it from ${clientName}'s history for good, including any notes on it.`,
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete",
      cancelLabel: "Keep it",
      onConfirm: () => deleteBooking(booking.id),
    });

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={history}
      keyExtractor={(booking) => booking.id}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListHeaderComponent={
        isGuest ? (
          <View style={[styles.guestNotice, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialCommunityIcons name="account-outline" size={18} color={colors.textMuted} />
            <Text style={[styles.guestNoticeText, { color: colors.textMuted }]}>No Snookered account - booked in by you.</Text>
          </View>
        ) : (
          <View>
            <Pressable
              onPress={message}
              disabled={messaging}
              accessibilityRole="button"
              style={[styles.message, { backgroundColor: colors.primary, opacity: messaging ? 0.6 : 1 }]}
            >
              {messaging ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="chat-outline" size={20} color={colors.onPrimary} />
                  <Text style={[styles.messageText, { color: colors.onPrimary }]}>Message {clientName}</Text>
                </>
              )}
            </Pressable>
            <View style={styles.homeworkHead}>
              <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>HOMEWORK</Text>
              <Pressable onPress={() => setSettingHomework(true)} accessibilityRole="button" hitSlop={8} style={styles.addHomework}>
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primary} />
                <Text style={[styles.addHomeworkText, { color: colors.primary }]}>Set homework</Text>
              </Pressable>
            </View>
            {homework.length ? (
              <View style={styles.homeworkList}>
                {homework.map((item) => (
                  <HomeworkRow key={item.id} homework={item} progress={homeworkProgress[item.id]} onRemove={() => removeHomework(item.id, item.routineName)} />
                ))}
              </View>
            ) : (
              <Text style={[styles.homeworkEmpty, { color: colors.textMuted }]}>
                Routines for {firstName} to practise between sessions. You'll see their best score and how often they've done each one.
              </Text>
            )}
            <Text style={[styles.sectionLabel, styles.sessionsLabel, { color: colors.textMuted }]}>SESSIONS</Text>
            <RoutinePickerSheet
              visible={settingHomework}
              mode="homework"
              onClose={() => setSettingHomework(false)}
              onAdd={async (routine, target, note, perWeek) => {
                const latest = history.find((item) => item.status === "accepted");
                const result = await addHomework({
                  playerId: clientId,
                  bookingId: latest?.id ?? null,
                  routineId: routine.id,
                  routineName: routine.name,
                  targetScore: target,
                  perWeek: perWeek ?? null,
                  note,
                });
                if (result.ok) setSettingHomework(false);
                else dialog.alert({ title: "Could not set that homework", message: result.message, tone: "danger" });
              }}
            />
          </View>
        )
      }
      renderItem={({ item }) => {
        const hasNotes = Boolean(sessionNotes[item.id]?.trim()) || Boolean(sessionRecaps[item.id]);
        const isLive = item.status === "accepted";
        const Row = isLive ? Pressable : View;
        // Only history that is actually over can be swiped away - a live or upcoming confirmed
        // session is cancelled, not deleted.
        const deletable = item.status !== "accepted" || new Date(item.endsAt) < new Date();
        const row = (
          <Row
            {...(isLive
              ? { onPress: () => navigation.getParent()?.navigate("LiveSession", { bookingId: item.id }), accessibilityRole: "button" as const }
              : {})}
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowDate, { color: colors.text }]}>{formatDay(item.startsAt)}</Text>
              <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                {formatTime(item.startsAt)}–{formatTime(item.endsAt)}
              </Text>
              {item.note ? <Text style={[styles.rowNote, { color: colors.text }]}>“{item.note}”</Text> : null}
            </View>
            {hasNotes ? <MaterialCommunityIcons name="note-text-outline" size={18} color={colors.primary} /> : null}
            <Text style={[styles.status, { color: item.status === "accepted" ? colors.primary : colors.textMuted }]}>
              {statusLabel(item)}
            </Text>
            {isLive ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} /> : null}
          </Row>
        );
        return deletable ? (
          <SwipeToDelete
            onDelete={() => removeHistory(item)}
            deleteLabel={`Delete the session with ${clientName} on ${formatDay(item.startsAt)}`}
            gapBelow={SPACING.sm}
          >
            {row}
          </SwipeToDelete>
        ) : (
          row
        );
      }}
    />
  );
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const styles = StyleSheet.create({
  list: { padding: SPACING.lg, gap: SPACING.sm },
  message: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
  },
  messageText: { fontSize: 16, fontWeight: "800" },
  guestNotice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.md,
  },
  guestNoticeText: { fontSize: 14, fontWeight: "600" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  rowText: { flex: 1, gap: 2 },
  rowDate: { fontSize: 15, fontWeight: "700" },
  rowTime: { fontSize: 13 },
  rowNote: { fontSize: 13, fontStyle: "italic", marginTop: 2 },
  homeworkHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.sm },
  sectionLabel: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.6 },
  sessionsLabel: { marginTop: SPACING.lg, marginBottom: SPACING.xs },
  addHomework: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: HIT_TARGET - 8 },
  addHomeworkText: { fontSize: 14, fontWeight: "700" },
  homeworkList: { gap: SPACING.sm },
  homeworkEmpty: { fontSize: 13, lineHeight: 18 },
  status: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.4, textTransform: "uppercase" },
});
