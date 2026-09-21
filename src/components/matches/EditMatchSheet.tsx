import React, { useEffect, useState } from "react";
import {
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Match, MatchResult } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../ui/DialogProvider";
import { useMatchesStore } from "../../store";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

const resultOf = (user: number, opponent: number): MatchResult =>
  user > opponent ? "win" : user < opponent ? "loss" : "draw";

/**
 * Changing a match's details. The score can only be typed for a match entered by hand: a live
 * match's score comes from its frames.
 */
export const EditMatchSheet = ({
  match,
  scoreFromFrames,
  visible,
  onClose,
}: {
  match: Match;
  scoreFromFrames: boolean;
  visible: boolean;
  onClose: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const updateMatch = useMatchesStore((state) => state.updateMatch);
  const [opponent, setOpponent] = useState(match.opponent_name);
  const [location, setLocation] = useState(match.location ?? "");
  const [userScore, setUserScore] = useState(String(match.user_score));
  const [opponentScore, setOpponentScore] = useState(String(match.opponent_score));
  const [notes, setNotes] = useState(match.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Start from the match as it is now each time the sheet opens.
  useEffect(() => {
    if (!visible) return;
    setOpponent(match.opponent_name);
    setLocation(match.location ?? "");
    setUserScore(String(match.user_score));
    setOpponentScore(String(match.opponent_score));
    setNotes(match.notes ?? "");
  }, [visible, match]);

  const save = async () => {
    setSaving(true);
    try {
      const user = Math.max(0, Math.round(Number(userScore) || 0));
      const opp = Math.max(0, Math.round(Number(opponentScore) || 0));
      await updateMatch(match.id, {
        opponent_name: opponent.trim() || match.opponent_name,
        location: location.trim(),
        notes: notes.trim(),
        ...(scoreFromFrames ? {} : { user_score: user, opponent_score: opp, result: resultOf(user, opp) }),
        sync_status: "pending",
      });
      onClose();
    } catch {
      dialog.alert({
        title: "Could not save the match",
        message: "Your changes are still here. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
    } finally {
      setSaving(false);
    }
  };

  const field = (label: string, input: React.ReactNode) => (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      {input}
    </View>
  );
  const inputStyle = [
    styles.input,
    { color: colors.text, backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={[styles.scrim, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]}>Edit match</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" style={styles.close}>
              <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {field(
              "Opponent",
              <TextInput value={opponent} onChangeText={setOpponent} style={inputStyle} autoCapitalize="words" />
            )}
            {field(
              "Venue",
              <TextInput
                value={location}
                onChangeText={setLocation}
                style={inputStyle}
                placeholder="Club or venue"
                placeholderTextColor={colors.textMuted}
              />
            )}
            {scoreFromFrames ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                The score comes from the frames you scored live.
              </Text>
            ) : (
              <View style={styles.scores}>
                <View style={styles.flex}>
                  {field(
                    "Your frames",
                    <TextInput
                      value={userScore}
                      onChangeText={setUserScore}
                      keyboardType="number-pad"
                      style={inputStyle}
                    />
                  )}
                </View>
                <View style={styles.flex}>
                  {field(
                    `${opponent.trim() || "Opponent"}'s frames`,
                    <TextInput
                      value={opponentScore}
                      onChangeText={setOpponentScore}
                      keyboardType="number-pad"
                      style={inputStyle}
                    />
                  )}
                </View>
              </View>
            )}
            {field(
              "Notes",
              <TextInput
                value={notes}
                onChangeText={setNotes}
                style={[inputStyle, styles.notes]}
                multiline
                textAlignVertical="top"
                placeholder="How it went, what to work on"
                placeholderTextColor={colors.textMuted}
              />
            )}
          </ScrollView>

          <Pressable
            onPress={save}
            disabled={saving}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.save,
              { backgroundColor: colors.primary, opacity: pressed || saving ? 0.8 : 1 },
            ]}
          >
            <Text style={[styles.saveText, { color: colors.onPrimary }]}>{saving ? "Saving…" : "Save changes"}</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrim: { ...StyleSheet.absoluteFillObject },
  sheet: {
    marginTop: "auto",
    maxHeight: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 20, fontWeight: "800" },
  close: { minWidth: HIT_TARGET, minHeight: HIT_TARGET, alignItems: "flex-end", justifyContent: "center" },
  body: { gap: SPACING.md, paddingVertical: SPACING.md },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  notes: { minHeight: 96, paddingTop: SPACING.sm },
  scores: { flexDirection: "row", gap: SPACING.md },
  hint: { fontSize: 13, lineHeight: 18 },
  save: {
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  saveText: { fontSize: 16, fontWeight: "800" },
});
