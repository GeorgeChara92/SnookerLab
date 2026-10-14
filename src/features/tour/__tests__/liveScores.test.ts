import {
  fromMatchRow,
  fromEventRow,
  fromPlayerRow,
  fromRankingRow,
  fromRoundRow,
  groupMatches,
  groupMatchesByTournament,
  matchStatus,
  formatScore,
  playerName,
  eventName,
  tournamentKey,
  roundLabel,
} from "../liveScores";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  event_id: 100,
  round: 7,
  number: 3,
  player1_id: 11,
  player2_id: 22,
  score1: 0,
  score2: 0,
  winner_id: null,
  unfinished: false,
  on_break: false,
  scheduled_at: "2026-10-18T09:00:00Z",
  live_url: null,
  details_url: null,
  table_no: null,
  note: null,
  ...overrides,
});

describe("pro tour live scores", () => {
  it("maps a cache row to a match", () => {
    const match = fromMatchRow(row({ score1: 2, score2: 1 }));
    expect(match).toMatchObject({ id: 1, eventId: 100, player1Id: 11, player2Id: 22, score1: 2, score2: 1 });
  });

  it("classifies status from winner_id and unfinished", () => {
    expect(matchStatus(fromMatchRow(row()))).toBe("upcoming");
    expect(matchStatus(fromMatchRow(row({ unfinished: true })))).toBe("live");
    expect(matchStatus(fromMatchRow(row({ winner_id: 11, score1: 4, score2: 1 })))).toBe("finished");
  });

  it("formats a score as score1-score2", () => {
    expect(formatScore(fromMatchRow(row({ score1: 3, score2: 2 })))).toBe("3-2");
  });

  it("shows TBD for a player not backfilled yet, same as a genuinely undecided slot", () => {
    expect(playerName({ 11: "Mark J Williams" }, 11)).toBe("Mark J Williams");
    expect(playerName({}, 22)).toBe("TBD");
    expect(playerName({}, null)).toBe("TBD");
  });

  it("falls back to a placeholder for an unknown event", () => {
    expect(eventName({}, 100)).toBe("Event 100");
  });

  it("groups matches into live, upcoming (soonest first) and finished (most recent first)", () => {
    const matches = [
      fromMatchRow(row({ id: 1, scheduled_at: "2026-10-20T00:00:00Z" })),
      fromMatchRow(row({ id: 2, unfinished: true })),
      fromMatchRow(row({ id: 3, winner_id: 11, scheduled_at: "2026-10-15T00:00:00Z" })),
      fromMatchRow(row({ id: 4, scheduled_at: "2026-10-18T00:00:00Z" })),
      fromMatchRow(row({ id: 5, winner_id: 22, scheduled_at: "2026-10-17T00:00:00Z" })),
    ];
    const { live, upcoming, finished } = groupMatches(matches);
    expect(live.map((m) => m.id)).toEqual([2]);
    expect(upcoming.map((m) => m.id)).toEqual([4, 1]);
    expect(finished.map((m) => m.id)).toEqual([5, 3]);
  });

  it("keeps a bracket slot nobody has reached yet (same placeholder id both sides) rather than hide the fixture", () => {
    const matches = [
      fromMatchRow(row({ id: 1, player1_id: 376, player2_id: 376 })),
      fromMatchRow(row({ id: 2, player1_id: 11, player2_id: 22 })),
    ];
    const { upcoming } = groupMatches(matches);
    expect(upcoming.map((m) => m.id).sort()).toEqual([1, 2]);
    expect(playerName({}, matches[0].player1Id)).toBe("TBD");
  });

  it("reads an event row, including its parent tournament id and venue from raw", () => {
    const event = fromEventRow({
      id: 2874,
      name: "Australian Women's Open - Group A",
      season: 2026,
      start_date: "2026-10-17",
      end_date: "2026-10-20",
      raw: { Main: 2642, Venue: "Mounties", City: "Sydney", Country: "Australia" },
    });
    expect(event).toMatchObject({ id: 2874, mainId: 2642, venue: "Mounties", country: "Australia" });
  });

  it("an event with no separate parent keeps its own id as mainId", () => {
    const event = fromEventRow({ id: 2548, name: "Northern Ireland Open", raw: { Main: 2548 } });
    expect(tournamentKey(event, 2548)).toBe(2548);
  });

  it("a qualifying group's tournament key is its parent event, not itself", () => {
    const event = fromEventRow({ id: 2874, raw: { Main: 2642 } });
    expect(tournamentKey(event, 2874)).toBe(2642);
  });

  it("reads a player's bio fields from raw", () => {
    const player = fromPlayerRow({
      id: 1,
      display_name: "Mark J Williams",
      raw: { Nationality: "Wales", Born: "1975-03-21", HighestRanking: 1, FirstSeasonAsPro: 1992, NumRankingTitles: 27 },
    });
    expect(player).toMatchObject({ name: "Mark J Williams", nationality: "Wales", highestRanking: 1, numRankingTitles: 27 });
  });

  it("looks up a round's real name per event, falling back to Round N until it's cached", () => {
    const rounds = { [`${2548}:${17}`]: "Quarter-Final" };
    expect(roundLabel(rounds, 2548, 17)).toBe("Quarter-Final");
    expect(roundLabel(rounds, 2548, 18)).toBe("Round 18");
    expect(roundLabel(rounds, 9999, 17)).toBe("Round 17");
  });

  it("reads a round-name row", () => {
    expect(fromRoundRow({ event_id: 2548, round: 19, name: "Final" })).toEqual({
      eventId: 2548,
      round: 19,
      name: "Final",
    });
  });

  it("reads a ranking row", () => {
    expect(fromRankingRow({ PlayerID: 946, Position: 1, Sum: 1265550, ChangePosition: 0 })).toEqual({
      playerId: 946,
      position: 1,
      sum: 1265550,
      changePosition: 0,
    });
  });

  it("groups matches by tournament, merging an event's qualifying groups under their parent", () => {
    const events = {
      2874: fromEventRow({ id: 2874, name: "Women's Open - Group A", raw: { Main: 2642 } }),
      2875: fromEventRow({ id: 2875, name: "Women's Open - Group B", raw: { Main: 2642 } }),
      2642: fromEventRow({ id: 2642, name: "Australian Women's Open", raw: { Main: 2642 } }),
      2548: fromEventRow({ id: 2548, name: "Northern Ireland Open", raw: { Main: 2548 } }),
    };
    const matches = [
      fromMatchRow(row({ id: 1, event_id: 2874, unfinished: true })),
      fromMatchRow(row({ id: 2, event_id: 2875, scheduled_at: "2026-10-18T00:00:00Z" })),
      fromMatchRow(row({ id: 3, event_id: 2548, scheduled_at: "2026-10-19T00:00:00Z" })),
    ];
    const groups = groupMatchesByTournament(matches, events);
    expect(groups.map((g) => g.tournamentId)).toEqual([2642, 2548]);
    expect(groups[0]).toMatchObject({ name: "Australian Women's Open", hasLive: true });
    expect(groups[0].live.map((m) => m.id)).toEqual([1]);
    expect(groups[0].upcoming.map((m) => m.id)).toEqual([2]);
  });

  it("falls back to a group's own name (suffix stripped) when the parent tournament has no event record", () => {
    const events = {
      2874: fromEventRow({ id: 2874, name: "Australian Women's Open - Group A", raw: { Main: 2642 } }),
      2875: fromEventRow({ id: 2875, name: "Australian Women's Open - Group B", raw: { Main: 2642 } }),
    };
    const matches = [
      fromMatchRow(row({ id: 1, event_id: 2874 })),
      fromMatchRow(row({ id: 2, event_id: 2875 })),
    ];
    const groups = groupMatchesByTournament(matches, events);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toMatchObject({ tournamentId: 2642, name: "Australian Women's Open" });
  });
});
