// Tests run in Asia/Nicosia (see jest.globalSetup.js), where toISOString-based keys were a day out.
import { addDays, countStreak, dateKeyFrom, parseDateKey, startOfWeekMonday, toLocalDateKey } from "../date";

describe("date helpers", () => {
  it("uses the local calendar day, not the UTC one", () => {
    // 00:30 local on Monday 16 March 2026 is still Sunday in UTC.
    const justAfterMidnight = new Date(2026, 2, 16, 0, 30);
    expect(justAfterMidnight.toISOString().startsWith("2026-03-15")).toBe(true);
    expect(toLocalDateKey(justAfterMidnight)).toBe("2026-03-16");
    expect(dateKeyFrom(justAfterMidnight.toISOString())).toBe("2026-03-16");
  });

  it("parses date-only keys as local midnight", () => {
    const date = parseDateKey("2026-03-16");
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 2, 16, 0]);
  });

  it("finds Monday as the start of the week", () => {
    expect(toLocalDateKey(startOfWeekMonday(new Date(2026, 2, 22, 23, 0)))).toBe("2026-03-16"); // Sunday
    expect(toLocalDateKey(startOfWeekMonday(new Date(2026, 2, 16, 0, 5)))).toBe("2026-03-16"); // Monday
  });

  it("steps whole weeks across the clocks going forward", () => {
    // Cyprus clocks change on 29 March 2026.
    const monday = startOfWeekMonday(new Date(2026, 3, 1));
    expect(toLocalDateKey(addDays(monday, -7))).toBe("2026-03-23");
    expect(addDays(monday, -7).getHours()).toBe(0);
  });

  it("counts a streak back from yesterday when today has no activity yet", () => {
    const now = new Date(2026, 2, 16, 9, 0);
    const active = new Set(["2026-03-13", "2026-03-14", "2026-03-15"]);
    expect(countStreak(active, now)).toBe(3);
    expect(countStreak(new Set([...active, "2026-03-16"]), now)).toBe(4);
    expect(countStreak(new Set(["2026-03-14"]), now)).toBe(0);
  });
});
