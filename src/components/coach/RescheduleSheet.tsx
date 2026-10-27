import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { openSlots, type CoachBooking, type CoachSlot } from "../../features/coach/types";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const REASON_LIMIT = 200;

/** How far ahead a coach can propose any time, and the times of day on offer (every 15 minutes). */
const ANY_TIME_DAYS = 21;
const FIRST_HOUR = 7;
const LAST_HOUR = 23;
const STEP_MINUTES = 15;

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
const dayChip = (date: Date, today: Date) => {
  if (sameDay(date, today)) return "Today";
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  if (sameDay(date, tomorrow)) return "Tomorrow";
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};
const clock = (minutes: number) => {
  const date = new Date(2000, 0, 1, Math.floor(minutes / 60), minutes % 60);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

/** Picking a new time for an existing booking, from the same coach's other open slots - usable by
 * either the coach or the player, since either one's plans can change. The coach can also offer any
 * day and time at all (`anyTime`): the same day an hour later, or a day they haven't opened yet. The
 * session keeps its length, and the other side accepts or declines the new time. */
export const RescheduleSheet = ({
  visible,
  coachId,
  bookingId,
  anyTime = false,
  onClose,
  onDone,
}: {
  visible: boolean;
  coachId: string;
  bookingId: string;
  /** The coach's own view: offer any day and time, not only open slots. */
  anyTime?: boolean;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { loadCoachSchedule, rescheduleBooking, booking } = useCoachStore(
    useShallow((state) => ({
      loadCoachSchedule: state.loadCoachSchedule,
      rescheduleBooking: state.rescheduleBooking,
      booking: [...state.bookingsAsCoach, ...state.bookingsAsPlayer].find((item) => item.id === bookingId) ?? null,
    }))
  );
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // Any day and time: starts on the booking's own day and time, so "an hour later" is one tap.
  const [day, setDay] = useState(() => startOfDay(new Date()));
  const [minutes, setMinutes] = useState(18 * 60);
  const lengthMinutes = booking ? Math.max(15, Math.round((Date.parse(booking.endsAt) - Date.parse(booking.startsAt)) / 60_000)) : 60;
  const days = useMemo(() => {
    const today = startOfDay(new Date());
    return Array.from({ length: ANY_TIME_DAYS }, (_, index) => {
      const date = new Date(today);
      date.setDate(today.getDate() + index);
      return date;
    });
    // Rebuilt each time the sheet opens, so "Today" is today.
  }, [visible]);
  const times = useMemo(
    () => Array.from({ length: ((LAST_HOUR - FIRST_HOUR) * 60) / STEP_MINUTES + 1 }, (_, index) => FIRST_HOUR * 60 + index * STEP_MINUTES),
    []
  );
  const proposedStart = new Date(day.getFullYear(), day.getMonth(), day.getDate(), Math.floor(minutes / 60), minutes % 60);
  const proposedInPast = proposedStart.getTime() <= Date.now();

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setReason("");
    if (booking) {
      const start = new Date(booking.startsAt);
      const today = startOfDay(new Date());
      setDay(startOfDay(start) < today ? today : startOfDay(start));
      const rounded = Math.round((start.getHours() * 60 + start.getMinutes()) / STEP_MINUTES) * STEP_MINUTES;
      setMinutes(Math.min(LAST_HOUR * 60, Math.max(FIRST_HOUR * 60, rounded)));
    }
    void loadCoachSchedule(coachId).then((result) => {
      setSlots(result.slots);
      setBookings(result.bookings);
      setLoading(false);
    });
  }, [visible, coachId, loadCoachSchedule]);

  const available = openSlots(slots, bookings);

  const pick = async (slot: CoachSlot) => {
    setSavingId(slot.id);
    const result = await rescheduleBooking(bookingId, slot, reason);
    setSavingId(null);
    if (result.ok) onDone();
    else dialog.alert({ title: "Could not reschedule", message: result.message, tone: "danger" });
  };

  const proposeAnyTime = async () => {
    if (proposedInPast) return;
    setSavingId("any");
    const startsAt = proposedStart.toISOString();
    const endsAt = new Date(proposedStart.getTime() + lengthMinutes * 60_000).toISOString();
    const result = await rescheduleBooking(bookingId, { startsAt, endsAt }, reason);
    setSavingId(null);
    if (result.ok) onDone();
    else dialog.alert({ title: "Could not suggest that time", message: result.message, tone: "danger" });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text style={[styles.title, { color: colors.text }]}>{anyTime ? "Suggest a new time" : "Choose a new time"}</Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>Reason (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={(text) => setReason(text.slice(0, REASON_LIMIT))}
          placeholder="Let them know why, if you'd like..."
          placeholderTextColor={colors.textMuted}
          style={[styles.reasonInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
        />
        {anyTime ? (
          <View style={styles.anyTime}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Any day and time</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {days.map((date) => {
                const selected = sameDay(date, day);
                return (
                  <Pressable
                    key={date.toDateString()}
                    onPress={() => setDay(date)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{dayChip(date, days[0])}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {times.map((value) => {
                const selected = value === minutes;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setMinutes(value)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    style={[styles.chip, selected ? { backgroundColor: colors.primary } : { backgroundColor: colors.surfaceMuted }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{clock(value)}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              onPress={proposeAnyTime}
              disabled={savingId !== null || proposedInPast}
              accessibilityRole="button"
              style={[styles.propose, { backgroundColor: colors.primary, opacity: savingId !== null || proposedInPast ? 0.5 : 1 }]}
            >
              {savingId === "any" ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.proposeText, { color: colors.onPrimary }]}>
                  {proposedInPast ? "That time has passed" : `Suggest ${dayChip(day, days[0])}, ${clock(minutes)}–${clock(minutes + lengthMinutes)}`}
                </Text>
              )}
            </Pressable>
            <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.md }]}>Or one of your open slots</Text>
          </View>
        ) : null}
        {loading ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : (
          <FlatList
            data={available}
            keyExtractor={(slot) => slot.id}
            style={styles.list}
            ListEmptyComponent={
              <Text style={[styles.empty, { color: colors.textMuted }]}>No other open slots right now.</Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => pick(item)}
                disabled={savingId !== null}
                accessibilityRole="button"
                style={[styles.row, { backgroundColor: colors.surfaceMuted }]}
              >
                <View>
                  <Text style={[styles.rowDate, { color: colors.text }]}>{formatDay(item.startsAt)}</Text>
                  <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                    {formatTime(item.startsAt)}–{formatTime(item.endsAt)}
                  </Text>
                </View>
                {savingId === item.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                )}
              </Pressable>
            )}
          />
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { marginTop: "auto", maxHeight: "75%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  title: { fontSize: 20, fontWeight: "800", marginBottom: SPACING.sm },
  label: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.4, marginBottom: 4 },
  reasonInput: { minHeight: HIT_TARGET, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 15, marginBottom: SPACING.md },
  loading: { marginVertical: SPACING.xl },
  anyTime: { gap: SPACING.sm },
  chips: { gap: 6, paddingRight: SPACING.lg },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, minHeight: 36, justifyContent: "center" },
  chipText: { fontSize: 14, fontWeight: "700" },
  propose: { minHeight: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.md },
  proposeText: { fontSize: 15, fontWeight: "800" },
  list: { gap: SPACING.sm },
  empty: { fontSize: 14, textAlign: "center", paddingVertical: SPACING.xl },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 8,
    marginBottom: SPACING.sm,
  },
  rowDate: { fontSize: 15, fontWeight: "700" },
  rowTime: { fontSize: 13, marginTop: 2 },
});
