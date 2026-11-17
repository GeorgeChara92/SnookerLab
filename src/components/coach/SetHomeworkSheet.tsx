import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { clientsOf } from "../../features/coach/types";
import { resolveHomeworkRoutine } from "../../features/coach/homeworkRoutine";
import { nameOf } from "../../features/community/types";
import { ClientAvatar } from "./CoachUI";
import type { Routine } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

const PER_WEEK: Array<number | null> = [null, 1, 2, 3, 4, 5, 7];
const NOTE_LIMIT = 500;

/**
 * Sets one routine as homework for any of the coach's clients at once, from the Routines tab: who
 * gets it, a target, how often, and what to focus on. Guests (booked by name, with no account) can't
 * see homework, so only clients with an account are listed.
 */
export const SetHomeworkSheet = ({
  routine,
  visible,
  onClose,
  onDone,
}: {
  routine: Routine;
  visible: boolean;
  onClose: () => void;
  /** After it's set: how many clients it went to. */
  onDone: (count: number) => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { bookingsAsCoach, addHomework } = useCoachStore(
    useShallow((state) => ({ bookingsAsCoach: state.bookingsAsCoach, addHomework: state.addHomework }))
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState("");
  const [perWeek, setPerWeek] = useState<number | null>(3);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const clients = useMemo(
    () => clientsOf(bookingsAsCoach).filter((client): client is typeof client & { playerId: string } => Boolean(client.playerId)),
    [bookingsAsCoach]
  );

  const reset = () => {
    setChosen(new Set());
    setTarget("");
    setPerWeek(3);
    setNote("");
    setProblem(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const toggle = (playerId: string) =>
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });

  const save = async () => {
    if (!chosen.size) return;
    setSaving(true);
    setProblem(null);
    const resolved = await resolveHomeworkRoutine(routine);
    if (!resolved.ok) {
      setSaving(false);
      setProblem(resolved.message);
      return;
    }
    const targetScore = target.trim() ? Math.max(0, Math.round(Number(target))) : null;
    let set = 0;
    let lastError: string | null = null;
    for (const playerId of chosen) {
      // Tied to their latest session with this coach, as homework set from a session is.
      const latest = bookingsAsCoach
        .filter((booking) => booking.playerId === playerId && booking.status === "accepted")
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))[0];
      const result = await addHomework({
        playerId,
        bookingId: latest?.id ?? null,
        routineId: resolved.routineId,
        routineName: resolved.routineName,
        targetScore,
        perWeek,
        note: note.trim(),
      });
      if (result.ok) set++;
      else lastError = result.message;
    }
    setSaving(false);
    if (lastError && !set) {
      setProblem(lastError);
      return;
    }
    reset();
    onDone(set);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={close} />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <ScrollView keyboardShouldPersistTaps="handled">
          <Text style={[styles.title, { color: colors.text }]}>Set as homework</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {routine.name}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>Who it's for</Text>
          {clients.length ? (
            <View style={[styles.clients, { borderColor: colors.border }]}>
              {clients.map((client, index) => {
                const on = chosen.has(client.playerId);
                const profile = profiles[client.playerId];
                return (
                  <Pressable
                    key={client.playerId}
                    onPress={() => toggle(client.playerId)}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: on }}
                    style={({ pressed }) => [
                      styles.client,
                      {
                        borderTopWidth: index ? StyleSheet.hairlineWidth : 0,
                        borderTopColor: colors.border,
                        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                      },
                    ]}
                  >
                    <ClientAvatar profile={profile} size={36} />
                    <Text style={[styles.clientName, { color: colors.text }]} numberOfLines={1}>
                      {nameOf(profile)}
                    </Text>
                    <MaterialCommunityIcons
                      name={on ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                      size={24}
                      color={on ? colors.primary : colors.textMuted}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Clients with an account show here once they've had a session with you.
            </Text>
          )}

          <Text style={[styles.label, { color: colors.textMuted }]}>Target score (optional)</Text>
          <TextInput
            value={target}
            onChangeText={(text) => setTarget(text.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 7"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>How often</Text>
          <View style={styles.chips}>
            {PER_WEEK.map((value) => {
              const on = perWeek === value;
              return (
                <Pressable
                  key={String(value)}
                  onPress={() => setPerWeek(value)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.primary : "transparent" }]}
                >
                  <Text style={[styles.chipText, { color: on ? colors.onPrimary : colors.text }]}>
                    {value == null ? "Any time" : value === 7 ? "Every day" : `${value}× a week`}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>What to focus on (optional)</Text>
          <TextInput
            value={note}
            onChangeText={(text) => setNote(text.slice(0, NOTE_LIMIT))}
            placeholder="Keep the cue arm still through the shot..."
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            style={[styles.input, styles.note, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          />

          {problem ? <Text style={[styles.problem, { color: colors.danger }]}>{problem}</Text> : null}

          <View style={styles.actions}>
            <Pressable onPress={close} accessibilityRole="button" style={[styles.button, styles.cancel, { borderColor: colors.border }]}>
              <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={save}
              disabled={!chosen.size || saving}
              accessibilityRole="button"
              style={[styles.button, styles.confirm, { backgroundColor: colors.primary, opacity: !chosen.size || saving ? 0.5 : 1 }]}
            >
              {saving ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.buttonText, { color: colors.onPrimary }]} numberOfLines={1}>
                  {chosen.size > 1 ? `Set for ${chosen.size} clients` : "Set homework"}
                </Text>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: {
    marginTop: "auto",
    maxHeight: "88%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  label: {
    fontSize: 13,
    fontFamily: FONTS.boardLabel,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    marginTop: SPACING.lg,
    marginBottom: SPACING.xs,
  },
  clients: { borderWidth: 1, borderRadius: RADIUS.md, overflow: "hidden" },
  client: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET + 8, paddingHorizontal: SPACING.md },
  clientName: { flex: 1, fontSize: 15, fontWeight: "700" },
  empty: { fontSize: 14, lineHeight: 20 },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: HIT_TARGET, fontSize: 15 },
  note: { minHeight: 88, paddingTop: SPACING.sm },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, minHeight: 36, justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "700" },
  problem: { fontSize: 14, marginTop: SPACING.md },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  button: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.md },
  cancel: { borderWidth: 1, flex: 1 },
  confirm: { flex: 2 },
  buttonText: { fontSize: 16, fontWeight: "800" },
});
