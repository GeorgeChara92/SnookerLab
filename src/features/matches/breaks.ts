import type { LiveFrameRecord, LiveFrameSide, Match } from "../../types";

/**
 * Breaks, from live scoring.
 *
 * Every visit scored ball by ball is kept on its frame, so the app knows each break the player
 * has made, not only the highest in each frame. That gives the numbers a snooker player talks
 * about: the high break, how many 20s, 50s and centuries, and the typical break once they are
 * among the balls.
 */

export type MadeBreak = {
  points: number;
  matchId: string;
  opponent: string;
  /** The match date, YYYY-MM-DD or ISO. */
  date: string;
  frameNumber: number;
};

/** The milestones players count, lowest first. */
export const MILESTONES = [20, 30, 50, 70, 100] as const;

/**
 * Breaks under this are a pot or two, not a break; the average is of the rest, so a handful of
 * single reds does not drag it down.
 */
export const AVERAGE_FROM = 10;

export type BreakStats = {
  /** Every scoring visit, highest first. */
  breaks: MadeBreak[];
  highest: MadeBreak | null;
  /** How many breaks reached each milestone. */
  milestones: Record<(typeof MILESTONES)[number], number>;
  /** Average of breaks of AVERAGE_FROM or more; null until there is one. */
  average: number | null;
  /** Frames scored ball by ball: the sample the numbers come from. */
  framesTracked: number;
};

export const breakStats = (
  matches: Match[],
  liveFramesByMatch: Record<string, LiveFrameRecord[]>,
  side: LiveFrameSide = "user"
): BreakStats => {
  const byId = new Map(matches.map((match) => [match.id, match]));
  const breaks: MadeBreak[] = [];
  let framesTracked = 0;

  Object.entries(liveFramesByMatch).forEach(([matchId, frames]) => {
    const match = byId.get(matchId);
    if (!match) return;
    frames.forEach((frame) => {
      framesTracked += 1;
      (frame.breaks ?? []).forEach((made) => {
        if (made.player !== side || !(made.points > 0)) return;
        breaks.push({
          points: made.points,
          matchId,
          opponent: match.opponent_name,
          date: match.date,
          frameNumber: frame.frame_number,
        });
      });
    });
  });

  // Highest first; the earlier one first when two are level, as that is when it was set.
  breaks.sort((a, b) => b.points - a.points || a.date.localeCompare(b.date) || a.frameNumber - b.frameNumber);
  const counted = breaks.filter((made) => made.points >= AVERAGE_FROM);

  return {
    breaks,
    highest: breaks[0] ?? null,
    milestones: Object.fromEntries(
      MILESTONES.map((mark) => [mark, breaks.filter((made) => made.points >= mark).length])
    ) as BreakStats["milestones"],
    average: counted.length ? counted.reduce((sum, made) => sum + made.points, 0) / counted.length : null,
    framesTracked,
  };
};

export type MatchCardFrame = { number: number; user: number; opponent: number; winner: "user" | "opponent" | null };

/** One match's frames and high breaks, for its result card. */
export const matchCard = (frames: LiveFrameRecord[]) => {
  const played = [...frames].filter((frame) => !frame.abandoned).sort((a, b) => a.frame_number - b.frame_number);
  const high = (side: LiveFrameSide) =>
    Math.max(
      0,
      ...played.flatMap((frame) => [
        ...(frame.breaks ?? []).filter((made) => made.player === side).map((made) => made.points),
        side === "user" ? (frame.highest_break_user ?? 0) : (frame.highest_break_opponent ?? 0),
      ])
    );
  return {
    frames: played.map<MatchCardFrame>((frame) => ({
      number: frame.frame_number,
      user: frame.user_score,
      opponent: frame.opponent_score,
      winner: frame.winner === "user" || frame.winner === "opponent" ? frame.winner : null,
    })),
    highUser: high("user"),
    highOpponent: high("opponent"),
    fiftiesUser: played.reduce(
      (sum, frame) => sum + (frame.breaks ?? []).filter((made) => made.player === "user" && made.points >= 50).length,
      0
    ),
  };
};
