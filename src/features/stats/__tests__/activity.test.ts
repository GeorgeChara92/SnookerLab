import { calendarWeeks, countByDay, longestStreak, thisWeek } from "../activity";

describe("practice activity", () => {
  it("counts more than one thing on the same day", () => {
    const counts = countByDay(["2026-09-01", "2026-09-01", "2026-09-03"]);
    expect(counts.get("2026-09-01")).toBe(2);
    expect(counts.get("2026-09-03")).toBe(1);
  });

  it("finds the longest run of days, across a month boundary", () => {
    expect(longestStreak(["2026-08-30", "2026-08-31", "2026-09-01", "2026-09-05"])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });

  it("lays out eight weeks, Monday to Sunday, oldest first", () => {
    // Monday 21 September 2026.
    const now = new Date(2026, 8, 21, 12);
    const weeks = calendarWeeks(countByDay(["2026-09-21", "2026-08-03"]), 8, now);

    expect(weeks).toHaveLength(8);
    expect(weeks[7][0]).toMatchObject({ key: "2026-09-21", count: 1, isToday: true });
    expect(weeks[0][0].key).toBe("2026-08-03");
    expect(weeks[0][0].count).toBe(1);
    // Later this week has not happened yet.
    expect(weeks[7][6]).toMatchObject({ key: "2026-09-27", isFuture: true });
  });

  it("gives this week as seven days starting on Monday", () => {
    const week = thisWeek(new Map(), new Date(2026, 8, 24, 9));
    expect(week.map((day) => day.key)).toEqual([
      "2026-09-21",
      "2026-09-22",
      "2026-09-23",
      "2026-09-24",
      "2026-09-25",
      "2026-09-26",
      "2026-09-27",
    ]);
  });
});
