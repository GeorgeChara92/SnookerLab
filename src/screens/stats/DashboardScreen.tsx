import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LineChart } from "react-native-chart-kit";
import { useMatchesStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useNavigation } from "@react-navigation/native";
import { addDays, countStreak, dateKeyFrom, parseDateValue, startOfWeekMonday, toLocalDateKey } from "../../utils/date";

type SegmentKey = "overview" | "training" | "matches";

const SEGMENTS: { key: SegmentKey; label: string; description: string }[] = [
  { key: "overview", label: "Overview", description: "Your performance at a glance" },
  { key: "training", label: "Training", description: "Practice habits and routine progress" },
  { key: "matches", label: "Matches", description: "Competitive performance and results" },
];

const getWeekStart = (value: string) => startOfWeekMonday(parseDateValue(value));

const formatWeekLabel = (date: Date) => `${date.getDate()}/${date.getMonth() + 1}`;

const parseScoreToPercent = (
  rawScore: string,routine?: { max_score?: number; scoring_type?: string }
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
  // Step back by calendar days (not fixed milliseconds) so weeks stay aligned across clock changes.
  const thisWeek = startOfWeekMonday();
  const starts = Array.from({ length: weekCount }, (_, index) => addDays(thisWeek, -7 * (weekCount - 1 - index)));

  const countsByWeek = new Map<string, number>();
  starts.forEach((start) => countsByWeek.set(toLocalDateKey(start), 0));

  dates.forEach((dateValue) => {
    const start = toLocalDateKey(getWeekStart(dateValue));
    if (!countsByWeek.has(start)) return;
    countsByWeek.set(start, (countsByWeek.get(start) ?? 0) + 1);
  });

  return {
    labels: starts.map((start) => formatWeekLabel(start)),
    values: starts.map((start) => countsByWeek.get(toLocalDateKey(start)) ?? 0),
  };
};

type TrendDirection = "up" | "down" | "neutral";

interface TrendInfo {
  direction: TrendDirection;
  label: string;
  subLabel: string;
}

const formatTrend = (current: number, previous: number, isPercentage = false): TrendInfo => {
  if (previous === 0 && current === 0) {
    return { direction: "neutral", label: "No data", subLabel: "Start tracking" };
  }
  if (previous === 0 && current > 0) {
    return { direction: "up", label: "New", subLabel: "This period" };
  }

  const changePercent = ((current - previous) / previous) * 100;
  const direction: TrendDirection = changePercent > 5 ? "up" : changePercent < -5 ? "down" : "neutral";

  const arrow = direction === "up" ? "↑" : direction === "down" ? "↓" : "—";

  if (isPercentage) {
    // Percentages move in points. Saying a win rate is "up 50%" when it went from
    // 46% to 69% is the kind of stat that makes an app look like it is flattering you.
    const points = Math.abs(current - previous).toFixed(0);
    return {
      direction,
      label: `${arrow}${direction !== "neutral" ? points + " pts" : ""}`,
      subLabel: "vs last 4 weeks",
    };
  }

  const diff = current - previous;
  const prefix = diff > 0 ? "+" : "";
  return {
    direction,
    label: `${arrow}${direction !== "neutral" ? prefix + Math.abs(diff) : "—"}`,
    subLabel: "vs last 4 weeks",
  };
};

const getStreakInfo = (currentStreak: number, activeDays: number): { label: string; subLabel: string; progress: number } => {
  if (currentStreak >= 7) {
    return { label: `${currentStreak} days`, subLabel: "Week target complete!", progress: 100 };
  }
  if (currentStreak >= 3) {
    return { label: `${currentStreak} days`, subLabel: "Keep building momentum", progress: (currentStreak / 7) * 100 };
  }
  if (currentStreak > 0) {
    return { label: `${currentStreak} day${currentStreak > 1 ? "s" : ""}`, subLabel: "Good start", progress: (currentStreak / 7) * 100 };
  }
  if (activeDays > 0) {
    return { label: "0 days", subLabel: "Start your streak today", progress: 0 };
  }
  return { label: "—", subLabel: "Log your first session", progress: 0 };
};

const generateInsights = (analytics: {
  sessionsCount: number;
  currentStreak: number;
  winRate: number;
  matchesCount: number;
  averageNormalizedScore: number;
  weeklySessions: { values: number[] };
}): { title: string; message: string; action?: string; actionType?: "sessions" | "routines" | "practice" }[] => {
  const insights: { title: string; message: string; action?: string; actionType?: "sessions" | "routines" | "practice" }[] = [];

  const recent = analytics.weeklySessions.values.slice(-4);
  const older = analytics.weeklySessions.values.slice(0, 4);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

  if (avgRecent < avgOlder * 0.5 && avgOlder > 0) {
    insights.push({
      title: "Activity Dip",
      message: "Practice frequency dropped recently.",
      action: "Log a session",
      actionType: "sessions",
    });
  } else if (avgRecent > avgOlder * 1.3 && avgOlder > 0) {
    insights.push({
      title: "Great Momentum",
      message: "Practice frequency is increasing.",
      action: "Keep it up",
    });
  }

  if (analytics.currentStreak >= 3) {
    insights.push({
      title: `${analytics.currentStreak}-Day Streak`,
      message: "Consistency drives improvement.",
      action: "Don't break it",
    });
  } else if (analytics.currentStreak === 0 && analytics.sessionsCount > 0) {
    insights.push({
      title: "Streak Reset",
      message: "Start a new streak today.",
      action: "Practice now",
      actionType: "sessions",
    });
  }

  if (analytics.matchesCount >= 3) {
    if (analytics.winRate >= 60) {
      insights.push({
        title: "Strong Form",
        message: `${analytics.winRate.toFixed(0)}% win rate in matches.`,
      });
    } else if (analytics.winRate < 40) {
      insights.push({
        title: "Room to Improve",
        message: "Match results could be better.",
        action: "View routines",
        actionType: "routines",
      });
    }
  }

  if (analytics.averageNormalizedScore > 0 && analytics.averageNormalizedScore < 50) {
    insights.push({
      title: "Routine Focus",
      message: "Average scores could improve.",
      action: "Try easier routines",
      actionType: "routines",
    });
  }

  if (insights.length === 0) {
    if (analytics.sessionsCount === 0) {
      insights.push({
        title: "Welcome",
        message: "Start tracking your practice.",
        action: "View routines",
        actionType: "routines",
      });
    } else {
      insights.push({
        title: "On Track",
        message: "Keep logging sessions to unlock insights.",
      });
    }
  }

  return insights.slice(0, 2);
};

export const DashboardScreen = () => {
  const { logs } = useSessionsStore();
  const { matches } = useMatchesStore();
  const { entries } = useRoutineScoresStore();
  const { routines } = useRoutinesStore();
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<any>();

  const [activeSegment, setActiveSegment] = useState<SegmentKey>("overview");
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(16)).current;
  const heroScale = useRef(new Animated.Value(0.95)).current;
  const insightsOpacity = useRef(new Animated.Value(0)).current;
  const statsOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    contentOpacity.setValue(0);
    contentShift.setValue(16);
    heroScale.setValue(0.95);
    insightsOpacity.setValue(0);
    statsOpacity.setValue(0);

    Animated.stagger(60, [
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(insightsOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(statsOpacity, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeSegment, contentOpacity, contentShift, heroScale, insightsOpacity, statsOpacity]);

  const routineMap = useMemo(() => {
    const map = new Map<string, (typeof routines)[number]>();
    routines.forEach((routine) => map.set(routine.id, routine));
    return map;
  }, [routines]);

  const analytics = useMemo(() => {
    const activeDayKeys = new Set<string>();

    logs.forEach((log) => activeDayKeys.add(log.date));
    entries.forEach((entry) => activeDayKeys.add(dateKeyFrom(entry.recorded_at)));

    const now = new Date();
    const previousPeriodStart = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000);
    const currentPeriodStart = previousPeriodEnd;

    const previousPeriodLogs = logs.filter((log) => {
      const logDate = new Date(log.date);
      return logDate >= previousPeriodStart && logDate < previousPeriodEnd;
    });
    const currentPeriodLogs = logs.filter((log) => {
      const logDate = new Date(log.date);
      return logDate >= currentPeriodStart;
    });

    const previousPeriodMatches = matches.filter((match) => {
      const matchDate = new Date(match.date);
      return matchDate >= previousPeriodStart && matchDate < previousPeriodEnd;
    });
    const currentPeriodMatches = matches.filter((match) => {
      const matchDate = new Date(match.date);
      return matchDate >= currentPeriodStart;
    });

    const previousPeriodEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.recorded_at);
      return entryDate >= previousPeriodStart && entryDate < previousPeriodEnd;
    });
    const currentPeriodEntries = entries.filter((entry) => {
      const entryDate = new Date(entry.recorded_at);
      return entryDate >= currentPeriodStart;
    });

    const currentStreak = countStreak(activeDayKeys, now);

    const sessionDates = logs.map((log) => log.date);
    const matchDates = matches.map((match) => match.date);
    const weeklySessions = getWeeklySeries(sessionDates);
    const weeklyMatches = getWeeklySeries(matchDates);

    const wins = matches.filter((match) => match.result === "win").length;
    const losses = matches.filter((match) => match.result === "loss").length;
    const draws = matches.filter((match) => match.result === "draw").length;
    const winRate = matches.length ? (wins / matches.length) * 100 : 0;

    const previousWins = previousPeriodMatches.filter((m) => m.result === "win").length;
    const currentWins = currentPeriodMatches.filter((m) => m.result === "win").length;
    const previousWinRate = previousPeriodMatches.length > 0 ? (previousWins / previousPeriodMatches.length) * 100 : 0;
    const currentWinRate = currentPeriodMatches.length > 0 ? (currentWins / currentPeriodMatches.length) * 100 : 0;

    const previousScores: number[] = [];
    previousPeriodLogs.forEach((log) => {
      log.results.forEach((result) => {
        const parsed = parseScoreToPercent(result.score, routineMap.get(result.routine_id));
        if (parsed !== null) previousScores.push(parsed);
      });
    });
    previousPeriodEntries.forEach((entry) => {
      const parsed = parseScoreToPercent(entry.score, routineMap.get(entry.routine_id));
      if (parsed !== null) previousScores.push(parsed);
    });

    const currentScores: number[] = [];
    currentPeriodLogs.forEach((log) => {
      log.results.forEach((result) => {
        const parsed = parseScoreToPercent(result.score, routineMap.get(result.routine_id));
        if (parsed !== null) currentScores.push(parsed);
      });
    });
    currentPeriodEntries.forEach((entry) => {
      const parsed = parseScoreToPercent(entry.score, routineMap.get(entry.routine_id));
      if (parsed !== null) currentScores.push(parsed);
    });

    const previousAvgScore = previousScores.length > 0 ? previousScores.reduce((a, b) => a + b, 0) / previousScores.length : 0;
    const currentAvgScore = currentScores.length > 0 ? currentScores.reduce((a, b) => a + b, 0) / currentScores.length : 0;

    const sessionTrend = formatTrend(currentPeriodLogs.length, previousPeriodLogs.length);
    const matchTrend = formatTrend(currentPeriodMatches.length, previousPeriodMatches.length);
    const winRateTrend = formatTrend(currentWinRate, previousWinRate, true);
    const avgScoreTrend = formatTrend(currentAvgScore, previousAvgScore, true);

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

    const streakInfo = getStreakInfo(currentStreak, activeDayKeys.size);
    const insights = generateInsights({
      sessionsCount: logs.length,
      currentStreak,
      winRate,
      matchesCount: matches.length,
      averageNormalizedScore,
      weeklySessions,
    });

    return {
      sessionsCount: logs.length,
      activeDays: activeDayKeys.size,
      currentStreak,
      streakInfo,
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
      sessionTrend,
      matchTrend,
      winRateTrend,
      avgScoreTrend,
      insights,
    };
  }, [entries, logs, matches, routineMap]);

  const chartWidth = Math.max(300, width - 48);
  const chartConfig = {
    backgroundGradientFrom: colors.surface,
    backgroundGradientTo: colors.surface,
    color: (opacity = 1) => `rgba(15, 90, 67, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(90, 111, 104, ${opacity})`,
    decimalPlaces: 0,
    propsForDots: {
      r: "4",
      strokeWidth: "2",
      stroke: colors.primary,
    },
    propsForBackgroundLines: {
      stroke: colors.border,
      strokeDasharray: "2,4",
      strokeWidth: 0.5,
    },
  };

  const getTrendColor = (direction: TrendDirection) => {
    if (direction === "up") return colors.primary;
    if (direction === "down") return colors.danger;
    return colors.textMuted;
  };

  const handleInsightAction = (actionType?: "sessions" | "routines" | "practice") => {
    if (!actionType) return;
    if (actionType === "sessions") navigation.navigate("Sessions");
    else if (actionType === "routines" || actionType === "practice") navigation.navigate("Practice");
  };

  const renderHeroCard = () => {
    const { label, subLabel, progress } = analytics.streakInfo;
    const progressWidth = Math.max(0, Math.min(100, progress));

    return (
      <Animated.View style={[styles.heroCard, { backgroundColor: colors.primaryStrong, borderColor: colors.primaryStrong, transform: [{ scale: heroScale }] }]}>
        <View style={styles.heroTop}>
          <View style={styles.heroLeft}>
            <Text style={styles.heroLabel}>CURRENT STREAK</Text>
            <Text style={styles.heroValue}>{analytics.currentStreak}</Text>
            <Text style={styles.heroUnit}>days</Text>
          </View>
          <View style={styles.heroRight}>
            <Text style={styles.heroTargetLabel}>WEEK TARGET</Text>
            <Text style={styles.heroTarget}>{Math.min(analytics.currentStreak, 7)} / 7</Text>
          </View>
        </View>
        <View style={styles.heroProgressWrap}>
          <View style={[styles.heroProgressBar, { width: `${progressWidth}%` }]} />
        </View>
        <Text style={styles.heroSubLabel}>{subLabel}</Text>
      </Animated.View>
    );
  };

  const renderStatCard = (title: string, value: string, trend?: TrendInfo, highlight = false) => (
    <View style={[styles.statCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.statLabel, { color: colors.textMuted }]}>{title}</Text>
      <Text style={[styles.statNumber, { color: highlight ? colors.primary : colors.primary }]}>{value}</Text>
      {trend && (
        <View style={styles.statTrendRow}>
          <Text style={[styles.statTrendValue, { color: getTrendColor(trend.direction) }]}>{trend.label}</Text>
          {trend.subLabel && <Text style={[styles.statTrendSub, { color: colors.textMuted }]}>{trend.subLabel}</Text>}
        </View>
      )}
    </View>
  );

  const renderInsightCard = () => (
    <Animated.View style={[styles.insightCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.primary }, { opacity: insightsOpacity }]}>
      <View style={styles.insightHeader}>
        <MaterialCommunityIcons name="chart-box-outline" size={20} color={colors.primary} style={styles.insightIcon} />
        <Text style={[styles.insightTitle, { color: colors.text }]}>Performance Insight</Text>
      </View>
      {analytics.insights.map((insight, idx) => (
        <View key={idx} style={styles.insightRow}>
          <View style={styles.insightContent}>
            <Text style={[styles.insightTextTitle, { color: colors.text }]}>{insight.title}</Text>
            <Text style={[styles.insightText, { color: colors.textMuted }]}>{insight.message}</Text>
          </View>
          {insight.action && insight.actionType && (
            <Pressable
              style={({ pressed }) => [styles.insightAction, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={() => handleInsightAction(insight.actionType)}
            >
              <Text style={styles.insightActionText}>{insight.action}</Text>
            </Pressable>
          )}
          {insight.action && !insight.actionType && (
            <View style={[styles.insightAction, { backgroundColor: colors.primary }]}>
              <Text style={styles.insightActionText}>{insight.action}</Text>
            </View>
          )}
        </View>
      ))}
    </Animated.View>
  );

  const renderOverview = () => (
    <>
      {renderHeroCard()}

      <View style={styles.statGroupLabel}>
        <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Activity</Text>
      </View>
      <Animated.View style={[styles.statsGrid, { opacity: statsOpacity }]}>
        {renderStatCard("Sessions", String(analytics.sessionsCount), analytics.sessionTrend)}
        {renderStatCard("Matches", String(analytics.matchesCount), analytics.matchTrend)}
      </Animated.View>

      <View style={styles.statGroupLabel}>
        <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Performance</Text>
      </View>
      <Animated.View style={[styles.statsGrid, { opacity: statsOpacity }]}>
        {renderStatCard("Win Rate", `${analytics.winRate.toFixed(0)}%`, analytics.winRateTrend)}
        {renderStatCard("Avg Routine Score", `${analytics.averageNormalizedScore.toFixed(0)}%`, analytics.avgScoreTrend)}
      </Animated.View>

      {analytics.insights.length > 0 && renderInsightCard()}

      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Practice Activity</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>Last 8 weeks</Text>
          </View>
          <View style={styles.chartLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Sessions</Text>
          </View>
        </View>
        <LineChart
          width={chartWidth}
          height={180}
          withInnerLines={false}
          withOuterLines={false}
          bezier
          chartConfig={chartConfig}
          data={{ labels: analytics.weeklySessions.labels, datasets: [{ data: analytics.weeklySessions.values.length ? analytics.weeklySessions.values : [0, 0, 0, 0, 0, 0, 0, 0] }] }}
          style={styles.chart}
        />
      </View>

      <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.chartHeader}>
          <View>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Matches</Text>
            <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>Last 8 weeks</Text>
          </View>
          <View style={styles.chartLegend}>
            <View style={[styles.legendDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.legendText, { color: colors.textMuted }]}>Played</Text>
          </View>
        </View>
        <LineChart
          width={chartWidth}
          height={140}
          withInnerLines={false}
          withOuterLines={false}
          bezier
          chartConfig={chartConfig}
          data={{ labels: analytics.weeklyMatches.labels, datasets: [{ data: analytics.weeklyMatches.values.length ? analytics.weeklyMatches.values : [0, 0, 0, 0, 0, 0, 0, 0] }] }}
          style={styles.chart}
        />
      </View>
    </>
  );

  const renderTraining = () => {
    const hasData = analytics.sessionsCount > 0 || analytics.activeDays > 0 || analytics.topRoutines.length > 0;

    if (!hasData) {
      return (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No training data yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Log your first session to start tracking your progress.</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionGap}>
        <View style={styles.statGroupLabel}>
          <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Practice Summary</Text>
        </View>
        <View style={styles.statsGrid}>
          {renderStatCard("Sessions", String(analytics.sessionsCount))}
          {renderStatCard("Active Days", String(analytics.activeDays))}
          {renderStatCard("Streak", String(analytics.currentStreak))}
          {renderStatCard("Best Week", String(analytics.bestWeekSessions))}
        </View>

        <View style={styles.statGroupLabel}>
          <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Routine Scores</Text>
        </View>
        <View style={styles.statsGrid}>
          {renderStatCard("Avg Routine Score", `${analytics.averageNormalizedScore.toFixed(0)}%`, analytics.avgScoreTrend)}
        </View>

        {analytics.topRoutines.length > 0 && (
          <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Most Trained Routines</Text>
            {analytics.topRoutines.slice(0, 5).map((routine) => (
              <View key={routine.routineId} style={styles.rowItem}>
                <Text style={[styles.rowLabel, { color: colors.text }]} numberOfLines={1}>{routine.name}</Text>
                <Text style={[styles.rowValue, { color: colors.primary }]}>{routine.count} logs</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Training Frequency</Text>
              <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>Last 8 weeks</Text>
            </View>
          </View>
          <LineChart
            width={chartWidth}
            height={180}
            withInnerLines={false}
            withOuterLines={false}
            bezier
            chartConfig={chartConfig}
            data={{ labels: analytics.weeklySessions.labels, datasets: [{ data: analytics.weeklySessions.values.length ? analytics.weeklySessions.values : [0, 0, 0, 0, 0, 0, 0, 0] }] }}
            style={styles.chart}
          />
        </View>
      </View>
    );
  };

  const renderMatches = () => {
    const hasData = analytics.matchesCount > 0;

    if (!hasData) {
      return (
        <View style={[styles.emptyState, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches logged yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>Track your match results to see insights.</Text>
        </View>
      );
    }

    return (
      <View style={styles.sectionGap}>
        <View style={styles.statGroupLabel}>
          <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Record</Text>
        </View>
        <View style={styles.statsGrid}>
          {renderStatCard("Played", String(analytics.matchesCount))}
          {renderStatCard("Wins", String(analytics.wins))}
          {renderStatCard("Losses", String(analytics.losses))}
          {renderStatCard("Draws", String(analytics.draws))}
        </View>

        <View style={styles.statGroupLabel}>
          <Text style={[styles.groupLabelText, { color: colors.textMuted }]}>Performance</Text>
        </View>
        <View style={styles.statsGrid}>
          {renderStatCard("Win Rate", `${analytics.winRate.toFixed(0)}%`, analytics.winRateTrend)}
        </View>

        <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Match Insights</Text>
          <View style={styles.rowItem}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Recent Form</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{analytics.recentForm || "—"}</Text>
          </View>
          <View style={styles.rowItem}>
            <Text style={[styles.rowLabel, { color: colors.textMuted }]}>Toughest Opponent</Text>
            <Text style={[styles.rowValue, { color: colors.text }]}>{analytics.toughestOpponent ?? "—"}</Text>
          </View>
        </View>

        <View style={[styles.chartCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Match Activity</Text>
              <Text style={[styles.chartSubtitle, { color: colors.textMuted }]}>Last 8 weeks</Text>
            </View>
          </View>
          <LineChart
            width={chartWidth}
            height={150}
            withInnerLines={false}
            withOuterLines={false}
            bezier
            chartConfig={chartConfig}
            data={{ labels: analytics.weeklyMatches.labels, datasets: [{ data: analytics.weeklyMatches.values.length ? analytics.weeklyMatches.values : [0, 0, 0, 0, 0, 0, 0, 0] }] }}
            style={styles.chart}
          />
        </View>
      </View>
    );
  };

  const renderSegment = () => {
    if (activeSegment === "overview") return renderOverview();
    if (activeSegment === "training") return renderTraining();
    return renderMatches();
  };

  const activeSegmentData = SEGMENTS.find((s) => s.key === activeSegment);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>{activeSegmentData?.description ?? "Your performance at a glance"}</Text>

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
                  borderColor: selected ? colors.primary : "transparent",
                },
              ]}
            >
              <Text style={[styles.segmentLabel, { color: selected ? colors.primary : colors.textMuted, fontWeight: selected ? "700" : "500" }]}>{segment.label}</Text>
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
  content: { padding: 16, paddingBottom: 32 },
  title: { fontSize: 26, fontWeight: "800", letterSpacing: -0.3 },
  subtitle: { marginTop: 2, marginBottom: 16, fontSize: 13, opacity: 0.7, lineHeight: 18 },
  segmentWrap: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    flexDirection: "row",
    marginBottom: 20,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1.5,
  },
  segmentLabel: {
    fontSize: 13,
  },
  statGroupLabel: {
    marginTop: 16,
    marginBottom: 8,
  },
  groupLabelText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    borderWidth: 1,
    padding: 16,
    borderRadius: 14,
    width: "48%",
    alignItems: "flex-start",
  },
  statNumber: { fontSize: 32, fontWeight: "800", marginTop: 4 },
  statLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5, opacity: 0.8 },
  statTrendRow: { flexDirection: "row", alignItems: "center", marginTop: 6, gap: 4 },
  statTrendValue: { fontSize: 11, fontWeight: "700" },
  statTrendSub: { fontSize: 10 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 20,
    marginBottom: 8,
    overflow: "hidden",
  },
  heroTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  heroLeft: { flex: 1 },
  heroRight: { alignItems: "flex-end" },
  heroLabel: { color: "#BDE6D7", fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6 },
  heroValue: { color: "#FFFFFF", fontSize: 52, fontWeight: "800", letterSpacing: -1 },
  heroUnit: { color: "#BDE6D7", fontSize: 15, fontWeight: "600" },
  heroTargetLabel: { color: "#BDE6D7", fontSize: 10, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  heroTarget: { color: "#FFFFFF", fontSize: 20, fontWeight: "800", marginTop: 4 },
  heroProgressWrap: { marginTop: 16, height: 6, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 3 },
  heroProgressBar: { height: "100%", backgroundColor: "#FFFFFF", borderRadius: 3 },
  heroSubLabel: { color: "#BDE6D7", fontSize: 12, marginTop: 10, textAlign: "center" },
  insightCard: {
    borderWidth: 1.5,
    borderRadius: 14,
    padding: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  insightHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 8 },
  insightIcon: { fontSize: 16 },
  insightTitle: { fontSize: 13, fontWeight: "800", letterSpacing: 0.3 },
  insightRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10, gap: 12 },
  insightContent: { flex: 1 },
  insightTextTitle: { fontSize: 14, fontWeight: "700" },
  insightText: { fontSize: 12, marginTop: 2, lineHeight: 16 },
  insightAction: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  insightActionText: { color: "#FFFFFF", fontSize: 11, fontWeight: "700" },
  sectionGap: { gap: 12 },
  chartCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
  },
  chartHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "800" },
  chartSubtitle: { fontSize: 11, marginTop: 2, opacity: 0.7 },
  chartLegend: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 11 },
  chart: {
    marginLeft: -16,
    borderRadius: 8,
  },
  listCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  rowItem: {
    marginTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    textAlign: "right",
  },
  emptyState: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 32,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});