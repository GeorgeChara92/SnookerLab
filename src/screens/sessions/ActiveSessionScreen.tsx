import React, { useEffect, useState } from "react";
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
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

export const ActiveSessionScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "ActiveSession">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templateId } = route.params;

  const {
    getTemplateById,
    startSession,
    activeTemplateId,
    activeDate,
    activeResults,
    updateActiveResult,
    saveActiveSession,
  } = useSessionsStore();
  const { getRoutineById } = useRoutinesStore();
  const { colors } = useAppTheme();
  const [isSaving, setIsSaving] = useState(false);

  const template = getTemplateById(templateId);

  useEffect(() => {
    if (activeTemplateId !== templateId || !activeResults.length) {
      startSession(templateId, route.params.date);
    }
  }, [templateId]);

  if (!template) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>Session preset not found.</Text>
      </View>
    );
  }

  const handleComplete = async () => {
    try {
      setIsSaving(true);
      await saveActiveSession();
      Alert.alert("Saved", "Session results logged for this date.", [
        {
          text: "OK",
          onPress: () => navigation.navigate("SessionTemplateDetail", { templateId }),
        },
      ]);
    } catch (error) {
      Alert.alert("Save failed", "Could not save session results right now.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable style={styles.dismissKeyboard} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>🎯 {template.name}</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Practice Date: {new Date(activeDate).toLocaleDateString()}</Text>

        {activeResults.map((result) => {
          const routine = getRoutineById(result.routine_id);
          return (
            <View key={result.routine_id} style={[styles.resultCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.routineName, { color: colors.text }]}>{routine?.name ?? "Routine"}</Text>
              <Text style={[styles.routineHint, { color: colors.textMuted }]}>Enter your score/result for today</Text>
              <TextInput
                style={[styles.scoreInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                placeholder="e.g. 42, 8/10, 70%"
                placeholderTextColor={colors.textMuted}
                value={result.score}
                onChangeText={(text) => updateActiveResult(result.routine_id, { score: text })}
              />
              <TextInput
                style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                placeholder="Optional notes"
                placeholderTextColor={colors.textMuted}
                value={result.notes ?? ""}
                onChangeText={(text) => updateActiveResult(result.routine_id, { notes: text })}
                multiline
                textAlignVertical="top"
              />
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.actionBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}> 
        <Pressable style={[styles.completeButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={handleComplete}>
          <Text style={[styles.completeButtonText, { color: colors.onPrimary }]}>Save Session Results</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 90 },
  dismissKeyboard: {
    alignSelf: "flex-end",
    backgroundColor: "#D9E2EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  dismissKeyboardText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 24, fontWeight: "800" },
  meta: { marginTop: 6, marginBottom: 12 },
  resultCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  routineName: { fontSize: 15, fontWeight: "700" },
  routineHint: { marginTop: 2, fontSize: 12 },
  scoreInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  notesInput: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 76,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  completeButton: {
    borderRadius: 12,
    alignItems: "center",
    paddingVertical: 13,
  },
  completeButtonText: { fontSize: 15, fontWeight: "700" },
  empty: { fontSize: 16, padding: 16 },
});
