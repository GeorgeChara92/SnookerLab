import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { openSlots, type CoachBooking, type CoachSlot } from "../../features/coach/types";
import type { CommunityStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const NOTE_LIMIT = 300;

/** A coach's open slots, and a request to book one - the "shared calendar instead of WhatsApp". */
export const BookCoachScreen = () => {
  const route = useRoute<RouteProp<CommunityStackParamList, "BookCoach">>();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { coachId, coachName } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsPlayer, loadCoachSchedule, requestBooking } = useCoachStore();

  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CoachSlot | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await loadCoachSchedule(coachId);
    setSlots(result.slots);
    setBookings(result.bookings);
    setLoading(false);
  }, [coachId, loadCoachSchedule]);

  useEffect(() => {
    void load();
  }, [load]);

  const alreadyRequested = bookingsAsPlayer.find(
    (booking) => booking.coachId === coachId && (booking.status === "pending" || booking.status === "accepted")
  );

  const available = openSlots(slots, bookings);

  const send = async () => {
    if (!selected) return;
    setSending(true);
    const result = await requestBooking(coachId, selected, note);
    setSending(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not send that request", message: result.message, tone: "danger" });
      return;
    }
    dialog.alert({
      title: "Request sent",
      message: `${coachName} will accept or decline it from their dashboard.`,
      icon: "calendar-check-outline",
    });
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (alreadyRequested) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="calendar-clock-outline" size={36} color={colors.textMuted} />
        <Text style={[styles.emptyText, { color: colors.text }]}>
          {alreadyRequested.status === "pending"
            ? `You already have a request waiting with ${coachName}.`
            : `You already have a session booked with ${coachName}.`}
        </Text>
      </View>
    );
  }

  if (selected) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.content}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Requesting</Text>
          <Text style={[styles.summary, { color: colors.text }]}>
            {formatDay(selected.startsAt)}{"\n"}
            {formatTime(selected.startsAt)}–{formatTime(selected.endsAt)} with {coachName}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted, marginTop: SPACING.lg }]}>
            Anything to tell {coachName}? (optional)
          </Text>
          <TextInput
            value={note}
            onChangeText={(text) => setNote(text.slice(0, NOTE_LIMIT))}
            placeholder="What would you like to work on?"
            placeholderTextColor={colors.textMuted}
            multiline
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
          />

          <View style={styles.footer}>
            <Pressable
              onPress={() => setSelected(null)}
              accessibilityRole="button"
              style={[styles.footerButton, { borderWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.footerButtonText, { color: colors.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={send}
              disabled={sending}
              accessibilityRole="button"
              style={[styles.footerButton, { backgroundColor: colors.primary, opacity: sending ? 0.6 : 1 }]}
            >
              {sending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.footerButtonText, { color: colors.onPrimary }]}>Request session</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={available}
      keyExtractor={(slot) => slot.id}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListEmptyComponent={
        <View style={styles.centre}>
          <MaterialCommunityIcons name="calendar-remove-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {coachName} has no open slots right now.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => setSelected(item)}
          accessibilityRole="button"
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View>
            <Text style={[styles.rowDate, { color: colors.text }]}>{formatDay(item.startsAt)}</Text>
            <Text style={[styles.rowTime, { color: colors.textMuted }]}>
              {formatTime(item.startsAt)}–{formatTime(item.endsAt)}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      )}
    />
  );
};

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });

const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: SPACING.lg, flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  emptyText: { fontSize: 15, textAlign: "center", maxWidth: 280 },
  list: { padding: SPACING.lg, gap: SPACING.sm, flexGrow: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 8,
  },
  rowDate: { fontSize: 15, fontWeight: "700" },
  rowTime: { fontSize: 14 },
  label: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase" },
  summary: { fontSize: 18, fontWeight: "800", marginTop: SPACING.xs, lineHeight: 26 },
  input: {
    marginTop: SPACING.xs,
    minHeight: 90,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    fontSize: 15,
    textAlignVertical: "top",
  },
  footer: { flexDirection: "row", gap: SPACING.sm, marginTop: "auto", paddingTop: SPACING.lg },
  footerButton: { flex: 1, minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  footerButtonText: { fontSize: 16, fontWeight: "800" },
});
