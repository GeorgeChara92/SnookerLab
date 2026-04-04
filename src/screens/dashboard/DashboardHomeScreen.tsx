import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

const getStartOfWeekMonday = (value = new Date()) => {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  const daysFromMonday = (weekday + 6) % 7;
  date.setDate(date.getDate() - daysFromMonday);
  return date;
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
    const currentWeekStart = getStartOfWeekMonday();
    const previousWeekStart = new Date(currentWeekStart);
    previousWeekStart.setDate(previousWeekStart.getDate() - 7);

    const currentWeekKeys = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(currentWeekStart);
      day.setDate(day.getDate() + index);
      return day.toISOString().split("T")[0];
    });

    const previousWeekKeys = Array.from({ length: 7 }, (_, index) => {
      const day = new Date(previousWeekStart);
      day.setDate(day.getDate() + index);
      return day.toISOString().split("T")[0];
    });

    const currentWeekActiveDays = currentWeekKeys.reduce((sum, key) => sum + (activeDateKeys.has(key) ? 1 : 0), 0);
    const previousWeekActiveDays = previousWeekKeys.reduce((sum, key) => sum + (activeDateKeys.has(key) ? 1 : 0), 0);
    const completionRate = Math.round((currentWeekActiveDays / 7) * 100);
    const consistencyDropping =
      currentWeekActiveDays < previousWeekActiveDays || (currentStreak <= 1 && currentWeekActiveDays <= 2);
    const totalCompletions = logs.reduce((sum, log) => sum + log.results.length, 0) + entries.length;

    const weeklyLoad = currentWeekKeys.map((key) => {
      const logCount = logs.reduce((sum, log) => {
        if (toDateKey(log.date) !== key) return sum;
        return sum + log.results.length;
      }, 0);
      const entryCount = entries.reduce((sum, entry) => {
        if (toDateKey(entry.recorded_at) !== key) return sum;
        return sum + 1;
      }, 0);

      return {
        key,
        label: new Date(key).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
        count: logCount + entryCount,
      };
    });

    const maxDailyLoad = Math.max(1, ...weeklyLoad.map((day) => day.count));
    const weeklyTotal = weeklyLoad.reduce((sum, day) => sum + day.count, 0);

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
      completionRate,
      consistencyDropping,
      recommendedRoutines,
      recentActivity,
      totalCompletions,
      weeklyLoad,
      maxDailyLoad,
      weeklyTotal,
    };
  }, [categories, entries, logs, routines]);

  const weekDelta = dashboard.currentWeekActiveDays - dashboard.previousWeekActiveDays;
  const weekDeltaLabel = `${weekDelta >= 0 ? "+" : ""}${weekDelta} day${Math.abs(weekDelta) === 1 ? "" : "s"}`;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.headerCaption, { color: colors.textMuted }]}>Performance Lounge</Text>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
        </View>
        <View style={[styles.headerAvatar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="diamond-stone" size={18} color={colors.primary} />
        </View>
      </View>

      <View style={[styles.editorialHero, { backgroundColor: colors.primaryStrong }]}> 
        <View style={styles.heroOrbTop} />
        <View style={styles.heroOrbBottom} />
        <Text style={[styles.heroKicker, { color: colors.onPrimary }]}>Match Preparation</Text>
        <Text style={[styles.heroTitle, { color: colors.onPrimary }]}>Step into your next frame</Text>
        <Text style={[styles.heroBody, { color: colors.onPrimary }]}>Plan your session, jump into AI review, and keep your table work consistent through the week.</Text>

        {lastTemplate ? (
          <Pressable
            style={[styles.heroAction, { borderColor: colors.onPrimary }]}
            onPress={() =>
              navigation.navigate("Sessions", {
                screen: "ActiveSession",
                params: { templateId: lastTemplate.id },
              })
            }
          >
            <View style={styles.heroActionTextWrap}>
              <Text style={[styles.heroActionLabel, { color: colors.onPrimary }]}>Continue session plan</Text>
              <Text style={[styles.heroActionTitle, { color: colors.onPrimary }]}>{lastTemplate.name}</Text>
            </View>
            <MaterialCommunityIcons name="arrow-top-right" size={18} color={colors.onPrimary} />
          </Pressable>
        ) : (
          <Text style={[styles.heroEmpty, { color: colors.onPrimary }]}>Build a session preset to start training in one tap.</Text>
        )}
      </View>

      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.quickRow}>
          <Pressable style={[styles.quickAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => navigation.navigate("Sessions")}>
            <MaterialCommunityIcons name="play-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.quickText, { color: colors.text }]}>Start</Text>
          </Pressable>
          <Pressable style={[styles.quickAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => navigation.navigate("AICoach")}>
            <MaterialCommunityIcons name="robot-outline" size={20} color={colors.primary} />
            <Text style={[styles.quickText, { color: colors.text }]}>AI Coach</Text>
          </Pressable>
          <Pressable style={[styles.quickAction, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => navigation.navigate("Stats")}>
            <MaterialCommunityIcons name="chart-line" size={20} color={colors.primary} />
            <Text style={[styles.quickText, { color: colors.text }]}>Stats</Text>
          </Pressable>
        </View>
      </AppCard>

      <AppCard style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeading, { color: colors.text }]}>Practice Sessions This Week</Text>
          <Text style={[styles.cardTag, { color: weekDelta >= 0 ? colors.primary : colors.textMuted }]}>{weekDeltaLabel}</Text>
        </View>
        <View style={styles.chartRow}>
          {dashboard.weeklyLoad.map((day) => (
            <View key={day.key} style={styles.chartBarWrap}>
              <View style={[styles.chartTrack, { backgroundColor: colors.surfaceMuted }]}>
                <View
                  style={[
                    styles.chartFill,
                    {
                      backgroundColor: day.count > 0 ? colors.primary : colors.border,
                      height: `${Math.max(12, Math.round((day.count / dashboard.maxDailyLoad) * 100))}%`,
                    },
                  ]}
                />
              </View>
              <Text style={[styles.chartDay, { color: colors.textMuted }]}>{day.label}</Text>
            </View>
          ))}
        </View>
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>Monday to Sunday view. Last activity: {dashboard.lastPracticeDate ? new Date(dashboard.lastPracticeDate).toLocaleDateString() : "No activity logged yet"}</Text>
      </AppCard>

      <AppCard style={styles.cardGap}>
        <Text style={[styles.cardHeading, { color: colors.text }]}>Session Notes</Text>
        <View style={styles.noteRow}>
          <MaterialCommunityIcons name="fire" size={16} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>Current run: {dashboard.currentStreak} day streak</Text>
        </View>
        <View style={styles.noteRow}>
          <MaterialCommunityIcons name="calendar-week" size={16} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>This week: {dashboard.currentWeekActiveDays} active days ({weekDeltaLabel} vs last week)</Text>
        </View>
        <View style={styles.noteRow}>
          <MaterialCommunityIcons name="counter" size={16} color={colors.primary} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>Volume: {dashboard.weeklyTotal} sessions this week, {dashboard.totalCompletions} total logged</Text>
        </View>
      </AppCard>

      <AppCard style={styles.cardGap}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardHeading, { color: colors.text }]}>Recommended Routines</Text>
          <MaterialCommunityIcons name="star-four-points" size={16} color={colors.primary} />
        </View>
        {dashboard.consistencyDropping ? (
          <Text style={[styles.recommendationHint, { color: colors.primary }]}>Foundations are prioritised this week to tighten control.</Text>
        ) : null}
        {dashboard.recommendedRoutines.map((routine) => (
          <Pressable
            key={routine.id}
            style={[styles.listItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            onPress={() =>
              navigation.navigate("Practice", {
                screen: "RoutineDetail",
                params: { routineId: routine.id },
              })
            }
          >
            <View style={styles.listTextWrap}>
              <Text style={[styles.listTitle, { color: colors.text }]}>{routine.name}</Text>
              <Text style={[styles.listMeta, { color: colors.textMuted }]}>{routine.categoryName} - {routine.note}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
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
              style={[styles.listItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              onPress={() =>
                navigation.navigate("Practice", {
                  screen: "RoutineDetail",
                  params: { routineId: item.id },
                })
              }
            >
              <View style={styles.listTextWrap}>
                <Text style={[styles.listTitle, { color: colors.text }]}>{item.name}</Text>
                <Text style={[styles.listMeta, { color: colors.textMuted }]}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
            </Pressable>
          ))
        )}
      </AppCard>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 20 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerCaption: { fontSize: 12, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  headerTitle: { marginTop: 2, fontSize: 30, fontWeight: "800" },
  headerAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  editorialHero: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 12,
    overflow: "hidden",
  },
  heroOrbTop: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 999,
    right: -24,
    top: -38,
    backgroundColor: "rgba(186, 51, 42, 0.25)",
  },
  heroOrbBottom: {
    position: "absolute",
    width: 88,
    height: 88,
    borderRadius: 999,
    left: -18,
    bottom: -34,
    backgroundColor: "rgba(186, 51, 42, 0.18)",
  },
  heroKicker: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1.1, opacity: 0.9 },
  heroTitle: { marginTop: 8, fontSize: 28, fontWeight: "900", lineHeight: 31 },
  heroBody: { marginTop: 6, fontSize: 13, lineHeight: 19, maxWidth: "85%", opacity: 0.9 },
  heroAction: {
    marginTop: 14,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroActionTextWrap: { flex: 1, marginRight: 10 },
  heroActionLabel: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, opacity: 0.88 },
  heroActionTitle: { marginTop: 2, fontSize: 15, fontWeight: "800" },
  heroEmpty: { marginTop: 12, fontSize: 12, opacity: 0.82 },
  cardGap: { marginTop: 12 },
  cardHeading: { fontSize: 16, fontWeight: "800", marginBottom: 8 },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  cardTag: { fontSize: 12, fontWeight: "700" },
  cardHint: { marginTop: 8, fontSize: 12 },
  quickRow: { flexDirection: "row", gap: 8 },
  quickAction: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    gap: 6,
  },
  quickText: { fontSize: 12, fontWeight: "700" },
  noteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  noteText: { fontSize: 13, lineHeight: 18 },
  recommendationHint: { marginBottom: 8, fontSize: 12, fontWeight: "700" },
  listItem: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTextWrap: { flex: 1, marginRight: 10 },
  listTitle: { fontSize: 14, fontWeight: "700" },
  listMeta: { fontSize: 12, marginTop: 2 },
  chartRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartBarWrap: { width: 30, alignItems: "center" },
  chartTrack: {
    height: 82,
    width: 16,
    borderRadius: 999,
    justifyContent: "flex-end",
    padding: 2,
  },
  chartFill: {
    width: "100%",
    borderRadius: 999,
    minHeight: 6,
  },
  chartDay: { marginTop: 6, fontSize: 11, fontWeight: "700" },
  bottomSpace: { height: 8 },
});
