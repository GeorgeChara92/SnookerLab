import React, { useEffect, useMemo, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { SessionsHomeScreen } from "../sessions/SessionsHomeScreen";
import { useCustomRoutinesStore, useRoutinesStore } from "../../store";
import { TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { summarise } from "../../features/scanSnooker/position";
import type { CustomRoutine } from "../../features/customRoutines/customRoutine";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";
import type { PracticeStackParamList, RoutineCategory } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getRoutineCategoryIconName } from "../../constants/routineCategoryIcons";

export const RoutineCategoriesScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { categories, routines, getRoutinesByCategory, loadRoutines } = useRoutinesStore();
  const { colors } = useAppTheme();
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  // The built-in library, or the routines the player has built.
  const route = useRoute<RouteProp<PracticeStackParamList, "RoutineCategories">>();
  const [tab, setTab] = useState<"library" | "mine" | "sessions">(route.params?.tab ?? "library");

  // Arriving from elsewhere (the dashboard's "start a session") opens the tab asked for.
  useEffect(() => {
    if (route.params?.tab) setTab(route.params.tab);
  }, [route.params?.tab]);

  const orderedCategories = useMemo(() => [...categories].sort((a, b) => a.order_index - b.order_index), [categories]);

  const entranceAnimations = useMemo(
    () => orderedCategories.map(() => new Animated.Value(0)),
    [orderedCategories.length]
  );

  useEffect(() => {
    loadRoutines();
  }, []);

  useEffect(() => {
    if (!categories.length || !routines.length) {
      loadRoutines();
    }
  }, [categories.length, routines.length]);

  useEffect(() => {
    if (!entranceAnimations.length) return;

    entranceAnimations.forEach((value) => value.setValue(0));
    Animated.stagger(
      70,
      entranceAnimations.map((value) =>
        Animated.timing(value, {
          toValue: 1,
          duration: 260,
          useNativeDriver: true,
        })
      )
    ).start();
  }, [entranceAnimations]);

  const renderCategory = ({ item, index }: { item: RoutineCategory; index: number }) => {
    const iconName = getRoutineCategoryIconName(item.id);
    const categoryItems = getRoutinesByCategory(item.id);
    const routinesCount = categoryItems.length;
    const categoryContainsOnlyGuides =
      categoryItems.length > 0 && categoryItems.every((entry) => entry.content_type === "guide");
    const itemLabel = categoryContainsOnlyGuides ? "guide" : "routine";
    const animation = entranceAnimations[index] ?? new Animated.Value(1);

    return (
      <Animated.View
        style={[
          styles.cardWrap,
          {
            opacity: animation,
            transform: [
              {
                translateY: animation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [14, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: pressed ? item.color : colors.border,
              transform: [{ scale: pressed ? 0.985 : 1 }],
              opacity: pressed ? 0.95 : 1,
            },
          ]}
          onPress={() => navigation.navigate("RoutinesList", { categoryId: item.id })}
        >
          <View style={styles.cardTopRow}>
            <View style={[styles.iconWrap, { backgroundColor: `${item.color}22` }]}>
              <MaterialCommunityIcons name={iconName as any} size={24} color={item.color} />
            </View>
          </View>
          <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={2}>
            {item.name}
          </Text>
          <Text style={[styles.count, { color: colors.textMuted }]}>
            {routinesCount} {routinesCount === 1 ? itemLabel : `${itemLabel}s`}
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              {categoryContainsOnlyGuides ? "Browse guides" : "Browse drills"}
            </Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textMuted} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const tabs = (
    <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]}>
      {(["library", "mine", "sessions"] as const).map((item) => {
        const active = tab === item;
        return (
          <Pressable
            key={item}
            onPress={() => setTab(item)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.tab, active && { backgroundColor: colors.surface }]}
          >
            <Text style={[styles.tabText, { color: active ? colors.text : colors.textMuted }]}>
              {item === "library"
                ? "Library"
                : item === "sessions"
                  ? "Sessions"
                  : `Mine${customRoutines.length ? ` · ${customRoutines.length}` : ""}`}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const newRoutine = (
    <Pressable
      onPress={() => navigation.navigate("CustomRoutineBuilder")}
      accessibilityRole="button"
      style={({ pressed }) => [styles.newButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
    >
      <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
      <Text style={[styles.newButtonText, { color: colors.onPrimary }]}>New routine</Text>
    </Pressable>
  );

  const renderCustom = ({ item }: { item: CustomRoutine }) => (
    <Pressable
      onPress={() => navigation.navigate("CustomRoutine", { routineId: item.id })}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}. ${summarise(item.balls)}`}
      style={({ pressed }) => [
        styles.customCard,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.customThumb}>
        <TableDiagram balls={item.balls} readOnly />
      </View>
      <View style={styles.customBody}>
        <Text style={[styles.customName, { color: colors.text }]} numberOfLines={1}>
          {item.name}
        </Text>
        {item.description ? (
          <Text style={[styles.customDescription, { color: colors.textMuted }]} numberOfLines={2}>
            {item.description}
          </Text>
        ) : null}
        <Text style={[styles.customMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {summarise(item.balls)} · {item.maxScore ? `max ${item.maxScore}` : "counts attempts"}
        </Text>
      </View>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );

  if (tab === "sessions") {
    return (
      <View style={[styles.sessions, { backgroundColor: colors.background }]}>
        <View style={styles.sessionsTabs}>{tabs}</View>
        <SessionsHomeScreen />
      </View>
    );
  }

  if (tab === "mine") {
    return (
      // Its own key: the library is a two-column list, and a FlatList cannot change its column
      // count in place, so switching tabs must build a fresh list rather than reuse this one.
      <FlatList
        key="my-routines"
        data={customRoutines}
        keyExtractor={(item) => item.id}
        renderItem={renderCustom}
        contentContainerStyle={[styles.container, { backgroundColor: colors.background, flexGrow: 1 }]}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
        ListHeaderComponent={
          <View style={styles.header}>
            {tabs}
            {customRoutines.length ? <View style={{ marginTop: SPACING.md }}>{newRoutine}</View> : null}
          </View>
        }
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
              <MaterialCommunityIcons name="table-furniture" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Build your own routines</Text>
            <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
              Place the balls on the table the way you practise, give it a name and a target score, and it is saved to
              your account for every device.
            </Text>
            {newRoutine}
          </View>
        }
      />
    );
  }

  return (
    <FlatList
      key="library"
      data={orderedCategories}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={renderCategory}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      ListHeaderComponent={
        <View style={styles.header}>
          {tabs}
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Pick a category to browse routines and guides.
          </Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  sessions: { flex: 1 },
  sessionsTabs: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md },
  tabs: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  tab: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, fontWeight: "700" },
  newButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
    alignSelf: "stretch",
  },
  newButtonText: { fontSize: 16, fontWeight: "800" },
  customCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
    paddingRight: SPACING.md,
  },
  customThumb: { width: 50, height: 96, borderRadius: RADIUS.sm, overflow: "hidden" },
  customBody: { flex: 1, gap: 3 },
  customName: { fontSize: 16, fontWeight: "800" },
  customDescription: { fontSize: 13, lineHeight: 18 },
  customMeta: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.xl },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 18, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: SPACING.sm },
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 26,
  },
  header: {
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    gap: 10,
    marginBottom: 10,
  },
  cardWrap: {
    flex: 1,
  },
  card: {
    height: 170,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  iconWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  categoryName: {
    fontSize: 15,
    fontWeight: "800",
    marginTop: 12,
    minHeight: 40,
  },
  count: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 2,
    minHeight: 16,
  },
  cardFooter: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerText: {
    fontSize: 12,
    fontWeight: "600",
  },
});
