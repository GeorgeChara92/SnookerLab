import { buildLeagueSchedule, leagueRoundCount, leagueTieCount } from "../leagueSchedule";

const players = (count: number) => Array.from({ length: count }, (_, i) => `P${i + 1}`);
const pairKey = (a: string, b: string) => [a, b].sort().join(" v ");

describe("league schedule", () => {
  it.each([3, 4, 5, 6, 8, 9])("has every pair exactly once for %i players", (count) => {
    const schedule = buildLeagueSchedule(players(count));
    const seen = schedule.map((tie) => pairKey(tie.home, tie.away));

    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toHaveLength(leagueTieCount(count));
  });

  it.each([3, 4, 5, 6, 8, 9])("never asks a player to play twice in a round (%i players)", (count) => {
    const schedule = buildLeagueSchedule(players(count));

    const byRound = new Map<number, string[]>();
    for (const tie of schedule) {
      byRound.set(tie.round, [...(byRound.get(tie.round) ?? []), tie.home, tie.away]);
    }

    byRound.forEach((names) => {
      expect(new Set(names).size).toBe(names.length);
    });
  });

  it("runs the right number of rounds", () => {
    // Four players: three rounds of two ties. Five players: five rounds, one sitting out each.
    expect(new Set(buildLeagueSchedule(players(4)).map((t) => t.round)).size).toBe(leagueRoundCount(4));
    expect(leagueRoundCount(4)).toBe(3);
    expect(new Set(buildLeagueSchedule(players(5)).map((t) => t.round)).size).toBe(leagueRoundCount(5));
    expect(leagueRoundCount(5)).toBe(5);
  });

  it("plays everyone the requested number of times", () => {
    const schedule = buildLeagueSchedule(players(4), 3);
    const counts = new Map<string, number>();
    schedule.forEach((tie) => {
      const key = pairKey(tie.home, tie.away);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

    expect(schedule).toHaveLength(leagueTieCount(4, 3));
    expect(new Set(counts.values())).toEqual(new Set([3]));
    expect(new Set(schedule.map((t) => t.round)).size).toBe(leagueRoundCount(4, 3));
  });

  it("swaps who is listed first on the second meeting", () => {
    const schedule = buildLeagueSchedule(players(4), 2);
    const first = schedule.find((tie) => tie.round === 1)!;
    const rematch = schedule.find(
      (tie) => tie.round > 3 && pairKey(tie.home, tie.away) === pairKey(first.home, first.away)
    )!;

    expect(rematch.home).toBe(first.away);
    expect(rematch.away).toBe(first.home);
  });

  it("returns nothing for a field too small to play", () => {
    expect(buildLeagueSchedule(players(1))).toEqual([]);
    expect(buildLeagueSchedule([])).toEqual([]);
  });
});
