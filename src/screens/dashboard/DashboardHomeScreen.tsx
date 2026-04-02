import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import {
  useRoutineScoresStore,
  useRoutinesStore,
  useSessionsStore,
} from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";

type RoutineRecommendation = {
  id: string;
  name: string;
  categoryName: string;
  note: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = (date: string) => date.split("T")[0];

const getDaysAgo = (dateKey: string) => {
  const today = new Date();
  const target = new Date(dateKey);

  const utcToday = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const utcTarget = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  return Math.max(0, Math.floor((utcToday - utcTarget) / DAY_MS));
};

const getDateKeyDaysAgo = (daysAgo: number) => {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split("T")[0];
};

const countActiveDaysInWindow = (dateKeys: Set<string>, startDaysAgo: number, endDaysAgo: number) => {
  let total = 0;

  for (let day = startDaysAgo; day <= endDaysAgo; day += 1) {
    const key = getDateKeyDaysAgo(day);
    if (dateKeys.has(key)) total += 1;
  }

  return total;
};

const buildCurrentStreak = (dateKeys: Set<string>) => {
  let streak = 0;
  const cursor = new Date();

  while (true) {
    const key = cursor.toISOString().split("T")[0];
    if (!dateKeys.has(key)) break;

    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
};

export const DashboardHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { templates, logs } = useSessionsStore();
  const { entries } = useRoutineScoresStore();
  const { routines, categories } = useRoutinesStore();

  const lastTemplate = templates[0];

  const dashboard = useMemo(() => {
    const activeDateKeys = new Set<string>();

    logs.forEach((log) => {
      activeDateKeys.add(toDateKey(log.date));
    });

    entries.forEach((entry) => {
      activeDateKeys.add(toDateKey(entry.recorded_at));
    });

    const currentStreak = buildCurrentStreak(activeDateKeys);
    const lastPracticeDate = logs[0]?.date ?? entries[0]?.recorded_at;
    const currentWeekActiveDays = countActiveDaysInWindow(activeDateKeys, 0, 6);
    const previousWeekActiveDays = countActiveDaysInWindow(activeDateKeys, 7, 13);
    const consistencyDropping =
      currentWeekActiveDays < previousWeekActiveDays || (currentStreak <= 1 && currentWeekActiveDays <= 2);

    const lastUsedByRoutineId = new Map<string, string>();

    logs.forEach((log) => {
      const dateKey = toDateKey(log.date);

      log.results.forEach((result) => {
        const existing = lastUsedByRoutineId.get(result.routine_id);
        if (!existing || new Date(dateKey).getTime() > new Date(existing).getTime()) {
          lastUsedByRoutineId.set(result.routine_id, dateKey);
        }
      });
    });

    entries.forEach((entry) => {
      const dateKey = toDateKey(entry.recorded_at);
      const existing = lastUsedByRoutineId.get(entry.routine_id);

      if (!existing || new Date(dateKey).getTime() > new Date(existing).getTime()) {
        lastUsedByRoutineId.set(entry.routine_id, dateKey);
      }
    });

    const rankedByRecency = [...routines].sort((a, b) => {
        const aDate = lastUsedByRoutineId.get(a.id);
        const bDate = lastUsedByRoutineId.get(b.id);

        if (!aDate && !bDate) return a.name.localeCompare(b.name);
        if (!aDate) return -1;
        if (!bDate) return 1;
        return new Date(aDate).getTime() - new Date(bDate).getTime();
      });

    const foundationsCategory = categories.find((category) =>
      category.name.toLowerCase().includes("foundation")
    );

    const baseRecommendations = consistencyDropping && foundationsCategory
      ? [
          ...rankedByRecency.filter((routine) => routine.category_id === foundationsCategory.id),
          ...rankedByRecency.filter((routine) => routine.category_id !== foundationsCategory.id),
        ]
      : rankedByRecency;

    const recommendedRoutines: RoutineRecommendation[] = baseRecommendations
      .slice(0, 3)
      .map((routine) => {
        const categoryName = categories.find((category) => category.id === routine.category_id)?.name ?? "Practice";
        const lastUsed = lastUsedByRoutineId.get(routine.id);

        const note = !lastUsed
          ? "Not logged yet"
          : getDaysAgo(lastUsed) === 0
            ? "Played today"
            : `${getDaysAgo(lastUsed)} day${getDaysAgo(lastUsed) === 1 ? "" : "s"} since last run`;

        return {
          id: routine.id,
          name: routine.name,
          categoryName,
          note,
        };
      });

    const recentActivity = [
      ...logs.flatMap((log) =>
        log.results.map((result) => ({
          routineId: result.routine_id,
          date: log.recorded_at,
        }))
      ),
      ...entries.map((entry) => ({
        routineId: entry.routine_id,
        date: entry.recorded_at,
      })),
    ]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .reduce<{ routineId: string; date: string }[]>((acc, item) => {
        if (acc.some((existing) => existing.routineId === item.routineId)) return acc;
        return [...acc, item];
      }, [])
      .slice(0, 4)
      .map((item) => {
        const routine = routines.find((routineEntry) => routineEntry.id === item.routineId);
        return {
          id: item.routineId,
          name: routine?.name ?? "Routine",
          date: item.date,
        };
      });

    return {
      currentStreak,
      lastPracticeDate,
      currentWeekActiveDays,
      previousWeekActiveDays,
      consistencyDropping,
      recommendedRoutines,
      recentActivity,
    };
  }, [categories, entries, logs, routines]);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
    >
      <Text style={[styles.title, { color: colors.text }]}>Your Training Dashboard</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track momentum, pick your next drills, and keep your rhythm.</Text>

      <AppCard>
        <Text style={[styles.cardHeading, { color: colors.text }]}>This Week</Text>
        <View style={styles.weekGrid}>
          <View style={[styles.weekMetric, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.weekMetricValue, { color: colors.text }]}>{dashboard.currentWeekActiveDays}</Text>
            <Text style={[styles.weekMetricLabel, { color: colors.textMuted }]}>Active Days</Text>
          </View>
          <View style={[styles.weekMetric, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.weekMetricValue, { color: colors.text }]}>{dashboard.recentActivity.length}</Text>
            <Text style={[styles.weekMetricLabel, { color: colors.textMuted }]}>Routines Done</Text>
          </View>
        </View>
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>
          {dashboard.currentWeekActiveDays - dashboard.previousWeekActiveDays >= 0 ? "Up" : "Down"} {Math.abs(dashboard.currentWeekActiveDays - dashboard.previousWeekActiveDays)} day{Math.abs(dashboard.currentWeekActiveDays - dashboard.previousWeekActiveDays) === 1 ? "" : "s"} vs last week.
        </Text>
      </AppCard>

      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Current Streak</Text>
        <Text style={[styles.streakValue, { color: colors.primary }]}>
          {dashboard.currentStreak} day{dashboard.currentStreak === 1 ? "" : "s"}
        </Text>
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>
          {dashboard.lastPracticeDate
            ? `Last activity: ${new Date(dashboard.lastPracticeDate).toLocaleDateString()}`
            : "No activity logged yet. Start your first routine today."}
        </Text>
      </AppCard>

      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Recommended Routines</Text>
        {dashboard.consistencyDropping ? (
          <Text style={[styles.recommendationHint, { color: colors.primary }]}>Consistency dipped this week - foundations prioritised.</Text>
        ) : null}
        {dashboard.recommendedRoutines.map((routine) => (
          <Pressable
            key={routine.id}
            style={[styles.rowItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            onPress={() =>
              navigation.navigate("Practice", {
                screen: "RoutineDetail",
                params: { routineId: routine.id },
              })
            }
          >
            <View style={styles.rowTextWrap}>
              <Text style={[styles.rowTitle, { color: colors.text }]}>{routine.name}</Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                {routine.categoryName} - {routine.note}
              </Text>
            </View>
            <Text style={[styles.rowChevron, { color: colors.primary }]}>›</Text>
          </Pressable>
        ))}
      </AppCard>

      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Recent Routines</Text>
        {dashboard.recentActivity.length === 0 ? (
          <Text style={[styles.cardHint, { color: colors.textMuted }]}>No routine activity yet.</Text>
        ) : (
          dashboard.recentActivity.map((item) => (
            <Pressable
              key={`${item.id}-${item.date}`}
              style={[styles.rowItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              onPress={() =>
                navigation.navigate("Practice", {
                  screen: "RoutineDetail",
                  params: { routineId: item.id },
                })
              }
            >
              <View style={styles.rowTextWrap}>
                <Text style={[styles.rowTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                  {new Date(item.date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={[styles.rowChevron, { color: colors.primary }]}>›</Text>
            </Pressable>
          ))
        )}
      </AppCard>

      <View style={styles.actionsSection}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <View style={styles.actionButtonWrap}>
            <AppButton label="Start Session" onPress={() => navigation.navigate("Sessions")} />
          </View>
          <View style={styles.actionButtonWrap}>
            <AppButton label="Record Score" variant="secondary" onPress={() => navigation.navigate("Practice")} />
          </View>
        </View>

        {lastTemplate ? (
          <Pressable
            style={[styles.lastPreset, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() =>
              navigation.navigate("Sessions", {
                screen: "ActiveSession",
                params: { templateId: lastTemplate.id },
              })
            }
          >
            <Text style={[styles.lastPresetTitle, { color: colors.text }]}>Resume Last Preset</Text>
            <Text style={[styles.lastPresetMeta, { color: colors.textMuted }]}>{lastTemplate.name}</Text>
          </Pressable>
        ) : null}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, fontSize: 14, lineHeight: 20, marginBottom: 14 },
  cardHeading: { fontSize: 17, fontWeight: "800", marginBottom: 8 },
  streakValue: { fontSize: 38, fontWeight: "800", lineHeight: 42 },
  cardHint: { marginTop: 4, fontSize: 13 },
  cardGap: { marginTop: 12 },
  weekGrid: { flexDirection: "row", gap: 8 },
  weekMetric: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  weekMetricValue: { fontSize: 24, fontWeight: "800" },
  weekMetricLabel: { fontSize: 12, marginTop: 2 },
  recommendationHint: { marginBottom: 8, fontSize: 12, fontWeight: "700" },
  rowItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  rowTextWrap: { flex: 1, marginRight: 10 },
  rowTitle: { fontSize: 14, fontWeight: "700" },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowChevron: { fontSize: 22, fontWeight: "700" },
  actionsSection: { marginTop: 12 },
  actionsGrid: { flexDirection: "row", gap: 8 },
  actionButtonWrap: { flex: 1 },
  lastPreset: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  lastPresetTitle: { fontSize: 14, fontWeight: "700" },
  lastPresetMeta: { marginTop: 3, fontSize: 12 },
});
