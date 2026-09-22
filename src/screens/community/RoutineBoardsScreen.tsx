import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useCustomRoutinesStore } from "../../store";
import { BoardRow } from "../../components/community/BoardRow";
import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../../constants/routines";
import { leaderboardKeyFor } from "../../features/customRoutines/customRoutine";
import { boardSummaries, type BoardSummary } from "../../features/community/sharedRoutines";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Board = { key: string; name: string; icon: string; group: string };

/**
 * Every routine leaderboard, found fast: search by name, or narrow to a category, the boards
 * the player is on, or the community routines they have saved. One compact line per board,
 * the busiest first.
 */
export const RoutineBoardsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const custom = useCustomRoutinesStore((state) => state.routines);
  const [summaries, setSummaries] = useState<Record<string, BoardSummary> | null>(null);
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => setSummaries(await boardSummaries(me)), [me]);
  useEffect(() => {
    void load();
  }, [load]);

  const boards = useMemo<Board[]>(
    () => [
      ...DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide").map((routine) => ({
        key: routine.id,
        name: routine.name,
        icon: routine.icon ?? "🎱",
        group: routine.category_id,
      })),
      ...custom
        .filter((routine) => leaderboardKeyFor(routine))
        .map((routine) => ({ key: leaderboardKeyFor(routine)!, name: routine.name, icon: "⭐", group: "community" })),
    ],
    [custom]
  );

  const groups = useMemo(
    () => [
      { value: "all", label: "All" },
      { value: "mine", label: "My places" },
      ...(boards.some((board) => board.group === "community") ? [{ value: "community", label: "Community" }] : []),
      ...DEFAULT_CATEGORIES.filter((category) => boards.some((board) => board.group === category.id)).map(
        (category) => ({
          value: category.id,
          label: category.name.replace(/ (Library|& .*)$/, ""),
        })
      ),
    ],
    [boards]
  );

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return boards
      .filter((board) => !needle || board.name.toLowerCase().includes(needle))
      .filter((board) =>
        group === "all" ? true : group === "mine" ? Boolean(summaries?.[board.key]?.myRank) : board.group === group
      )
      .sort(
        (a, b) =>
          (summaries?.[b.key]?.players ?? 0) - (summaries?.[a.key]?.players ?? 0) || a.name.localeCompare(b.name)
      );
  }, [boards, group, query, summaries]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Find a routine"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {groups.map((option) => {
            const selected = option.value === group;
            return (
              <Pressable
                key={option.value}
                onPress={() => setGroup(option.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {summaries === null ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          data={shown}
          keyExtractor={(board) => board.key}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {group === "mine" ? "Record a score on a routine to get on its board." : "No routines match."}
            </Text>
          }
          renderItem={({ item, index }) => (
            <View
              style={[
                styles.cell,
                { backgroundColor: colors.surface, borderColor: colors.border },
                index === 0 ? styles.top : null,
                index === shown.length - 1 ? styles.bottom : null,
              ]}
            >
              <BoardRow
                first={index === 0}
                icon={item.icon}
                name={item.name}
                summary={summaries[item.key]}
                onPress={() => navigation.navigate("RoutineLeaderboard", { routineKey: item.key, name: item.name })}
              />
            </View>
          )}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.sm },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 2,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  chips: { gap: SPACING.xs, paddingVertical: 2 },
  chip: {
    minHeight: 34,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    justifyContent: "center",
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  content: { padding: SPACING.lg, paddingTop: SPACING.md },
  cell: { borderLeftWidth: 1, borderRightWidth: 1, overflow: "hidden" },
  top: { borderTopWidth: 1, borderTopLeftRadius: RADIUS.lg, borderTopRightRadius: RADIUS.lg },
  bottom: { borderBottomWidth: 1, borderBottomLeftRadius: RADIUS.lg, borderBottomRightRadius: RADIUS.lg },
  empty: { fontSize: 14, textAlign: "center", marginTop: SPACING.xl },
});
