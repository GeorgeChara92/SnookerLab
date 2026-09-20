import React, { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import type { PracticeStackParamList } from "../../types";
import { useRoutineScoresStore, useRoutinesStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import type { ScoringType } from "../../types";

type EntryMode = "direct" | "fraction";

const getScoringUnitLabel = (scoringType: ScoringType): string => {
  switch (scoringType) {
    case "points":
      return "points";
    case "percentage":
      return "%";
    case "count":
      return "count";
    case "time":
      return "time";
    default:
      return "score";
  }
};

const getScoringHelpText = (scoringType: ScoringType, maxScore?: number): string => {
  switch (scoringType) {
    case "points":
      return maxScore
        ? `Record your session points total. Session cap: ${maxScore}.`
        : "Record your session points total.";
    case "percentage":
      return "Record either a percentage (for example 72%) or a made/attempts result (for example 18/25).";
    case "count":
      return maxScore
        ? `Record your completed count for the session. Session cap: ${maxScore}.`
        : "Record your completed count for the session.";
    case "time":
      return "Record your completion time in mm:ss format.";
    default:
      return "Record the score value for this routine.";
  }
};

const buildScoreFromInputs = (params: {
  scoringType: ScoringType;
  mode: EntryMode;
  directValue: string;
  made: string;
  attempts: string;
  maxScore?: number;
}): { value?: string; error?: string } => {
  const { scoringType, mode, directValue, made, attempts, maxScore } = params;
  const cleanDirect = directValue.trim();

  if (scoringType === "percentage" && mode === "fraction") {
    const madeNum = Number(made.trim());
    const attemptsNum = Number(attempts.trim());
    if (!Number.isFinite(madeNum) || !Number.isFinite(attemptsNum)) {
      return { error: "Enter valid numbers for made and attempts." };
    }
    if (attemptsNum <= 0 || madeNum < 0 || madeNum > attemptsNum) {
      return { error: "Made/attempts must be valid (made <= attempts, attempts > 0)." };
    }
    return { value: `${madeNum}/${attemptsNum}` };
  }

  if (!cleanDirect) {
    return { error: "Enter a score first." };
  }

  if (scoringType === "percentage") {
    const parsed = Number(cleanDirect.replace("%", ""));
    if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
      return { error: "Percentage must be between 0 and 100." };
    }
    return { value: `${parsed}%` };
  }

  if (scoringType === "points" || scoringType === "count") {
    const parsed = Number(cleanDirect);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return { error: `Enter a valid ${scoringType} value.` };
    }
    if (maxScore !== undefined && maxScore > 0 && parsed > maxScore) {
      return { error: `This routine has a session cap of ${maxScore}.` };
    }
    return { value: `${parsed}` };
  }

  if (scoringType === "time") {
    if (!/^\d{1,2}:\d{2}$/.test(cleanDirect)) {
      return { error: "Time must be in mm:ss format (for example 07:35)." };
    }
    return { value: cleanDirect };
  }

  return { value: cleanDirect };
};

export const RecordRoutineScoreScreen = () => {
  const route = useRoute<RouteProp<PracticeStackParamList, "RecordRoutineScore">>();
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { routineId } = route.params;

  const [score, setScore] = useState("");
  const [entryMode, setEntryMode] = useState<EntryMode>("direct");
  const [made, setMade] = useState("");
  const [attempts, setAttempts] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { getRoutineById } = useRoutinesStore();
  const { addEntry } = useRoutineScoresStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const routine = useMemo(() => getRoutineById(routineId), [getRoutineById, routineId]);
  const scoringType = (routine?.scoring_type ?? "count") as ScoringType;
  const scoringHelp = getScoringHelpText(scoringType, routine?.max_score);

  const saveResult = async () => {
    if (!routine) {
      dialog.alert({
        title: "Routine not found",
        message: "We could not find this routine. Go back and choose it again from the library.",
        tone: "danger",
        icon: "alert-outline",
      });
      return;
    }

    const built = buildScoreFromInputs({
      scoringType,
      mode: entryMode,
      directValue: score,
      made,
      attempts,
      maxScore: routine.max_score,
    });
    if (!built.value) {
      dialog.alert({
        title: "Check your score",
        message: built.error ?? "Enter a valid score first.",
        icon: "pencil-outline",
      });
      return;
    }

    try {
      setIsSaving(true);
        await addEntry({
          routine_id: routine.id,
          routine_name: routine.name,
          score: built.value,
          notes: notes.trim() || undefined,
        });

      dialog.alert({
        title: "Score saved",
        message: "Your result has been added to this routine's history.",
        tone: "success",
        icon: "check-circle-outline",
        confirmLabel: "Done",
        onConfirm: () => navigation.goBack(),
      });
    } catch (error) {
      dialog.alert({
        title: "Save failed",
        message: "Could not save your score. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={90}
    >
      <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Pressable style={[styles.dismissKeyboard, { backgroundColor: colors.surfaceMuted }]} onPress={() => Keyboard.dismiss()}>
        <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
      </Pressable>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.heading, { color: colors.text }]}>Record Score</Text>
        <Text style={[styles.routineName, { color: colors.text }]}>{routine?.name ?? "Routine"}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Date: {new Date().toLocaleString()}</Text>
        <Text style={[styles.helpText, { color: colors.textMuted }]}>{scoringHelp}</Text>

        {scoringType === "percentage" ? (
          <View style={styles.modeWrap}>
            <View style={styles.modeRow}>
              <Pressable
                onPress={() => setEntryMode("direct")}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: entryMode === "direct" ? colors.primary : colors.surfaceMuted,
                    borderColor: entryMode === "direct" ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: entryMode === "direct" ? colors.onPrimary : colors.text, fontWeight: "700" }}>Percent</Text>
              </Pressable>
              <Pressable
                onPress={() => setEntryMode("fraction")}
                style={[
                  styles.modeChip,
                  {
                    backgroundColor: entryMode === "fraction" ? colors.primary : colors.surfaceMuted,
                    borderColor: entryMode === "fraction" ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={{ color: entryMode === "fraction" ? colors.onPrimary : colors.text, fontWeight: "700" }}>Made/Attempts</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {scoringType === "percentage" && entryMode === "fraction" ? (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Made</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. 18"
              placeholderTextColor={colors.textMuted}
              value={made}
              onChangeText={setMade}
              keyboardType="numeric"
            />
            <Text style={[styles.label, { color: colors.text }]}>Attempts</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              placeholder="e.g. 25"
              placeholderTextColor={colors.textMuted}
              value={attempts}
              onChangeText={setAttempts}
              keyboardType="numeric"
            />
          </>
        ) : (
          <>
            <Text style={[styles.label, { color: colors.text }]}>Log {getScoringUnitLabel(scoringType)}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              placeholder={
                scoringType === "points"
                  ? "e.g. 42"
                  : scoringType === "count"
                    ? "e.g. 8"
                    : scoringType === "time"
                      ? "e.g. 07:35"
                      : "e.g. 72"
              }
              placeholderTextColor={colors.textMuted}
              value={score}
              onChangeText={setScore}
              keyboardType={scoringType === "time" ? "numbers-and-punctuation" : "numeric"}
            />
          </>
        )}

        <Text style={[styles.label, { color: colors.text }]}>Notes (optional)</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          placeholder="What went well? What needs work?"
          placeholderTextColor={colors.textMuted}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
        />

        <Pressable style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={saveResult}>
          <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Save Result</Text>
        </Pressable>
      </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  dismissKeyboard: {
    alignSelf: "flex-end",
    backgroundColor: "#D9E2EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  dismissKeyboardText: { color: "#243B53", fontSize: 12, fontWeight: "700" },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  heading: {
    fontSize: 24,
    fontWeight: "800",
    color: "#102A43",
  },
  routineName: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 6,
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    marginBottom: 16,
  },
  helpText: {
    fontSize: 12,
    marginBottom: 12,
  },
  modeWrap: { marginBottom: 6 },
  modeRow: { flexDirection: "row", gap: 8 },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
  },
  notesInput: {
    height: 110,
    marginBottom: 14,
  },
  primaryButton: {
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
});
