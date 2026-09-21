import { breakStats, matchCard, matchTape } from "../breaks";
import type { LiveFrameRecord, Match } from "../../../types";

const match = (id: string, opponent: string, date: string): Match =>
  ({
    id,
    user_id: "u",
    opponent_name: opponent,
    date,
    match_type: "practice",
    format: "best_of",
    frames_played: 1,
    user_score: 1,
    opponent_score: 0,
    result: "win",
    sync_status: "synced",
    created_at: date,
    updated_at: date,
  }) as Match;

const frame = (
  matchId: string,
  number: number,
  breaks: Array<["user" | "opponent", number]>,
  extra: Partial<LiveFrameRecord> = {}
): LiveFrameRecord => ({
  id: `${matchId}-${number}`,
  match_id: matchId,
  frame_number: number,
  user_score: 60,
  opponent_score: 30,
  winner: "user",
  highest_break_user: Math.max(0, ...breaks.filter(([side]) => side === "user").map(([, p]) => p)),
  highest_break_opponent: Math.max(0, ...breaks.filter(([side]) => side === "opponent").map(([, p]) => p)),
  breaks: breaks.map(([player, points]) => ({ player, points, endedBy: "visit_end", timestamp: "" })),
  events: [],
  created_at: "",
  ...extra,
});

describe("breaks from live scoring", () => {
  const matches = [match("m1", "Ronnie", "2026-09-01"), match("m2", "Judd", "2026-09-10")];
  const frames = {
    m1: [
      frame("m1", 1, [
        ["user", 8],
        ["user", 24],
        ["opponent", 71],
      ]),
      frame("m1", 2, [["user", 55]]),
    ],
    m2: [
      frame("m2", 1, [
        ["user", 102],
        ["user", 1],
        ["user", 33],
      ]),
    ],
    gone: [frame("gone", 1, [["user", 147]])],
  };

  it("finds the high break and where it was made, and ignores deleted matches", () => {
    const stats = breakStats(matches, frames);
    expect(stats.highest).toMatchObject({ points: 102, opponent: "Judd", frameNumber: 1 });
    expect(stats.breaks.map((made) => made.points)).toEqual([102, 55, 33, 24, 8, 1]);
    expect(stats.framesTracked).toBe(3);
  });

  it("counts the milestones and averages the real breaks", () => {
    const stats = breakStats(matches, frames);
    expect(stats.milestones).toEqual({ 20: 4, 30: 3, 50: 2, 70: 1, 100: 1 });
    expect(stats.average).toBe((102 + 55 + 33 + 24) / 4);
  });

  it("can read the opponent's side too", () => {
    expect(breakStats(matches, frames, "opponent").highest?.points).toBe(71);
  });

  it("has nothing to say before any live frames", () => {
    const stats = breakStats(matches, {});
    expect(stats).toMatchObject({ highest: null, average: null, framesTracked: 0 });
  });
});

describe("a match's result card", () => {
  it("lists the frames in order, leaves out abandoned ones, and finds each player's high break", () => {
    const card = matchCard([
      frame("m", 2, [["opponent", 64]], { user_score: 10, opponent_score: 80, winner: "opponent" }),
      frame("m", 1, [
        ["user", 52],
        ["user", 12],
      ]),
      frame("m", 3, [["user", 90]], { abandoned: true }),
    ]);
    expect(card.frames).toEqual([
      { number: 1, user: 60, opponent: 30, winner: "user" },
      { number: 2, user: 10, opponent: 80, winner: "opponent" },
    ]);
    expect(card.highUser).toBe(52);
    expect(card.highOpponent).toBe(64);
    expect(card.fiftiesUser).toBe(1);
  });
});

describe("match statistics", () => {
  it("adds up both players across the frames", () => {
    const pot = (player: "user" | "opponent") => ({
      id: Math.random().toString(),
      kind: "pot" as const,
      timestamp: "",
      player,
    });
    const tape = matchTape([
      frame(
        "m",
        1,
        [
          ["user", 55],
          ["opponent", 20],
        ],
        {
          events: [
            pot("user"),
            pot("user"),
            pot("opponent"),
            { id: "f", kind: "foul", timestamp: "", player: "opponent" },
          ],
        }
      ),
      frame("m", 2, [["opponent", 40]], { user_score: 12, opponent_score: 70, winner: "opponent" }),
    ]);
    expect(tape.user).toEqual({ frames: 1, points: 72, high: 55, fifties: 1, pots: 2, fouls: 0 });
    expect(tape.opponent).toEqual({ frames: 1, points: 100, high: 40, fifties: 0, pots: 1, fouls: 1 });
  });
});
