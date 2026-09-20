/**
 * What reaches Supabase when a scoreline is saved.
 *
 * Saving used to rewrite every fixture and every frame in the tournament. It now writes only
 * what moved, so these tests pin down that the right rows still go, and that a failed write
 * puts the screen back rather than leaving a result that was never stored.
 */

import type { Tournament, TournamentFixture } from "../../types";

type Recorded = {
  table: string;
  op: "update" | "delete" | "insert";
  payload?: any;
  match?: [string, any];
};

const recorded: Recorded[] = [];
/** Set to a table name to make every write to it come back with an error. */
let failTable: string | null = null;

const outcome = (table: string) =>
  Promise.resolve(failTable === table ? { error: { message: "network" } } : { error: null });

jest.mock("../../api/supabase", () => ({
  supabase: {
    from: (table: string) => ({
      update: (payload: any) => ({
        eq: (column: string, value: any) => {
          recorded.push({ table, op: "update", payload, match: [column, value] });
          return outcome(table);
        },
      }),
      delete: () => ({
        eq: (column: string, value: any) => {
          recorded.push({ table, op: "delete", match: [column, value] });
          return outcome(table);
        },
      }),
      insert: (payload: any) => {
        recorded.push({ table, op: "insert", payload });
        return outcome(table);
      },
    }),
  },
}));

jest.mock("../../utils/storage", () => ({
  safeStorage: {
    getItem: async () => null,
    setItem: async () => undefined,
    removeItem: async () => undefined,
  },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useTournamentsStore } = require("../tournamentsStore");

const fixture = (over: Partial<TournamentFixture> & { id: string }): TournamentFixture => ({
  tournament_id: "t1",
  round_number: 1,
  fixture_index: 0,
  participant_a: "Alice",
  participant_b: "Ben",
  best_of_frames: 3,
  status: "pending",
  ...over,
});

const tournament = (over: Partial<Tournament> = {}): Tournament => ({
  id: "t1",
  name: "Club League",
  date: "2026-09-20",
  tournament_type: "league",
  entry_mode: "singles",
  pairing_mode: "random",
  best_of_frames: 3,
  participants: ["Alice", "Ben", "Cara"],
  fixtures: [
    fixture({ id: "f1" }),
    fixture({ id: "f2", fixture_index: 1, participant_a: "Cara", participant_b: "Ben" }),
    fixture({ id: "f3", fixture_index: 2, participant_a: "Alice", participant_b: "Cara" }),
  ],
  status: "active",
  created_at: "2026-09-01T10:00:00.000Z",
  updated_at: "2026-09-01T10:00:00.000Z",
  ...over,
});

const twoNil = [
  { frame_number: 1, score_a: 74, score_b: 21, winner: "a" as const },
  { frame_number: 2, score_a: 66, score_b: 40, winner: "a" as const },
];

const writes = (table: string, op: Recorded["op"]) =>
  recorded.filter((item) => item.table === table && item.op === op);

beforeEach(() => {
  recorded.length = 0;
  failTable = null;
  useTournamentsStore.setState({ tournaments: [tournament()], ownerUserId: "u1" });
});

describe("saving a league result", () => {
  it("writes the fixture that was played, and nothing else", async () => {
    await useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil });

    const fixtureWrites = writes("tournament_fixtures", "update");
    expect(fixtureWrites).toHaveLength(1);
    expect(fixtureWrites[0].match).toEqual(["id", "f1"]);
    expect(fixtureWrites[0].payload).toMatchObject({
      score_a: 2,
      score_b: 0,
      winner: "Alice",
      status: "completed",
    });
  });

  it("replaces the frames for that fixture only", async () => {
    await useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil });

    const deletes = writes("tournament_fixture_frames", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].match).toEqual(["fixture_id", "f1"]);

    const inserts = writes("tournament_fixture_frames", "insert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual([
      { fixture_id: "f1", frame_number: 1, score_a: 74, score_b: 21, winner: "a" },
      { fixture_id: "f1", frame_number: 2, score_a: 66, score_b: 40, winner: "a" },
    ]);
  });

  it("keeps the tournament row in step", async () => {
    await useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil });

    const rows = writes("tournaments", "update");
    expect(rows).toHaveLength(1);
    expect(rows[0].match).toEqual(["id", "t1"]);
    expect(rows[0].payload.status).toBe("active");
    expect(typeof rows[0].payload.updated_at).toBe("string");
  });

  it("marks the tournament complete once the last fixture is in", async () => {
    const played = { ...twoNil[0] };
    useTournamentsStore.setState({
      tournaments: [
        tournament({
          fixtures: [
            fixture({ id: "f1", status: "completed", score_a: 2, score_b: 0, winner: "Alice", frame_scores: twoNil }),
            fixture({
              id: "f2",
              fixture_index: 1,
              participant_a: "Cara",
              participant_b: "Ben",
              status: "completed",
              score_a: 2,
              score_b: 0,
              winner: "Cara",
              frame_scores: twoNil,
            }),
            fixture({ id: "f3", fixture_index: 2, participant_a: "Alice", participant_b: "Cara" }),
          ],
        }),
      ],
    });

    await useTournamentsStore.getState().updateFixtureResult("t1", "f3", { frameScores: [played, twoNil[1]] });

    expect(writes("tournaments", "update")[0].payload.status).toBe("completed");
  });

  it("updates the screen before the writes come back", async () => {
    const pending = useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil });

    const saved = useTournamentsStore
      .getState()
      .tournaments[0].fixtures.find((item: TournamentFixture) => item.id === "f1");
    expect(saved).toMatchObject({ score_a: 2, score_b: 0, winner: "Alice", status: "completed" });

    await pending;
  });
});

describe("saving a knockout result", () => {
  const knockout = () =>
    tournament({
      tournament_type: "knockout",
      participants: ["Alice", "Ben", "Cara", "Dan"],
      fixtures: [
        fixture({ id: "k1" }),
        fixture({ id: "k2", fixture_index: 1, participant_a: "Cara", participant_b: "Dan" }),
        fixture({
          id: "k3",
          round_number: 2,
          fixture_index: 0,
          participant_a: "TBD",
          participant_b: "TBD",
        }),
      ],
    });

  it("carries the winner into the next round and writes that row too", async () => {
    useTournamentsStore.setState({ tournaments: [knockout()] });

    await useTournamentsStore.getState().updateFixtureResult("t1", "k1", { frameScores: twoNil });

    const ids = writes("tournament_fixtures", "update").map((item) => item.match?.[1]);
    expect(ids).toEqual(expect.arrayContaining(["k1", "k3"]));
    expect(ids).not.toContain("k2");

    const final = writes("tournament_fixtures", "update").find((item) => item.match?.[1] === "k3");
    expect(final?.payload).toMatchObject({ participant_a: "Alice", participant_b: "TBD" });
  });
});

describe("when Supabase refuses the write", () => {
  it("puts the scoreline back and says so", async () => {
    failTable = "tournament_fixtures";

    await expect(
      useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil })
    ).rejects.toBeDefined();

    const reverted = useTournamentsStore
      .getState()
      .tournaments[0].fixtures.find((item: TournamentFixture) => item.id === "f1");
    expect(reverted?.status).toBe("pending");
    expect(reverted?.score_a).toBeUndefined();
    expect(useTournamentsStore.getState().tournaments[0].status).toBe("active");
  });

  it("puts it back when the frames are the part that fails", async () => {
    failTable = "tournament_fixture_frames";

    await expect(
      useTournamentsStore.getState().updateFixtureResult("t1", "f1", { frameScores: twoNil })
    ).rejects.toBeDefined();

    const reverted = useTournamentsStore
      .getState()
      .tournaments[0].fixtures.find((item: TournamentFixture) => item.id === "f1");
    expect(reverted?.status).toBe("pending");
  });
});
