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
import { type CoachBooking } from "../../features/coach/types";
import { addBookingToCalendar } from "../../features/coach/calendarSync";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** A coach's own agenda: requests waiting for an answer, then what is coming up today and beyond.
 * The broader picture (trends, top clients, recent sessions) lives on the Dashboard tab instead,
 * so this stays a quick daily check rather than a second dashboard. */
export const CoachDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsCoach, respondToBooking, loaded, markCoachResolutionsSeen } = useCoachStore();
  const { profiles } = useCommunityStore();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addingToCalendar, setAddingToCalendar] = useState<string | null>(null);

  useFocusEffect(useCallback(() => markCoachResolutionsSeen(), [markCoachResolutionsSeen]));

  const pending = useMemo(
    () =>
      bookingsAsCoach
        .filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsCoach]
  );
  const upcoming = useMemo(
    () =>
      bookingsAsCoach
        .filter((booking) => booking.status === "accepted" && new Date(booking.endsAt) > new Date())
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsCoach]
  );

  const respond = async (booking: CoachBooking, status: "accepted" | "declined") => {
    setBusyId(booking.id);
    const result = await respondToBooking(booking.id, status);
    setBusyId(null);
    if (!result.ok) dialog.alert({ title: "Could not update that request", message: result.message, tone: "danger" });
  };

  const playerName = (booking: CoachBooking) => booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]);

  const addToCalendar = async (booking: CoachBooking) => {
    setAddingToCalendar(booking.id);
    const result = await addBookingToCalendar(booking, `Coaching session with ${playerName(booking)}`);
    setAddingToCalendar(null);
    if (!result.ok) dialog.alert({ title: "Could not add to calendar", message: result.message, tone: "danger" });
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
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Requests</Text>
      {pending.length ? (
        <View style={styles.list}>
          {pending.map((booking) => (
            <View key={booking.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardName, { color: colors.text }]}>{playerName(booking)}</Text>
              <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
              </Text>
              {booking.note ? <Text style={[styles.cardNote, { color: colors.text }]}>“{booking.note}”</Text> : null}
              <View style={styles.actions}>
                <Pressable
                  onPress={() => respond(booking, "declined")}
                  disabled={busyId === booking.id}
                  accessibilityRole="button"
                  style={[styles.actionButton, { borderWidth: 1, borderColor: colors.border }]}
                >
                  <Text style={[styles.actionText, { color: colors.text }]}>Decline</Text>
                </Pressable>
                <Pressable
                  onPress={() => respond(booking, "accepted")}
                  disabled={busyId === booking.id}
                  accessibilityRole="button"
                  style={[styles.actionButton, { backgroundColor: colors.primary }]}
                >
                  {busyId === booking.id ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.actionText, { color: colors.onPrimary }]}>Accept</Text>
                  )}
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>Nothing waiting on you.</Text>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Coming up</Text>
      {upcoming.length ? (
        <View style={styles.list}>
          {upcoming.map((booking) => (
            <View key={booking.id} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => navigation.getParent()?.navigate("LiveSession", { bookingId: booking.id })}
                accessibilityRole="button"
                accessibilityLabel={`${playerName(booking)}, start session`}
                style={styles.rowMain}
              >
                <View style={styles.rowText}>
                  <Text style={[styles.rowDate, { color: colors.text }]}>{formatDay(booking.startsAt)}</Text>
                  <Text style={[styles.rowTime, { color: colors.textMuted }]}>
                    {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
                  </Text>
                  <Text style={[styles.rowName, { color: colors.primary }]}>{playerName(booking)}</Text>
                </View>
                <MaterialCommunityIcons name="play-circle-outline" size={26} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => addToCalendar(booking)}
                disabled={addingToCalendar === booking.id}
                accessibilityRole="button"
                accessibilityLabel="Add to calendar"
                hitSlop={8}
                style={[styles.calendarButton, { backgroundColor: colors.surfaceMuted }]}
              >
                {addingToCalendar === booking.id ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <MaterialCommunityIcons name="calendar-plus" size={18} color={colors.textMuted} />
                )}
              </Pressable>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[styles.empty, { color: colors.textMuted }]}>No confirmed sessions yet.</Text>
      )}
    </ScrollView>
  );
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.md },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase", marginTop: SPACING.sm },
  empty: { fontSize: 14 },
  list: { gap: SPACING.sm },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  cardName: { fontSize: 16, fontWeight: "800" },
  cardTime: { fontSize: 14 },
  cardNote: { fontSize: 14, fontStyle: "italic", marginTop: 2 },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  actionButton: { flex: 1, minHeight: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "800" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rowMain: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowText: { gap: 2 },
  rowDate: { fontSize: 15, fontWeight: "700" },
  rowTime: { fontSize: 13 },
  rowName: { fontSize: 15, fontWeight: "700", marginTop: 2 },
  calendarButton: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
});
