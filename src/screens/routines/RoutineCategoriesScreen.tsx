import React, { useEffect, useMemo } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useRoutinesStore } from "../../store";
import type { PracticeStackParamList, RoutineCategory } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getRoutineCategoryIconName } from "../../constants/routineCategoryIcons";

export const RoutineCategoriesScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const { categories, routines, getRoutinesByCategory, loadRoutines } = useRoutinesStore();
  const { colors } = useAppTheme();

  const orderedCategories = useMemo(
    () => [...categories].sort((a, b) => a.order_index - b.order_index),
    [categories]
  );

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
    const categoryContainsOnlyGuides = categoryItems.length > 0 && categoryItems.every((entry) => entry.content_type === "guide");
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
          <Text style={[styles.categoryName, { color: colors.text }]} numberOfLines={2}>{item.name}</Text>
          <Text style={[styles.count, { color: colors.textMuted }]}>{routinesCount} {routinesCount === 1 ? itemLabel : `${itemLabel}s`}</Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.footerText, { color: colors.textMuted }]}>{categoryContainsOnlyGuides ? "Browse guides" : "Browse drills"}</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.textMuted} />
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  return (
    <FlatList
      data={orderedCategories}
      keyExtractor={(item) => item.id}
      numColumns={2}
      renderItem={renderCategory}
      columnWrapperStyle={styles.row}
      contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Pick a category to browse routines and guides.</Text>
        </View>
      }
    />
  );
};

const styles = StyleSheet.create({
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
    marginTop: 5,
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
