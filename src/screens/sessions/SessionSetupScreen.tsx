import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { Routine, ScoringType, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** Used when a routine does not say how long it takes. */
const FALLBACK_MINUTES = 5;

const minutesFor = (routine?: Routine) => routine?.estimated_duration_minutes ?? FALLBACK_MINUTES;

const scoringLabel = (scoringType: ScoringType, maxScore?: number) => {
  const base =
    scoringType === "points"
      ? "Points"
      : scoringType === "percentage"
        ? "Success rate"
        : scoringType === "count"
          ? "Pots made"
          : "Time";

  return maxScore && maxScore > 0 ? `${base} out of ${maxScore}` : base;
};

export const SessionSetupScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionSetup">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();

  const templateId = route.params?.templateId;

  const { categories, routines } = useRoutinesStore();
  const { createTemplate, updateTemplate, getTemplateById } = useSessionsStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const existing = useMemo(() => (templateId ? getTemplateById(templateId) : undefined), [templateId, getTemplateById]);

  const [selectedRoutines, setSelectedRoutines] = useState<string[]>(existing?.routine_ids ?? []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionName, setSessionName] = useState(existing?.name ?? "");
  const [sessionNotes, setSessionNotes] = useState(existing?.notes ?? "");

  const selectedDetails = useMemo(
    () =>
      selectedRoutines
        .map((id) => routines.find((routine) => routine.id === id))
        .filter((routine): routine is Routine => Boolean(routine)),
    [selectedRoutines, routines]
  );

  // Routines say how long they take, so the estimate is the sum rather than a flat guess.
  const estimatedDuration = useMemo(
    () => selectedDetails.reduce((total, routine) => total + minutesFor(routine), 0),
    [selectedDetails]
  );

  const groupedRoutines = useMemo(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order_index - b.order_index);
    const normalisedQuery = query.trim().toLowerCase();

    return sortedCategories
      .map((category) => ({
        categoryId: category.id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryDescription: category.description,
        routines: routines
          .filter((routine) => routine.category_id === category.id)
          .filter((routine) => routine.content_type !== "guide")
          .filter((routine) => {
            if (!normalisedQuery) return true;
            const haystack = [routine.name, routine.summary, category.name].filter(Boolean).join(" ").toLowerCase();
            return haystack.includes(normalisedQuery);
          })
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.routines.length > 0);
  }, [categories, routines, query]);

  const filteredGroups = useMemo(
    () => (activeCategory ? groupedRoutines.filter((group) => group.categoryId === activeCategory) : groupedRoutines),
    [groupedRoutines, activeCategory]
  );

  const toggleRoutine = useCallback((routineId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedRoutines((prev) =>
      prev.includes(routineId) ? prev.filter((id) => id !== routineId) : [...prev, routineId]
    );
  }, []);

  const removeRoutine = useCallback((routineId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setSelectedRoutines((prev) => prev.filter((id) => id !== routineId));
  }, []);

  const clearSelection = () => {
    dialog.confirm({
      title: "Clear this session?",
      message: "Every routine you have picked comes off the list. The library stays as it is.",
      tone: "danger",
      icon: "playlist-remove",
      confirmLabel: "Clear them",
      cancelLabel: "Keep them",
      onConfirm: () => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSelectedRoutines([]);
      },
    });
  };

  const handleSave = async () => {
    if (!sessionName.trim()) {
      dialog.alert({
        title: "Name your session",
        message: "Give this session a name so you can find it again later.",
        icon: "pencil-outline",
      });
      return;
    }

    try {
      setIsSaving(true);
      if (templateId) {
        await updateTemplate(templateId, { name: sessionName, notes: sessionNotes, routineIds: selectedRoutines });
        setShowSaveModal(false);
        navigation.navigate("SessionTemplateDetail", { templateId });
        return;
      }

      const newTemplateId = await createTemplate({
        name: sessionName,
        notes: sessionNotes,
        routineIds: selectedRoutines,
      });
      setShowSaveModal(false);
      navigation.navigate("SessionTemplateDetail", { templateId: newTemplateId });
    } catch (error) {
      dialog.alert({
        title: "Save failed",
        message: "Could not save your session. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openSaveModal = () => {
    if (!selectedRoutines.length) return;

    Keyboard.dismiss();
    setSessionName(
      existing?.name ??
        `Practice Session ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
    );
    setShowSaveModal(true);
  };

  const hasSelection = selectedRoutines.length > 0;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={90}
    >
      {/* Everything you need while picking stays put; only the library scrolls. */}
      <View style={[styles.stickyTop, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.summaryRow}>
          <Text style={[styles.summaryText, { color: hasSelection ? colors.text : colors.textMuted }]}>
            {hasSelection
              ? `${selectedRoutines.length} ${selectedRoutines.length === 1 ? "routine" : "routines"} · about ${estimatedDuration} min`
              : "Tap routines to build your session"}
          </Text>

          {hasSelection ? (
            <Pressable
              onPress={clearSelection}
              accessibilityRole="button"
              accessibilityLabel="Clear every routine you have picked"
              hitSlop={8}
              style={styles.clearButton}
            >
              <Text style={[styles.clearText, { color: colors.textMuted }]}>Clear</Text>
            </Pressable>
          ) : null}
        </View>

        {hasSelection ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickedRow}
            keyboardShouldPersistTaps="handled"
          >
            {selectedDetails.map((routine, index) => (
              <View
                key={routine.id}
                style={[styles.pickedChip, { backgroundColor: colors.surfaceMuted, borderColor: colors.primary }]}
              >
                <Text style={[styles.pickedIndex, { color: colors.primary }]}>{index + 1}</Text>
                <Text style={[styles.pickedName, { color: colors.text }]} numberOfLines={1}>
                  {routine.name}
                </Text>
                <Pressable
                  onPress={() => removeRoutine(routine.id)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel={`Take ${routine.name} out of this session`}
                >
                  <MaterialCommunityIcons name="close" size={14} color={colors.textMuted} />
                </Pressable>
              </View>
            ))}
          </ScrollView>
        ) : null}

        <View style={[styles.searchWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search routines"
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            accessibilityLabel="Search routines"
            returnKeyType="search"
          />
          {query.length ? (
            <Pressable onPress={() => setQuery("")} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear the search">
              <MaterialCommunityIcons name="close-circle" size={16} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
          keyboardShouldPersistTaps="handled"
        >
          {[{ id: null as string | null, name: "All", icon: undefined as string | undefined }, ...groupedRoutines.map((group) => ({ id: group.categoryId, name: group.categoryName, icon: group.categoryIcon }))].map(
            (category) => {
              const selected = activeCategory === category.id;
              return (
                <Pressable
                  key={category.id ?? "all"}
                  onPress={() => setActiveCategory(category.id)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={category.id ? `Show ${category.name} routines` : "Show every routine"}
                  style={[
                    styles.categoryChip,
                    {
                      backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                      borderColor: selected ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {category.icon ? <Text style={styles.categoryIcon}>{category.icon}</Text> : null}
                  <Text style={[styles.categoryText, { color: selected ? colors.onPrimary : colors.text }]}>
                    {category.name}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {filteredGroups.length === 0 ? (
          <View style={styles.noResults}>
            <MaterialCommunityIcons name="magnify-close" size={28} color={colors.textMuted} />
            <Text style={[styles.noResultsText, { color: colors.textMuted }]}>
              Nothing matches "{query.trim()}". Try a different word, or clear the search.
            </Text>
          </View>
        ) : (
          filteredGroups.map((group) => (
            <View key={group.categoryId} style={styles.categoryBlock}>
              {/* With a category chosen the heading would only repeat the chip above. */}
              {activeCategory ? null : (
                <Text style={[styles.categoryHeading, { color: colors.textMuted }]}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}
                  {group.categoryName.toUpperCase()}
                </Text>
              )}

              {group.routines.map((routine) => {
                const selected = selectedRoutines.includes(routine.id);
                const position = selectedRoutines.indexOf(routine.id) + 1;

                return (
                  <Pressable
                    key={routine.id}
                    onPress={() => toggleRoutine(routine.id)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${routine.name}. ${selected ? "Tap to take out of the session" : "Tap to add to the session"}`}
                    style={({ pressed }) => [
                      styles.routineRow,
                      {
                        backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                        borderColor: selected ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <View style={[styles.routineIconTile, { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={styles.routineIcon}>{routine.icon ?? "🎱"}</Text>
                    </View>

                    <View style={styles.routineTextWrap}>
                      <Text style={[styles.routineName, { color: colors.text }]} numberOfLines={1}>
                        {routine.name}
                      </Text>
                      <Text style={[styles.routineMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {scoringLabel(routine.scoring_type, routine.max_score)} · about {minutesFor(routine)} min
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.addButton,
                        {
                          backgroundColor: selected ? colors.primary : "transparent",
                          borderColor: selected ? colors.primary : colors.border,
                        },
                      ]}
                    >
                      {selected ? (
                        <Text style={[styles.addButtonIndex, { color: colors.onPrimary }]}>{position}</Text>
                      ) : (
                        <MaterialCommunityIcons name="plus" size={18} color={colors.textMuted} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionCount, { color: colors.text }]}>
            {selectedRoutines.length} {selectedRoutines.length === 1 ? "routine" : "routines"}
          </Text>
          <Text style={[styles.actionHint, { color: colors.textMuted }]}>
            {hasSelection ? `About ${estimatedDuration} min` : "Pick at least one"}
          </Text>
        </View>

        <Pressable
          onPress={openSaveModal}
          disabled={!hasSelection}
          accessibilityRole="button"
          accessibilityLabel={templateId ? "Save the changes to this session" : "Name and save this session"}
          accessibilityState={{ disabled: !hasSelection }}
          style={({ pressed }) => [
            styles.saveButton,
            {
              backgroundColor: hasSelection ? colors.primary : colors.surfaceMuted,
              borderColor: hasSelection ? colors.primary : colors.border,
              opacity: pressed && hasSelection ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.saveButtonText, { color: hasSelection ? colors.onPrimary : colors.textMuted }]}>
            {templateId ? "Save changes" : "Name and save"}
          </Text>
        </Pressable>
      </View>

      <Modal visible={showSaveModal} transparent animationType="fade" onRequestClose={() => setShowSaveModal(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setShowSaveModal(false)} accessibilityLabel="Close">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalContainer}>
            <Pressable
              style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
              onPress={() => null}
              accessibilityViewIsModal
            >
              <View style={[styles.modalAccentBar, { backgroundColor: colors.primary }]} />

              <View style={styles.modalBody}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Save this session</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                  {selectedRoutines.length} routine{selectedRoutines.length !== 1 ? "s" : ""} · about {estimatedDuration}{" "}
                  min
                </Text>

                <Text style={[styles.inputLabel, { color: colors.text }]}>Session name</Text>
                <TextInput
                  style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  value={sessionName}
                  onChangeText={setSessionName}
                  placeholder="e.g. Morning Practice"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />

                <Text style={[styles.inputLabel, { color: colors.text }]}>Notes (optional)</Text>
                <TextInput
                  style={[styles.input, styles.notesInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  value={sessionNotes}
                  onChangeText={setSessionNotes}
                  placeholder="Focus areas, goals..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />

                <Pressable
                  onPress={handleSave}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel={templateId ? "Update the session" : "Save the session"}
                  accessibilityState={{ disabled: isSaving, busy: isSaving }}
                  style={({ pressed }) => [
                    styles.modalConfirm,
                    { backgroundColor: colors.primary, opacity: isSaving ? 0.65 : pressed ? 0.85 : 1 },
                  ]}
                >
                  {isSaving ? (
                    <ActivityIndicator size="small" color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.modalConfirmText, { color: colors.onPrimary }]}>
                      {templateId ? "Update session" : "Save session"}
                    </Text>
                  )}
                </Pressable>

                <Pressable
                  onPress={() => setShowSaveModal(false)}
                  disabled={isSaving}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel"
                  style={[styles.modalCancel, { opacity: isSaving ? 0.5 : 1 }]}
                >
                  <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
                </Pressable>
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  stickyTop: {
    borderBottomWidth: 1,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
    minHeight: 28,
  },
  summaryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  clearButton: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: SPACING.xs,
  },
  clearText: {
    fontSize: 13,
    fontWeight: "600",
  },

  pickedRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  pickedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    maxWidth: 200,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingLeft: SPACING.sm,
    paddingRight: SPACING.sm,
    paddingVertical: 6,
  },
  pickedIndex: {
    fontSize: 11,
    fontWeight: "800",
  },
  pickedName: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: "600",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: HIT_TARGET,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 0,
  },

  categoryRow: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  categoryIcon: { fontSize: 13 },
  categoryText: { fontSize: 13, fontWeight: "700" },

  scrollView: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  categoryBlock: { marginBottom: SPACING.lg },
  categoryHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: SPACING.sm,
  },

  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 64,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  routineIconTile: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  routineIcon: { fontSize: 20 },
  routineTextWrap: { flex: 1 },
  routineName: { fontSize: 15, fontWeight: "700" },
  routineMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  addButtonIndex: { fontSize: 13, fontWeight: "800" },

  noResults: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xxl,
  },
  noResultsText: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: SPACING.xl,
  },

  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  actionInfo: { flex: 1 },
  actionCount: { fontSize: 15, fontWeight: "800" },
  actionHint: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  saveButton: {
    minHeight: HIT_TARGET,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  saveButtonText: { fontSize: 15, fontWeight: "800" },

  modalOverlay: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  modalContainer: { width: "100%" },
  modalCard: { borderRadius: RADIUS.xl, borderWidth: 1, overflow: "hidden" },
  modalAccentBar: { height: 4 },
  modalBody: { padding: SPACING.xl },
  modalTitle: { fontSize: 19, fontWeight: "800", textAlign: "center" },
  modalSubtitle: { fontSize: 14, textAlign: "center", marginTop: SPACING.xs, marginBottom: SPACING.lg },
  inputLabel: { fontSize: 13, fontWeight: "700", marginBottom: SPACING.xs },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: 15,
    marginBottom: SPACING.md,
  },
  notesInput: { minHeight: 84 },
  modalConfirm: {
    alignSelf: "stretch",
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.sm,
  },
  modalConfirmText: { fontSize: 15, fontWeight: "800" },
  modalCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  modalCancelText: { fontSize: 14, fontWeight: "600" },
});
