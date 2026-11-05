import type { LiveFoulType } from "./liveFrameEngine";

/**
 * A foul added from a scan, without leaving it.
 *
 * Scan Snooker and Record a Snooker open on top of the live scoring screen, which keeps the frame's
 * state. The live screen offers to take fouls for its match here, and a scan on top of it adds one
 * through that offer - so the player can put the balls back and give away the points from the same
 * screen, instead of leaving it, losing the calibration and scanning the table again.
 */

export type FoulTarget = {
  frameNumber: () => number;
  /** False once the frame is over and there is nothing left to give points away in. */
  open: () => boolean;
  /** The least the foul can be worth with the ball that is on. */
  minimum: () => 4 | 5 | 6 | 7;
  /** Who the points go to. */
  awardedTo: () => string;
  /** Adds the foul to the frame and says what was added, e.g. "Foul and a miss: 5 to Ben". */
  apply: (value: 4 | 5 | 6 | 7, type: LiveFoulType, note?: string) => string;
};

const targets = new Map<string, FoulTarget>();

/** Called by the live scoring screen while it is open; the returned function takes the offer back. */
export const offerFouls = (matchId: string, target: FoulTarget) => {
  targets.set(matchId, target);
  return () => {
    if (targets.get(matchId) === target) targets.delete(matchId);
  };
};

/** Where a foul in this frame can go, or null if the frame is not open underneath. */
export const foulTargetFor = (matchId: string, frameNumber: number) => {
  const target = targets.get(matchId);
  return target && target.frameNumber() === frameNumber && target.open() ? target : null;
};
