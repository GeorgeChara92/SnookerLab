import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useMatchesStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";

type SegmentKey = "overview" | "practice" | "routines" | "matches";

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "practice", label: "Practice" },
  { key: "routines", label: "Routines" },
  { key: "matches", label: "Matches" },
];

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const getWeekStart = (value: string) => {
  const date = new Date(value);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - diffToMonday);
  return date;
};

const formatWeekLabel = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

const parseScoreToPercent = (
  rawScore: string,
  routine?: { max_score?: number; scoring_type?: string }
): number | null => {
  const value = rawScore.trim();
  if (!value) return null;

  const percentMatch = value.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percentMatch) {
    const parsed = Number(percentMatch[1]);
    if (Number.isFinite(parsed)) return Math.max(0, Math.min(100, parsed));
  }

  const fractionMatch = value.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fractionMatch) {
    const numerator = Number(fractionMatch[1]);
    const denominator = Number(fractionMatch[2]);
    if (Number.isFinite(numerator) && Number.isFinite(denominator) && denominator > 0) {
      return Math.max(0, Math.min(100, (numerator / denominator) * 100));
    }
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  if (routine?.max_score && routine.max_score > 0) {
    return Math.max(0, Math.min(100, (numeric / routine.max_score) * 100));
  }

  if (routine?.scoring_type === "percentage") {
    return Math.max(0, Math.min(100, numeric));
  }

  return null;
};

const getWeeklySeries = (dates: string[], weekCount = 8) => {
  const starts = Array.from({ length: weekCount }, (_, index) => {
    const base = getWeekStart(new Date().toISOString());
    base.setTime(base.getTime() - (weekCount - 1 - index) * WEEK_MS);
    return base;
  });

  const countsByWeek = new Map<string, number>();
  starts.forEach((start) => countsByWeek.set(start.toISOString(), 0));

  dates.forEach((dateValue) => {
    const start = getWeekStart(dateValue).toISOString();
    if (!countsByWeek.has(start)) return;
    countsByWeek.set(start, (countsByWeek.get(start) ?? 0) + 1);
  });

  return {
    labels: starts.map((start) => formatWeekLabel(start)),
    values: starts.map((start) => countsByWeek.get(start.toISOString()) ?? 0),
  };
};

export const DashboardScreen = () => {
  const { logs } = useSessionsStore();
  const { matches } = useMatchesStore();
  const { entries } = useRoutineScoresStore();
  const { routines } = useRoutinesStore();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();

  const [activeSegment, setActiveSegment] = useState<SegmentKey>("overview");
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(8)).current;

  useEffect(() => {
    contentOpacity.setValue(0);
    contentShift.setValue(8);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 230,
        useNativeDriver: true,
      }),
      Animated.timing(contentShift, {
        toValue: 0,
        duration: 230,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeSegment, contentOpacity, contentShift]);

  const routineMap = useMemo(() => {
    const map = new Map<string, (typeof routines)[number]>();
    routines.forEach((routine) => map.set(routine.id, routine));
    return map;
  }, [routines]);

  const analytics = useMemo(() => {
    const activeDayKeys = new Set<string>();

    logs.forEach((log) => activeDayKeys.add(log.date));
    entries.forEach((entry) => activeDayKeys.add(entry.recorded_at.split("T")[0]));

    const now = new Date();
    let currentStreak = 0;
    const cursor = new Date(now);

    while (true) {
      const key = cursor.toISOString().split("T")[0];
      if (!activeDayKeys.has(key)) break;
      currentStreak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    const sessionDates = logs.map((log) => log.date);
    const matchDates = matches.map((match) => match.date);
    const weeklySessions = getWeeklySeries(sessionDates);
    const weeklyMatches = getWeeklySeries(matchDates);

    const wins = matches.filter((match) => match.result === "win").length;
    const losses = matches.filter((match) => match.result === "loss").length;
    const draws = matches.filter((match) => match.result === "draw").length;
    const winRate = matches.length ? (wins / matches.length) * 100 : 0;

    const routinePlays = new Map<string, number>();
    logs.forEach((log) => {
      log.results.forEach((result) => {
        routinePlays.set(result.routine_id, (routinePlays.get(result.routine_id) ?? 0) + 1);
      });
    });
    entries.forEach((entry) => {
      routinePlays.set(entry.routine_id, (routinePlays.get(entry.routine_id) ?? 0) + 1);
    });

    const topRoutines = Array.from(routinePlays.entries())
      .map(([routineId, count]) => ({
        routineId,
        count,
        name: routineMap.get(routineId)?.name ?? "Routine",
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

    const normalizedScores: number[] = [];
    logs.forEach((log) => {
      log.results.forEach((result) => {
        const parsed = parseScoreToPercent(result.score, routineMap.get(result.routine_id));
        if (parsed !== null) normalizedScores.push(parsed);
      });
    });
    entries.forEach((entry) => {
      const parsed = parseScoreToPercent(entry.score, routineMap.get(entry.routine_id));
      if (parsed !== null) normalizedScores.push(parsed);
    });

    const averageNormalizedScore = normalizedScores.length
      ? normalizedScores.reduce((sum, value) => sum + value, 0) / normalizedScores.length
      : 0;

    const opponentBalance = new Map<string, number>();
    matches.forEach((match) => {
      const delta = match.user_score - match.opponent_score;
      opponentBalance.set(match.opponent_name, (opponentBalance.get(match.opponent_name) ?? 0) + delta);
    });

    const toughestOpponent = Array.from(opponentBalance.entries())
      .sort((a, b) => a[1] - b[1])[0]?.[0];

    return {
      sessionsCount: logs.length,
      activeDays: activeDayKeys.size,
      currentStreak,
      averageNormalizedScore,
      matchesCount: matches.length,
      wins,
      losses,
      draws,
      winRate,
      weeklySessions,
      weeklyMatches,
      topRoutines,
      toughestOpponent,
      recentForm: matches.slice(0, 5).map((match) => match.result.toUpperCase()[0]).join(" "),
      bestWeekSessions: Math.max(...weeklySessions.values, 0),
    };
  }, [entries, logs, matches, routineMap]);

  const chartWidth = Math.max(300, width - 42);
  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `rgba(15, 90, 67, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(90, 111, 104, ${opacity})`,
    decimalPlaces: 0,
    propsForDots: {
      r: "3",
      strokeWidth: "1",
      stroke: colors.primary,
    },
  };

  const renderOverview = () => (
    <>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.sessionsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sessions Logged</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.currentStreak}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Current Streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.winRate.toFixed(0)}%</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Match Win Rate</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.averageNormalizedScore.toFixed(0)}%</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg Routine Score</Text>
        </View>
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Practice Activity (8 weeks)</Text>
        <LineChart
          width={chartWidth}
          height={210}
          withInnerLines={false}
          withOuterLines={false}
          bezier
          chartConfig={chartConfig}
          data={{ labels: analytics.weeklySessions.labels, datasets: [{ data: analytics.weeklySessions.values }] }}
          style={styles.chart}
        />
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Matches Logged (8 weeks)</Text>
        <LineChart
          width={chartWidth}
          height={210}
          withInnerLines={false}
          withOuterLines={false}
          chartConfig={chartConfig}
          data={{ labels: analytics.weeklyMatches.labels, datasets: [{ data: analytics.weeklyMatches.values }] }}
          style={styles.chart}
        />
      </View>
    </>
  );

  const renderPractice = () => (
    <View style={styles.sectionGap}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.sessionsCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Sessions</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.activeDays}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Active Days</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.currentStreak}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Streak</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.bestWeekSessions}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Best Week</Text>
        </View>
      </View>
    </View>
  );

  const renderRoutines = () => (
    <View style={styles.sectionGap}>
      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Most Trained Routines</Text>
        {analytics.topRoutines.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No routine activity logged yet.</Text>
        ) : (
          analytics.topRoutines.map((routine) => (
            <View key={routine.routineId} style={styles.rowItem}>
              <Text style={[styles.rowLabel, { color: colors.text }]}>{routine.name}</Text>
              <Text style={[styles.rowValue, { color: colors.primary }]}>{routine.count} logs</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );

  const renderMatches = () => (
    <View style={styles.sectionGap}>
      <View style={styles.statsGrid}>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.matchesCount}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Matches</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.wins}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Wins</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.losses}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Losses</Text>
        </View>
        <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.statNumber, { color: colors.primary }]}>{analytics.draws}</Text>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Draws</Text>
        </View>
      </View>

      <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Match Insights</Text>
        <View style={styles.rowItem}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Recent Form (last 5)</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{analytics.recentForm || "-"}</Text>
        </View>
        <View style={styles.rowItem}>
          <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Toughest Opponent</Text>
          <Text style={[styles.rowValue, { color: colors.text }]}>{analytics.toughestOpponent ?? "Not enough data"}</Text>
        </View>
      </View>
    </View>
  );

  const renderSegment = () => {
    if (activeSegment === "overview") return renderOverview();
    if (activeSegment === "practice") return renderPractice();
    if (activeSegment === "routines") return renderRoutines();
    return renderMatches();
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Your Statistics</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Modern tracking with trend charts and cleaner performance insights.</Text>

      <View style={[styles.segmentWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
        {SEGMENTS.map((segment) => {
          const selected = activeSegment === segment.key;
          return (
            <Pressable
              key={segment.key}
              onPress={() => setActiveSegment(segment.key)}
              style={[
                styles.segmentButton,
                {
                  backgroundColor: selected ? colors.surface : "transparent",
                  borderColor: selected ? colors.border : "transparent",
                },
              ]}
            >
              <Text style={[styles.segmentLabel, { color: selected ? colors.text : colors.textMuted }]}>{segment.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Animated.View style={{ opacity: contentOpacity, transform: [{ translateY: contentShift }] }}>{renderSegment()}</Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, marginBottom: 14, fontSize: 14, lineHeight: 20 },
  segmentWrap: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 4,
    flexDirection: "row",
    gap: 4,
    marginBottom: 14,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  statCard: {
    borderWidth: 1,
    padding: 20,
    borderRadius: 12,
    width: "48%",
    alignItems: "center",
  },
  statNumber: { fontSize: 32, fontWeight: "800" },
  statLabel: { fontSize: 14, marginTop: 4 },
  sectionGap: { gap: 12 },
  chartCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginTop: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 8,
  },
  chart: {
    marginLeft: -10,
    borderRadius: 8,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  rowItem: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
  },
  rowValue: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 13,
  },
});
