import React, { useEffect, useMemo } from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useRoutinesStore } from "../../store";
import type { PracticeStackParamList } from "../../types";
import { RoutineCard } from "../../components/routines/RoutineCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getRoutineCategoryIconName } from "../../constants/routineCategoryIcons";

type ScreenRoute = RouteProp<PracticeStackParamList, "RoutinesList">;

export const RoutinesListScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const route = useRoute<ScreenRoute>();
  const { categories, routines, getRoutinesByCategory, loadRoutines } = useRoutinesStore();
  const { colors } = useAppTheme();

  const categoryId = route.params.categoryId;

  useEffect(() => {
    loadRoutines();
  }, []);

  useEffect(() => {
    if (!categories.length || !routines.length) {
      loadRoutines();
    }
  }, [categories.length, routines.length]);

  const category = useMemo(() => categories.find((item) => item.id === categoryId), [categories, categoryId]);
  const categoryRoutines = getRoutinesByCategory(categoryId);
  const categoryContainsOnlyGuides = categoryRoutines.length > 0 && categoryRoutines.every((item) => item.content_type === "guide");
  const itemLabel = categoryContainsOnlyGuides ? "guide" : "routine";
  const iconName = getRoutineCategoryIconName(categoryId);

  if (!category) {
    return (
      <View style={[styles.emptyState, { backgroundColor: colors.background }]}> 
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Category not found</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>This category is unavailable. Go back and choose another one.</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={categoryRoutines}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      renderItem={({ item }) => (
        <RoutineCard
          routine={item}
          categoryName={category.name}
          categoryColor={category.color}
          onPress={() => navigation.navigate("RoutineDetail", { routineId: item.id })}
        />
      )}
      ListHeaderComponent={
        <View style={[styles.headerCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <View style={[styles.iconWrap, { backgroundColor: `${category.color}22` }]}> 
            <MaterialCommunityIcons name={iconName as any} size={22} color={category.color} />
          </View>
          <View style={styles.headerTextWrap}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>{category.name}</Text>
            <Text style={[styles.headerMeta, { color: colors.textMuted }]}>{categoryRoutines.length} {categoryRoutines.length === 1 ? itemLabel : `${itemLabel}s`}</Text>
          </View>
        </View>
      }
      ListFooterComponent={<View style={{ height: 10 }} />}
    />
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 24,
  },
  headerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
  },
  headerMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: "600",
  },
  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "800",
  },
  emptyBody: {
    marginTop: 8,
    textAlign: "center",
    fontSize: 14,
    lineHeight: 20,
  },
});
