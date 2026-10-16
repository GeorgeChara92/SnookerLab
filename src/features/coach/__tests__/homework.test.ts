import { homeworkProgress, progressLine, scoreNumber, startOfWeek, targetMet } from "../homework";
import type { Homework } from "../types";

const hw = (overrides: Partial<Homework> = {}): Homework => ({
  id: "h1",
  coachId: "coach",
  playerId: "player",
  bookingId: null,
  routineId: "line-up",
  routineName: "The line-up",
  targetScore: 50,
  perWeek: 3,
  note: null,
  createdAt: "2026-10-01T10:00:00Z",
  ...overrides,
});

const entry = (score: string, recorded_at: string, routine_id = "line-up") => ({ routine_id, score, recorded_at });

describe("coach homework", () => {
  it("reads the leading number of a stored score", () => {
    expect(scoreNumber("42")).toBe(42);
    expect(scoreNumber("7/10")).toBe(7);
    expect(scoreNumber(" 7 of 10")).toBe(7);
    expect(scoreNumber("missed")).toBeNull();
    expect(scoreNumber(null)).toBeNull();
  });

  it("starts the week on Monday", () => {
    expect(startOfWeek(new Date(2026, 9, 15, 18)).getDay()).toBe(1); // a Thursday -> Monday
    expect(startOfWeek(new Date(2026, 9, 18, 9)).getDate()).toBe(12); // Sunday the 18th -> Monday the 12th
  });

  it("counts only scores on the homework routine since it was set", () => {
    const now = new Date(2026, 9, 15, 20);
    const entries = [
      entry("30", "2026-09-28T10:00:00Z"), // before it was set
      entry("38", "2026-10-03T10:00:00Z"),
      entry("44", new Date(2026, 9, 13, 19).toISOString()),
      entry("41", new Date(2026, 9, 14, 19).toISOString()),
      entry("99", new Date(2026, 9, 14, 19).toISOString(), "other-routine"),
    ];
    const progress = homeworkProgress(hw(), entries, now);
    expect(progress).toMatchObject({ best: 44, attempts: 3, thisWeek: 2 });
    expect(progressLine(hw(), progress)).toBe("Best 44 · target 50 · 2 of 3 this week");
    expect(targetMet(hw(), progress)).toBe(false);
    expect(targetMet(hw({ targetScore: 40 }), progress)).toBe(true);
  });

  it("says so when it hasn't been tried", () => {
    const progress = homeworkProgress(hw({ perWeek: null, targetScore: null }), []);
    expect(progressLine(hw({ perWeek: null, targetScore: null }), progress)).toBe("Not tried yet");
  });
});
