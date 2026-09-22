import type { LiveFrameRecord, Match } from "../../types";
import { getPointsRemaining, type LiveFrameState } from "./liveFrameEngine";

/**
 * A match followed live, as posted by the scorer's phone and read by everyone following it.
 * Pure, so what gets posted can be tested; liveShare.ts does the posting and reading.
 */

export type LiveFrameSummary = { n: number; u: number; o: number; w: string };

export type LiveScore = {
  matchId: string;
  userId: string;
  opponentId: string | null;
  opponentName: string;
  bestOf: number | null;
  framesUser: number;
  framesOpponent: number;
  frameNumber: number;
  pointsUser: number;
  pointsOpponent: number;
  currentBreak: number;
  atTable: "user" | "opponent" | null;
  remaining: number | null;
  highBreakUser: number;
  highBreakOpponent: number;
  frames: LiveFrameSummary[];
  status: "live" | "finished";
  startedAt: string;
  updatedAt: string;
};

/** A live match not touched for this long is taken to have stopped. */
export const STALE_MS = 30 * 60_000;

/** The row to post for the match as it stands. */
export const snapshot = (
  match: Match,
  frame: LiveFrameState,
  records: LiveFrameRecord[],
  bestOf: number | null,
  finished: boolean
) => {
  const played = records.filter((record) => !record.abandoned);
  return {
    match_id: match.id,
    opponent_id: match.opponent_id ?? null,
    opponent_name: match.opponent_name.slice(0, 60),
    best_of: bestOf,
    frames_user: played.filter((record) => record.winner === "user").length,
    frames_opponent: played.filter((record) => record.winner === "opponent").length,
    frame_number: finished ? played.length : frame.frameNumber,
    points_user: finished ? 0 : frame.userScore,
    points_opponent: finished ? 0 : frame.opponentScore,
    current_break: finished ? 0 : frame.currentBreak,
    at_table: finished || frame.phase === "ended" ? null : frame.atTable,
    remaining: finished ? null : getPointsRemaining(frame),
    high_break_user: Math.max(0, frame.highestBreakUser, ...played.map((record) => record.highest_break_user ?? 0)),
    high_break_opponent: Math.max(
      0,
      frame.highestBreakOpponent,
      ...played.map((record) => record.highest_break_opponent ?? 0)
    ),
    frames: played.map((record) => ({
      n: record.frame_number,
      u: record.user_score,
      o: record.opponent_score,
      w: record.winner,
    })),
    status: finished ? ("finished" as const) : ("live" as const),
  };
};

export type LiveRow = ReturnType<typeof snapshot>;

export const liveFromRow = (row: any): LiveScore => ({
  matchId: row.match_id,
  userId: row.user_id,
  opponentId: row.opponent_id ?? null,
  opponentName: row.opponent_name,
  bestOf: row.best_of ?? null,
  framesUser: row.frames_user ?? 0,
  framesOpponent: row.frames_opponent ?? 0,
  frameNumber: row.frame_number ?? 1,
  pointsUser: row.points_user ?? 0,
  pointsOpponent: row.points_opponent ?? 0,
  currentBreak: row.current_break ?? 0,
  atTable: row.at_table ?? null,
  remaining: row.remaining ?? null,
  highBreakUser: row.high_break_user ?? 0,
  highBreakOpponent: row.high_break_opponent ?? 0,
  frames: Array.isArray(row.frames) ? row.frames : [],
  status: row.status === "finished" ? "finished" : "live",
  startedAt: row.started_at,
  updatedAt: row.updated_at,
});

/** Whether a match is still going: live, and heard from recently. */
export const isLiveNow = (score: Pick<LiveScore, "status" | "updatedAt">, now = Date.now()) =>
  score.status === "live" && now - new Date(score.updatedAt).getTime() < STALE_MS;
