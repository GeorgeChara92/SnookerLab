import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
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

    const scoreableRoutines = routines.filter((routine) => routine.content_type !== "guide");

    const rankedByRecency = [...scoreableRoutines].sort((a, b) => {
      const aDate = lastUsedByRoutineId.get(a.id);
      const bDate = lastUsedByRoutineId.get(b.id);

      if (!aDate && !bDate) return a.name.localeCompare(b.name);
      if (!aDate) return -1;
      if (!bDate) return 1;
      return new Date(aDate).getTime() - new Date(bDate).getTime();
    });

    const foundationsCategory = categories.find((category) => {
      const label = category.name.toLowerCase();
      return label.includes("foundation") || label.includes("fundamental");
    });

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
        const routine = scoreableRoutines.find((routineEntry) => routineEntry.id === item.routineId);
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
  const barAnims = useRef(Array.from({ length: 7 }, () => new Animated.Value(0))).current;

  useEffect(() => {
    Animated.stagger(
      45,
      barAnims.map((anim, index) =>
        Animated.timing(anim, {
          toValue: dashboard.weeklyLoad[index]?.count ?? 0,
          duration: 320,
          useNativeDriver: false,
        })
      )
    ).start();
  }, [barAnims, dashboard.weeklyLoad]);

  const startPrimarySession = () => {
    if (lastTemplate) {
      navigation.navigate("Sessions", {
        screen: "ActiveSession",
        params: { templateId: lastTemplate.id },
      });
      return;
    }
    navigation.navigate("Sessions");
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.topShell}>
        <Text style={[styles.headerCaption, { color: colors.textMuted }]}>Elite Training Hub</Text>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Dashboard</Text>
      </View>

      <View style={[styles.focusHero, { backgroundColor: colors.primaryStrong }]}> 
        <View style={styles.focusGlow} />
        <Text style={[styles.focusKicker, { color: colors.onPrimary }]}>TODAY'S FOCUS</Text>
        <Text style={[styles.focusTitle, { color: colors.onPrimary }]}>{lastTemplate ? "Your Next Session" : "Set Your Next Session"}</Text>
        <Text style={[styles.focusDescription, { color: colors.onPrimary }]}>
          {lastTemplate
            ? `${lastTemplate.name} is ready. Keep your routine sharp and build match rhythm.`
            : "Build a high-quality session plan and start with one decisive action."}
        </Text>
        <View style={styles.focusActionsRow}>
          <Pressable style={[styles.focusPrimaryButton, { backgroundColor: colors.onPrimary }]} onPress={startPrimarySession}>
            <Text style={[styles.focusPrimaryText, { color: colors.primaryStrong }]}>Start Session</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryStrong} />
          </Pressable>
          <Pressable style={[styles.focusSecondaryButton, { borderColor: colors.onPrimary }]} onPress={() => navigation.navigate("Practice")}> 
            <Text style={[styles.focusSecondaryText, { color: colors.onPrimary }]}>View Plan</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <Pressable style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={startPrimarySession}>
            <MaterialCommunityIcons name="target" size={22} color={colors.primary} />
            <Text style={[styles.quickActionTitle, { color: colors.text }]}>Start Session</Text>
            <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Launch focused practice</Text>
          </Pressable>
          <Pressable style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate("AICoach")}>
            <MaterialCommunityIcons name="robot-outline" size={22} color={colors.primary} />
            <Text style={[styles.quickActionTitle, { color: colors.text }]}>AI Coach</Text>
            <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Video and tactical review</Text>
          </Pressable>
          <Pressable style={[styles.quickActionCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => navigation.navigate("Stats")}>
            <MaterialCommunityIcons name="chart-timeline-variant" size={22} color={colors.primary} />
            <Text style={[styles.quickActionTitle, { color: colors.text }]}>Stats</Text>
            <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Track progress and form</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.insightHeaderRow}>
            <Text style={[styles.sectionHeading, { color: colors.text }]}>Weekly Sessions</Text>
            <Text style={[styles.weekDeltaTag, { color: weekDelta >= 0 ? colors.primary : colors.textMuted }]}>{weekDeltaLabel} vs last week</Text>
          </View>
          <View style={styles.chartRow}>
            {dashboard.weeklyLoad.map((day, index) => {
              const isToday = toDateKey(new Date().toISOString()) === day.key;
              return (
                <View key={day.key} style={styles.chartBarWrap}>
                  <View style={[styles.chartTrack, { backgroundColor: colors.surfaceMuted, borderColor: isToday ? colors.primary : colors.border }]}> 
                    <Animated.View
                      style={[
                        styles.chartFill,
                        {
                          backgroundColor: day.count > 0 ? colors.primary : colors.border,
                          height: barAnims[index].interpolate({
                            inputRange: [0, dashboard.maxDailyLoad || 1],
                            outputRange: [12, 104],
                            extrapolate: "clamp",
                          }),
                          opacity: isToday ? 1 : 0.92,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.chartDay, { color: isToday ? colors.primary : colors.textMuted }]}>{day.label}</Text>
                </View>
              );
            })}
          </View>
          <Text style={[styles.chartHint, { color: colors.textMuted }]}>Total {dashboard.weeklyTotal} sessions this week. Last activity: {dashboard.lastPracticeDate ? new Date(dashboard.lastPracticeDate).toLocaleDateString() : "No activity logged yet"}.</Text>
        </View>

        <View style={[styles.insightCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Performance Insights</Text>
          <View style={styles.metricRow}><MaterialCommunityIcons name="fire" size={16} color={colors.primary} /><Text style={[styles.metricText, { color: colors.textMuted }]}>Streak: {dashboard.currentStreak} day run</Text></View>
          <View style={styles.metricRow}><MaterialCommunityIcons name="calendar-week" size={16} color={colors.primary} /><Text style={[styles.metricText, { color: colors.textMuted }]}>Weekly activity: {dashboard.currentWeekActiveDays} days active</Text></View>
          <View style={styles.metricRow}><MaterialCommunityIcons name="counter" size={16} color={colors.primary} /><Text style={[styles.metricText, { color: colors.textMuted }]}>Volume: {dashboard.totalCompletions} total completions logged</Text></View>
          <View style={styles.metricRow}><MaterialCommunityIcons name="percent-circle-outline" size={16} color={colors.primary} /><Text style={[styles.metricText, { color: colors.textMuted }]}>Weekly completion: {dashboard.completionRate}%</Text></View>
        </View>
      </View>

      <View style={styles.sectionWrap}>
        <View style={styles.listHeaderRow}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Recommended Routines</Text>
          <MaterialCommunityIcons name="star-four-points" size={16} color={colors.primary} />
        </View>
        {dashboard.consistencyDropping ? (
          <Text style={[styles.recommendationHint, { color: colors.primary }]}>Focus Area: Fundamentals are prioritised this week.</Text>
        ) : null}
        {dashboard.recommendedRoutines.map((routine, index) => (
          <Pressable
            key={routine.id}
            style={[
              styles.recommendationCard,
              {
                borderColor: index === 0 ? colors.primary : colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            onPress={() =>
              navigation.navigate("Practice", {
                screen: "RoutineDetail",
                params: { routineId: routine.id },
              })
            }
          >
            <View style={styles.listTextWrap}>
              <View style={styles.recoTopRow}>
                <Text style={[styles.listTitle, { color: colors.text }]}>{routine.name}</Text>
                {index === 0 ? <Text style={[styles.recoPill, { color: colors.primary }]}>Recommended</Text> : null}
              </View>
              <Text style={[styles.listMeta, { color: colors.textMuted }]}>{routine.categoryName} • {routine.note}</Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionWrap}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Recent Routines</Text>
        {dashboard.recentActivity.length === 0 ? (
          <Text style={[styles.chartHint, { color: colors.textMuted }]}>No routine activity yet.</Text>
        ) : (
          dashboard.recentActivity.map((item) => (
            <Pressable
              key={`${item.id}-${item.date}`}
              style={[styles.recentItem, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
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
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 22 },
  topShell: { marginBottom: 10 },
  headerCaption: { fontSize: 12, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  headerTitle: { marginTop: 2, fontSize: 34, fontWeight: "900" },
  focusHero: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.24,
    shadowRadius: 16,
    elevation: 4,
  },
  focusGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -44,
    top: -40,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  focusKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  focusTitle: { marginTop: 8, fontSize: 32, fontWeight: "900", lineHeight: 36 },
  focusDescription: { marginTop: 6, fontSize: 14, lineHeight: 20, maxWidth: "88%" },
  focusActionsRow: {
    marginTop: 16,
    flexDirection: "row",
    gap: 8,
  },
  focusPrimaryButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusPrimaryText: { fontSize: 15, fontWeight: "900" },
  focusSecondaryButton: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  focusSecondaryText: { fontSize: 13, fontWeight: "800" },
  sectionWrap: {
    marginTop: 12,
  },
  sectionHeading: { fontSize: 17, fontWeight: "900", marginBottom: 10 },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 8,
  },
  quickActionCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
  },
  quickActionTitle: { marginTop: 8, fontSize: 14, fontWeight: "800" },
  quickActionMeta: { marginTop: 2, fontSize: 11 },
  insightCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  insightHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  weekDeltaTag: {
    fontSize: 11,
    fontWeight: "800",
  },
  metricRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 9,
  },
  metricText: { fontSize: 13, lineHeight: 18 },
  recommendationHint: { marginBottom: 8, fontSize: 12, fontWeight: "700" },
  recommendationCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  listTextWrap: { flex: 1, marginRight: 10 },
  listHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  recoTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  recoPill: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  listTitle: { fontSize: 14, fontWeight: "700" },
  listMeta: { fontSize: 12, marginTop: 2 },
  chartRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartBarWrap: { width: 36, alignItems: "center" },
  chartTrack: {
    height: 108,
    width: 22,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 2,
    paddingBottom: 2,
  },
  chartFill: {
    width: "100%",
    borderRadius: 10,
    minHeight: 12,
  },
  chartDay: { marginTop: 6, fontSize: 11, fontWeight: "700" },
  chartHint: { marginTop: 8, fontSize: 12 },
  recentItem: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 11,
    marginBottom: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bottomSpace: { height: 8 },
});
