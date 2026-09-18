// Calendar-day helpers that work in the device's local time zone.
//
// Avoid `toISOString().split("T")[0]` for "today" style keys: that gives the UTC date, which is
// a day out for anyone east of UTC after midnight or west of UTC in the evening. Likewise
// `new Date("YYYY-MM-DD")` parses as UTC midnight, so use parseDateKey for date-only strings.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

const pad = (value: number) => String(value).padStart(2, "0");

/** Local calendar date as YYYY-MM-DD. */
export const toLocalDateKey = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const todayKey = () => toLocalDateKey(new Date());

/** Local midnight for a YYYY-MM-DD key. */
export const parseDateKey = (key: string) => {
  const match = DATE_ONLY.exec(key);
  if (!match) return new Date(key);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
};

/** Parses either a date-only key (as local) or a full ISO timestamp. */
export const parseDateValue = (value: string) => (DATE_ONLY.test(value) ? parseDateKey(value) : new Date(value));

/** Local calendar day for a date-only key or an ISO timestamp. */
export const dateKeyFrom = (value: string) => (DATE_ONLY.test(value) ? value : toLocalDateKey(new Date(value)));

export const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

/** Local midnight on the Monday of the week containing `date`. */
export const startOfWeekMonday = (date: Date = new Date()) => {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
};

/**
 * Consecutive active days ending today. If today has no activity yet the streak still
 * counts back from yesterday, so it doesn't read 0 until you practise.
 */
export const countStreak = (activeDayKeys: Set<string>, now: Date = new Date()) => {
  let cursor = new Date(now);
  if (!activeDayKeys.has(toLocalDateKey(cursor))) cursor = addDays(cursor, -1);

  let streak = 0;
  while (activeDayKeys.has(toLocalDateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
};
