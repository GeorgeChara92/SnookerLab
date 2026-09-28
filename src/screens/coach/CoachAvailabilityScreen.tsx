import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Calendar, type DateData } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { nameOf } from "../../features/community/types";
import { clientsOf, generateWeeklySlots, type Client, type CoachBooking, type CoachSlot } from "../../features/coach/types";
import { FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

const WEEKDAYS: Array<{ value: number; label: string }> = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const WEEK_OPTIONS = [2, 4, 8];

const DURATIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 90, label: "1.5 hours" },
  { minutes: 120, label: "2 hours" },
];

/** "2026-09-29", in the coach's own local time - not a UTC slice, which can land on the wrong
 * calendar day for anything close to midnight. */
const localDateKey = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const todayKey = () => localDateKey(new Date().toISOString());

type DayItem = { kind: "booking"; booking: CoachBooking } | { kind: "slot"; slot: CoachSlot };

/** A coach's calendar: open slots and bookings on a month grid, with the selected day's detail below. */
export const CoachAvailabilityScreen = () => {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const navigation = useNavigation<any>();
  const { mySlots, bookingsAsCoach, addSlot, removeSlot, addRecurringSlots, respondToBooking, createManualBooking, loaded } = useCoachStore();
  const { profiles } = useCommunityStore();

  const partyName = (booking: CoachBooking) => booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]);

  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [adding, setAdding] = useState(false);
  const [start, setStart] = useState(() => nextHour());
  const [duration, setDuration] = useState(60);
  const [busy, setBusy] = useState(false);
  const [settingWeekly, setSettingWeekly] = useState(false);
  const [weeklyDays, setWeeklyDays] = useState<Set<number>>(new Set());
  const [weeklyStart, setWeeklyStart] = useState(() => atHour(9));
  const [weeklyEnd, setWeeklyEnd] = useState(() => atHour(17));
  const [weeklyDuration, setWeeklyDuration] = useState(60);
  const [weeklyWeeks, setWeeklyWeeks] = useState(4);
  const [savingWeekly, setSavingWeekly] = useState(false);

  const [bookingSlot, setBookingSlot] = useState<CoachSlot | null>(null);
  const [bookingSelectedClient, setBookingSelectedClient] = useState<Client | null>(null);
  const [bookingGuestName, setBookingGuestName] = useState("");
  const [bookingNote, setBookingNote] = useState("");
  const [bookingBusy, setBookingBusy] = useState(false);

  // Only real accounts make sense to pick from a list - a repeat guest is simply typed again below.
  const existingClients = useMemo(() => clientsOf(bookingsAsCoach).filter((client) => client.playerId), [bookingsAsCoach]);

  const bookedSlotIds = useMemo(
    () =>
      new Set(
        bookingsAsCoach
          .filter((booking) => booking.status === "pending" || booking.status === "accepted")
          .map((booking) => booking.availabilityId)
          .filter((id): id is string => Boolean(id))
      ),
    [bookingsAsCoach]
  );

  const acceptedSlotIds = useMemo(
    () =>
      new Set(
        bookingsAsCoach
          .filter((booking) => booking.status === "accepted")
          .map((booking) => booking.availabilityId)
          .filter((id): id is string => Boolean(id))
      ),
    [bookingsAsCoach]
  );

  const markedDates = useMemo(() => {
    const marks: Record<string, { dots: Array<{ key: string; color: string }> }> = {};
    const addDot = (key: string, dotKey: string, color: string) => {
      if (!marks[key]) marks[key] = { dots: [] };
      if (!marks[key].dots.some((dot) => dot.key === dotKey)) marks[key].dots.push({ key: dotKey, color });
    };
    // A slot's own dot reflects what is actually happening to it - confirmed, still waiting on an
    // answer, or open - never "booked" for a request that has not been accepted yet, which used to
    // show alongside its own "waiting on you" dot as if it were two different things on that day.
    const now = new Date();
    for (const slot of mySlots) {
      const key = localDateKey(slot.startsAt);
      if (acceptedSlotIds.has(slot.id)) addDot(key, "booked", colors.primary);
      else if (bookedSlotIds.has(slot.id)) addDot(key, "pending", colors.danger);
      else if (new Date(slot.startsAt) > now) addDot(key, "open", colors.textMuted);
    }
    for (const booking of bookingsAsCoach) {
      if (booking.status !== "pending" && booking.status !== "accepted") continue;
      addDot(localDateKey(booking.startsAt), booking.status === "pending" ? "pending" : "booked", booking.status === "pending" ? colors.danger : colors.primary);
    }
    return marks;
  }, [mySlots, bookingsAsCoach, bookedSlotIds, acceptedSlotIds, colors.primary, colors.textMuted, colors.danger]);

  const daySlots = useMemo(
    () =>
      mySlots.filter(
        (slot) => localDateKey(slot.startsAt) === selectedDay && !bookedSlotIds.has(slot.id) && new Date(slot.startsAt) > new Date()
      ),
    [mySlots, selectedDay, bookedSlotIds]
  );
  const dayBookings = useMemo(
    () =>
      bookingsAsCoach
        .filter((booking) => localDateKey(booking.startsAt) === selectedDay && (booking.status === "pending" || booking.status === "accepted"))
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsCoach, selectedDay]
  );

  const openAdd = () => {
    const [year, month, day] = selectedDay.split("-").map(Number);
    const base = nextHour();
    base.setFullYear(year, month - 1, day);
    setStart(base);
    setAdding(true);
  };

  const save = async () => {
    setBusy(true);
    const endsAt = new Date(start.getTime() + duration * 60_000);
    const result = await addSlot(start.toISOString(), endsAt.toISOString());
    setBusy(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not add that slot", message: result.message, tone: "danger" });
      return;
    }
    setAdding(false);
    setDuration(60);
  };

  const confirmRemove = (slot: CoachSlot) =>
    dialog.confirm({
      title: "Remove this slot?",
      message: "Players will no longer be able to book it.",
      tone: "danger",
      icon: "calendar-remove-outline",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
      onConfirm: () => removeSlot(slot.id),
    });

  const openBookSlot = (slot: CoachSlot) => {
    setBookingSlot(slot);
    setBookingSelectedClient(null);
    setBookingGuestName("");
    setBookingNote("");
  };

  const closeBookSlot = () => setBookingSlot(null);

  const saveManualBooking = async () => {
    if (!bookingSlot) return;
    const guestName = bookingGuestName.trim();
    if (!bookingSelectedClient && !guestName) return;
    setBookingBusy(true);
    const result = await createManualBooking(
      bookingSlot,
      bookingSelectedClient?.playerId ? { playerId: bookingSelectedClient.playerId } : { guestName },
      bookingNote
    );
    setBookingBusy(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not book that slot", message: result.message, tone: "danger" });
      return;
    }
    closeBookSlot();
  };

  const bookingLabel = (booking: CoachBooking) =>
    booking.status === "pending" ? (booking.awaitingResponseFrom === "coach" ? "Waiting on you" : "Waiting on them") : "Confirmed";

  const respond = async (booking: CoachBooking, status: "accepted" | "declined") => {
    const result = await respondToBooking(booking.id, status);
    if (!result.ok) dialog.alert({ title: "Could not update that request", message: result.message, tone: "danger" });
  };

  const openBooking = (booking: CoachBooking) => {
    if (booking.status === "pending" && booking.awaitingResponseFrom === "coach") {
      dialog.choose({
        title: partyName(booking),
        message: `${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}`,
        icon: "calendar-question-outline",
        confirmLabel: "Accept",
        secondaryLabel: "Decline",
        cancelLabel: "Not now",
        onConfirm: () => respond(booking, "accepted"),
        onSecondary: () => respond(booking, "declined"),
      });
    } else if (booking.status === "pending") {
      dialog.alert({
        title: partyName(booking),
        message: `You proposed ${formatTime(booking.startsAt)} – ${formatTime(booking.endsAt)}. Waiting for them to confirm it.`,
        icon: "calendar-clock-outline",
      });
    } else {
      navigation.getParent()?.navigate("LiveSession", { bookingId: booking.id });
    }
  };

  const toggleWeeklyDay = (value: number) =>
    setWeeklyDays((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });

  const previewWeeklySlots = useMemo(
    () =>
      generateWeeklySlots(
        [...weeklyDays],
        { hour: weeklyStart.getHours(), minute: weeklyStart.getMinutes() },
        { hour: weeklyEnd.getHours(), minute: weeklyEnd.getMinutes() },
        weeklyDuration,
        weeklyWeeks,
        mySlots
      ),
    [weeklyDays, weeklyStart, weeklyEnd, weeklyDuration, weeklyWeeks, mySlots]
  );

  const saveWeekly = async () => {
    setSavingWeekly(true);
    const result = await addRecurringSlots(previewWeeklySlots);
    setSavingWeekly(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not add those slots", message: result.message, tone: "danger" });
      return;
    }
    setSettingWeekly(false);
    setWeeklyDays(new Set());
  };

  const dayItems: DayItem[] = [
    ...dayBookings.map((booking): DayItem => ({ kind: "booking", booking })),
    ...daySlots.map((slot): DayItem => ({ kind: "slot", slot })),
  ];

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Calendar
        // react-native-calendars caches some of its internal styles on first mount and does not
        // reliably re-apply every theme colour when the theme prop alone changes - remounting on
        // a light/dark flip is what actually gets it to repaint correctly.
        key={isDark ? "dark" : "light"}
        current={selectedDay}
        onDayPress={(day: DateData) => setSelectedDay(day.dateString)}
        markingType="multi-dot"
        markedDates={{
          ...markedDates,
          [selectedDay]: { ...(markedDates[selectedDay] ?? { dots: [] }), selected: true, selectedColor: colors.primary },
        }}
        theme={{
          calendarBackground: colors.surface,
          dayTextColor: colors.text,
          monthTextColor: colors.text,
          textDisabledColor: colors.textSubtle,
          todayTextColor: colors.primary,
          arrowColor: colors.primary,
          textMonthFontWeight: "800",
          textDayFontWeight: "600",
          selectedDayBackgroundColor: colors.primary,
          selectedDayTextColor: colors.onPrimary,
        }}
        style={[styles.calendar, { borderColor: colors.border }]}
      />

      <View style={[styles.legend, { borderColor: colors.border }]}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Booked</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Waiting on you</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>Open slot</Text>
        </View>
      </View>

      <FlatList
        data={dayItems}
        keyExtractor={(item) => (item.kind === "booking" ? item.booking.id : item.slot.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialCommunityIcons name="calendar-blank-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nothing on this day yet.</Text>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === "booking" ? (
            <Pressable
              onPress={() => openBooking(item.booking)}
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowDate, { color: colors.text }]}>{partyName(item.booking)}</Text>
                <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                  {formatTime(item.booking.startsAt)} – {formatTime(item.booking.endsAt)}
                </Text>
              </View>
              <Text style={[styles.status, { color: item.booking.status === "pending" ? colors.danger : colors.primary }]}>
                {bookingLabel(item.booking)}
              </Text>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          ) : (
            <Pressable
              onPress={() => openBookSlot(item.slot)}
              accessibilityRole="button"
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowDate, { color: colors.text }]}>Open slot</Text>
                <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                  {formatTime(item.slot.startsAt)} – {formatTime(item.slot.endsAt)}
                </Text>
              </View>
              <Text style={[styles.status, { color: colors.textMuted }]}>Tap to book</Text>
              <Pressable
                onPress={() => confirmRemove(item.slot)}
                accessibilityRole="button"
                accessibilityLabel="Remove this slot"
                hitSlop={8}
                style={styles.remove}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </Pressable>
          )
        }
      />

      <Pressable
        onPress={() =>
          dialog.choose({
            title: "Add availability",
            message: "Add one slot on the selected day, or set your standing weekly hours.",
            icon: "calendar-plus",
            confirmLabel: "Add a slot on this day",
            secondaryLabel: "Set weekly hours",
            cancelLabel: "Cancel",
            // This dialog is still animating closed when onConfirm/onSecondary fire - opening
            // another modal in the same instant is what silently swallows it on iOS.
            onConfirm: () => setTimeout(openAdd, 350),
            onSecondary: () => setTimeout(() => setSettingWeekly(true), 350),
          })
        }
        accessibilityRole="button"
        style={[styles.add, { backgroundColor: colors.primary, bottom: insets.bottom + SPACING.md }]}
      >
        <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
        <Text style={[styles.addText, { color: colors.onPrimary }]}>Add availability</Text>
      </Pressable>

      <Modal visible={adding} transparent animationType="slide" onRequestClose={() => setAdding(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={() => setAdding(false)} />
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Add a slot</Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>Starts</Text>
          <DateTimePicker
            value={start}
            mode="datetime"
            minimumDate={new Date()}
            onChange={(_, value) => value && setStart(value)}
            themeVariant={isDark ? "dark" : "light"}
          />

          <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>Length</Text>
          <View style={styles.durations}>
            {DURATIONS.map(({ minutes, label }) => (
              <Pressable
                key={minutes}
                onPress={() => setDuration(minutes)}
                accessibilityRole="radio"
                accessibilityState={{ selected: duration === minutes }}
                style={[
                  styles.durationChip,
                  {
                    borderColor: duration === minutes ? colors.primary : colors.border,
                    backgroundColor: duration === minutes ? colors.primary : "transparent",
                  },
                ]}
              >
                <Text style={{ color: duration === minutes ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={save}
            disabled={busy}
            accessibilityRole="button"
            style={[styles.save, { backgroundColor: colors.primary, opacity: busy ? 0.6 : 1 }]}
          >
            <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save slot</Text>
          </Pressable>
        </View>
      </Modal>

      <Modal visible={settingWeekly} transparent animationType="slide" onRequestClose={() => setSettingWeekly(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={() => setSettingWeekly(false)} />
        <View
          style={[
            styles.bottomSheet,
            styles.tallSheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Weekly hours</Text>

          <ScrollView contentContainerStyle={styles.weeklyBody}>
            <View style={{ gap: SPACING.xs }}>
                <Text style={[styles.label, { color: colors.textMuted }]}>Days</Text>
                <View style={styles.durations}>
                  {WEEKDAYS.map(({ value, label }) => {
                    const selected = weeklyDays.has(value);
                    return (
                      <Pressable
                        key={value}
                        onPress={() => toggleWeeklyDay(value)}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: selected }}
                        style={[
                          styles.durationChip,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : "transparent" },
                        ]}
                      >
                        <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: "700" }}>{label}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>From</Text>
                <DateTimePicker
                  value={weeklyStart}
                  mode="time"
                  onChange={(_, value) => value && setWeeklyStart(value)}
                  themeVariant={isDark ? "dark" : "light"}
                />
                <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.md }]}>Until</Text>
                <DateTimePicker
                  value={weeklyEnd}
                  mode="time"
                  onChange={(_, value) => value && setWeeklyEnd(value)}
                  themeVariant={isDark ? "dark" : "light"}
                />

                <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>Slot length</Text>
                <View style={styles.durations}>
                  {DURATIONS.map(({ minutes, label }) => (
                    <Pressable
                      key={minutes}
                      onPress={() => setWeeklyDuration(minutes)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: weeklyDuration === minutes }}
                      style={[
                        styles.durationChip,
                        {
                          borderColor: weeklyDuration === minutes ? colors.primary : colors.border,
                          backgroundColor: weeklyDuration === minutes ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      <Text style={{ color: weeklyDuration === minutes ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>For the next</Text>
                <View style={styles.durations}>
                  {WEEK_OPTIONS.map((weeks) => (
                    <Pressable
                      key={weeks}
                      onPress={() => setWeeklyWeeks(weeks)}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: weeklyWeeks === weeks }}
                      style={[
                        styles.durationChip,
                        {
                          borderColor: weeklyWeeks === weeks ? colors.primary : colors.border,
                          backgroundColor: weeklyWeeks === weeks ? colors.primary : "transparent",
                        },
                      ]}
                    >
                      <Text style={{ color: weeklyWeeks === weeks ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                        {weeks} weeks
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={[styles.previewText, { color: colors.textMuted }]}>
                  {weeklyDays.size === 0
                    ? "Choose at least one day."
                    : `${previewWeeklySlots.length} slot${previewWeeklySlots.length === 1 ? "" : "s"} will be added.`}
                </Text>

                <Pressable
                  onPress={saveWeekly}
                  disabled={savingWeekly || weeklyDays.size === 0 || !previewWeeklySlots.length}
                  accessibilityRole="button"
                  style={[
                    styles.save,
                    { backgroundColor: colors.primary, opacity: savingWeekly || weeklyDays.size === 0 || !previewWeeklySlots.length ? 0.5 : 1 },
                  ]}
                >
                  <Text style={[styles.saveText, { color: colors.onPrimary }]}>Add these slots</Text>
                </Pressable>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={!!bookingSlot} transparent animationType="slide" onRequestClose={closeBookSlot}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={closeBookSlot} />
        <View
          style={[
            styles.bottomSheet,
            styles.tallSheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Book this slot</Text>
          {bookingSlot ? (
            <Text style={[styles.rowTime, { color: colors.textMuted, marginBottom: SPACING.sm }]}>
              {formatTime(bookingSlot.startsAt)} – {formatTime(bookingSlot.endsAt)}
            </Text>
          ) : null}

          <ScrollView contentContainerStyle={styles.weeklyBody}>
            {existingClients.length ? (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Existing clients</Text>
                <View style={styles.durations}>
                  {existingClients.map((client) => {
                    const selected = bookingSelectedClient?.key === client.key;
                    return (
                      <Pressable
                        key={client.key}
                        onPress={() => {
                          setBookingSelectedClient(selected ? null : client);
                          setBookingGuestName("");
                        }}
                        accessibilityRole="radio"
                        accessibilityState={{ selected }}
                        style={[
                          styles.durationChip,
                          { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : "transparent" },
                        ]}
                      >
                        <Text style={{ color: selected ? colors.onPrimary : colors.text, fontWeight: "700" }}>
                          {nameOf(profiles[client.playerId ?? ""])}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>Or someone with no Snookered account</Text>
            <TextInput
              value={bookingGuestName}
              onChangeText={(text) => {
                setBookingGuestName(text);
                setBookingSelectedClient(null);
              }}
              placeholder="Their name"
              placeholderTextColor={colors.textMuted}
              editable={!bookingSelectedClient}
              style={[
                styles.guestInput,
                { color: colors.text, backgroundColor: colors.background, borderColor: colors.border, opacity: bookingSelectedClient ? 0.5 : 1 },
              ]}
            />

            <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>Note (optional)</Text>
            <TextInput
              value={bookingNote}
              onChangeText={(text) => setBookingNote(text.slice(0, 300))}
              placeholder="What this session covers"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.guestInput, styles.noteInput, { color: colors.text, backgroundColor: colors.background, borderColor: colors.border }]}
            />

            <Pressable
              onPress={saveManualBooking}
              disabled={bookingBusy || (!bookingSelectedClient && !bookingGuestName.trim())}
              accessibilityRole="button"
              style={[
                styles.save,
                { backgroundColor: colors.primary, opacity: bookingBusy || (!bookingSelectedClient && !bookingGuestName.trim()) ? 0.5 : 1 },
              ]}
            >
              <Text style={[styles.saveText, { color: colors.onPrimary }]}>
                {bookingSelectedClient ? "Book & ask them to confirm" : "Book slot"}
              </Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
};

/** The top of the next hour, so a coach adding a slot right now is not picking a time in the past. */
const nextHour = () => {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 1);
  return date;
};

/** Today, at a given hour - only the time of day matters for the weekly-hours picker. */
const atHour = (hour: number) => {
  const date = new Date();
  date.setHours(hour, 0, 0, 0);
  return date;
};

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  screen: { flex: 1 },
  calendar: { borderBottomWidth: 1 },
  legend: {
    flexDirection: "row",
    justifyContent: "center",
    gap: SPACING.lg,
    paddingVertical: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12, fontWeight: "600" },
  list: { padding: SPACING.lg, gap: SPACING.sm },
  empty: { alignItems: "center", gap: SPACING.sm, paddingTop: SPACING.xl },
  emptyText: { fontSize: 14, textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rowText: { flex: 1, gap: 2 },
  rowDate: { fontSize: 15, fontWeight: "700" },
  rowTime: { fontSize: 14 },
  status: { fontSize: 12, fontFamily: FONTS.boardLabel, letterSpacing: 0.4, textTransform: "uppercase" },
  remove: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  add: {
    position: "absolute",
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  addText: { fontSize: 16, fontWeight: "800" },
  bottomSheet: {
    marginTop: "auto",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  tallSheet: { maxHeight: "85%" },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 19, fontWeight: "800", marginBottom: SPACING.md },
  weeklyBody: { gap: SPACING.xs, paddingBottom: SPACING.md },
  label: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase" },
  durations: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  durationChip: {
    borderWidth: 1.5,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  save: {
    marginTop: SPACING.xl,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontWeight: "800" },
  previewText: { fontSize: 13, marginTop: SPACING.md, textAlign: "center" },
  guestInput: { borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, marginTop: SPACING.xs, fontSize: 15 },
  noteInput: { minHeight: 72 },
});
