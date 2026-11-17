import React, { useMemo, useState } from "react";
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCustomRoutinesStore, useRoutinesStore } from "../../store";
import { CUSTOM_CATEGORY_ID, toRoutine, type CustomRoutine } from "../../features/customRoutines/customRoutine";
import { RoutineThumb } from "../../components/coach/RoutineThumb";
import type { CoachRoutinesStackParamList, Routine } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Section = { key: string; title: string; data: Routine[]; total: number };

/**
 * A coach's routines tab: their own routines first (the same ones as in player view - it's one
 * account), with a way to build a new one, then the library by category. Open any of them to set it
 * as homework or send it to a client.
 */
export const CoachRoutinesScreen = () => {
  const navigation = useNavigation<NavigationProp<CoachRoutinesStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { library, categories } = useRoutinesStore(useShallow((state) => ({ library: state.routines, categories: state.categories })));
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Set<string>>(new Set());

  const customById = useMemo(() => new Map(customRoutines.map((routine) => [routine.id, routine])), [customRoutines]);
  const searching = query.trim().length > 0;

  const sections = useMemo((): Section[] => {
    const text = query.trim().toLowerCase();
    const matches = (routine: Routine, category: string) =>
      !text || routine.name.toLowerCase().includes(text) || category.toLowerCase().includes(text);
    const mine = customRoutines.map(toRoutine).filter((routine) => matches(routine, "my routines"));
    const out: Section[] = [{ key: CUSTOM_CATEGORY_ID, title: "My routines", data: mine, total: mine.length }];
    for (const category of [...categories].sort((a, b) => a.order_index - b.order_index)) {
      const data = library.filter((routine) => routine.category_id === category.id && matches(routine, category.name));
      if (data.length) out.push({ key: category.id, title: category.name, data, total: data.length });
    }
    return out;
  }, [query, customRoutines, categories, library]);

  // My routines are always open; library categories open on a tap, or all of them while searching.
  const shown = useMemo(
    () =>
      sections.map((section) => ({
        ...section,
        data: section.key === CUSTOM_CATEGORY_ID || searching || open.has(section.key) ? section.data : [],
      })),
    [sections, open, searching]
  );

  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const build = () => (navigation as any).navigate("CustomRoutineBuilder", { returnToCaller: true });

  const header = (
    <View style={styles.header}>
      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search routines"
        placeholderTextColor={colors.textMuted}
        accessibilityLabel="Search routines"
        clearButtonMode="while-editing"
        style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      <Pressable
        onPress={build}
        accessibilityRole="button"
        style={({ pressed }) => [styles.build, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.onPrimary} />
        <Text style={[styles.buildText, { color: colors.onPrimary }]}>Build a routine</Text>
      </Pressable>
    </View>
  );

  return (
    <SectionList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      sections={shown}
      keyExtractor={(item) => item.id}
      keyboardShouldPersistTaps="handled"
      stickySectionHeadersEnabled={false}
      ListHeaderComponent={header}
      renderSectionHeader={({ section }) => {
        const mineSection = section.key === CUSTOM_CATEGORY_ID;
        const isOpen = mineSection || searching || open.has(section.key);
        return (
          <View>
            <Pressable
              onPress={() => toggle(section.key)}
              disabled={mineSection || searching}
              accessibilityRole={mineSection ? "header" : "button"}
              accessibilityState={mineSection ? undefined : { expanded: isOpen }}
              style={[styles.sectionHead, { borderBottomColor: colors.border }]}
            >
              <Text style={[styles.sectionTitle, { color: mineSection ? colors.primary : colors.textMuted }]}>
                {section.title.toUpperCase()} · {section.total}
              </Text>
              {mineSection || searching ? null : (
                <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.textMuted} />
              )}
            </Pressable>
            {mineSection && !section.total && !searching ? (
              <View style={[styles.emptyCard, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                <MaterialCommunityIcons name="table-furniture" size={26} color={colors.primary} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  Routines you build show here. Set one as homework and it goes privately to that client - it isn't posted to the
                  community.
                </Text>
              </View>
            ) : null}
          </View>
        );
      }}
      renderItem={({ item }) => (
        <RoutineRow
          routine={item}
          custom={customById.get(item.id)}
          onPress={() => navigation.navigate("CoachRoutine", { routineId: item.id })}
        />
      )}
      ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No routines match.</Text>}
    />
  );
};

const RoutineRow = ({ routine, custom, onPress }: { routine: Routine; custom?: CustomRoutine; onPress: () => void }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border }]}
    >
      <RoutineThumb routine={routine} custom={custom} style={styles.thumb} landscape />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={[styles.rowSummary, { color: colors.textMuted }]} numberOfLines={2}>
          {custom?.sourceSharedId ? "Saved from the community" : (routine.summary ?? routine.description ?? "Your routine")}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.sm },
  header: { gap: SPACING.sm, marginBottom: SPACING.xs },
  search: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: HIT_TARGET, fontSize: 15 },
  build: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
  },
  buildText: { fontSize: 16, fontWeight: "800" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: HIT_TARGET,
    marginTop: SPACING.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionTitle: { fontSize: 14, fontFamily: FONTS.boardLabel, letterSpacing: 0.8 },
  emptyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.sm,
  },
  emptyText: { flex: 1, fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginTop: SPACING.sm,
  },
  // The table and rail's own shape, so the diagram fills it.
  thumb: { width: 96, aspectRatio: 1.9, height: undefined, borderRadius: RADIUS.sm },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: 15, fontWeight: "800" },
  rowSummary: { fontSize: 13, lineHeight: 18 },
});
