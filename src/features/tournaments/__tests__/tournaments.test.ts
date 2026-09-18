import type { TournamentFixture } from "../../../types";
import { buildKnockoutFixtures, buildRandomDrawSlots, isBye, recomputeKnockoutTree } from "../knockout";
import { computeLeagueStandings } from "../leagueStandings";

const players = (count: number) => Array.from({ length: count }, (_, i) => `Player ${i + 1}`);

/** Plays every pending real-vs-real fixture (participant A wins) until the tree settles. */
const playOut = (fixtures: TournamentFixture[]) => {
  let current = fixtures;
  for (let guard = 0; guard < 100; guard += 1) {
    const playable = current.find(
      (f) => f.status === "pending" && !isBye(f.participant_a) && !isBye(f.participant_b) && f.participant_a !== "TBD" && f.participant_b !== "TBD"
    );
    if (!playable) break;
    current = recomputeKnockoutTree(
      current.map((f) => (f.id === playable.id ? { ...f, status: "completed", winner: f.participant_a, score_a: 1, score_b: 0 } : f))
    );
  }
  return current;
};

describe("knockout draw", () => {
  it.each([2, 3, 5, 6, 7, 9, 12, 17, 18, 31])("never pairs two BYEs for %i players", (count) => {
    const slots = buildRandomDrawSlots(players(count));
    for (let i = 0; i < slots.length; i += 2) {
      expect(isBye(slots[i]) && isBye(slots[i + 1])).toBe(false);
    }
    expect(slots.filter((slot) => !isBye(slot)).sort()).toEqual(players(count).sort());
  });

  it.each([3, 5, 9, 17, 18])("can be played through to a champion with %i players", (count) => {
    const fixtures = playOut(buildKnockoutFixtures("t1", players(count), 3, "random"));
    const finalRound = Math.max(...fixtures.map((f) => f.round_number));
    const final = fixtures.find((f) => f.round_number === finalRound)!;
    expect(final.status).toBe("completed");
    expect(players(count)).toContain(final.winner);
  });

  it("keeps manual pairings as entered and still completes when a BYE slot is empty", () => {
    const manual = [
      { participantA: "Ann", participantB: "Bob" },
      { participantA: "Cat", participantB: "Dan" },
      { participantA: "Eve", participantB: "BYE" },
    ];
    const fixtures = buildKnockoutFixtures("t1", [], 3, "manual", manual);
    const roundOne = fixtures.filter((f) => f.round_number === 1).map((f) => [f.participant_a, f.participant_b]);
    expect(roundOne.slice(0, 3)).toEqual([
      ["Ann", "Bob"],
      ["Cat", "Dan"],
      ["Eve", "BYE"],
    ]);

    const played = playOut(fixtures);
    const final = played.find((f) => f.round_number === 3)!;
    expect(final.status).toBe("completed");
  });
});

describe("league standings", () => {
  const fixture = (a: string, b: string, scoreA: number, scoreB: number): TournamentFixture => ({
    id: `${a}-${b}`,
    tournament_id: "t1",
    round_number: 1,
    fixture_index: 0,
    participant_a: a,
    participant_b: b,
    best_of_frames: 5,
    status: "completed",
    score_a: scoreA,
    score_b: scoreB,
  });

  it("awards points per match, not per frame", () => {
    const table = computeLeagueStandings(["Ann", "Bob"], [fixture("Ann", "Bob", 3, 2)]);
    expect(table.map((row) => [row.name, row.pts])).toEqual([
      ["Ann", 3],
      ["Bob", 0],
    ]);
  });

  it("breaks ties on frame difference, then head-to-head", () => {
    const table = computeLeagueStandings(
      ["Ann", "Bob", "Cat", "Dan"],
      [fixture("Bob", "Ann", 3, 2), fixture("Ann", "Cat", 3, 2), fixture("Dan", "Bob", 3, 2)]
    );
    // Dan: 3 pts, +1. Ann and Bob: 3 pts, level on frames; Bob won the head-to-head.
    expect(table.map((row) => row.name)).toEqual(["Dan", "Bob", "Ann", "Cat"]);
  });
});
