import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useRoutineScoresStore,
  useRoutinesStore,
  useSessionsStore,
} from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { addDays, countStreak, dateKeyFrom, parseDateKey, startOfWeekMonday, toLocalDateKey, todayKey } from "../../utils/date";

type RoutineRecommendation = {
  id: string;
  name: string;
  categoryName: string;
  note: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

const toDateKey = dateKeyFrom;

const getDaysAgo = (dateKey: string) => {
  const today = parseDateKey(todayKey());
  const target = parseDateKey(dateKey);
  return Math.max(0, Math.round((today.getTime() - target.getTime()) / DAY_MS));
};

export const DashboardHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
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

    const currentStreak = countStreak(activeDateKeys);
    const lastPracticeDate = logs[0]?.date ?? entries[0]?.recorded_at;
    const currentWeekStart = startOfWeekMonday();
    const previousWeekStart = addDays(currentWeekStart, -7);

    const currentWeekKeys = Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(currentWeekStart, index)));
    const previousWeekKeys = Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(previousWeekStart, index)));

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
        label: parseDateKey(key).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 3),
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

  const carouselPages = ["performance", "recommended", "recent"] as const;
  const [activePage, setActivePage] = useState(0);
  const carouselWidth = Math.max(280, width - 24);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={styles.content}>
        <View style={[styles.focusHero, { backgroundColor: colors.primaryStrong }]}> 
          <View style={styles.focusGlow} />
          <Text style={[styles.focusKicker, { color: colors.onPrimary }]}>TODAY'S FOCUS</Text>
          <Text style={[styles.focusTitle, { color: colors.onPrimary }]}>{lastTemplate ? "Your Next Session" : "Set Your Next Session"}</Text>
          <Text style={[styles.focusDescription, { color: colors.onPrimary }]}> 
            {lastTemplate
              ? `${lastTemplate.name} - ${lastTemplate.routine_ids.length} ${lastTemplate.routine_ids.length === 1 ? "routine" : "routines"}`
              : "Pick the routines you want to work on and save them as a session you can repeat."}
          </Text>
          <View style={styles.focusActionsRow}>
            <Pressable style={[styles.focusPrimaryButton, { backgroundColor: colors.onPrimary }]} onPress={startPrimarySession}>
              <Text style={[styles.focusPrimaryText, { color: colors.primaryStrong }]}>Start Session</Text>
              <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryStrong} />
            </Pressable>
            <Pressable style={[styles.focusSecondaryButton, { borderColor: "rgba(255,255,255,0.45)" }]} onPress={() => navigation.navigate("Practice")}>
              <Text style={[styles.focusSecondaryText, { color: colors.onPrimary }]}>View Plan</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.sectionWrap}>
          <Text style={[styles.sectionHeading, { color: colors.text }]}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <Pressable
              style={({ pressed }) => [
                styles.quickActionCard,
                { backgroundColor: colors.surface, borderColor: pressed ? colors.primary : colors.border },
                pressed && styles.quickActionCardPressed,
              ]}
              onPress={startPrimarySession}
            >
              <MaterialCommunityIcons name="target" size={24} color={colors.primary} />
              <Text style={[styles.quickActionTitle, { color: colors.text }]}>Start Session</Text>
              <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Focused practice</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quickActionCard,
                { backgroundColor: colors.surface, borderColor: pressed ? colors.primary : colors.border },
                pressed && styles.quickActionCardPressed,
              ]}
              onPress={() => navigation.navigate("AICoach")}
            >
              <MaterialCommunityIcons name="robot-outline" size={24} color={colors.primary} />
              <Text style={[styles.quickActionTitle, { color: colors.text }]}>AI Coach</Text>
              <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Review and analysis</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.quickActionCard,
                { backgroundColor: colors.surface, borderColor: pressed ? colors.primary : colors.border },
                pressed && styles.quickActionCardPressed,
              ]}
              onPress={() => navigation.navigate("Stats")}
            >
              <MaterialCommunityIcons name="chart-timeline-variant" size={24} color={colors.primary} />
              <Text style={[styles.quickActionTitle, { color: colors.text }]}>Stats</Text>
              <Text style={[styles.quickActionMeta, { color: colors.textMuted }]}>Progress and form</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.carouselSection}>
          <FlatList
            horizontal
            pagingEnabled
            data={carouselPages as unknown as string[]}
            keyExtractor={(item) => item}
            showsHorizontalScrollIndicator={false}
            snapToInterval={carouselWidth}
            decelerationRate="fast"
            contentContainerStyle={styles.carouselTrack}
            onScroll={(event) => {
              const x = event.nativeEvent.contentOffset.x;
              const index = Math.floor((x + carouselWidth * 0.5) / carouselWidth);
              setActivePage(index);
            }}
            scrollEventThrottle={16}
            renderItem={({ item }) => (
              <View style={[styles.carouselPage, { width: carouselWidth }]}> 
                {item === "performance" ? (
                  <View style={styles.pageShell}>
                    <View style={styles.pageDominant}> 
                      <View style={styles.insightHeaderRow}>
                        <Text style={[styles.pageTitle, { color: colors.text }]}>Performance Overview</Text>
                        <Text style={[styles.weekDeltaTag, { color: weekDelta >= 0 ? colors.primary : colors.textMuted }]}>{weekDeltaLabel}</Text>
                      </View>
                      {dashboard.weeklyTotal === 0 ? (
                        <View style={styles.chartEmpty}>
                          <Text style={[styles.chartEmptyTitle, { color: colors.text }]}>No practice logged this week</Text>
                          <Text style={[styles.chartEmptyBody, { color: colors.textMuted }]}>
                            Log a routine score or a session and your week fills in here.
                          </Text>
                          <Pressable
                            onPress={startPrimarySession}
                            accessibilityRole="button"
                            accessibilityLabel="Start a practice session"
                            style={({ pressed }) => [
                              styles.chartEmptyAction,
                              { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 },
                            ]}
                          >
                            <Text style={[styles.chartEmptyActionText, { color: colors.primary }]}>Start a session</Text>
                          </Pressable>
                        </View>
                      ) : (
                      <View style={styles.chartRow}>
                        {dashboard.weeklyLoad.map((day, index) => {
                          const isToday = todayKey() === day.key;
                          return (
<View key={day.key} style={styles.chartBarWrap}> 
                              <View style={[styles.chartTrack, { backgroundColor: colors.surface, borderWidth: 1, borderColor: isToday ? colors.primary : colors.border }]}> 
                                <Animated.View
                                  style={[
                                    styles.chartFill,
                                    {
                                      backgroundColor: day.count > 0 ? colors.primary : colors.border,
                                      height: barAnims[index].interpolate({
                                        inputRange: [0, dashboard.maxDailyLoad || 1],
                                        outputRange: [14, 172],
                                        extrapolate: "clamp",
                                      }),
                                    },
                                  ]}
                                />
                              </View>
                              <Text style={[styles.chartDay, { color: isToday ? colors.primary : colors.textMuted }]}>{day.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      )}
                    </View>

                    <View style={styles.statsStrip}>
                      <View style={[styles.statChip, { backgroundColor: colors.surface }]}> 
                        <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.currentStreak}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
                      </View>
                      <View style={[styles.statChip, { backgroundColor: colors.surface }]}> 
                        <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.currentWeekActiveDays}</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active Days</Text>
                      </View>
                      <View style={[styles.statChip, { backgroundColor: colors.surface }]}> 
                        <Text style={[styles.statValue, { color: colors.text }]}>{dashboard.completionRate}%</Text>
                        <Text style={[styles.statLabel, { color: colors.textMuted }]}>Completion</Text>
                      </View>
                    </View>
                  </View>
                ) : null}

                {item === "recommended" ? (
                  <View style={styles.pageShell}>
                    <Text style={[styles.pageTitle, { color: colors.text }]}>Recommended Training</Text>
                    {dashboard.consistencyDropping ? (
                      <Text style={[styles.recommendationHint, { color: colors.primary }]}>Focus: fundamentals this week.</Text>
                    ) : null}
                    {dashboard.recommendedRoutines.slice(0, 4).map((routine, index) => (
                      <Pressable
                        key={routine.id}
                        style={({ pressed }) => [
                          styles.featureRoutineCard,
                          {
                            backgroundColor: colors.surface,
                            borderColor: index === 0 ? colors.primary : "transparent",
                            transform: [{ scale: pressed ? 0.985 : 1 }],
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
                          <Text style={[styles.listTitle, { color: colors.text }]}>{routine.name}</Text>
                          <Text style={[styles.listMeta, { color: colors.textMuted }]}>{routine.categoryName}</Text>
                          <Text style={[styles.featureRoutineMeta, { color: colors.primary }]}>{routine.note}</Text>
                        </View>
                        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.primary} />
                      </Pressable>
                    ))}
                  </View>
                ) : null}

                {item === "recent" ? (
                  <View style={styles.pageShell}>
                    <View style={styles.pageTopBlock}>
                      <Text style={[styles.pageTitle, { color: colors.text }]}>Recent Activity</Text>
                      {dashboard.recentActivity.length === 0 ? (
                        <Text style={[styles.chartHint, { color: colors.textMuted }]}>No routine activity yet.</Text>
                      ) : (
                        <View style={styles.recentListWrap}>
                          {dashboard.recentActivity.slice(0, 5).map((itemEntry, index) => (
                            <Pressable
                              key={`${itemEntry.id}-${itemEntry.date}`}
                              style={[
                                styles.recentItem,
                                { borderColor: "transparent", backgroundColor: "transparent" },
                                index < 4 && styles.recentItemDivider,
                              ]}
                              onPress={() =>
                                navigation.navigate("Practice", {
                                  screen: "RoutineDetail",
                                  params: { routineId: itemEntry.id },
                                })
                              }
                            >
                              <View style={styles.recentBullet} />
                              <View style={styles.listTextWrap}>
                                <Text style={[styles.recentTitle, { color: colors.text }]}>{itemEntry.name}</Text>
                                <Text style={[styles.listMeta, { color: colors.textMuted }]}>{new Date(itemEntry.date).toLocaleDateString()}</Text>
                              </View>
                              <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
                            </Pressable>
                          ))}
                        </View>
                      )}
                    </View>

                    <View style={[styles.pageBottomAnchor, styles.recentFooter, { backgroundColor: colors.surfaceMuted }]}> 
                      <Text style={[styles.recentFooterValue, { color: colors.text }]}>{dashboard.weeklyTotal}</Text>
                      <Text style={[styles.recentFooterLabel, { color: colors.textMuted }]}>Total sessions this week</Text>
                    </View>
                  </View>
                ) : null}
              </View>
            )}
          />

          <View style={styles.carouselDots}>
            {carouselPages.map((page, index) => (
              <View
                key={page}
                style={[
                  styles.carouselDot,
                  {
                    backgroundColor: index === activePage ? colors.primary : colors.textMuted,
                    opacity: index === activePage ? 0.95 : 0.35,
                    transform: [{ scale: index === activePage ? 1.16 : 1 }],
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 14, paddingBottom: 8 },
  topShell: { marginBottom: 6 },
  headerCaption: { fontSize: 12, fontWeight: "700", letterSpacing: 0.7, textTransform: "uppercase" },
  headerTitle: { marginTop: 2, fontSize: 28, fontWeight: "900" },
  focusHero: {
    borderRadius: 18,
    padding: 10,
    marginBottom: 7,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  focusGlow: {
    position: "absolute",
    width: 180,
    height: 180,
    borderRadius: 999,
    right: -44,
    top: -40,
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  focusKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  focusTitle: { marginTop: 4, fontSize: 21, fontWeight: "900", lineHeight: 24 },
  focusDescription: { marginTop: 3, fontSize: 12, lineHeight: 15, maxWidth: "100%" },
  focusActionsRow: {
    marginTop: 8,
    flexDirection: "row",
    gap: 8,
  },
  focusPrimaryButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  focusPrimaryText: { fontSize: 13, fontWeight: "900" },
  focusSecondaryButton: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: "center",
  },
  focusSecondaryText: { fontSize: 12, fontWeight: "800" },
  sectionWrap: {
    marginTop: 8,
  },
  sectionHeading: { fontSize: 16, fontWeight: "900", marginBottom: 8 },
  quickActionsGrid: {
    flexDirection: "row",
    gap: 10,
  },
  quickActionCard: {
    flex: 1,
    borderWidth: 0,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  quickActionCardPressed: {
    transform: [{ scale: 0.98 }],
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionTitle: { marginTop: 6, fontSize: 12, fontWeight: "800" },
  quickActionMeta: { marginTop: 1, fontSize: 10 },
  pageShell: {
    flex: 1,
    gap: 8,
    justifyContent: "space-between",
  },
  pageTopBlock: {
    flex: 1,
  },
  pageBottomAnchor: {
    marginTop: 8,
  },
  recommendedSecondaryWrap: {
    paddingTop: 2,
  },
  pageDominant: {
    flex: 1.6,
    borderRadius: 14,
    padding: 10,
  },
  pageTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 6,
  },
  statsStrip: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  statChip: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
  },
  statValue: {
    fontSize: 16,
    fontWeight: "900",
  },
  statLabel: {
    marginTop: 2,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  insightCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginBottom: 0,
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
    marginBottom: 6,
  },
  metricText: { fontSize: 12, lineHeight: 16 },
  recommendationHint: { marginBottom: 6, fontSize: 11, fontWeight: "700" },
  featureRoutineCard: {
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  featureRoutineTitle: {
    fontSize: 15,
    fontWeight: "800",
  },
  featureRoutineMeta: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "700",
  },
  supportRoutineRow: {
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recommendationCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 6,
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
  listTitle: { fontSize: 13, fontWeight: "700" },
  listMeta: { fontSize: 11, marginTop: 2 },
  chartEmpty: {
    height: 196,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 6,
  },
  chartEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  chartEmptyBody: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  chartEmptyAction: {
    marginTop: 8,
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
  },
  chartEmptyActionText: {
    fontSize: 14,
    fontWeight: "700",
  },
  chartRow: {
    marginTop: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  chartBarWrap: { width: 34, alignItems: "center" },
  chartTrack: {
    height: 170,
    width: 24,
    borderRadius: 13,
    borderWidth: 1,
    justifyContent: "flex-end",
    overflow: "hidden",
  },
  chartFill: {
    position: "absolute",
    left: -1.5,
    right: -1.5,
    bottom: -1.5,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 14,
  },
  chartDay: { marginTop: 5, fontSize: 10, fontWeight: "700" },
  chartHint: { marginTop: 6, fontSize: 11 },
  recentItem: {
    borderWidth: 0,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  recentListWrap: {
    marginTop: 3,
  },
  recentItemDivider: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(120,120,120,0.18)",
  },
  recentBullet: {
    width: 8,
    height: 8,
    borderRadius: 999,
    backgroundColor: "rgba(90,180,140,0.55)",
    marginRight: 10,
    marginTop: 3,
  },
  recentTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  recentFooter: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  recentFooterValue: {
    fontSize: 20,
    fontWeight: "900",
  },
  recentFooterLabel: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: "700",
  },
  carouselSection: {
    marginTop: 8,
    flex: 1,
  },
  carouselTrack: {
    paddingRight: 4,
  },
  carouselPage: {
    paddingRight: 8,
    paddingBottom: 2,
  },
  stackedPage: {
    flex: 1,
    gap: 8,
  },
  stackedCardTop: {
    flex: 1.05,
  },
  stackedCardBottom: {
    flex: 0.95,
  },
  carouselDots: {
    marginTop: 3,
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  carouselDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});
