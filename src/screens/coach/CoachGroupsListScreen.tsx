import React, { useCallback } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCoachStore } from "../../store/coachStore";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** A coach's own broadcast groups: their clients, and the practice content posted for them. Loaded
 * alongside the rest of coach mode's data (see coachStore.hydrate), so this screen paints from
 * cache immediately rather than fetching cold on every visit. */
export const CoachGroupsListScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { myCoachGroups: groups, loaded, refreshMyCoachGroups } = useCoachStore();

  useFocusEffect(
    useCallback(() => {
      void refreshMyCoachGroups();
    }, [refreshMyCoachGroups])
  );

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      data={groups}
      keyExtractor={(group) => group.id}
      contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
      ListEmptyComponent={
        <View style={styles.empty}>
          <MaterialCommunityIcons name="account-multiple-plus-outline" size={36} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Make a group to post a routine video, image or PDF to several clients at once.
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <Pressable
          onPress={() => navigation.navigate("CoachGroup", { groupId: item.id, groupName: item.name })}
          accessibilityRole="button"
          style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="account-multiple-outline" size={24} color={colors.primary} />
          <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      )}
      ListFooterComponent={
        <Pressable
          onPress={() => navigation.navigate("CoachGroupForm")}
          accessibilityRole="button"
          style={[styles.newGroup, { borderColor: colors.border }]}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.primary} />
          <Text style={[styles.newGroupText, { color: colors.primary }]}>New group</Text>
        </Pressable>
      }
    />
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: SPACING.lg, gap: SPACING.sm, flexGrow: 1 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
  emptyText: { fontSize: 15, textAlign: "center", maxWidth: 280 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 16,
  },
  rowName: { flex: 1, fontSize: 16, fontWeight: "700" },
  newGroup: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  newGroupText: { fontSize: 15, fontWeight: "700" },
});
