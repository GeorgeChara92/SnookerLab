import type { LiveFrameRecord, Match } from "../../types";

/**
 * A match a friend scored against the player, turned round to the player's side: their score
 * first, the friend as the opponent, a win where the friend lost. It keeps the friend's id in
 * linked_by, so screens know it is theirs to read, not to edit. Pure, for testing.
 */

type Side = "user" | "opponent";
const flip = (side: Side | undefined): Side | undefined =>
  side === "user" ? "opponent" : side === "opponent" ? "user" : side;

export const mirrorMatch = (match: Match, scorerName: string): Match => ({
  ...match,
  opponent_name: scorerName,
  opponent_id: match.user_id,
  user_score: match.opponent_score,
  opponent_score: match.user_score,
  result: match.result === "win" ? "loss" : match.result === "loss" ? "win" : "draw",
  linked_by: match.user_id,
});

export const mirrorFrame = (frame: LiveFrameRecord): LiveFrameRecord => ({
  ...frame,
  user_score: frame.opponent_score,
  opponent_score: frame.user_score,
  winner: frame.winner === "user" ? "opponent" : frame.winner === "opponent" ? "user" : frame.winner,
  highest_break_user: frame.highest_break_opponent,
  highest_break_opponent: frame.highest_break_user,
  breaks: (frame.breaks ?? []).map((made) => ({ ...made, player: flip(made.player as Side) as Side })),
  events: (frame.events ?? []).map((event) => ({ ...event, player: flip(event.player) })),
});

/** Whether a match was scored by someone else and only shared with the player. */
export const isLinkedIn = (match: Pick<Match, "linked_by">) => Boolean(match.linked_by);
