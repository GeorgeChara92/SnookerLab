import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useMatchesStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { useTourNewsStore } from "../../store/tourNewsStore";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  addDays,
  countStreak,
  dateKeyFrom,
  parseDateKey,
  startOfWeekMonday,
  toLocalDateKey,
  todayKey,
} from "../../utils/date";
import { countByDay, lastDays, thisWeek } from "../../features/stats/activity";
import { byNewest, countsAsResult, relativeDate, summariseMatches } from "../../features/matches/matchSummary";
import { bestOfFor } from "../../features/matches/bestOf";
import { WeekTrack } from "../../components/stats/WeekTrack";
import { RhythmBars } from "../../components/stats/RhythmBars";
import { ScoreStrip } from "../../components/scoreboard/Scoreboard";
import { FormStrip } from "../../components/matches/MatchRows";
import { NewsRow } from "../../components/tour/NewsRow";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const DAY_MS = 86_400_000;

const PAGES = [
  { key: "week", label: "This week" },
  { key: "next", label: "Next up" },
  { key: "recent", label: "Recent" },
  { key: "tour", label: "Pro tour" },
] as const;
type PageKey = (typeof PAGES)[number]["key"];

/** Row heights, to work out how many rows a page has room for. */
const ROW = { next: 64, recent: 56, tour: 80 };

/** The pages' height from which This week also shows the last four weeks. */
const RHYTHM_FROM = 360;

const daysAgo = (key: string) =>
  Math.max(0, Math.round((parseDateKey(todayKey()).getTime() - parseDateKey(key).getTime()) / DAY_MS));

/**
 * Home, on one screen: what to practise next, the numbers that matter at a glance (streak, this
 * week, recent form), and four pages to swipe between - the week on the rail with the last
 * match, what to practise next, what was done lately, and news from the pro tour. The pages
 * fill whatever height the phone leaves, showing as many rows as fit, so nothing scrolls down.
 */
export const DashboardHomeScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { templates, logs } = useSessionsStore();
  const { entries } = useRoutineScoresStore();
  const { routines, categories } = useRoutinesStore();
  const matches = useMatchesStore((state) => state.matches);
  const news = useTourNewsStore((state) => state.items);
  const refreshNews = useTourNewsStore((state) => state.refresh);

  const [pager, setPager] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const [rhythmWidth, setRhythmWidth] = useState(0);
  const listRef = useRef<FlatList>(null);

  // News is checked on opening and whenever the app comes back to the front (at most every
  // 15 minutes; the store decides).
  useEffect(() => {
    void refreshNews();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refreshNews();
    });
    return () => subscription.remove();
  }, [refreshNews]);

  const template = templates[0];
  const templateMinutes = useMemo(
    () =>
      template
        ? template.routine_ids.reduce(
            (sum, id) => sum + (routines.find((routine) => routine.id === id)?.estimated_duration_minutes ?? 0),
            0
          )
        : 0,
    [routines, template]
  );

  const home = useMemo(() => {
    const practiceKeys = [
      ...logs.map((log) => dateKeyFrom(log.date)),
      ...entries.map((entry) => dateKeyFrom(entry.recorded_at)),
    ];
    const counts = countByDay([
      ...logs.flatMap((log) => log.results.map(() => dateKeyFrom(log.date))),
      ...entries.map((entry) => dateKeyFrom(entry.recorded_at)),
    ]);
    const active = new Set(practiceKeys);
    const week = thisWeek(counts);
    const month = lastDays(counts, 28);
    const lastMonday = addDays(startOfWeekMonday(), -7);
    const lastWeekDays = Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(lastMonday, index))).filter(
      (key) => active.has(key)
    ).length;
    const weekDays = week.filter((day) => day.count > 0).length;
    const weekLogged = week.reduce((sum, day) => sum + day.count, 0);

    // When each routine was last played, to suggest the ones left longest.
    const lastPlayed = new Map<string, string>();
    const note = (routineId: string, key: string) => {
      const known = lastPlayed.get(routineId);
      if (!known || key > known) lastPlayed.set(routineId, key);
    };
    logs.forEach((log) => log.results.forEach((result) => note(result.routine_id, dateKeyFrom(log.date))));
    entries.forEach((entry) => note(entry.routine_id, dateKeyFrom(entry.recorded_at)));

    const scoreable = routines.filter((routine) => routine.content_type !== "guide");
    const slipping = weekDays < lastWeekDays || weekDays <= 1;
    const foundations = categories.find((category) => /foundation|fundamental/i.test(category.name));
    const byStaleness = [...scoreable].sort((a, b) => {
      const [x, y] = [lastPlayed.get(a.id), lastPlayed.get(b.id)];
      if (!x && !y) return a.name.localeCompare(b.name);
      if (!x) return -1;
      if (!y) return 1;
      return x.localeCompare(y);
    });
    const ordered =
      slipping && foundations
        ? [
            ...byStaleness.filter((routine) => routine.category_id === foundations.id),
            ...byStaleness.filter((routine) => routine.category_id !== foundations.id),
          ]
        : byStaleness;
    const next = ordered.slice(0, 6).map((routine) => {
      const last = lastPlayed.get(routine.id);
      return {
        id: routine.id,
        name: routine.name,
        category: categories.find((category) => category.id === routine.category_id)?.name ?? "Practice",
        note: !last ? "Not played yet" : daysAgo(last) === 0 ? "Played today" : `${daysAgo(last)}d since you played it`,
      };
    });

    // Routines and matches together, newest first, one line each.
    const recentRoutines = [
      ...logs.flatMap((log) =>
        log.results.map((result) => ({ id: result.routine_id, at: log.recorded_at ?? log.date }))
      ),
      ...entries.map((entry) => ({ id: entry.routine_id, at: entry.recorded_at, score: entry.score })),
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .filter((item, index, list) => list.findIndex((other) => other.id === item.id) === index)
      .slice(0, 8)
      .map((item) => ({
        kind: "routine" as const,
        key: `r-${item.id}`,
        id: item.id,
        at: item.at,
        title: scoreable.find((routine) => routine.id === item.id)?.name ?? "Routine",
        detail: "score" in item && item.score ? `Scored ${item.score}` : "Practised",
      }));
    const played = [...matches].filter(countsAsResult).sort(byNewest);
    const recentMatches = played.slice(0, 8).map((match) => ({
      kind: "match" as const,
      key: `m-${match.id}`,
      id: match.id,
      at: match.date,
      title: `${match.user_score > match.opponent_score ? "Beat" : match.user_score < match.opponent_score ? "Lost to" : "Drew with"} ${match.opponent_name}`,
      detail: `${match.user_score}–${match.opponent_score}`,
    }));
    const recent = [...recentRoutines, ...recentMatches].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);

    return {
      week,
      month,
      weekDays,
      weekLogged,
      lastWeekDays,
      streak: countStreak(active),
      form: summariseMatches(matches).form,
      lastMatch: played[0] ?? null,
      next,
      slipping: Boolean(slipping && foundations),
      recent,
    };
  }, [categories, entries, logs, matches, routines]);

  const startSession = () => {
    if (template) navigation.navigate("Practice", { screen: "ActiveSession", params: { templateId: template.id } });
    else navigation.navigate("Practice", { screen: "RoutineCategories", params: { tab: "sessions" } });
  };
  const openRoutine = (routineId: string) =>
    navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId }, initial: false });
  const openMatch = (matchId: string) =>
    navigation.navigate("Matches", { screen: "MatchDetail", params: { matchId }, initial: false });

  const goTo = (index: number) => {
    setPage(index);
    listRef.current?.scrollToOffset({ offset: index * pager.width, animated: true });
  };

  const fit = (rowHeight: number, reserved = 0) =>
    Math.max(2, Math.floor((pager.height - reserved + SPACING.sm) / (rowHeight + SPACING.sm)));

  const weekDelta = home.weekDays - home.lastWeekDays;

  // ------------------------------------------------------------------ pages

  const weekPage = () => {
    const bestOf = home.lastMatch ? bestOfFor(home.lastMatch) : undefined;
    return (
      <View style={styles.pageGap}>
        <View style={[styles.board, { backgroundColor: colors.board, borderColor: colors.boardRaised }]}>
          <View style={styles.boardHead}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
              {home.weekLogged} LOGGED THIS WEEK
            </Text>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardMuted }]}>
              {weekDelta === 0 ? "SAME AS LAST WEEK" : `${weekDelta > 0 ? "+" : ""}${weekDelta} ON LAST WEEK`}
            </Text>
          </View>
          <View onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}>
            {railWidth ? <WeekTrack days={home.week} width={railWidth} /> : null}
          </View>
        </View>
        {home.lastMatch ? (
          <Pressable
            onPress={() => openMatch(home.lastMatch!.id)}
            accessibilityRole="button"
            accessibilityLabel={`Last match against ${home.lastMatch.opponent_name}. Open it.`}
          >
            <Text style={[styles.label, { color: colors.textMuted }]}>
              LAST MATCH · {relativeDate(home.lastMatch.date).toUpperCase()}
            </Text>
            <ScoreStrip
              left={{
                name: "You",
                score: home.lastMatch.user_score,
                leading: home.lastMatch.user_score > home.lastMatch.opponent_score,
              }}
              right={{
                name: home.lastMatch.opponent_name,
                score: home.lastMatch.opponent_score,
                leading: home.lastMatch.opponent_score > home.lastMatch.user_score,
              }}
              middle={bestOf ? `(${bestOf})` : "V"}
            />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => navigation.navigate("Matches", { screen: "NewMatch", initial: false })}
            accessibilityRole="button"
            style={[styles.prompt, { borderColor: colors.border }]}
          >
            <MaterialCommunityIcons name="trophy-outline" size={20} color={colors.primary} />
            <Text style={[styles.promptText, { color: colors.text }]}>Record your first match</Text>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        {/* On a taller phone there is room for the last four weeks too. */}
        {pager.height >= RHYTHM_FROM ? (
          <View style={[styles.rhythm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>LAST 4 WEEKS</Text>
            <View onLayout={(event) => setRhythmWidth(event.nativeEvent.layout.width)}>
              {rhythmWidth ? <RhythmBars days={home.month} width={rhythmWidth} /> : null}
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const nextPage = () => (
    <View style={styles.pageGap}>
      {home.slipping ? <Text style={[styles.label, { color: colors.primary }]}>BACK TO BASICS THIS WEEK</Text> : null}
      {home.next.slice(0, fit(ROW.next, home.slipping ? 24 : 0)).map((routine, index) => (
        <Pressable
          key={routine.id}
          onPress={() => openRoutine(routine.id)}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.row,
            {
              height: ROW.next,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
              borderColor: colors.border,
              borderLeftColor: index === 0 ? colors.boardRule : colors.border,
              borderLeftWidth: index === 0 ? 3 : 1,
            },
          ]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
              {routine.name}
            </Text>
            <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
              {routine.category} · {routine.note}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      ))}
    </View>
  );

  const recentPage = () =>
    home.recent.length === 0 ? (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Routines you score and matches you play show up here.
        </Text>
      </View>
    ) : (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {home.recent.slice(0, fit(ROW.recent, 2)).map((item, index) => (
          <Pressable
            key={item.key}
            onPress={() => (item.kind === "match" ? openMatch(item.id) : openRoutine(item.id))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.recent,
              { height: ROW.recent, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
              index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
            ]}
          >
            <MaterialCommunityIcons
              name={item.kind === "match" ? "trophy-outline" : "target"}
              size={18}
              color={item.kind === "match" ? colors.boardRule : colors.primary}
            />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {item.detail}
              </Text>
            </View>
            <Text style={[styles.when, { color: colors.textMuted }]}>{relativeDate(item.at)}</Text>
          </Pressable>
        ))}
      </View>
    );

  const tourPage = () => (
    <View style={styles.pageGap}>
      {news.length === 0 ? (
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            The latest from the World Snooker Tour and BBC Sport appears here once it loads.
          </Text>
        </View>
      ) : (
        news.slice(0, Math.max(1, fit(ROW.tour, 36))).map((item) => (
          <View key={item.id} style={{ height: ROW.tour }}>
            <NewsRow item={item} summary={false} />
          </View>
        ))
      )}
      <Pressable
        onPress={() => navigation.navigate("Community", { screen: "TourNews", initial: false })}
        accessibilityRole="button"
        style={styles.more}
      >
        <Text style={[styles.moreText, { color: colors.primary }]}>All tour news</Text>
        <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primary} />
      </Pressable>
    </View>
  );

  const renderPage = (key: PageKey) =>
    key === "week" ? weekPage() : key === "next" ? nextPage() : key === "recent" ? recentPage() : tourPage();

  // ------------------------------------------------------------------ screen

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {/* Up next */}
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
          {template
            ? [
                "UP NEXT",
                `${template.routine_ids.length} ${template.routine_ids.length === 1 ? "ROUTINE" : "ROUTINES"}`,
                templateMinutes ? `ABOUT ${templateMinutes} MIN` : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : "UP NEXT"}
        </Text>
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          style={[styles.heroTitle, { color: colors.boardText }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {template ? template.name : "Build your first session"}
        </Text>
        <View style={styles.heroActions}>
          <Pressable
            onPress={startSession}
            accessibilityRole="button"
            style={({ pressed }) => [styles.start, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name={template ? "play" : "plus"} size={20} color={colors.onPrimary} />
            <Text style={[styles.startText, { color: colors.onPrimary }]}>
              {template ? "Start session" : "Create a session"}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Practice", { screen: "PracticePlan", initial: false })}
            accessibilityRole="button"
            accessibilityLabel="This week's plan"
            style={({ pressed }) => [styles.plan, { borderColor: colors.boardRaised, opacity: pressed ? 0.8 : 1 }]}
          >
            <MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.boardText} />
            <Text style={[styles.planText, { color: colors.boardText }]}>Plan</Text>
          </Pressable>
        </View>
      </View>

      {/* The numbers */}
      <View style={[styles.numbers, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => navigation.navigate("Stats")} accessibilityRole="button" style={styles.cell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.text }]}>
            {home.streak}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            DAY STREAK
          </Text>
        </Pressable>
        <View style={[styles.cellRule, { backgroundColor: colors.border }]} />
        <Pressable onPress={() => navigation.navigate("Stats")} accessibilityRole="button" style={styles.cell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.text }]}>
            {home.weekDays}
            <Text style={{ color: colors.textMuted }}>/7</Text>
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            DAYS THIS WEEK
          </Text>
        </Pressable>
        <View style={[styles.cellRule, { backgroundColor: colors.border }]} />
        <Pressable onPress={() => navigation.navigate("Matches")} accessibilityRole="button" style={styles.cell}>
          {home.form.length ? (
            <FormStrip form={home.form} size={18} />
          ) : (
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.textMuted }]}>
              –
            </Text>
          )}
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            FORM
          </Text>
        </Pressable>
      </View>

      {/* Pages */}
      <View style={styles.tabs} accessibilityRole="tablist">
        {PAGES.map((item, index) => {
          const selected = index === page;
          return (
            <Pressable
              key={item.key}
              onPress={() => goTo(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected ? { borderBottomColor: colors.boardRule } : null]}
            >
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.tabText, { color: selected ? colors.text : colors.textMuted }]}
                numberOfLines={1}
              >
                {item.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View
        style={styles.pager}
        onLayout={(event) =>
          setPager({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })
        }
      >
        {pager.width ? (
          <FlatList
            ref={listRef}
            horizontal
            pagingEnabled
            data={PAGES as unknown as Array<(typeof PAGES)[number]>}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            extraData={[home, news, railWidth, rhythmWidth, pager.height]}
            getItemLayout={(_, index) => ({ length: pager.width, offset: pager.width * index, index })}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / pager.width))}
            renderItem={({ item }) => (
              <View style={{ width: pager.width, height: pager.height }}>{renderPage(item.key)}</View>
            )}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.3 },
  label: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2, marginBottom: 6 },
  hero: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  heroTitle: { fontFamily: FONTS.boardHeavy, fontSize: 32, lineHeight: 36, letterSpacing: 0.3 },
  heroActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  start: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
  },
  startText: { fontSize: 16, fontWeight: "800" },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  planText: { fontSize: 15, fontWeight: "700" },
  numbers: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderRadius: RADIUS.lg },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: SPACING.sm, minHeight: 64 },
  cellRule: { width: StyleSheet.hairlineWidth, marginVertical: SPACING.sm },
  cellValue: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 28 },
  cellLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  tabs: { flexDirection: "row", gap: SPACING.md },
  tab: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: FONTS.board, fontSize: 14, letterSpacing: 1 },
  pager: { flex: 1, overflow: "hidden" },
  pageGap: { gap: SPACING.sm },
  rhythm: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  board: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  boardHead: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.sm },
  prompt: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  promptText: { flex: 1, fontSize: 15, fontWeight: "700" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  recent: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.md },
  when: { fontSize: 12 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  more: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: HIT_TARGET - 8, alignSelf: "flex-start" },
  moreText: { fontSize: 14, fontWeight: "800" },
});
