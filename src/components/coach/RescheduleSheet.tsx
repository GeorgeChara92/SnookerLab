import React, { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { openSlots, type CoachBooking, type CoachSlot } from "../../features/coach/types";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const REASON_LIMIT = 200;

/** Picking a new time for an existing booking, from the same coach's other open slots - usable by
 * either the coach or the player, since either one's plans can change. */
export const RescheduleSheet = ({
  visible,
  coachId,
  bookingId,
  onClose,
  onDone,
}: {
  visible: boolean;
  coachId: string;
  bookingId: string;
  onClose: () => void;
  onDone: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { loadCoachSchedule, rescheduleBooking } = useCoachStore();
  const [loading, setLoading] = useState(true);
  const [slots, setSlots] = useState<CoachSlot[]>([]);
  const [bookings, setBookings] = useState<CoachBooking[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setReason("");
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
        <Text style={[styles.title, { color: colors.text }]}>Choose a new time</Text>
        <Text style={[styles.label, { color: colors.textMuted }]}>Reason (optional)</Text>
        <TextInput
          value={reason}
          onChangeText={(text) => setReason(text.slice(0, REASON_LIMIT))}
          placeholder="Let them know why, if you'd like..."
          placeholderTextColor={colors.textMuted}
          style={[styles.reasonInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
        />
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
