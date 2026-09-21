import { cleanPlan, goalStatus, parseTarget, plannedToday, streaks, type RoutineGoal } from "../plan";
import { routineProgress } from "../../routines/progress";
import type { RoutineScoreEntry } from "../../../types";

// Wednesday 23 September 2026, early evening.
const NOW = new Date(2026, 8, 23, 18, 0);
const plan = { days: [], weeklyTarget: 3 };
const days = (...keys: string[]) => new Set(keys);

describe("streaks", () => {
  it("counts days in a row, and waits for today before breaking", () => {
    const result = streaks(days("2026-09-20", "2026-09-21", "2026-09-22"), plan, NOW);
    expect(result.days).toBe(3);
    expect(result.bestDays).toBe(3);
  });

  it("finds the best run of days in the past", () => {
    const result = streaks(days("2026-08-01", "2026-08-02", "2026-08-03", "2026-08-04", "2026-09-22"), plan, NOW);
    expect(result.days).toBe(1);
    expect(result.bestDays).toBe(4);
  });

  it("counts weeks on target, without this week breaking it before it is over", () => {
    const active = days(
      // Week of 7 Sep: three days. Week of 14 Sep: three days. This week: one so far.
      "2026-09-07",
      "2026-09-09",
      "2026-09-11",
      "2026-09-14",
      "2026-09-16",
      "2026-09-19",
      "2026-09-22"
    );
    const result = streaks(active, plan, NOW);
    expect(result.weeks).toBe(2);
    expect(result.thisWeek).toMatchObject({ done: 1, target: 3, reached: false });
  });

  it("counts this week as soon as the target is reached", () => {
    const active = days("2026-09-14", "2026-09-16", "2026-09-19", "2026-09-21", "2026-09-22", "2026-09-23");
    const result = streaks(active, plan, NOW);
    expect(result.weeks).toBe(2);
    expect(result.thisWeek.reached).toBe(true);
  });

  it("lays out this week with what was planned and what was done", () => {
    const withPlan = {
      days: [
        { day: 0 as const, templateId: null },
        { day: 2 as const, templateId: "t1" },
      ],
      weeklyTarget: 2,
    };
    const week = streaks(days("2026-09-21"), withPlan, NOW).thisWeek.days;
    expect(week).toHaveLength(7);
    expect(week[0]).toMatchObject({ key: "2026-09-21", practised: true, isPast: true, planned: { templateId: null } });
    expect(week[2]).toMatchObject({ key: "2026-09-23", isToday: true, planned: { templateId: "t1" } });
    expect(plannedToday(withPlan, NOW)?.templateId).toBe("t1");
  });
});

describe("goals", () => {
  const entry = (score: string, at: string): RoutineScoreEntry => ({
    id: at,
    routine_id: "r1",
    routine_name: "Line-up",
    score,
    recorded_at: at,
  });
  const goal = (overrides: Partial<RoutineGoal> = {}): RoutineGoal => ({
    id: "g1",
    routineId: "r1",
    routineName: "Line-up",
    target: 40,
    kind: "number",
    deadline: "2026-10-01",
    createdAt: "2026-09-10T00:00:00Z",
    ...overrides,
  });

  it("shows how far there is to go, and the days left", () => {
    const progress = routineProgress({ id: "r1", scoring_type: "points" }, [entry("20", "2026-09-12T18:00:00Z")], []);
    const status = goalStatus(goal(), progress, NOW);
    expect(status).toMatchObject({ best: 20, fraction: 0.5, reachedAt: null, daysLeft: 8 });
  });

  it("is reached by a score after it was set, not one before", () => {
    const before = routineProgress({ id: "r1", scoring_type: "points" }, [entry("45", "2026-09-01T18:00:00Z")], []);
    expect(goalStatus(goal(), before, NOW).reachedAt).toBeNull();
    const after = routineProgress({ id: "r1", scoring_type: "points" }, [entry("41", "2026-09-15T18:00:00Z")], []);
    expect(goalStatus(goal(), after, NOW)).toMatchObject({ reachedAt: "2026-09-15T18:00:00Z", fraction: 1 });
  });

  it("reads a timed goal the right way round", () => {
    const progress = routineProgress(
      { id: "r1", scoring_type: "time" },
      [entry("08:00", "2026-09-11T18:00:00Z"), entry("07:00", "2026-09-12T18:00:00Z")],
      []
    );
    const status = goalStatus(goal({ kind: "time", target: 360 }), progress, NOW);
    expect(status.best).toBe(420);
    expect(status.fraction).toBe(0.5);
  });

  it("reads targets as they are typed", () => {
    expect(parseTarget("25", "number")).toBe(25);
    expect(parseTarget("80%", "percent")).toBe(80);
    expect(parseTarget("6:30", "time")).toBe(390);
    expect(parseTarget("6:30", "number")).toBeNull();
    expect(parseTarget("25", "time")).toBeNull();
    expect(parseTarget("0", "number")).toBeNull();
  });
});

describe("a stored plan", () => {
  it("is made safe whatever arrives", () => {
    expect(cleanPlan(null)).toMatchObject({ days: [], weeklyTarget: 3, goals: [] });
    const cleaned = cleanPlan({
      days: [{ day: 4, templateId: "t" }, { day: 9 }, { day: 4, templateId: null }, { day: 1 }],
      weeklyTarget: 12,
      goals: [{ id: "x" }],
    });
    expect(cleaned.days).toEqual([
      { day: 1, templateId: null },
      { day: 4, templateId: null },
    ]);
    expect(cleaned.weeklyTarget).toBe(7);
    expect(cleaned.goals).toEqual([]);
  });
});
