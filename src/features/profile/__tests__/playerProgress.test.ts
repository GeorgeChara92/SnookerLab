import { levelProgress } from "../../../constants/achievements";
import { computePlayerStats } from "../playerStats";
import type { Match, Routine, SessionLog } from "../../../types";

const match = (id: string, date: string, result: Match["result"]): Match =>
  ({ id, date, result, opponent_name: "John", user_score: 1, opponent_score: 0 }) as Match;

describe("player progress", () => {
  it("measures the level bar from where the level starts", () => {
    // Level 3 runs from 250 to 500 XP.
    const progress = levelProgress(450);
    expect(progress.level).toBe(3);
    expect(progress.title).toBe("Club Player");
    expect(progress.xpToNext).toBe(50);
    expect(progress.progress).toBeCloseTo(0.8);
    expect(progress.nextTitle).toBe("Regular");
  });

  it("does not run past the top level", () => {
    expect(levelProgress(50_000)).toMatchObject({ level: 10, progress: 1, nextTitle: null });
  });

  it("finds the longest winning run in date order", () => {
    const stats = computePlayerStats(
      [
        match("a", "2026-05-03", "win"),
        match("b", "2026-05-01", "win"),
        match("c", "2026-05-02", "loss"),
        match("d", "2026-05-04", "win"),
      ],
      [],
      [],
      [],
      {}
    );
    // By date: win, loss, win, win.
    expect(stats.longestWinStreak).toBe(2);
    expect(stats.winRate).toBe(75);
  });

  it("counts sessions when working out what you have trained most", () => {
    const routines = [
      { id: "r1", category_id: "cat-safety" },
      { id: "r2", category_id: "cat-long-potting" },
    ] as Routine[];
    const sessions = [
      { id: "s1", results: [{ routine_id: "r1", score: "3" }, { routine_id: "r1", score: "5" }] },
    ] as unknown as SessionLog[];

    expect(computePlayerStats([], sessions, [], routines, {}).mostTrainedCategory).toBe("cat-safety");
  });
});
