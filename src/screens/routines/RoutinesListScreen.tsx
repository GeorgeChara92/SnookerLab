import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  StyleSheet,
  FlatList,
  Text,
  Pressable,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useRoutinesStore } from "../../store";
import { Routine, RoutineCategory } from "../../types";
import { RoutineCard } from "../../components/routines/RoutineCard";
import type { PracticeStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

export const RoutinesListScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { categories, routines, getRoutinesByCategory, loadRoutines } = useRoutinesStore();
  const { colors } = useAppTheme();
  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order_index - b.order_index),
    [categories]
  );

  useEffect(() => {
    if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    loadRoutines();
  }, []);

  useEffect(() => {
    if (!categories.length || !routines.length) {
      loadRoutines();
    }
  }, [categories.length, routines.length]);

  useEffect(() => {
    if (!orderedCategories.length) return;

    setExpandedCategoryIds((prev) => {
      if (prev.length) {
        const valid = prev.filter((id) => orderedCategories.some((category) => category.id === id));
        if (valid.length) return valid;
      }

      return [orderedCategories[0].id];
    });
  }, [orderedCategories]);

  const toggleCategory = (categoryId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryIds((prev) =>
      prev.includes(categoryId) ? prev.filter((id) => id !== categoryId) : [...prev, categoryId]
    );
  };

  const expandAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryIds(orderedCategories.map((category) => category.id));
  };

  const collapseAll = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedCategoryIds([]);
  };

  const renderRoutine = (routine: Routine, category: RoutineCategory) => (
    <RoutineCard
      key={routine.id}
      routine={routine}
      categoryName={category.name}
      categoryColor={category.color}
      onPress={() => navigation.navigate("RoutineDetail", { routineId: routine.id })}
    />
  );

  const renderCategory = (category: RoutineCategory) => {
    const routines = getRoutinesByCategory(category.id);
    const isExpanded = expandedCategoryIds.includes(category.id);
    const countLabel = `${routines.length} ${routines.length === 1 ? "routine" : "routines"}`;

    return (
      <View key={category.id} style={styles.categorySection}>
        <Pressable
          style={[styles.categoryHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => toggleCategory(category.id)}
        >
          <View style={styles.categoryHeadingLeft}>
            <Text style={[styles.categoryTitle, { color: category.color }]}>
              {category.icon} {category.name}
            </Text>
            <Text style={[styles.categoryMeta, { color: colors.textMuted }]}>{countLabel}</Text>
          </View>

          <Text style={[styles.chevron, { color: colors.textMuted }]}>{isExpanded ? "▾" : "▸"}</Text>
        </Pressable>

        {isExpanded ? (
          <View style={styles.categoryBody}>
            <Text style={[styles.categoryDescription, { color: colors.textMuted }]}>{category.description}</Text>
            {routines.map((routine) => renderRoutine(routine, category))}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <FlatList
      data={orderedCategories}
      renderItem={({ item }) => renderCategory(item)}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      ListHeaderComponent={
        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={expandAll}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Expand all</Text>
          </Pressable>

          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={collapseAll}
          >
            <Text style={[styles.actionButtonText, { color: colors.text }]}>Collapse all</Text>
          </Pressable>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 28,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "700",
  },
  categorySection: {
    marginBottom: 14,
  },
  categoryHeader: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  categoryHeadingLeft: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  categoryMeta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  chevron: {
    fontSize: 20,
    marginLeft: 10,
  },
  categoryBody: {
    marginTop: 10,
  },
  categoryDescription: {
    fontSize: 13,
    marginBottom: 12,
    lineHeight: 18,
  },
});
