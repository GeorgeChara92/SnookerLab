/**
 * Scoring a frame when the connection is against you.
 *
 * A frame saved in a cellar with no signal has to stay on the scoreboard and reach Supabase
 * later. These tests hold both halves of that: the screen moves on the tap, and the write is
 * parked and sent unchanged once there is a connection.
 */

import type { LiveFrameRecord, Match } from "../../types";

type Recorded = { table: string; op: string; payload?: any; matches: Array<[string, any]> };

const recorded: Recorded[] = [];
let failTable: string | null = null;
/** What that table comes back with. A dropped connection by default. */
let failWith: any = { message: "offline" };

const chainFor = (table: string, op: string, payload?: any) => {
  const record: Recorded = { table, op, payload, matches: [] };
  recorded.push(record);

  const chain: any = {
    eq: (column: string, value: any) => {
      record.matches.push([column, value]);
      return chain;
    },
    select: () => chain,
    single: () => chain,
    order: () => chain,
    in: () => chain,
    then: (resolve: any, reject: any) =>
      Promise.resolve(failTable === table ? { data: null, error: failWith } : { data: null, error: null }).then(
        resolve,
        reject
      ),
  };

  return chain;
};

jest.mock("../../api/supabase", () => ({
  supabase: {
    auth: {
      // The local session, which is what a write with no signal has to lean on.
      getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
      getUser: async () => ({ data: { user: { id: "u1" } } }),
    },
    from: (table: string) => ({
      update: (payload: any) => chainFor(table, "update", payload),
      delete: () => chainFor(table, "delete"),
      insert: (payload: any) => chainFor(table, "insert", payload),
      upsert: (payload: any) => chainFor(table, "upsert", payload),
      select: () => chainFor(table, "select"),
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
const { useMatchesStore } = require("../matchesStore");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { useOutboxStore, flushOutbox } = require("../../sync/outbox");

const match: Match = {
  id: "m1",
  user_id: "u1",
  opponent_name: "Ben",
  date: "2026-09-20",
  match_type: "practice",
  format: "best_of",
  target_frames: 3,
  frames_played: 0,
  user_score: 0,
  opponent_score: 0,
  result: "draw",
  sync_status: "synced",
  created_at: "2026-09-20T09:00:00.000Z",
  updated_at: "2026-09-20T09:00:00.000Z",
};

const frame: Omit<LiveFrameRecord, "id" | "match_id" | "created_at"> = {
  frame_number: 1,
  user_score: 71,
  opponent_score: 34,
  winner: "user",
  highest_break_user: 43,
  highest_break_opponent: 18,
  breaks: [],
  events: [],
};

const writes = (table: string, op: string) => recorded.filter((item) => item.table === table && item.op === op);

beforeEach(() => {
  recorded.length = 0;
  failTable = null;
  failWith = { message: "offline" };
  useMatchesStore.setState({ matches: [match], liveFramesByMatch: {}, ownerUserId: "u1" });
  useOutboxStore.setState({ jobs: [], isFlushing: false, lastSyncedAt: null });
});

describe("saving a live frame", () => {
  it("puts the frame on the scoreboard and writes it", async () => {
    await useMatchesStore.getState().saveFrameRecord("m1", frame);

    const state = useMatchesStore.getState();
    expect(state.liveFramesByMatch.m1).toHaveLength(1);
    expect(state.matches[0]).toMatchObject({ user_score: 1, opponent_score: 0, frames_played: 1 });

    expect(writes("match_frames", "upsert")).toHaveLength(1);
    expect(writes("match_frames", "upsert")[0].payload).toMatchObject({
      match_id: "m1",
      frame_number: 1,
      user_score: 71,
      user_id: "u1",
    });
    expect(writes("matches", "update")[0].payload).toMatchObject({ user_score: 1, recording_mode: "live" });
  });

  it("keeps the frame and parks the write when there is no connection", async () => {
    failTable = "match_frames";

    await useMatchesStore.getState().saveFrameRecord("m1", frame);

    // The frame stays on the scoreboard whatever the network did.
    expect(useMatchesStore.getState().liveFramesByMatch.m1).toHaveLength(1);
    expect(useMatchesStore.getState().matches[0].user_score).toBe(1);

    const jobs = useOutboxStore.getState().jobs;
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ kind: "match.frame", scope: "matches" });
    expect(jobs[0].description).toContain("Ben");
  });

  it("sends the parked frame unchanged once there is a connection", async () => {
    failTable = "match_frames";
    await useMatchesStore.getState().saveFrameRecord("m1", frame);

    recorded.length = 0;
    failTable = null;

    const { sent } = await flushOutbox();

    expect(sent).toBe(1);
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
    expect(writes("match_frames", "upsert")[0].payload).toMatchObject({ frame_number: 1, user_score: 71 });
    expect(writes("matches", "update")).toHaveLength(1);
  });

  it("does not hide a missing table behind the queue", async () => {
    // A table that does not exist is a setup problem, not a bad connection. Queueing it would
    // retry forever and say nothing.
    failTable = "match_frames";
    failWith = { code: "42P01", message: "relation does not exist" };

    await expect(useMatchesStore.getState().saveFrameRecord("m1", frame)).rejects.toThrow(/Live frame table missing/);
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
  });
});

describe("starting a match", () => {
  const details = { ...match, user_id: "", opponent_name: "Sam", sync_status: "pending" as const };
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  const start = async (): Promise<Match> => {
    const { id, created_at, updated_at, ...rest } = details;
    return useMatchesStore.getState().addMatch(rest);
  };

  it("is on the scoreboard straight away, with an id the server will keep", async () => {
    const started = await start();

    expect(started.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(useMatchesStore.getState().matches[0].id).toBe(started.id);

    await settle();
    expect(writes("matches", "insert")[0].payload).toMatchObject({ id: started.id, user_id: "u1", opponent_name: "Sam" });
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
  });

  it("starts with no connection and reaches the server later", async () => {
    failTable = "matches";
    const started = await start();
    await settle();

    expect(useMatchesStore.getState().getMatchById(started.id)).toBeDefined();
    expect(useOutboxStore.getState().jobs[0]).toMatchObject({ kind: "match.create", scope: "matches" });

    failTable = null;
    await flushOutbox();
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
  });

  it("sends what happens in the match after the match itself", async () => {
    failTable = "matches";
    const started = await start();
    await settle();
    recorded.length = 0;
    failTable = null;

    await useMatchesStore.getState().saveFrameRecord(started.id, frame);
    await useMatchesStore.getState().updateMatch(started.id, { notes: "Good game" });
    expect(recorded).toHaveLength(0);
    expect(useOutboxStore.getState().jobs.map((job: any) => job.kind)).toEqual(["match.create", "match.frame", "match.update"]);

    await flushOutbox();
    expect(recorded.map((item) => `${item.table}.${item.op}`)).toEqual([
      "matches.insert",
      "match_frames.upsert",
      "matches.update",
      "matches.update",
    ]);
  });

  it("deletes a match left straight away after it has landed, so no 0-0 is left behind", async () => {
    failTable = "matches";
    const started = await start();
    await settle();
    recorded.length = 0;
    failTable = null;

    await useMatchesStore.getState().deleteMatch(started.id);
    await flushOutbox();
    expect(recorded.map((item) => item.op)).toEqual(["insert", "delete"]);
  });

  it("does not send a match twice when the first answer was lost", async () => {
    failTable = "matches";
    await start();
    await settle();

    failWith = { code: "23505", message: "duplicate key" };
    await flushOutbox();
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
  });

  it("withdraws the match and what was scored in it if the plan's limit turns it down", async () => {
    failTable = "matches";
    const started = await start();
    await settle();
    await useMatchesStore.getState().saveFrameRecord(started.id, frame);

    failWith = { message: "subscription_limit_exceeded: matches" };
    await flushOutbox();

    const state = useMatchesStore.getState();
    expect(state.getMatchById(started.id)).toBeUndefined();
    expect(state.liveFramesByMatch[started.id]).toBeUndefined();
    expect(state.refusedMatchId).toBe(started.id);
    expect(useOutboxStore.getState().jobs).toHaveLength(0);
  });

  it("is not wiped by a refresh before it has reached the server", async () => {
    failTable = "matches";
    const started = await start();
    await settle();
    await useMatchesStore.getState().saveFrameRecord(started.id, frame);
    failTable = null;

    await useMatchesStore.getState().hydrateMatchesForUser("u1");

    const state = useMatchesStore.getState();
    expect(state.getMatchById(started.id)).toBeDefined();
    expect(state.liveFramesByMatch[started.id]).toHaveLength(1);
  });
});

describe("deleting a match", () => {
  it("takes it off the list and parks the delete when offline", async () => {
    failTable = "matches";

    await useMatchesStore.getState().deleteMatch("m1");

    expect(useMatchesStore.getState().matches).toHaveLength(0);
    expect(useOutboxStore.getState().jobs[0]).toMatchObject({ kind: "match.delete", scope: "matches" });
  });

  it("sends the delete when the connection returns", async () => {
    failTable = "matches";
    await useMatchesStore.getState().deleteMatch("m1");

    recorded.length = 0;
    failTable = null;
    await flushOutbox();

    const deletes = writes("matches", "delete");
    expect(deletes).toHaveLength(1);
    expect(deletes[0].matches).toEqual([
      ["id", "m1"],
      ["user_id", "u1"],
    ]);
  });
});
