import type { RoutineScoreEntry, SessionLog } from "../../types";
import { addDays, countStreak, dateKeyFrom, parseDateKey, startOfWeekMonday, toLocalDateKey } from "../../utils/date";
import { parseScore, type RoutineProgress, type ScoreKind } from "../routines/progress";

/**
 * The player's practice plan: which days of the week they mean to practise (and what, if they
 * have a preset in mind), how many days a week they are aiming for, and targets on routines.
 *
 * Streaks come in two kinds. A day streak is every day in a row with some practice - the one
 * everyone knows, and the one a club player breaks the first time they have a night off. A week
 * streak counts weeks in a row that reached the weekly target, which rewards the player who
 * practises three evenings a week, every week, as the habit it is.
 */

/** Monday is 0, Sunday is 6: the week as a player plans it. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type PlannedDay = {
  day: Weekday;
  /** A session preset to run that day, or null for any practice. */
  templateId: string | null;
};

export type RoutineGoal = {
  id: string;
  routineId: string;
  /** Kept so the goal still reads properly if the routine is later deleted. */
  routineName: string;
  /** In the routine's own units: points, a percentage, or seconds for a time. */
  target: number;
  kind: ScoreKind;
  /** YYYY-MM-DD, or null for no deadline. */
  deadline: string | null;
  createdAt: string;
};

export type PracticePlan = {
  days: PlannedDay[];
  /** Days a week the player aims to practise, 1 to 7. */
  weeklyTarget: number;
  goals: RoutineGoal[];
  updatedAt: string;
};

export const EMPTY_PLAN: PracticePlan = { days: [], weeklyTarget: 3, goals: [], updatedAt: new Date(0).toISOString() };

export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const WEEKDAY_LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;

export const weekdayOf = (date: Date): Weekday => ((date.getDay() + 6) % 7) as Weekday;

/** A plan read from storage or the server, made safe to use whatever shape it arrives in. */
export const cleanPlan = (raw: unknown): PracticePlan => {
  const input = (raw && typeof raw === "object" ? raw : {}) as Partial<PracticePlan>;
  const days = Array.isArray(input.days)
    ? input.days
        .filter((day): day is PlannedDay => Number.isInteger(day?.day) && day.day >= 0 && day.day <= 6)
        .map((day) => ({ day: day.day, templateId: typeof day.templateId === "string" ? day.templateId : null }))
    : [];
  const unique = [...new Map(days.map((day) => [day.day, day])).values()].sort((a, b) => a.day - b.day);
  const target = Number(input.weeklyTarget);
  return {
    days: unique,
    weeklyTarget: Number.isFinite(target) ? Math.min(7, Math.max(1, Math.round(target))) : EMPTY_PLAN.weeklyTarget,
    goals: Array.isArray(input.goals)
      ? input.goals.filter(
          (goal): goal is RoutineGoal =>
            typeof goal?.id === "string" && typeof goal.routineId === "string" && Number.isFinite(goal.target)
        )
      : [],
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : EMPTY_PLAN.updatedAt,
  };
};

/** Every day with some practice on it: a session logged or a routine score recorded. */
export const practiceDays = (logs: SessionLog[], entries: RoutineScoreEntry[]) => {
  const days = new Set<string>();
  logs.forEach((log) => days.add(dateKeyFrom(log.date)));
  entries.forEach((entry) => days.add(dateKeyFrom(entry.recorded_at)));
  return days;
};

/** The most days in a row among these days. */
export const longestRun = (keys: Iterable<string>) => {
  const sorted = [...keys].sort();
  let best = 0;
  let run = 0;
  let previous: string | null = null;
  sorted.forEach((key) => {
    run = previous && toLocalDateKey(addDays(parseDateKey(previous), 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = key;
  });
  return best;
};

const daysInWeek = (active: Set<string>, monday: Date) =>
  Array.from({ length: 7 }, (_, index) => toLocalDateKey(addDays(monday, index))).filter((key) => active.has(key))
    .length;

export type WeekDay = {
  key: string;
  day: Weekday;
  practised: boolean;
  planned: PlannedDay | null;
  isToday: boolean;
  isPast: boolean;
};

export type Streaks = {
  /** Days in a row with practice, up to today (or yesterday, until today's practice is in). */
  days: number;
  bestDays: number;
  /** Weeks in a row on target. This week counts once reached; until then it does not break it. */
  weeks: number;
  bestWeeks: number;
  thisWeek: { done: number; target: number; reached: boolean; days: WeekDay[] };
};

export const streaks = (
  active: Set<string>,
  plan: Pick<PracticePlan, "days" | "weeklyTarget">,
  now = new Date()
): Streaks => {
  const monday = startOfWeekMonday(now);
  const today = toLocalDateKey(now);
  const target = plan.weeklyTarget;
  const done = daysInWeek(active, monday);

  // Weeks on target, walking back from this one.
  let weeks = 0;
  let cursor = done >= target ? monday : addDays(monday, -7);
  while (daysInWeek(active, cursor) >= target) {
    weeks += 1;
    cursor = addDays(cursor, -7);
  }

  // The best run of weeks, from the first week with any practice.
  const keys = [...active];
  let bestWeeks = weeks;
  if (keys.length) {
    const first = startOfWeekMonday(parseDateKey(keys.sort()[0]));
    let run = 0;
    for (let week = first; week.getTime() <= monday.getTime(); week = addDays(week, 7)) {
      const onTarget = daysInWeek(active, week) >= target;
      run = onTarget ? run + 1 : 0;
      bestWeeks = Math.max(bestWeeks, run);
    }
  }

  const planned = new Map(plan.days.map((day) => [day.day, day]));
  return {
    days: countStreak(active, now),
    bestDays: longestRun(keys),
    weeks,
    bestWeeks,
    thisWeek: {
      done,
      target,
      reached: done >= target,
      days: Array.from({ length: 7 }, (_, index) => {
        const key = toLocalDateKey(addDays(monday, index));
        return {
          key,
          day: index as Weekday,
          practised: active.has(key),
          planned: planned.get(index as Weekday) ?? null,
          isToday: key === today,
          isPast: key < today,
        };
      }),
    },
  };
};

/** What is planned for today, if anything. */
export const plannedToday = (plan: Pick<PracticePlan, "days">, now = new Date()) =>
  plan.days.find((day) => day.day === weekdayOf(now)) ?? null;

export type GoalStatus = {
  /** The best score on the routine. */
  best: number | null;
  /** How far from nothing to the target the best is, 0 to 1. Times have no zero, so it runs from the first time. */
  fraction: number;
  /** When the target was first reached after the goal was set. */
  reachedAt: string | null;
  /** Whole days until the deadline; negative once it has passed. */
  daysLeft: number | null;
};

const meets = (value: number, goal: RoutineGoal) =>
  goal.kind === "time" ? value <= goal.target : value >= goal.target;

export const goalStatus = (goal: RoutineGoal, progress: RoutineProgress, now = new Date()): GoalStatus => {
  const points = progress.points;
  const reached = points.find((point) => point.at >= goal.createdAt && meets(point.value, goal));
  const values = points.map((point) => point.value);
  const best = values.length ? (goal.kind === "time" ? Math.min(...values) : Math.max(...values)) : null;

  let fraction = 0;
  if (best !== null) {
    if (goal.kind === "time") {
      const start = Math.max(...values);
      fraction = start <= goal.target ? 1 : (start - best) / (start - goal.target);
    } else {
      fraction = goal.target > 0 ? best / goal.target : 1;
    }
  }

  const daysLeft = goal.deadline
    ? Math.round((parseDateKey(goal.deadline).getTime() - parseDateKey(toLocalDateKey(now)).getTime()) / 86_400_000)
    : null;

  return {
    best,
    fraction: reached ? 1 : Math.min(1, Math.max(0, fraction)),
    reachedAt: reached?.at ?? null,
    daysLeft,
  };
};

/** A target as typed ("25", "80%", "6:30"), read in the routine's units. */
export const parseTarget = (raw: string, kind: ScoreKind): number | null => {
  const parsed = parseScore(raw);
  if (!parsed) return null;
  if (kind === "time" && parsed.kind !== "time") return null;
  if (kind !== "time" && parsed.kind === "time") return null;
  if (parsed.value <= 0) return null;
  if (kind === "percent" && parsed.value > 100) return null;
  return parsed.value;
};

export const newGoalId = () => `goal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
