import type { LiveFrameRecord, Match } from "../../types";
import { bestOfFor } from "../matches/bestOf";
import { matchCard } from "../matches/breaks";
import { matchHighlights } from "../matches/highlights";
import type { MatchShare } from "./chatShare";

/** A match result as a chat card: the score, the length, the high break and the highlights. */
export const matchShareFor = (
  match: Match,
  matches: Match[],
  liveFramesByMatch: Record<string, LiveFrameRecord[]>
): MatchShare => {
  const bestOf = bestOfFor(match);
  const highlights = matchHighlights(
    match,
    matches,
    liveFramesByMatch,
    bestOf ? Math.floor(bestOf / 2) + 1 : undefined
  );
  const high = matchCard(liveFramesByMatch[match.id] ?? []).highUser;
  return {
    kind: "match",
    opponent: match.opponent_name,
    userScore: match.user_score,
    opponentScore: match.opponent_score,
    result: match.user_score > match.opponent_score ? "win" : match.user_score < match.opponent_score ? "loss" : "draw",
    date: match.date,
    bestOf: bestOf ?? null,
    highBreak: high || null,
    highlights: highlights.map((item) => item.label),
  };
};
