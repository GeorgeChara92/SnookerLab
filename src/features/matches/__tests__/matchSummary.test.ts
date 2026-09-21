import type { Match } from "../../../types";
import {
  describeScore,
  getRecordingMode,
  groupByOpponent,
  initialsOf,
  relativeDate,
  summariseMatches,
} from "../matchSummary";

const match = (over: Partial<Match> & { id: string }): Match => ({
  user_id: "u1",
  opponent_name: "John",
  date: "2026-09-01",
  match_type: "practice",
  format: "best_of",
  target_frames: 5,
  frames_played: 4,
  user_score: 3,
  opponent_score: 1,
  result: "win",
  sync_status: "synced",
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
  ...over,
});

describe("a match's score", () => {
  it("is frames when the match was scored live", () => {
    expect(describeScore(match({ id: "a", recording_mode: "live" }))).toEqual({ score: "3-1", unit: "frames" });
  });

  it("is points when a single frame was entered by hand", () => {
    const manual = match({ id: "b", recording_mode: "manual", target_frames: 1, user_score: 20, opponent_score: 1 });
    expect(describeScore(manual)).toEqual({ score: "20-1", unit: "points" });
  });

  it("treats an old one-frame match with no mode as entered by hand", () => {
    expect(getRecordingMode(match({ id: "c", recording_mode: undefined, target_frames: 1 }))).toBe("manual");
    expect(getRecordingMode(match({ id: "d", recording_mode: undefined, target_frames: 5 }))).toBe("live");
  });
});

describe("a record", () => {
  it("counts frames from live matches and points from manual ones, without mixing them", () => {
    const record = summariseMatches([
      match({ id: "1", recording_mode: "manual", target_frames: 1, user_score: 20, opponent_score: 1 }),
      match({ id: "2", recording_mode: "manual", target_frames: 1, user_score: 25, opponent_score: 0 }),
      match({ id: "3", recording_mode: "live", user_score: 3, opponent_score: 2 }),
    ]);

    // Two one-frame wins and a 3-2: five frames won, two lost.
    expect(record.framesWon).toBe(5);
    expect(record.framesLost).toBe(2);
    expect(record.pointsFor).toBe(45);
    expect(record.pointsAgainst).toBe(1);
  });

  it("gives the last five results newest first", () => {
    const record = summariseMatches([
      match({ id: "1", date: "2026-09-01", result: "win" }),
      match({ id: "2", date: "2026-09-03", result: "loss" }),
      match({ id: "3", date: "2026-09-02", result: "draw" }),
    ]);

    expect(record.form).toEqual(["L", "D", "W"]);
    expect(record.lastPlayed).toBe("2026-09-03");
  });

  it("has a win rate of nothing, not a division by zero, with no matches", () => {
    expect(summariseMatches([]).winRate).toBe(0);
  });
});

describe("opponents", () => {
  it("groups by name and puts the most-played first", () => {
    const groups = groupByOpponent([
      match({ id: "1", opponent_name: "Sanj" }),
      match({ id: "2", opponent_name: "John" }),
      match({ id: "3", opponent_name: "John " }),
    ]);

    expect(groups.map((group) => [group.name, group.played])).toEqual([
      ["John", 2],
      ["Sanj", 1],
    ]);
  });
});

describe("small helpers", () => {
  it("makes initials from one name or two", () => {
    expect(initialsOf("John")).toBe("JO");
    expect(initialsOf("John Smith")).toBe("JS");
    expect(initialsOf("  ")).toBe("?");
  });

  it("says today and yesterday by the calendar, not by 24-hour periods", () => {
    const now = new Date(2026, 8, 21, 0, 30);
    expect(relativeDate(new Date(2026, 8, 20, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(relativeDate(new Date(2026, 8, 21, 0, 5).toISOString(), now)).toBe("Today");
    expect(relativeDate(new Date(2026, 8, 18, 12).toISOString(), now)).toBe("3 days ago");
  });
});
