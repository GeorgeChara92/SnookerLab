import { matchHighlights } from "../highlights";
import type { LiveFrameRecord, Match } from "../../../types";

const match = (id: string, date: string, us: number, them: number, opponent = "Judd"): Match =>
  ({
    id,
    user_id: "u",
    opponent_name: opponent,
    date,
    match_type: "league",
    format: "best_of",
    target_frames: 5,
    frames_played: us + them,
    user_score: us,
    opponent_score: them,
    result: us > them ? "win" : us < them ? "loss" : "draw",
    sync_status: "synced",
    created_at: date,
    updated_at: date,
  }) as Match;

const frame = (matchId: string, n: number, winner: "user" | "opponent", breaks: number[] = []): LiveFrameRecord => ({
  id: `${matchId}-${n}`,
  match_id: matchId,
  frame_number: n,
  user_score: winner === "user" ? 70 : 20,
  opponent_score: winner === "user" ? 20 : 70,
  winner,
  highest_break_user: Math.max(0, ...breaks),
  highest_break_opponent: 0,
  breaks: breaks.map((points) => ({ player: "user", points, endedBy: "visit_end", timestamp: "" })),
  events: [],
  created_at: "",
});

const kinds = (list: ReturnType<typeof matchHighlights>) => list.map((item) => item.kind);

describe("match highlights", () => {
  it("leads with a maximum", () => {
    const m = match("m2", "2026-09-10", 1, 0);
    const result = matchHighlights(m, [m], { m2: [frame("m2", 1, "user", [147])] });
    expect(result[0]).toMatchObject({ kind: "maximum", label: "MAXIMUM 147" });
  });

  it("marks a century and a new personal best over an earlier break", () => {
    const old = match("m1", "2026-09-01", 1, 0);
    const now = match("m2", "2026-09-10", 1, 0);
    const result = matchHighlights(now, [old, now], {
      m1: [frame("m1", 1, "user", [64])],
      m2: [frame("m2", 1, "user", [104, 30])],
    });
    expect(kinds(result)).toEqual(expect.arrayContaining(["century", "personal-best"]));
    expect(result.find((item) => item.kind === "personal-best")?.sentence).toContain("beating 64");
  });

  it("does not call the first break ever tracked a record, nor count later matches", () => {
    const now = match("m1", "2026-09-01", 1, 0);
    const later = match("m2", "2026-09-10", 1, 0);
    const result = matchHighlights(now, [now, later], {
      m1: [frame("m1", 1, "user", [55])],
      m2: [frame("m2", 1, "user", [90])],
    });
    expect(kinds(result)).toEqual(["fifties"]);
  });

  it("finds a whitewash, a first win over someone and a run of wins", () => {
    const history = [
      match("a", "2026-08-01", 0, 3),
      match("b", "2026-08-05", 3, 0, "Ronnie"),
      match("c", "2026-08-06", 3, 1, "Neil"),
    ];
    const now = match("d", "2026-08-10", 3, 0);
    const result = matchHighlights(
      now,
      [...history, now],
      {
        d: [frame("d", 1, "user"), frame("d", 2, "user"), frame("d", 3, "user")],
      },
      3
    );
    expect(kinds(result)).toEqual(["whitewash", "first-win", "streak"]);
    expect(result.find((item) => item.kind === "streak")?.label).toBe("3 WINS IN A ROW");
  });

  it("has nothing to say about a loss with no breaks", () => {
    const now = match("x", "2026-08-10", 1, 3);
    expect(matchHighlights(now, [now], {})).toEqual([]);
  });
});
