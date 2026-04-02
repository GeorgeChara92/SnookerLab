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
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";

type RoutineGroup = {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryDescription?: string;
  routines: ReturnType<typeof useRoutinesStore.getState>["routines"];
};

export const SessionSetupScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionSetup">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();

  const templateId = route.params?.templateId;

  const { categories, routines } = useRoutinesStore();
  const { createTemplate, updateTemplate, getTemplateById } = useSessionsStore();
  const { colors } = useAppTheme();

  const existing = useMemo(() => (templateId ? getTemplateById(templateId) : undefined), [templateId, getTemplateById]);

  const [name, setName] = useState(existing?.name ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [query, setQuery] = useState("");
  const [selectedRoutines, setSelectedRoutines] = useState<string[]>(existing?.routine_ids ?? []);
  const [isSaving, setIsSaving] = useState(false);

  const selectedDetails = useMemo(
    () => selectedRoutines.map((id) => routines.find((routine) => routine.id === id)).filter(Boolean),
    [selectedRoutines, routines]
  );

  const groupedRoutines = useMemo<RoutineGroup[]>(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order_index - b.order_index);
    const normalizedQuery = query.trim().toLowerCase();

    return sortedCategories
      .map((category) => {
        const categoryRoutines = routines
          .filter((routine) => routine.category_id === category.id)
          .filter((routine) => {
            if (!normalizedQuery) return true;

            const haystack = [routine.name, routine.summary, category.name]
              .filter(Boolean)
              .join(" ")
              .toLowerCase();

            return haystack.includes(normalizedQuery);
          })
          .sort((a, b) => a.name.localeCompare(b.name));

        return {
          categoryId: category.id,
          categoryName: category.name,
          categoryIcon: category.icon,
          categoryDescription: category.description,
          routines: categoryRoutines,
        };
      })
      .filter((group) => group.routines.length > 0);
  }, [categories, routines, query]);

  const toggleRoutine = (routineId: string) => {
    setSelectedRoutines((prev) =>
      prev.includes(routineId) ? prev.filter((id) => id !== routineId) : [...prev, routineId]
    );
  };

  const onSavePreset = async () => {
    if (!name.trim()) {
      Alert.alert("Missing name", "Add a name for your session preset.");
      return;
    }
    if (!selectedRoutines.length) {
      Alert.alert("No routines selected", "Select at least one routine for this preset.");
      return;
    }

    try {
      setIsSaving(true);
      if (templateId) {
        await updateTemplate(templateId, { name, notes, routineIds: selectedRoutines });
        navigation.navigate("SessionTemplateDetail", { templateId });
        return;
      }

      const newTemplateId = await createTemplate({ name, notes, routineIds: selectedRoutines });
      navigation.navigate("SessionTemplateDetail", { templateId: newTemplateId });
    } catch (error) {
      Alert.alert("Save failed", "Could not save this session preset right now.");
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
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
      >
        <Pressable
          style={[styles.dismissKeyboard, { backgroundColor: colors.surfaceMuted }]}
          onPress={() => Keyboard.dismiss()}
        >
          <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
        </Pressable>

        <AppCard>
          <Text style={[styles.heading, { color: colors.text }]}>{templateId ? "Edit Session Preset" : "Create Session Preset"}</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>Build your practice block by selecting routines from each category.</Text>

          <Text style={[styles.label, { color: colors.text }]}>Preset Name</Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text },
            ]}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Tuesday Break Building"
            placeholderTextColor={colors.textMuted}
          />

          <Text style={[styles.label, { color: colors.text }]}>Notes (optional)</Text>
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Focus areas, match prep or goals"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
          />

          <View style={[styles.selectionSummary, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.selectionTitle, { color: colors.text }]}>Selected Routines: {selectedRoutines.length}</Text>
            {selectedDetails.length === 0 ? (
              <Text style={[styles.selectionEmpty, { color: colors.textMuted }]}>No routines selected yet.</Text>
            ) : (
              <Text style={[styles.selectionPreview, { color: colors.textMuted }]} numberOfLines={2}>
                {selectedDetails.map((routine) => routine?.name).join(" • ")}
              </Text>
            )}
          </View>
        </AppCard>

        <AppCard style={styles.routinesCard}>
          <Text style={[styles.routinesTitle, { color: colors.text }]}>Routine Library</Text>
          <TextInput
            style={[
              styles.input,
              styles.searchInput,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder="Search routines or categories"
            placeholderTextColor={colors.textMuted}
          />

          {groupedRoutines.length === 0 ? (
            <Text style={[styles.noResults, { color: colors.textMuted }]}>No routines match your search.</Text>
          ) : (
            groupedRoutines.map((group) => (
              <View key={group.categoryId} style={styles.categoryBlock}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}
                  {group.categoryName}
                </Text>
                {group.categoryDescription ? (
                  <Text style={[styles.categoryDescription, { color: colors.textMuted }]}>
                    {group.categoryDescription}
                  </Text>
                ) : null}

                {group.routines.map((routine) => {
                  const selected = selectedRoutines.includes(routine.id);

                  return (
                    <Pressable
                      key={routine.id}
                      style={[
                        styles.routineRow,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                        },
                      ]}
                      onPress={() => toggleRoutine(routine.id)}
                    >
                      <View style={styles.routineMeta}>
                        <Text style={styles.routineIcon}>{routine.icon ?? "🎱"}</Text>
                        <View style={styles.routineTextWrap}>
                          <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
                          <Text style={[styles.routineSummary, { color: colors.textMuted }]} numberOfLines={2}>
                            {routine.summary ?? "Structured snooker routine"}
                          </Text>
                        </View>
                      </View>

                      <View
                        style={[
                          styles.check,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : "transparent",
                          },
                        ]}
                      >
                        {selected ? <Text style={[styles.checkMark, { color: colors.onPrimary }]}>✓</Text> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </AppCard>
      </ScrollView>

      <View style={[styles.actionBar, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <AppButton label={templateId ? "Update Preset" : "Save Preset"} onPress={onSavePreset} loading={isSaving} disabled={isSaving} />
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 96 },
  dismissKeyboard: {
    alignSelf: "flex-end",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  dismissKeyboardText: { fontSize: 12, fontWeight: "700" },
  heading: {
    fontSize: 23,
    fontWeight: "800",
  },
  subheading: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13,
    lineHeight: 19,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    fontSize: 15,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  textArea: { minHeight: 84 },
  selectionSummary: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  selectionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  selectionEmpty: {
    fontSize: 12,
    marginTop: 2,
  },
  selectionPreview: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 17,
  },
  routinesCard: {
    marginTop: 12,
    paddingTop: 12,
  },
  routinesTitle: {
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 8,
  },
  searchInput: {
    marginBottom: 10,
  },
  noResults: {
    fontSize: 13,
    textAlign: "center",
    marginVertical: 8,
  },
  categoryBlock: {
    marginTop: 8,
    marginBottom: 4,
  },
  categoryTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  categoryDescription: {
    marginTop: 2,
    marginBottom: 8,
    fontSize: 12,
    lineHeight: 17,
  },
  routineRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  routineMeta: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  routineIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  routineTextWrap: {
    flex: 1,
  },
  routineName: {
    fontSize: 14,
    fontWeight: "700",
  },
  routineSummary: {
    marginTop: 2,
    fontSize: 12,
    lineHeight: 16,
  },
  check: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
});
