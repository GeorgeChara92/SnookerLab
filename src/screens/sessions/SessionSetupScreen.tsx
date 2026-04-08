import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import {
  Alert,
  Animated,
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
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type RoutineGroup = {
  categoryId: string;
  categoryName: string;
  categoryIcon?: string;
  categoryDescription?: string;
  routines: ReturnType<typeof useRoutinesStore.getState>["routines"];
};

const ESTIMATED_MINUTES_PER_ROUTINE = 5;

export const SessionSetupScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionSetup">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();

  const templateId = route.params?.templateId;

  const { categories, routines } = useRoutinesStore();
  const { createTemplate, updateTemplate, getTemplateById } = useSessionsStore();
  const { colors } = useAppTheme();

  const existing = useMemo(() => (templateId ? getTemplateById(templateId) : undefined), [templateId, getTemplateById]);

  const [selectedRoutines, setSelectedRoutines] = useState<string[]>(existing?.routine_ids ?? []);
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [sessionName, setSessionName] = useState(existing?.name ?? "");
  const [sessionNotes, setSessionNotes] = useState(existing?.notes ?? "");

  const itemAnimations = useRef<Record<string, Animated.Value>>({}).current;
  const prevSelectedRef = useRef<string[]>(selectedRoutines);

  useEffect(() => {
    const prevSelected = prevSelectedRef.current;
    const added = selectedRoutines.filter((id) => !prevSelected.includes(id));

    added.forEach((id) => {
      if (!itemAnimations[id]) {
        itemAnimations[id] = new Animated.Value(0);
        Animated.spring(itemAnimations[id], {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }).start();
      }
    });

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    prevSelectedRef.current = selectedRoutines;
  }, [selectedRoutines]);

  const selectedDetails = useMemo(
    () => selectedRoutines.map((id) => routines.find((routine) => routine.id === id)).filter(Boolean),
    [selectedRoutines, routines]
  );

  const estimatedDuration = selectedRoutines.length * ESTIMATED_MINUTES_PER_ROUTINE;

  const groupedRoutines = useMemo<RoutineGroup[]>(() => {
    const sortedCategories = [...categories].sort((a, b) => a.order_index - b.order_index);
    const normalizedQuery = query.trim().toLowerCase();

    return sortedCategories
      .map((category) => {
        const categoryRoutines = routines
          .filter((routine) => routine.category_id === category.id)
          .filter((routine) => routine.content_type !== "guide")
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

  const filteredGroups = useMemo(() => {
    if (!activeCategory) return groupedRoutines;
    return groupedRoutines.filter((g) => g.categoryId === activeCategory);
  }, [groupedRoutines, activeCategory]);

  const toggleRoutine = useCallback((routineId: string) => {
    setSelectedRoutines((prev) =>prev.includes(routineId) ? prev.filter((id) => id !== routineId) : [...prev, routineId]
    );
  }, []);

  const removeRoutine = useCallback((routineId: string) => {
    setSelectedRoutines((prev) => prev.filter((id) => id !== routineId));
  }, []);

  const handleSave = async () => {
    if (!sessionName.trim()) {
      Alert.alert("Name required", "Please enter a name for your session.");
      return;
    }
    if (!selectedRoutines.length) {
      Alert.alert("No routines", "Please select at least one routine.");
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

      const newTemplateId = await createTemplate({ name: sessionName, notes: sessionNotes, routineIds: selectedRoutines });
      setShowSaveModal(false);
      navigation.navigate("SessionTemplateDetail", { templateId: newTemplateId });
    } catch (error) {
      Alert.alert("Save failed", "Could not save this session right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const openSaveModal = () => {
    if (!selectedRoutines.length) {
      Alert.alert("No routines", "Please select at least one routine.");
      return;
    }
    Keyboard.dismiss();
    setSessionName(existing?.name ?? `Practice Session ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`);
    setShowSaveModal(true);
  };

  const getItemAnimatedStyle = (routineId: string) => {
    const animation = itemAnimations[routineId];
    if (!animation) return {};
    return {
      transform: [
        { translateX: animation.interpolate({ inputRange: [0, 1], outputRange: [-50, 0] }) },
        { scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) },
      ],
      opacity: animation,
    };
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.container, { backgroundColor: colors.background }]}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.progressHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Building Session</Text>
          <Text style={[styles.progressValue, { color: colors.text }]}>
            {selectedRoutines.length} routine{selectedRoutines.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {selectedRoutines.length > 0 && (
          <View style={[styles.durationBadge, { backgroundColor: colors.primary + "20" }]}>
            <Text style={[styles.durationText, { color: colors.primary }]}>~{estimatedDuration} min</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.selectedSection,
            {
              backgroundColor: colors.surface,
              borderColor: selectedRoutines.length > 0 ? colors.primary : colors.border,
            },
          ]}
        >
          <View style={styles.selectedHeader}>
            <Text style={[styles.selectedTitle, { color: colors.text }]}>Your Session</Text>
            {selectedRoutines.length > 0 && (
              <Text style={[styles.selectedCount, { color: colors.primary }]}>
                {selectedRoutines.length} selected
              </Text>
            )}
          </View>

          {selectedRoutines.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={[styles.emptyIconWrap, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={styles.emptyIcon}>📋</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>Start building your session</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Tap routines below to add them to your practice plan.
              </Text>
            </View>
          ) : (
            <View style={styles.selectedList}>
              {selectedDetails.map((routine, index) => {
                const routineData = routine as NonNullable<typeof routine>;
                return (
                  <Animated.View
                    key={routineData.id}
                    style={[
                      styles.selectedItem,
                      { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
                      getItemAnimatedStyle(routineData.id),
                    ]}
                  >
                    <View style={styles.selectedMain}>
                      <View style={[styles.selectedNumber, { backgroundColor: colors.primary }]}>
                        <Text style={styles.selectedNumberText}>{index + 1}</Text>
                      </View>
                      <View style={styles.selectedInfo}>
                        <Text style={[styles.selectedName, { color: colors.text }]}>{routineData.name}</Text>
                        <Text style={[styles.selectedCategory, { color: colors.textMuted }]} numberOfLines={1}>
                          {categories.find((c) => c.id === routineData.category_id)?.name ?? ""}
                        </Text>
                      </View>
 </View>
                    <Pressable style={styles.removeBtn} onPress={() => removeRoutine(routineData.id)} hitSlop={8}>
                      <Text style={[styles.removeBtnIcon, { color: colors.textMuted }]}>×</Text>
                    </Pressable>
                  </Animated.View>
                );
              })}
            </View>
          )}
        </View>

        <View style={styles.librarySection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Routine Library</Text>

          <TextInput
            style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
            placeholder="Search routines..."
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.categoryFilters}
            contentContainerStyle={styles.categoryFiltersContent}
          >
            <Pressable
              style={[
                styles.categoryChip,
                {
                  backgroundColor: !activeCategory ? colors.primary : colors.surfaceMuted,
                  borderColor: !activeCategory ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setActiveCategory(null)}
            >
              <Text style={[styles.categoryChipText, { color: !activeCategory ? colors.onPrimary : colors.text }]}>
                All
              </Text>
            </Pressable>
            {groupedRoutines.map((group) => (
              <Pressable
                key={group.categoryId}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: activeCategory === group.categoryId ? colors.primary : colors.surfaceMuted,
                    borderColor: activeCategory === group.categoryId ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setActiveCategory(group.categoryId)}
              >
                {group.categoryIcon && <Text style={styles.categoryChipIcon}>{group.categoryIcon}</Text>}
                <Text style={[styles.categoryChipText, { color: activeCategory === group.categoryId ? colors.onPrimary : colors.text }]}>
                  {group.categoryName}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          {filteredGroups.length === 0 ? (
            <View style={styles.noResultsWrap}>
              <Text style={[styles.noResults, { color: colors.textMuted }]}>No routines match your search.</Text>
            </View>
          ) : (
            filteredGroups.map((group) => (
              <View key={group.categoryId} style={styles.categoryBlock}>
                <Text style={[styles.categoryTitle, { color: colors.text }]}>
                  {group.categoryIcon ? `${group.categoryIcon} ` : ""}
                  {group.categoryName}
                </Text>
                {group.categoryDescription && (
                  <Text style={[styles.categoryDesc, { color: colors.textMuted }]}>{group.categoryDescription}</Text>
                )}

                {group.routines.map((routine) => {
                  const selected = selectedRoutines.includes(routine.id);

                  return (
                    <Pressable
                      key={routine.id}
                      style={[
                        styles.routineCard,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + "12" : colors.surface,
                        },
                      ]}
                      onPress={() => toggleRoutine(routine.id)}
                    >
                      <View style={styles.routineContent}>
                        <Text style={styles.routineIcon}>{routine.icon ?? "🎱"}</Text>
                        <View style={styles.routineTextWrap}>
                          <Text style={[styles.routineName, { color: colors.text }]}>{routine.name}</Text>
                          <Text style={[styles.routineSummary, { color: colors.textMuted }]} numberOfLines={1}>
                            {routine.summary ?? "Structured routine"}
                          </Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.checkCircle,
                          {
                            borderColor: selected ? colors.primary : colors.border,
                            backgroundColor: selected ? colors.primary : "transparent",
                          },
                        ]}
                      >
                        {selected && <Text style={styles.checkMark}>✓</Text>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionCount, { color: colors.text }]}>
            {selectedRoutines.length} routine{selectedRoutines.length !== 1 ? "s" : ""}
          </Text>
          {selectedRoutines.length > 0 && (
            <Text style={[styles.actionDuration, { color: colors.primary }]}>~{estimatedDuration} min</Text>
          )}
        </View>
        <Pressable
          style={[styles.saveButton, { backgroundColor: selectedRoutines.length > 0 ? colors.primary : colors.border }]}
          onPress={openSaveModal}
          disabled={selectedRoutines.length === 0}
        >
          <Text style={[styles.saveButtonText, { color: selectedRoutines.length > 0 ? colors.onPrimary : colors.textMuted }]}>
            {templateId ? "Update" : "Save Session"}
          </Text>
        </Pressable>
      </View>

      <Modal visible={showSaveModal} transparent animationType="fade" onRequestClose={() => setShowSaveModal(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.modalContainer}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Save Session</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                {selectedRoutines.length} routine{selectedRoutines.length !== 1 ? "s" : ""} · ~{estimatedDuration} min
              </Text>

              <Text style={[styles.inputLabel, { color: colors.text }]}>Session Name</Text>
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

              <View style={styles.modalActions}>
                <Pressable style={[styles.modalBtn, { backgroundColor: colors.surfaceMuted }]} onPress={() => setShowSaveModal(false)}>
                  <Text style={[styles.modalBtnText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                  onPress={handleSave}
                  disabled={isSaving}
                >
                  <Text style={[styles.modalBtnText, { color: colors.onPrimary }]}>
                    {isSaving ? "Saving..." : "Save"}
                  </Text>
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressHeader: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressInfo: { flex: 1 },
  progressLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
  progressValue: { fontSize: 20, fontWeight: "800", marginTop: 2 },
  durationBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  durationText: { fontSize: 14, fontWeight: "700" },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  selectedSection: {
    borderRadius: 16,
    borderWidth: 2,
    padding: 16,
    marginBottom: 20,
  },
  selectedHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  selectedTitle: { fontSize: 17, fontWeight: "800" },
  selectedCount: { fontSize: 12, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: 24 },
  emptyIconWrap: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  emptyIcon: { fontSize: 28 },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, paddingHorizontal: 16 },
  selectedList: { gap: 8 },
  selectedItem: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedMain: { flexDirection: "row", alignItems: "center", flex: 1 },
  selectedNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  selectedNumberText: { color: "#FFF", fontSize: 13, fontWeight: "700" },
  selectedInfo: { flex: 1 },
  selectedName: { fontSize: 14, fontWeight: "600" },
  selectedCategory: { fontSize: 11, marginTop: 2 },
  removeBtn: { paddingHorizontal: 8, paddingVertical: 4 },
  removeBtnIcon: { fontSize: 22, fontWeight: "400" },
  librarySection: {},
  sectionTitle: { fontSize: 17, fontWeight: "800", marginBottom: 12 },
  searchInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 12,
  },
  categoryFilters: { marginBottom: 12 },
  categoryFiltersContent: { paddingRight: 16 },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    marginRight: 8,
  },
  categoryChipIcon: { fontSize: 14, marginRight: 4 },
  categoryChipText: { fontSize: 13, fontWeight: "600" },
  noResultsWrap: { paddingVertical: 32, alignItems: "center" },
  noResults: { fontSize: 14, textAlign: "center" },
  categoryBlock: { marginTop: 8, marginBottom: 8 },
  categoryTitle: { fontSize: 15, fontWeight: "800", marginBottom: 8 },
  categoryDesc: { fontSize: 12, marginBottom: 10, lineHeight: 17 },
  routineCard: {
    borderWidth: 2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  routineContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  routineIcon: { fontSize: 22, marginRight: 12 },
  routineTextWrap: { flex: 1 },
  routineName: { fontSize: 15, fontWeight: "600" },
  routineSummary: { fontSize: 12, marginTop: 2 },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: { color: "#FFF", fontSize: 14, fontWeight: "700" },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
  },
  actionInfo: { flex: 1 },
  actionCount: { fontSize: 16, fontWeight: "700" },
  actionDuration: { fontSize: 13, marginTop: 2, fontWeight: "600" },
  saveButton: { borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 },
  saveButtonText: { fontSize: 16, fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContainer: { width: "100%", maxWidth: 360 },
  modalCard: { borderRadius: 18, padding: 22 },
  modalTitle: { fontSize: 22, fontWeight: "800", marginBottom: 4 },
  modalSubtitle: { fontSize: 13, marginBottom: 18 },
  inputLabel: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 14,
  },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  modalBtn: { flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  modalBtnText: { fontSize: 15, fontWeight: "600" },
});