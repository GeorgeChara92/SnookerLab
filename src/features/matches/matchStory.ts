import type { LiveFrameRecord } from "../../types";

/**
 * The story of a match, the way a commentator would tell it: did it go to a decider, was it a
 * whitewash, did someone come from behind. Worked out from the frames in order.
 */

export type MatchStory = {
  /** Both players were one frame from the match before the last frame. */
  decider: boolean;
  /** The loser did not win a frame, over a match longer than one frame. */
  whitewash: boolean;
  /** The winner was behind by this many frames at some point (0 if never behind). */
  cameFromBehind: number;
  winner: "user" | "opponent" | null;
};

export const matchStory = (frames: LiveFrameRecord[], firstTo?: number): MatchStory => {
  const played = frames
    .filter((frame) => !frame.abandoned && (frame.winner === "user" || frame.winner === "opponent"))
    .sort((a, b) => a.frame_number - b.frame_number);

  let user = 0;
  let opponent = 0;
  let userWorst = 0;
  let opponentWorst = 0;
  let beforeLast = { user: 0, opponent: 0 };
  played.forEach((frame, index) => {
    if (index === played.length - 1) beforeLast = { user, opponent };
    if (frame.winner === "user") user += 1;
    else opponent += 1;
    userWorst = Math.max(userWorst, opponent - user);
    opponentWorst = Math.max(opponentWorst, user - opponent);
  });

  const winner = user > opponent ? "user" : opponent > user ? "opponent" : null;
  return {
    decider: Boolean(firstTo && firstTo > 1 && beforeLast.user === firstTo - 1 && beforeLast.opponent === firstTo - 1),
    whitewash: Boolean(winner && played.length > 1 && (winner === "user" ? opponent === 0 : user === 0)),
    cameFromBehind: winner === "user" ? userWorst : winner === "opponent" ? opponentWorst : 0,
    winner,
  };
};

/**
 * What the next frame means, for the live scoreboard: "DECIDER" when both players need one,
 * "MATCH FRAME" when one of them does.
 */
export const nextFrameStakes = (wins: { user: number; opponent: number }, firstTo?: number) => {
  if (!firstTo || firstTo < 2) return null;
  const userNeeds = firstTo - wins.user;
  const opponentNeeds = firstTo - wins.opponent;
  if (userNeeds <= 0 || opponentNeeds <= 0) return null;
  if (userNeeds === 1 && opponentNeeds === 1) return "DECIDER";
  if (userNeeds === 1 || opponentNeeds === 1) return "MATCH FRAME";
  return null;
};
