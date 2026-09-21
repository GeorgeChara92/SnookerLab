import { findOpponent, knownOpponents, searchOpponents } from "../opponents";
import type { Match } from "../../../types";

const match = (opponent: string, date: string, result: Match["result"], extra: Partial<Match> = {}): Match =>
  ({
    id: `${opponent}-${date}`,
    user_id: "u",
    opponent_name: opponent,
    date,
    match_type: "league",
    format: "best_of",
    target_frames: 5,
    frames_played: 3,
    user_score: result === "win" ? 3 : 1,
    opponent_score: result === "win" ? 1 : 3,
    result,
    sync_status: "synced",
    created_at: date,
    updated_at: date,
    ...extra,
  }) as Match;

const matches = [
  match("Judd", "2026-09-01", "win", { location: "The Crucible" }),
  match("judd ", "2026-09-10", "loss", { location: "Q Club", target_frames: 7 }),
  match("Ronnie", "2026-09-05", "win"),
  match("Neil", "2026-09-12", "draw", { frames_played: 0, user_score: 0, opponent_score: 0 }),
];

describe("known opponents", () => {
  it("merges spellings, keeps the latest match, and counts only finished ones", () => {
    const known = knownOpponents(matches);
    expect(known.map((o) => o.name)).toEqual(["Neil", "judd", "Ronnie"]);
    const judd = known[1];
    expect(judd).toMatchObject({ played: 2, wins: 1, losses: 1, lastPlayed: "2026-09-10" });
    expect(judd.last.location).toBe("Q Club");
    expect(known[0].played).toBe(0);
  });

  it("finds an opponent whatever the capitals", () => {
    expect(findOpponent("  JUDD", knownOpponents(matches))?.name).toBe("judd");
    expect(findOpponent("Mark", knownOpponents(matches))).toBeUndefined();
  });

  it("suggests names as they are typed", () => {
    const known = knownOpponents(matches);
    expect(searchOpponents("ro", known).map((o) => o.name)).toEqual(["Ronnie"]);
    expect(searchOpponents("n", known).map((o) => o.name)).toEqual(["Neil", "Ronnie"]);
    expect(searchOpponents("", known)).toHaveLength(3);
  });
});
