import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useMatchesStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { addDays, countStreak, dateKeyFrom, parseDateValue, startOfWeekMonday, toLocalDateKey } from "../../utils/date";
import { BoardPanel, ScoreStrip } from "../../components/scoreboard/Scoreboard";
import { FormStrip } from "../../components/matches/MatchRows";
import { BreaksPanel } from "../../components/matches/BreaksPanel";
import {
  countsAsResult,
  groupByOpponent,
  relativeDate,
  summariseMatches,
  byNewest,
} from "../../features/matches/matchSummary";
import { countByDay, lastDays, longestStreak, thisWeek } from "../../features/stats/activity";
import { WeekTrack } from "../../components/stats/WeekTrack";
import { RhythmBars } from "../../components/stats/RhythmBars";

type SegmentKey = "overview" | "training" | "matches";

const SEGMENTS: { key: SegmentKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "training", label: "Training" },
  { key: "matches", label: "Matches" },
];

/** A win rate over fewer matches than this is noise, so it waits. */
const MIN_FOR_WIN_RATE = 3;

const getWeekStart = (value: string) => startOfWeekMonday(parseDateValue(value));

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
  if (routine?.max_score && routine.max_score > 0)
    return Math.max(0, Math.min(100, (numeric / routine.max_score) * 100));
  if (routine?.scoring_type === "percentage") return Math.max(0, Math.min(100, numeric));
  return null;
};

const getWeeklySeries = (dates: string[], weekCount = 8) => {
  // Step back by calendar days (not fixed milliseconds) so weeks stay aligned across clock changes.
  const thisMonday = startOfWeekMonday();
  const starts = Array.from({ length: weekCount }, (_, index) => addDays(thisMonday, -7 * (weekCount - 1 - index)));

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
}

/**
 * Compares the last four weeks with the four before. When there is nothing in either it says so,
 * rather than printing "No data" under a number that is plainly data.
 */
const formatTrend = (current: number, previous: number, isPercentage = false): TrendInfo => {
  if (previous === 0 && current === 0) return { direction: "neutral", label: "None in the last 4 weeks" };
  if (previous === 0) return { direction: "up", label: "New in the last 4 weeks" };

  const changePercent = ((current - previous) / previous) * 100;
  const direction: TrendDirection = changePercent > 5 ? "up" : changePercent < -5 ? "down" : "neutral";

  if (direction === "neutral") return { direction, label: "Steady on the 4 weeks before" };

  if (isPercentage) {
    // Percentages move in points; "up 50%" for a move from 46% to 69% would flatter you.
    const points = Math.abs(current - previous).toFixed(0);
    return { direction, label: `${direction === "up" ? "Up" : "Down"} ${points} pts on the 4 weeks before` };
  }

  const diff = Math.abs(current - previous);
  return { direction, label: `${direction === "up" ? "Up" : "Down"} ${diff} on the 4 weeks before` };
};

type Insight = { title: string; message: string; action?: string; actionType?: "sessions" | "routines" | "practice" };

const generateInsights = (data: {
  sessionsCount: number;
  currentStreak: number;
  winRate: number;
  matchesCount: number;
  averageNormalizedScore: number;
  weeklySessions: { values: number[] };
}): Insight[] => {
  const insights: Insight[] = [];

  const recent = data.weeklySessions.values.slice(-4);
  const older = data.weeklySessions.values.slice(0, 4);
  const avgRecent = recent.reduce((a, b) => a + b, 0) / recent.length;
  const avgOlder = older.reduce((a, b) => a + b, 0) / older.length;

  if (avgRecent < avgOlder * 0.5 && avgOlder > 0) {
    insights.push({
      title: "Practice has dropped off",
      message: "You are logging about half as many sessions as a month ago.",
      action: "Log a session",
      actionType: "sessions",
    });
  } else if (avgRecent > avgOlder * 1.3 && avgOlder > 0) {
    insights.push({ title: "Practice is picking up", message: "More sessions this month than last. Keep the rhythm." });
  }

  if (data.currentStreak >= 3) {
    insights.push({ title: `${data.currentStreak} days in a row`, message: "Consistency is what moves the numbers." });
  } else if (data.currentStreak === 0 && data.sessionsCount > 0) {
    insights.push({
      title: "Start a new streak",
      message: "Nothing logged today yet. One routine is enough to start it.",
      action: "Practise now",
      actionType: "practice",
    });
  }

  if (data.matchesCount >= MIN_FOR_WIN_RATE && data.winRate < 40) {
    insights.push({
      title: "Results are behind practice",
      message: "Match play responds to pressure drills more than long sessions.",
      action: "See the challenges",
      actionType: "routines",
    });
  }

  if (data.averageNormalizedScore > 0 && data.averageNormalizedScore < 50) {
    insights.push({
      title: "Routine scores are low",
      message: "Drop a level for a week and build the scores back up.",
      action: "Browse routines",
      actionType: "routines",
    });
  }

  if (!insights.length && data.sessionsCount === 0) {
    insights.push({
      title: "Nothing logged yet",
      message: "Log a routine or a session and this page starts to fill in.",
      action: "Browse routines",
      actionType: "routines",
    });
  }

  return insights.slice(0, 3);
};

export const DashboardScreen = () => {
  const { logs } = useSessionsStore();
  const { matches } = useMatchesStore();
  const { entries } = useRoutineScoresStore();
  const { routines } = useRoutinesStore();
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  const [activeSegment, setActiveSegment] = useState<SegmentKey>("overview");
  const [railWidth, setRailWidth] = useState(0);
  const [rhythmWidth, setRhythmWidth] = useState(0);
  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    contentOpacity.setValue(0);
    contentShift.setValue(10);
    Animated.parallel([
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentShift, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
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
    // Practice days: session logs and routine scores. Matches are shown separately.
    const practiceDayKeys = [...logs.map((log) => log.date), ...entries.map((entry) => dateKeyFrom(entry.recorded_at))];
    const practiceCounts = countByDay(practiceDayKeys);
    const activeDayKeys = new Set(practiceDayKeys);

    const now = new Date();
    const previousPeriodStart = new Date(now.getTime() - 56 * 86_400_000);
    const currentPeriodStart = new Date(now.getTime() - 28 * 86_400_000);
    const inPrevious = (value: string) => {
      const date = new Date(value);
      return date >= previousPeriodStart && date < currentPeriodStart;
    };
    const inCurrent = (value: string) => new Date(value) >= currentPeriodStart;

    const scoresFor = (predicate: (value: string) => boolean) => {
      const scores: number[] = [];
      logs
        .filter((log) => predicate(log.date))
        .forEach((log) =>
          log.results.forEach((result) => {
            const parsed = parseScoreToPercent(result.score, routineMap.get(result.routine_id));
            if (parsed !== null) scores.push(parsed);
          })
        );
      entries
        .filter((entry) => predicate(entry.recorded_at))
        .forEach((entry) => {
          const parsed = parseScoreToPercent(entry.score, routineMap.get(entry.routine_id));
          if (parsed !== null) scores.push(parsed);
        });
      return scores;
    };
    const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0);

    const allScores = scoresFor(() => true);
    const record = summariseMatches(matches);
    const played = matches.filter(countsAsResult);
    const currentMatches = played.filter((match) => inCurrent(match.date));
    const previousMatches = played.filter((match) => inPrevious(match.date));
    const rate = (list: typeof matches) =>
      list.length ? (list.filter((match) => match.result === "win").length / list.length) * 100 : 0;

    const weeklySessions = getWeeklySeries(logs.map((log) => log.date));
    const weeklyMatches = getWeeklySeries(matches.map((match) => match.date));

    const routinePlays = new Map<string, number>();
    logs.forEach((log) =>
      log.results.forEach((result) =>
        routinePlays.set(result.routine_id, (routinePlays.get(result.routine_id) ?? 0) + 1)
      )
    );
    entries.forEach((entry) => routinePlays.set(entry.routine_id, (routinePlays.get(entry.routine_id) ?? 0) + 1));

    const topRoutines = Array.from(routinePlays.entries())
      .map(([routineId, count]) => ({ routineId, count, name: routineMap.get(routineId)?.name ?? "Routine" }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Compared in frames, so points from manual matches cannot swamp a live match's frames.
    const opponents = groupByOpponent(matches);
    const toughest = [...opponents]
      .filter((opponent) => opponent.framesWon < opponent.framesLost)
      .sort((a, b) => a.framesWon - a.framesLost - (b.framesWon - b.framesLost))[0];
    const bestRecord = [...opponents]
      .filter((opponent) => opponent.framesWon > opponent.framesLost)
      .sort((a, b) => b.framesWon - b.framesLost - (a.framesWon - a.framesLost))[0];

    const currentStreak = countStreak(activeDayKeys, now);
    const averageNormalizedScore = average(allScores);

    return {
      practiceCounts,
      sessionsCount: logs.length,
      currentPeriodSessions: logs.filter((log) => inCurrent(log.date)).length,
      activeDays: activeDayKeys.size,
      activeDaysLast4Weeks: Array.from(activeDayKeys).filter((key) => inCurrent(key)).length,
      currentStreak,
      bestStreak: longestStreak(activeDayKeys),
      averageNormalizedScore,
      record,
      lastMatch: [...matches].sort(byNewest)[0]?.date,
      currentPeriodMatches: currentMatches.length,
      weeklySessions,
      weeklyMatches,
      topRoutines,
      toughest,
      bestRecord,
      bestWeekSessions: Math.max(...weeklySessions.values, 0),
      sessionTrend: formatTrend(
        logs.filter((log) => inCurrent(log.date)).length,
        logs.filter((log) => inPrevious(log.date)).length
      ),
      matchTrend: formatTrend(currentMatches.length, previousMatches.length),
      winRateTrend: formatTrend(rate(currentMatches), rate(previousMatches), true),
      avgScoreTrend: formatTrend(average(scoresFor(inCurrent)), average(scoresFor(inPrevious)), true),
      insights: generateInsights({
        sessionsCount: logs.length,
        currentStreak,
        winRate: record.winRate,
        matchesCount: record.played,
        averageNormalizedScore,
        weeklySessions,
      }),
    };
  }, [entries, logs, matches, routineMap]);

  const trendColour = (direction: TrendDirection) =>
    direction === "up" ? colors.primary : direction === "down" ? colors.danger : colors.textMuted;

  const handleInsightAction = (actionType?: Insight["actionType"]) => {
    if (actionType === "sessions")
      navigation.navigate("Practice", { screen: "RoutineCategories", params: { tab: "sessions" } });
    else if (actionType) navigation.navigate("Practice");
  };

  // ------------------------------------------------------------------ pieces

  const Tile = ({
    label,
    value,
    note,
    noteColour,
  }: {
    label: string;
    value: string;
    note?: string;
    noteColour?: string;
  }) => (
    <View style={[styles.tile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.tileLabel, { color: colors.textMuted }]}>{label.toUpperCase()}</Text>
      <Text style={[styles.tileValue, { color: colors.text }]}>{value}</Text>
      {note ? (
        <Text style={[styles.tileNote, { color: noteColour ?? colors.textMuted }]} numberOfLines={2}>
          {note}
        </Text>
      ) : null}
    </View>
  );

  /** This week as seven squares, with the streak above it. */
  const renderWeek = () => {
    const week = thisWeek(analytics.practiceCounts);
    const activeThisWeek = week.filter((day) => day.count > 0).length;

    const line =
      activeThisWeek === 7
        ? "Every day this week. That is a perfect week."
        : analytics.currentStreak >= 2
          ? `${analytics.currentStreak} days running. Practise tomorrow to keep it.`
          : analytics.currentStreak === 1
            ? "Practised today. Come back tomorrow to make it a streak."
            : analytics.activeDays
              ? "Nothing logged today yet. One routine starts a new streak."
              : "Log a routine or a session and your week fills in here.";

    return (
      <BoardPanel kicker="THIS WEEK" aside={analytics.bestStreak ? `BEST RUN ${analytics.bestStreak}` : undefined}>
        <View style={styles.weekTop}>
          <View>
            <Text style={[styles.streakValue, { color: colors.boardText }]}>{analytics.currentStreak}</Text>
            <Text style={[styles.streakLabel, { color: colors.boardMuted }]}>DAY STREAK</Text>
          </View>
          <View style={styles.weekCount}>
            <Text style={[styles.weekCountValue, { color: colors.boardText }]}>
              {activeThisWeek}
              <Text style={{ color: colors.boardMuted }}>/7</Text>
            </Text>
            <Text style={[styles.streakLabel, { color: colors.boardMuted }]}>DAYS THIS WEEK</Text>
          </View>
        </View>

        <View style={styles.railWrap} onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}>
          {railWidth ? <WeekTrack days={week} width={railWidth} /> : null}
        </View>

        <Text style={[styles.weekLine, { color: colors.boardMuted }]}>{line}</Text>
      </BoardPanel>
    );
  };

  /** Four weeks of practice, a bar a day, taller on busier days. */
  const renderCalendar = () => {
    const days = lastDays(analytics.practiceCounts, 28);
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Practice rhythm</Text>
          <Text style={[styles.cardAside, { color: colors.textMuted }]}>
            {analytics.activeDaysLast4Weeks} active {analytics.activeDaysLast4Weeks === 1 ? "day" : "days"} in 4 weeks
          </Text>
        </View>
        <View onLayout={(event) => setRhythmWidth(event.nativeEvent.layout.width)}>
          {rhythmWidth ? <RhythmBars days={days} width={rhythmWidth} /> : null}
        </View>
      </View>
    );
  };

  /** Eight weekly bars. When every week is empty, one honest sentence instead of a flat line. */
  const renderBars = (title: string, series: { labels: string[]; values: number[] }, emptyLine: string) => {
    const max = Math.max(1, ...series.values);
    const total = series.values.reduce((a, b) => a + b, 0);

    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.cardAside, { color: colors.textMuted }]}>{total} in 8 weeks</Text>
        </View>

        {total === 0 ? (
          <Text style={[styles.emptyLine, { color: colors.textMuted }]}>{emptyLine}</Text>
        ) : (
          <View style={styles.bars}>
            {series.values.map((value, index) => (
              <View key={series.labels[index]} style={styles.barColumn}>
                <Text style={[styles.barValue, { color: value ? colors.text : "transparent" }]}>{value}</Text>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${Math.max(value ? 8 : 0, (value / max) * 100)}%`,
                        backgroundColor: index === series.values.length - 1 ? colors.primary : `${colors.primary}99`,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: colors.textSubtle }]}>{series.labels[index]}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  const renderInsights = () =>
    analytics.insights.length ? (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Worth knowing</Text>
        {analytics.insights.map((insight, index) => (
          <View
            key={insight.title}
            style={[styles.insight, index > 0 ? { borderTopWidth: 1, borderTopColor: colors.border } : null]}
          >
            <View style={[styles.insightDot, { backgroundColor: colors.primary }]} />
            <View style={styles.insightBody}>
              <Text style={[styles.insightTitle, { color: colors.text }]}>{insight.title}</Text>
              <Text style={[styles.insightMessage, { color: colors.textMuted }]}>{insight.message}</Text>
              {insight.action && insight.actionType ? (
                <Pressable
                  onPress={() => handleInsightAction(insight.actionType)}
                  accessibilityRole="button"
                  accessibilityLabel={insight.action}
                  hitSlop={8}
                  style={styles.insightAction}
                >
                  <Text style={[styles.insightActionText, { color: colors.primary }]}>{insight.action}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primary} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ))}
      </View>
    ) : null;

  const winRateTile = () =>
    analytics.record.played >= MIN_FOR_WIN_RATE ? (
      <Tile
        label="Win rate"
        value={`${analytics.record.winRate}%`}
        note={analytics.winRateTrend.label}
        noteColour={trendColour(analytics.winRateTrend.direction)}
      />
    ) : (
      <Tile
        label="Win rate"
        value="–"
        note={`Shows after ${MIN_FOR_WIN_RATE} matches. ${analytics.record.played} so far.`}
      />
    );

  // ------------------------------------------------------------------ tabs

  const renderOverview = () => (
    <>
      {renderWeek()}
      {renderCalendar()}

      <View style={styles.grid}>
        <Tile
          label="Sessions"
          value={`${analytics.currentPeriodSessions}`}
          note={analytics.sessionTrend.label}
          noteColour={trendColour(analytics.sessionTrend.direction)}
        />
        <Tile
          label="Matches"
          value={`${analytics.record.played}`}
          note={
            analytics.lastMatch ? `Last one ${relativeDate(analytics.lastMatch).toLowerCase()}` : "None recorded yet"
          }
        />
      </View>
      <View style={styles.grid}>
        {winRateTile()}
        <Tile
          label="Routine average"
          value={analytics.averageNormalizedScore ? `${analytics.averageNormalizedScore.toFixed(0)}%` : "–"}
          note={analytics.averageNormalizedScore ? analytics.avgScoreTrend.label : "Score a routine to see it"}
          noteColour={analytics.averageNormalizedScore ? trendColour(analytics.avgScoreTrend.direction) : undefined}
        />
      </View>

      {renderInsights()}
    </>
  );

  const renderTraining = () => {
    if (!analytics.activeDays && !analytics.sessionsCount) {
      return (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="target" size={28} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No practice logged yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Score a routine or finish a session and your training history builds here.
          </Text>
        </View>
      );
    }

    const most = analytics.topRoutines[0]?.count ?? 1;

    return (
      <>
        <View style={styles.grid}>
          <Tile label="Sessions" value={`${analytics.sessionsCount}`} note="All time" />
          <Tile label="Active days" value={`${analytics.activeDays}`} note="All time" />
        </View>
        <View style={styles.grid}>
          <Tile
            label="Best run"
            value={`${analytics.bestStreak}`}
            note={analytics.bestStreak === 1 ? "day" : "days in a row"}
          />
          <Tile
            label="Routine average"
            value={analytics.averageNormalizedScore ? `${analytics.averageNormalizedScore.toFixed(0)}%` : "–"}
            note={analytics.averageNormalizedScore ? analytics.avgScoreTrend.label : "Score a routine to see it"}
            noteColour={analytics.averageNormalizedScore ? trendColour(analytics.avgScoreTrend.direction) : undefined}
          />
        </View>

        {renderCalendar()}
        {renderBars(
          "Sessions per week",
          analytics.weeklySessions,
          "No sessions in the last 8 weeks. Start one from the Sessions tab."
        )}

        {analytics.topRoutines.length ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Most practised</Text>
            {analytics.topRoutines.map((routine, index) => (
              <View key={routine.routineId} style={styles.rankRow}>
                <Text style={[styles.rank, { color: index === 0 ? colors.primary : colors.textSubtle }]}>
                  {index + 1}
                </Text>
                <View style={styles.rankBody}>
                  <View style={styles.rankLine}>
                    <Text style={[styles.rankName, { color: colors.text }]} numberOfLines={1}>
                      {routine.name}
                    </Text>
                    <Text style={[styles.rankCount, { color: colors.textMuted }]}>{routine.count}</Text>
                  </View>
                  <View style={[styles.rankTrack, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={[
                        styles.rankFill,
                        {
                          width: `${(routine.count / most) * 100}%`,
                          backgroundColor: index === 0 ? colors.primary : `${colors.primary}99`,
                        },
                      ]}
                    />
                  </View>
                </View>
              </View>
            ))}
          </View>
        ) : null}
      </>
    );
  };

  const renderMatches = () => {
    const { record } = analytics;

    if (!record.played) {
      return (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="scoreboard-outline" size={28} color={colors.primary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No matches recorded yet</Text>
          <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
            Score a match live or enter a result from the Matches tab, and your record builds here.
          </Text>
        </View>
      );
    }

    return (
      <>
        <BoardPanel kicker="CAREER" aside={record.played >= MIN_FOR_WIN_RATE ? `${record.winRate}% WON` : undefined}>
          <ScoreStrip
            size="hero"
            left={{ name: "Won", score: record.wins, leading: record.wins >= record.losses && record.wins > 0 }}
            right={{ name: "Lost", score: record.losses, leading: record.losses > record.wins }}
            middle={`(${record.played})`}
            style={styles.boardStrip}
          />
          <View style={[styles.boardFoot, { borderTopColor: colors.boardRaised }]}>
            <View style={styles.boardCell}>
              <Text style={[styles.boardLabel, { color: colors.boardMuted }]}>FRAMES</Text>
              <Text style={[styles.boardValue, { color: colors.boardText }]}>
                {record.framesWon}–{record.framesLost}
              </Text>
            </View>
            <View style={styles.boardCell}>
              <Text style={[styles.boardLabel, { color: colors.boardMuted }]}>DRAWN</Text>
              <Text style={[styles.boardValue, { color: colors.boardText }]}>{record.draws}</Text>
            </View>
            <View style={[styles.boardCell, styles.boardForm]}>
              <Text style={[styles.boardLabel, { color: colors.boardMuted }]}>FORM</Text>
              <FormStrip form={record.form} size={22} />
            </View>
          </View>
        </BoardPanel>

        <BreaksPanel />

        <View style={styles.grid}>
          {winRateTile()}
          <Tile
            label="Last 4 weeks"
            value={`${analytics.currentPeriodMatches}`}
            note={analytics.matchTrend.label}
            noteColour={trendColour(analytics.matchTrend.direction)}
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Head to heads</Text>
          <View style={styles.rivalRow}>
            <MaterialCommunityIcons name="arrow-up-bold" size={18} color={colors.primary} />
            <Text style={[styles.rivalLabel, { color: colors.textMuted }]}>Best record</Text>
            <Text style={[styles.rivalValue, { color: colors.text }]} numberOfLines={1}>
              {analytics.bestRecord
                ? `${analytics.bestRecord.name}  ${analytics.bestRecord.framesWon}–${analytics.bestRecord.framesLost}`
                : "–"}
            </Text>
          </View>
          <View style={[styles.rivalRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
            <MaterialCommunityIcons name="arrow-down-bold" size={18} color={colors.danger} />
            <Text style={[styles.rivalLabel, { color: colors.textMuted }]}>Toughest</Text>
            <Text style={[styles.rivalValue, { color: colors.text }]} numberOfLines={1}>
              {analytics.toughest
                ? `${analytics.toughest.name}  ${analytics.toughest.framesWon}–${analytics.toughest.framesLost}`
                : "Nobody has the better of you yet"}
            </Text>
          </View>
        </View>

        {renderBars(
          "Matches per week",
          analytics.weeklyMatches,
          analytics.lastMatch
            ? `No matches in the last 8 weeks. Your last was ${relativeDate(analytics.lastMatch).toLowerCase()}.`
            : "No matches yet."
        )}
      </>
    );
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {SEGMENTS.map((segment) => {
          const selected = activeSegment === segment.key;
          return (
            <Pressable
              key={segment.key}
              onPress={() => setActiveSegment(segment.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={styles.tab}
            >
              <Text style={[styles.tabLabel, { color: selected ? colors.text : colors.textMuted }]}>
                {segment.label.toUpperCase()}
              </Text>
              <View style={[styles.tabUnderline, { backgroundColor: selected ? colors.boardRule : "transparent" }]} />
            </Pressable>
          );
        })}
      </View>

      <Animated.View style={[styles.body, { opacity: contentOpacity, transform: [{ translateY: contentShift }] }]}>
        {activeSegment === "overview"
          ? renderOverview()
          : activeSegment === "training"
            ? renderTraining()
            : renderMatches()}
      </Animated.View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  railWrap: { marginTop: SPACING.md },
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  body: { gap: SPACING.md },

  tabs: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: SPACING.lg,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    minHeight: HIT_TARGET,
    justifyContent: "flex-end",
  },
  tabLabel: { fontFamily: FONTS.board, fontSize: 16, letterSpacing: 1.6, marginBottom: SPACING.sm },
  tabUnderline: { height: 3, width: "60%", borderRadius: 2 },

  weekTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  streakValue: { fontFamily: FONTS.boardHeavy, fontSize: 64, lineHeight: 68, fontVariant: ["tabular-nums"] },
  streakLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.6 },
  weekCount: { alignItems: "flex-end" },
  weekCountValue: { fontFamily: FONTS.board, fontSize: 34, fontVariant: ["tabular-nums"] },
  weekLine: { fontSize: 13, fontWeight: "600", lineHeight: 18, marginTop: SPACING.md },

  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
  },
  cardHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: SPACING.md },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  cardAside: { fontSize: 12, fontWeight: "600" },

  grid: { flexDirection: "row", gap: SPACING.md },
  tile: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    minHeight: 118,
  },
  tileLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.4 },
  tileValue: { fontFamily: FONTS.board, fontSize: 40, lineHeight: 46, fontVariant: ["tabular-nums"], marginTop: 2 },
  tileNote: { fontSize: 12, fontWeight: "600", lineHeight: 16, marginTop: 2 },

  bars: { flexDirection: "row", alignItems: "flex-end", gap: 6, height: 140 },
  barColumn: { flex: 1, alignItems: "center", gap: 4, height: "100%" },
  barValue: { fontFamily: FONTS.board, fontSize: 13 },
  barTrack: { flex: 1, width: "100%", borderRadius: 6, justifyContent: "flex-end", overflow: "hidden" },
  barFill: { width: "100%", borderRadius: 6 },
  barLabel: { fontFamily: FONTS.boardLabel, fontSize: 11 },
  emptyLine: { fontSize: 14, lineHeight: 20 },

  insight: { flexDirection: "row", gap: SPACING.md, paddingVertical: SPACING.md },
  insightDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  insightBody: { flex: 1 },
  insightTitle: { fontSize: 15, fontWeight: "700" },
  insightMessage: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  insightAction: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: SPACING.sm, alignSelf: "flex-start" },
  insightActionText: { fontSize: 13, fontWeight: "700" },

  rankRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: SPACING.md },
  rank: { fontFamily: FONTS.board, fontSize: 22, width: 18, textAlign: "center" },
  rankBody: { flex: 1, gap: 6 },
  rankLine: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.sm },
  rankName: { flex: 1, fontSize: 14, fontWeight: "700" },
  rankCount: { fontFamily: FONTS.board, fontSize: 15 },
  rankTrack: { height: 5, borderRadius: 3, overflow: "hidden" },
  rankFill: { height: "100%", borderRadius: 3 },

  boardStrip: { borderTopWidth: 0, borderBottomWidth: 0 },
  boardFoot: { flexDirection: "row", borderTopWidth: 1, marginTop: SPACING.md, paddingTop: SPACING.md },
  boardCell: { flex: 1, gap: 4 },
  boardForm: { flex: 1.4, alignItems: "flex-end" },
  boardLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.6 },
  boardValue: { fontFamily: FONTS.board, fontSize: 22, fontVariant: ["tabular-nums"] },

  rivalRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 48 },
  rivalLabel: { width: 84, fontSize: 13, fontWeight: "600" },
  rivalValue: { flex: 1, textAlign: "right", fontFamily: FONTS.board, fontSize: 18, letterSpacing: 0.4 },

  emptyCard: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { fontSize: 17, fontWeight: "800" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
