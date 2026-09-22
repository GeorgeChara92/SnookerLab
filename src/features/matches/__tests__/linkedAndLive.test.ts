import { mirrorFrame, mirrorMatch } from "../linked";
import { isLiveNow, snapshot } from "../liveScore";
import { createInitialLiveFrameState } from "../liveFrameEngine";
import type { LiveFrameRecord, Match } from "../../../types";

const match: Match = {
  id: "m1",
  user_id: "scorer",
  opponent_name: "Jo",
  opponent_id: "friend",
  opponent_status: "confirmed",
  date: "2026-09-22",
  match_type: "casual",
  format: "best_of",
  target_frames: 5,
  frames_played: 4,
  user_score: 3,
  opponent_score: 1,
  result: "win",
  recording_mode: "live",
  sync_status: "synced",
  created_at: "2026-09-22T10:00:00Z",
  updated_at: "2026-09-22T11:00:00Z",
};

const frame: LiveFrameRecord = {
  id: "f1",
  match_id: "m1",
  frame_number: 1,
  user_score: 72,
  opponent_score: 30,
  winner: "user",
  highest_break_user: 45,
  highest_break_opponent: 12,
  breaks: [{ player: "user", points: 45, endedBy: "visit_end", timestamp: "" }],
  events: [{ id: "e", kind: "pot", timestamp: "", player: "opponent", ball: "red", points: 1 }],
  created_at: "",
};

describe("friend matches", () => {
  it("turns a friend's match round to the player's side", () => {
    const mine = mirrorMatch(match, "Sam");
    expect(mine).toMatchObject({
      opponent_name: "Sam",
      opponent_id: "scorer",
      user_score: 1,
      opponent_score: 3,
      result: "loss",
      linked_by: "scorer",
    });
  });

  it("turns the frames round too", () => {
    const mine = mirrorFrame(frame);
    expect(mine).toMatchObject({
      user_score: 30,
      opponent_score: 72,
      winner: "opponent",
      highest_break_user: 12,
      highest_break_opponent: 45,
    });
    expect(mine.breaks[0].player).toBe("opponent");
    expect(mine.events[0].player).toBe("user");
  });
});

describe("live scores", () => {
  it("posts the frame in progress and the frames so far", () => {
    const state = {
      ...createInitialLiveFrameState(2),
      userScore: 18,
      opponentScore: 4,
      currentBreak: 11,
      atTable: "user" as const,
    };
    const row = snapshot(match, state, [frame], 5, false);
    expect(row).toMatchObject({
      match_id: "m1",
      opponent_id: "friend",
      frames_user: 1,
      frames_opponent: 0,
      frame_number: 2,
      points_user: 18,
      points_opponent: 4,
      current_break: 11,
      at_table: "user",
      high_break_user: 45,
      status: "live",
    });
    expect(row.frames).toEqual([{ n: 1, u: 72, o: 30, w: "user" }]);
  });

  it("clears the table once the match is over", () => {
    const row = snapshot(match, createInitialLiveFrameState(5), [frame], 5, true);
    expect(row).toMatchObject({ status: "finished", at_table: null, points_user: 0, remaining: null, frame_number: 1 });
  });

  it("treats a match not heard from in half an hour as stopped", () => {
    const now = Date.parse("2026-09-22T12:00:00Z");
    expect(isLiveNow({ status: "live", updatedAt: "2026-09-22T11:50:00Z" }, now)).toBe(true);
    expect(isLiveNow({ status: "live", updatedAt: "2026-09-22T11:00:00Z" }, now)).toBe(false);
    expect(isLiveNow({ status: "finished", updatedAt: "2026-09-22T11:59:00Z" }, now)).toBe(false);
  });
});
