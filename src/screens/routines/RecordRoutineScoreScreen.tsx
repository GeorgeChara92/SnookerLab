import React, { useMemo, useState } from "react";
import {
  Alert,
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

export const RecordRoutineScoreScreen = () => {
  const route = useRoute<RouteProp<PracticeStackParamList, "RecordRoutineScore">>();
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { routineId } = route.params;

  const [score, setScore] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const { getRoutineById } = useRoutinesStore();
  const { addEntry } = useRoutineScoresStore();
  const { colors } = useAppTheme();

  const routine = useMemo(() => getRoutineById(routineId), [getRoutineById, routineId]);

  const saveResult = async () => {
    if (!routine) {
      Alert.alert("Error", "Routine not found.");
      return;
    }

    if (!score.trim()) {
      Alert.alert("Missing score", "Enter a score or result first.");
      return;
    }

    try {
      setIsSaving(true);
      await addEntry({
        routine_id: routine.id,
        routine_name: routine.name,
        score: score.trim(),
        notes: notes.trim() || undefined,
      });

      Alert.alert("Saved", "Your result has been recorded.", [
        {
          text: "OK",
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert("Save failed", "Could not save this routine score right now.");
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
        <Text style={[styles.heading, { color: colors.text }]}>📝 Record Score</Text>
        <Text style={[styles.routineName, { color: colors.text }]}>{routine?.name ?? "Routine"}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Date: {new Date().toLocaleString()}</Text>

        <Text style={[styles.label, { color: colors.text }]}>Score / Result</Text>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
          placeholder="e.g. 42, 8/10, 65%"
          placeholderTextColor={colors.textMuted}
          value={score}
          onChangeText={setScore}
        />

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
