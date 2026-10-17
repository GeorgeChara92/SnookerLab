import {
  buildDrawLinks,
  dayKeyOf,
  drawOrder,
  drawRounds,
  groupStageName,
  headToHead,
  matchKey,
  parseFrameScores,
  seasonRecord,
  slotLabel,
  fromEventRow,
  fromMatchRow,
  fromPlayerRow,
  fromRankingRow,
  fromRoundRow,
  groupByDay,
  groupMatches,
  isUndecided,
  kickoff,
  matchStatus,
  parseSessions,
  playerName,
  prizeMoney,
  resultPending,
  roundKey,
  roundShortTitle,
  roundTitle,
  sessionTimesKnown,
  streamName,
  tournamentKey,
  tournamentName,
  tournamentStatus,
  type ProTourRound,
} from "../liveScores";

const row = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  event_id: 2548,
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

// The Northern Ireland Open's round info, as snooker.org returns it (t=12&e=2548).
const NI_ROUNDS: ProTourRound[] = [
  [2770, 1, "Qual Round 1", 4, 128, 32, 0],
  [2770, 2, "Qual Round 2", 4, 96, 32, 1000],
  [2548, 7, "Round 1", 4, 64, 32, 3600],
  [2548, 8, "Round 2", 4, 32, 16, 5400],
  [2548, 9, "Round 3", 4, 16, 8, 9000],
  [2548, 13, "Quarterfinals", 5, 8, 4, 13200],
  [2548, 14, "Semifinals", 6, 4, 2, 21000],
  [2548, 15, "Final", 9, 2, 1, 45000],
  [2548, 17, "Final", 0, 1, 0, 100000],
].map(([eventId, round, RoundName, Distance, NumLeft, NumMatches, Money]) =>
  fromRoundRow({ event_id: eventId, round, name: RoundName, raw: { RoundName, Distance, NumLeft, NumMatches, Money, Currency: "GBP" } })
);
const ni = (round: number) => NI_ROUNDS.find((r) => r.eventId === 2548 && r.round === round);

describe("pro tour: matches", () => {
  it("maps a cache row, including the raw-backed fields", () => {
    const m = fromMatchRow(row({ estimated: "true", video_url: "https://www.youtube.com/watch?v=x", walkover1: "false", score1: 2 }));
    expect(m).toMatchObject({ id: 1, eventId: 2548, score1: 2, estimated: true, videoUrl: "https://www.youtube.com/watch?v=x", walkover: false });
  });

  it("classifies status from winner_id and unfinished", () => {
    expect(matchStatus(fromMatchRow(row()))).toBe("upcoming");
    expect(matchStatus(fromMatchRow(row({ unfinished: true })))).toBe("live");
    expect(matchStatus(fromMatchRow(row({ winner_id: 11 })))).toBe("finished");
  });

  it("never shows a bare id for a player", () => {
    expect(playerName({ 11: "Mark Williams" }, 11)).toBe("Mark Williams");
    expect(playerName({}, 22)).toBe("TBD");
    expect(playerName({}, null)).toBe("TBD");
  });

  it("treats the same placeholder on both sides as an undecided slot", () => {
    expect(isUndecided(fromMatchRow(row({ player1_id: 376, player2_id: 376 })))).toBe(true);
    expect(isUndecided(fromMatchRow(row()))).toBe(false);
  });

  it("orders upcoming soonest first and results most recent first", () => {
    const { live, upcoming, finished } = groupMatches([
      fromMatchRow(row({ id: 1, scheduled_at: "2026-10-20T09:00:00Z" })),
      fromMatchRow(row({ id: 2, unfinished: true })),
      fromMatchRow(row({ id: 3, winner_id: 11, scheduled_at: "2026-10-15T09:00:00Z" })),
      fromMatchRow(row({ id: 4, scheduled_at: "2026-10-18T09:00:00Z" })),
      fromMatchRow(row({ id: 5, winner_id: 22, scheduled_at: "2026-10-17T09:00:00Z" })),
    ]);
    expect(live.map((m) => m.id)).toEqual([2]);
    expect(upcoming.map((m) => m.id)).toEqual([4, 1]);
    expect(finished.map((m) => m.id)).toEqual([5, 3]);
  });

  it("names a stream from its link", () => {
    expect(streamName("https://www.youtube.com/watch?v=abc")).toBe("YouTube");
    expect(streamName("https://matchroom.live/snooker")).toBe("Matchroom.live");
    expect(streamName("https://example.org/live")).toBe("example.org");
  });
});

describe("pro tour: times", () => {
  it("reads a round where every match is at midnight UTC as 'time to be confirmed'", () => {
    const matches = [
      fromMatchRow(row({ id: 1, round: 9, scheduled_at: "2026-10-21T00:00:00Z" })),
      fromMatchRow(row({ id: 2, round: 9, scheduled_at: "2026-10-21T00:00:00Z" })),
      fromMatchRow(row({ id: 3, round: 7, scheduled_at: "2026-10-18T09:00:00Z" })),
    ];
    const known = sessionTimesKnown(matches);
    expect(kickoff(matches[0], known)).toMatchObject({ dayKey: "2026-10-21", timeKnown: false });
    expect(kickoff(matches[2], known)?.timeKnown).toBe(true);
  });

  it("keeps a real midnight-UTC session when the round has other times too", () => {
    const matches = [
      fromMatchRow(row({ id: 1, round: 3, scheduled_at: "2026-10-21T00:00:00Z" })),
      fromMatchRow(row({ id: 2, round: 3, scheduled_at: "2026-10-21T04:00:00Z" })),
    ];
    expect(kickoff(matches[0], sessionTimesKnown(matches))?.timeKnown).toBe(true);
  });

  it("puts a known time on the device's local day", () => {
    const m = fromMatchRow(row({ scheduled_at: "2026-10-18T09:00:00Z" }));
    const k = kickoff(m, sessionTimesKnown([m]));
    expect(k?.dayKey).toBe(dayKeyOf(new Date("2026-10-18T09:00:00Z")));
  });

  it("carries the estimated flag through", () => {
    const m = fromMatchRow(row({ scheduled_at: "2026-10-18T14:00:00Z", estimated: "true" }));
    expect(kickoff(m, sessionTimesKnown([m]))?.estimated).toBe(true);
  });

  it("groups by day, then tournament, then session time", () => {
    const events = { 2548: fromEventRow({ id: 2548, name: "Northern Ireland Open", raw: { Main: 2548 } }) };
    const days = groupByDay(
      [
        fromMatchRow(row({ id: 1, scheduled_at: "2026-10-18T09:00:00Z", number: 2 })),
        fromMatchRow(row({ id: 2, scheduled_at: "2026-10-18T09:00:00Z", number: 1 })),
        fromMatchRow(row({ id: 3, scheduled_at: "2026-10-18T12:00:00Z" })),
      ],
      events,
      new Date("2026-10-15T12:00:00Z")
    );
    expect(days).toHaveLength(1);
    expect(days[0].tournaments[0].name).toBe("Northern Ireland Open");
    expect(days[0].tournaments[0].sessions.map((s) => s.matches.map((m) => m.id))).toEqual([[2, 1], [3]]);
    expect(days[0].matchCount).toBe(3);
  });
});

describe("pro tour: rounds", () => {
  it("names rounds the way the sport does, from players left", () => {
    expect(roundTitle(ni(7), 7)).toBe("Last 64");
    expect(roundTitle(ni(8), 8)).toBe("Last 32");
    expect(roundTitle(ni(9), 9)).toBe("Last 16");
    expect(roundTitle(ni(13), 13)).toBe("Quarter-finals");
    expect(roundTitle(ni(14), 14)).toBe("Semi-finals");
    expect(roundTitle(ni(15), 15)).toBe("Final");
    expect(roundTitle(NI_ROUNDS[0], 1)).toBe("Qualifying round 1");
  });

  it("falls back to the match count, then to Round N", () => {
    expect(roundTitle(undefined, 13, 4)).toBe("Quarter-finals");
    expect(roundTitle(undefined, 9, 8)).toBe("Last 16");
    expect(roundTitle(undefined, 9, 6)).toBe("Round 9");
    expect(roundTitle(undefined, 9)).toBe("Round 9");
  });

  it("reads best of from the frames needed to win", () => {
    expect(ni(7)?.bestOf).toBe(7);
    expect(ni(15)?.bestOf).toBe(17);
    expect(NI_ROUNDS.find((r) => r.round === 17)?.bestOf).toBeNull();
  });

  it("shortens long titles for pills", () => {
    expect(roundShortTitle("Quarter-finals")).toBe("Quarters");
    expect(roundShortTitle("Last 64")).toBe("Last 64");
    expect(roundShortTitle("Qualifying round 2")).toBe("Qual R2");
  });

  it("names wildcard rounds", () => {
    const info = fromRoundRow({ event_id: 1, round: 1, name: "Wildcard Round", raw: { RoundName: "Wildcard Round", NumLeft: 136 } });
    expect(roundTitle(info, 1)).toBe("Wildcard round");
  });

  it("builds the prize money, winner first, with the total fund", () => {
    const prizes = prizeMoney(NI_ROUNDS);
    expect(prizes?.lines[0]).toEqual({ label: "Winner", amount: 100000, currency: "GBP" });
    expect(prizes?.lines[1]).toEqual({ label: "Runner-up", amount: 45000, currency: "GBP" });
    expect(prizes?.lines.map((l) => l.label)).toContain("Last 64");
    expect(prizes?.total).toBe(100000 + 45000 + 21000 * 2 + 13200 * 4 + 9000 * 8 + 5400 * 16 + 3600 * 32 + 1000 * 32);
  });
});

describe("pro tour: events, players, rankings", () => {
  it("reads an event row from raw", () => {
    const event = fromEventRow({ id: 2548, name: "Northern Ireland Open", raw: { Main: 2548, Type: "Ranking", Venue: "Waterfront Hall", NumCompetitors: 128 } });
    expect(event).toMatchObject({ type: "Ranking", venue: "Waterfront Hall", numCompetitors: 128 });
    expect(tournamentKey(event, 2548)).toBe(2548);
  });

  it("files a qualifying event under its parent tournament", () => {
    const qual = fromEventRow({ id: 2770, name: "Northern Ireland Open Qualifiers", raw: { Main: 2548 } });
    expect(tournamentKey(qual, 2770)).toBe(2548);
    expect(tournamentName({ 2770: qual }, 2548, 2770)).toBe("Northern Ireland Open");
  });

  it("reads a player and a ranking row", () => {
    expect(fromPlayerRow({ id: 1, display_name: "Mark Williams", raw: { Nationality: "Wales", NumMaximums: 3 } })).toMatchObject({ nationality: "Wales", numMaximums: 3 });
    expect(fromRankingRow({ PlayerID: 946, Position: 1, Sum: 1265550 })).toMatchObject({ playerId: 946, position: 1, sum: 1265550 });
  });

  it("describes where a tournament is at", () => {
    const event = fromEventRow({ id: 2548, start_date: "2026-10-18", end_date: "2026-10-25", raw: {} });
    expect(tournamentStatus(event, false, new Date(2026, 9, 15, 12)).label).toBe("Starts in 3 days");
    expect(tournamentStatus(event, false, new Date(2026, 9, 19, 12)).label).toBe("Day 2 of 8");
    expect(tournamentStatus(event, false, new Date(2026, 9, 27, 12)).label).toBe("Finished");
    expect(tournamentStatus(event, true).label).toBe("Live now");
  });

  it("keys rounds by event and number", () => {
    expect(roundKey(2548, 13)).toBe("2548:13");
  });
});

describe("pro tour: sessions", () => {
  it("reads later sessions from snooker.org's Central European time", () => {
    // The NI Open final: 13:00 UTC first session, "25.10.2026 20:00" (CET, after the clocks go back) = 19:00 UTC.
    expect(parseSessions("25.10.2026 20:00").map((d) => d.toISOString())).toEqual(["2026-10-25T19:00:00.000Z"]);
    // In summer time (CEST, UTC+2): 20:00 local is 18:00 UTC.
    expect(parseSessions("02.05.2026 20:00").map((d) => d.toISOString())).toEqual(["2026-05-02T18:00:00.000Z"]);
  });

  it("reads several sessions, in order, and nothing from an empty field", () => {
    expect(parseSessions("04.05.2026 14:00; 03.05.2026 20:00").map((d) => d.toISOString())).toEqual([
      "2026-05-03T18:00:00.000Z",
      "2026-05-04T12:00:00.000Z",
    ]);
    expect(parseSessions("")).toEqual([]);
    expect(parseSessions(null)).toEqual([]);
  });

  it("carries the sessions on the match", () => {
    expect(fromMatchRow(row({ sessions: "25.10.2026 20:00" })).laterSessions).toHaveLength(1);
  });
});


describe("pro tour: the draw", () => {
  const m = (id: number, eventId: number, round: number, number: number, p1: number | null, p2: number | null, extra: Record<string, unknown> = {}) =>
    fromMatchRow(row({ id, event_id: eventId, round, number, player1_id: p1, player2_id: p2, ...extra }));

  it("shows every round from the first fixtures to the final, with stand-ins for rounds not drawn", () => {
    const matches = [m(1, 2770, 2, 1, 11, 22), m(2, 2548, 7, 1, 33, 44), m(3, 2548, 15, 1, 376, 376)];
    const list = drawRounds(matches, NI_ROUNDS, 2548);
    expect(list.map((r) => r.title)).toEqual(["Qualifying round 2", "Last 64", "Last 32", "Last 16", "Quarter-finals", "Semi-finals", "Final"]);
    const last16 = list.find((r) => r.title === "Last 16");
    expect(last16?.matches).toHaveLength(0);
    expect(last16?.placeholders).toHaveLength(8);
    expect(last16?.placeholders.every((p) => p.id < 0)).toBe(true);
    expect(list.find((r) => r.title === "Final")?.placeholders).toHaveLength(0);
  });

  it("fills knockout rounds snooker.org hasn't published, down to the final", () => {
    // An old season: no round info at all, the last 64 and the final only.
    const last64 = Array.from({ length: 32 }, (_, i) => m(100 + i, 900, 7, i + 1, 1000 + i * 2, 1001 + i * 2));
    const list = drawRounds([...last64, m(200, 900, 15, 1, 1000, 1002)], [], 900);
    expect(list.map((r) => r.title)).toEqual(["Last 64", "Last 32", "Last 16", "Quarter-finals", "Semi-finals", "Final"]);
    expect(list.filter((r) => r.inferred).map((r) => r.placeholders.length)).toEqual([16, 8, 4, 2]);
  });

  it("carries on to the final when only the early rounds are known", () => {
    const last16 = Array.from({ length: 8 }, (_, i) => m(300 + i, 901, 9, i + 1, 2000 + i * 2, 2001 + i * 2));
    expect(drawRounds(last16, [], 901).map((r) => r.title)).toEqual(["Last 16", "Quarter-finals", "Semi-finals", "Final"]);
  });

  it("puts group stages first, by group, then the knockout (the Australian Women's Open)", () => {
    const groups = [2874, 2875, 2876];
    const infos = [
      ...groups.map((eventId) => fromRoundRow({ event_id: eventId, round: 19, name: "Round-Robin", raw: { RoundName: "Round-Robin", NumLeft: 0, NumMatches: 0 } })),
      ...[
        [7, "Round 1", 16, 8],
        [13, "Quarterfinals", 8, 4],
        [14, "Semifinals", 4, 2],
        [15, "Final", 2, 1],
      ].map(([round, RoundName, NumLeft, NumMatches]) =>
        fromRoundRow({ event_id: 2642, round, name: RoundName, raw: { RoundName, NumLeft, NumMatches, Distance: 4 } })
      ),
    ];
    const matches = groups.map((eventId, i) => m(500 + i, eventId, 19, 1, 11 + i, 21 + i));
    const names: Record<number, string> = { 2874: "Australian Women's Open - Group A", 2875: "Australian Women's Open - Group B", 2876: "Australian Women's - C" };
    const list = drawRounds(matches, infos, 2642, (id) => groupStageName(names[id]));
    expect(list.map((r) => r.title)).toEqual(["Group A", "Group B", "Group C", "Last 16", "Quarter-finals", "Semi-finals", "Final"]);
  });

  it("names an undecided slot after the match feeding it", () => {
    const links = buildDrawLinks([
      { FromEvent: 2548, FromRound: 14, FromNumber: 1, FromIndex: 1, ToEvent: 2548, ToRound: 15, ToNumber: 1, ToIndex: 1, PlayerID: 376 },
      { FromEvent: 2548, FromRound: 14, FromNumber: 1, FromIndex: 2, ToEvent: 2548, ToRound: 15, ToNumber: 1, ToIndex: 1, PlayerID: 376 },
    ]);
    const semi = m(10, 2548, 14, 1, 11, 22);
    const final = m(11, 2548, 15, 1, 376, 376);
    const byKey = new Map([[matchKey(2548, 14, 1), semi]]);
    const players = { 11: "Mark Selby", 22: "Xiao Guodong" };
    expect(slotLabel(final, 1, links, byKey, players)).toBe("Winner of Selby v Guodong");
    expect(slotLabel(final, 2, links, byKey, players)).toBeNull();
  });

  it("orders a round the way the draw runs, not by match number", () => {
    const links = buildDrawLinks([
      { FromEvent: 1, FromRound: 14, FromNumber: 2, ToEvent: 1, ToRound: 15, ToNumber: 1, ToIndex: 1 },
      { FromEvent: 1, FromRound: 14, FromNumber: 1, ToEvent: 1, ToRound: 15, ToNumber: 1, ToIndex: 2 },
      { FromEvent: 1, FromRound: 13, FromNumber: 4, ToEvent: 1, ToRound: 14, ToNumber: 2, ToIndex: 1 },
      { FromEvent: 1, FromRound: 13, FromNumber: 1, ToEvent: 1, ToRound: 14, ToNumber: 2, ToIndex: 2 },
      { FromEvent: 1, FromRound: 13, FromNumber: 3, ToEvent: 1, ToRound: 14, ToNumber: 1, ToIndex: 1 },
      { FromEvent: 1, FromRound: 13, FromNumber: 2, ToEvent: 1, ToRound: 14, ToNumber: 1, ToIndex: 2 },
    ]);
    const order = drawOrder(
      [
        { eventId: 1, round: 13, numbers: [1, 2, 3, 4] },
        { eventId: 1, round: 14, numbers: [1, 2] },
        { eventId: 1, round: 15, numbers: [1] },
      ],
      links
    );
    expect(order.get("1:14")).toEqual([2, 1]);
    expect(order.get("1:13")).toEqual([4, 1, 3, 2]);
  });
});

describe("pro tour: match detail", () => {
  it("reads frame scores by session", () => {
    const sessions = parseFrameScores("Session 1:<br/>0-136 (136), 72-45 (52), 10-80<br/>Session 2:<br/>65-0 (65)");
    expect(sessions).toHaveLength(2);
    expect(sessions[0].frames).toEqual([
      { p1: 0, p2: 136, breaks: "136" },
      { p1: 72, p2: 45, breaks: "52" },
      { p1: 10, p2: 80, breaks: null },
    ]);
    expect(sessions[1].label).toBe("Session 2");
    expect(parseFrameScores(null)).toEqual([]);
  });

  it("adds up a player's season", () => {
    const ms = [
      fromMatchRow(row({ id: 1, event_id: 1, player1_id: 5, player2_id: 6, score1: 4, score2: 2, winner_id: 5, scheduled_at: "2026-09-01T10:00:00Z" })),
      fromMatchRow(row({ id: 2, event_id: 1, player1_id: 7, player2_id: 5, score1: 4, score2: 3, winner_id: 7, scheduled_at: "2026-09-02T10:00:00Z" })),
      fromMatchRow(row({ id: 3, event_id: 2, player1_id: 5, player2_id: 8, score1: 4, score2: 0, winner_id: 5, scheduled_at: "2026-09-03T10:00:00Z" })),
    ];
    expect(seasonRecord(ms, 5, new Set([1]))).toEqual({ won: 1, lost: 1, framesWon: 7, framesLost: 6, form: ["L", "W"] });
    expect(seasonRecord(ms, 5).form).toEqual(["W", "L", "W"]);
  });

  it("reads head-to-head from either player's side", () => {
    const rows = [
      { EventID: 1, Player1ID: 5, Player2ID: 6, Score1: 6, Score2: 3, WinnerID: 5, StartDate: "2024-01-01" },
      { EventID: 2, Player1ID: 6, Player2ID: 5, Score1: 4, Score2: 1, WinnerID: 6, StartDate: "2025-01-01" },
      { EventID: 3, Player1ID: 5, Player2ID: 6, Score1: 0, Score2: 0, WinnerID: 0 },
    ];
    const h = headToHead(rows, 5);
    expect(h.winsA).toBe(1);
    expect(h.winsB).toBe(1);
    expect(h.meetings[0]).toMatchObject({ eventId: 2, scoreA: 1, scoreB: 4 });
  });
});

describe("pro tour: results that never arrived", () => {
  const now = new Date("2026-10-17T15:00:00Z").getTime();
  const base = fromMatchRow(row({ scheduled_at: "2026-10-17T05:00:00Z" }));

  it("stops calling a match live hours after it began", () => {
    const stuck = { ...base, unfinished: true, startedAt: "2026-10-17T05:25:00Z", score1: 1 };
    expect(resultPending(stuck, now)).toBe(true);
    expect(resultPending({ ...stuck, startedAt: "2026-10-17T12:00:00Z" }, now)).toBe(false);
  });

  it("counts a later session as the latest start", () => {
    const twoSessions = { ...base, unfinished: true, startedAt: "2026-10-17T05:00:00Z", laterSessions: [new Date("2026-10-17T13:00:00Z")] };
    expect(resultPending(twoSessions, now)).toBe(false);
  });

  it("gives a date-only fixture its whole day", () => {
    expect(resultPending({ ...base, scheduledAt: "2026-10-17T00:00:00Z" }, now)).toBe(false);
    expect(resultPending({ ...base, scheduledAt: "2026-10-16T00:00:00Z" }, now)).toBe(true);
  });

  it("never applies to a decided match", () => {
    expect(resultPending({ ...base, unfinished: true, winnerId: 11, startedAt: "2026-10-16T05:00:00Z" }, now)).toBe(false);
  });
});
