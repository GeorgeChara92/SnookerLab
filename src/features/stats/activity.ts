/**
 * Practice activity by day: what the calendar, the week strip and the streaks are drawn from.
 * Kept apart from the screen so the counting can be tested without rendering anything.
 */

import { addDays, parseDateKey, startOfWeekMonday, toLocalDateKey } from "../../utils/date";

/** How many things happened on each day, keyed "YYYY-MM-DD". */
export const countByDay = (dayKeys: string[]) => {
  const counts = new Map<string, number>();
  dayKeys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return counts;
};

/** The longest run of consecutive days with anything on them. */
export const longestStreak = (dayKeys: Iterable<string>) => {
  const sorted = Array.from(new Set(dayKeys)).sort();
  let best = 0;
  let run = 0;
  let previous: Date | null = null;

  sorted.forEach((key) => {
    const day = parseDateKey(key);
    run = previous && toLocalDateKey(addDays(previous, 1)) === key ? run + 1 : 1;
    best = Math.max(best, run);
    previous = day;
  });

  return best;
};

export type CalendarDay = { key: string; count: number; isFuture: boolean; isToday: boolean };

/**
 * Weeks as columns, Monday to Sunday down each one, oldest week first - the layout of the grid on
 * the Stats page. Days after today are marked so they can be drawn empty rather than as zero.
 */
export const calendarWeeks = (counts: Map<string, number>, weeks = 8, now = new Date()): CalendarDay[][] => {
  const todayKey = toLocalDateKey(now);
  const thisMonday = startOfWeekMonday(now);

  return Array.from({ length: weeks }, (_, column) => {
    const monday = addDays(thisMonday, -7 * (weeks - 1 - column));
    return Array.from({ length: 7 }, (_, row) => {
      const key = toLocalDateKey(addDays(monday, row));
      return { key, count: counts.get(key) ?? 0, isFuture: key > todayKey, isToday: key === todayKey };
    });
  });
};

/** This week, Monday first, for the strip of seven days. */
export const thisWeek = (counts: Map<string, number>, now = new Date()) => calendarWeeks(counts, 1, now)[0];

/** The last `days` days, oldest first and ending today, for the practice rhythm chart. */
export const lastDays = (counts: Map<string, number>, days = 28, now = new Date()): CalendarDay[] => {
  const todayKey = toLocalDateKey(now);
  return Array.from({ length: days }, (_, index) => {
    const key = toLocalDateKey(addDays(now, index - (days - 1)));
    return { key, count: counts.get(key) ?? 0, isFuture: false, isToday: key === todayKey };
  });
};

export type BallName = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

/** The colours in the order they are potted, with their values: the week reads red to black. */
export const COLOUR_ORDER: BallName[] = ["red", "yellow", "green", "brown", "blue", "pink", "black"];

/** A busy day is worth more: one thing logged is a red, two a yellow, and so on up to the black. */
export const ballForCount = (count: number): BallName => COLOUR_ORDER[Math.min(7, Math.max(1, count)) - 1];
