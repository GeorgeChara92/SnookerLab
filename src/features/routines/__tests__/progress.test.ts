import { formatScore, nextTarget, parseScore, routineProgress } from "../progress";
import type { RoutineScoreEntry, SessionLog } from "../../../types";

const entry = (score: string, day: number, routineId = "r1"): RoutineScoreEntry => ({
  id: `e${day}-${score}`,
  routine_id: routineId,
  routine_name: "Line-up",
  score,
  recorded_at: `2026-09-${String(day).padStart(2, "0")}T18:00:00Z`,
});

describe("reading scores", () => {
  it("reads every way a score is entered", () => {
    expect(parseScore("12")).toEqual({ value: 12, kind: "number" });
    expect(parseScore("72%")).toEqual({ value: 72, kind: "percent" });
    expect(parseScore("18/24")).toEqual({ value: 75, kind: "percent" });
    expect(parseScore("07:35")).toEqual({ value: 455, kind: "time" });
    expect(parseScore("60", { scoring_type: "percentage" })).toEqual({ value: 60, kind: "percent" });
    expect(parseScore("lots")).toBeNull();
    expect(parseScore("3/0")).toBeNull();
  });

  it("shows scores the way they were meant", () => {
    expect(formatScore(455, "time")).toBe("7:35");
    expect(formatScore(72.25, "percent")).toBe("72.3%");
    expect(formatScore(12, "number")).toBe("12");
  });
});

describe("progress on a routine", () => {
  const routine = { id: "r1", scoring_type: "points" as const, max_score: 30 };

  it("finds the best, the latest and how the last five compare with the five before", () => {
    const scores = [10, 12, 11, 13, 12, 15, 16, 14, 18, 17];
    const progress = routineProgress(
      routine,
      scores.map((score, index) => entry(String(score), index + 1)),
      []
    );
    expect(progress.points.map((point) => point.value)).toEqual(scores);
    expect(progress.best?.value).toBe(18);
    expect(progress.latest?.value).toBe(17);
    expect(progress.recentAverage).toBe(16);
    expect(progress.previousAverage).toBe(11.6);
    expect(progress.change).toBeCloseTo(4.4);
    expect(progress.ceiling).toBe(30);
    expect(nextTarget(progress)).toBe("19 for a new best");
  });

  it("brings in scores recorded as part of a session, and leaves other routines out", () => {
    const logs: SessionLog[] = [
      {
        id: "s1",
        template_id: "t1",
        template_name: "Evening",
        date: "2026-09-03",
        recorded_at: "2026-09-03T19:00:00Z",
        results: [
          { routine_id: "r1", score: "20" },
          { routine_id: "r2", score: "99" },
        ],
      },
    ];
    const progress = routineProgress(routine, [entry("10", 1), entry("50", 2, "r2")], logs);
    expect(progress.points.map((point) => point.value)).toEqual([10, 20]);
    expect(progress.best?.value).toBe(20);
  });

  it("counts less as better for timed routines", () => {
    const timed = { id: "r1", scoring_type: "time" as const };
    const progress = routineProgress(timed, [entry("08:10", 1), entry("07:35", 2), entry("07:50", 3)], []);
    expect(progress.kind).toBe("time");
    expect(progress.higherIsBetter).toBe(false);
    expect(progress.best?.raw).toBe("07:35");
    expect(nextTarget(progress)).toBe("Under 7:35 for a new best");
  });

  it("keeps the first time a best was reached, and says so at the maximum", () => {
    const progress = routineProgress(routine, [entry("30", 1), entry("30", 2)], []);
    expect(progress.best?.at).toContain("2026-09-01");
    expect(nextTarget(progress)).toMatch(/maximum/);
  });

  it("has nothing to say before any scores", () => {
    const progress = routineProgress(routine, [], []);
    expect(progress.best).toBeNull();
    expect(progress.change).toBeNull();
    expect(nextTarget(progress)).toBeNull();
  });
});
