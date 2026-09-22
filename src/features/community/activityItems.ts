import type { Match } from "../../types";
import type { Highlight } from "../matches/highlights";
import { bestOfFor } from "../matches/bestOf";
import { countsAsResult, getRecordingMode } from "../matches/matchSummary";

/**
 * What goes in the feed friends and group-mates see, written from the player's numbers. Pure,
 * so it can be tested; useActivitySync posts them.
 */

export type ActivityKind =
  "match" | "century" | "maximum" | "high_break" | "personal_best" | "level_up" | "achievement";

export type ActivityDraft = {
  kind: ActivityKind;
  title: string;
  detail: string | null;
  payload: Record<string, unknown> | null;
  /** The same moment is only ever posted once. */
  dedupeKey: string;
};

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/**
 * Whether a match is over. A manual entry is a result as soon as it is saved; a live one when a
 * player has won enough frames. A live match of no set length never says, so it is not posted.
 */
export const matchFinished = (match: Match) => {
  if (!countsAsResult(match)) return false;
  if (getRecordingMode(match) !== "live") return true;
  const bestOf = bestOfFor(match);
  if (!bestOf) return false;
  const firstTo = Math.floor(bestOf / 2) + 1;
  return match.user_score >= firstTo || match.opponent_score >= firstTo;
};

/**
 * A finished match, as one feed item led by its best moment: a maximum, a century, a new high
 * break, or the win. Losses and draws without one of those are the player's business, and are
 * not posted.
 */
export const matchActivity = (match: Match, highlights: Highlight[], highBreak: number): ActivityDraft | null => {
  const score = `${match.user_score}–${match.opponent_score}`;
  const won = match.user_score > match.opponent_score;
  const lost = match.user_score < match.opponent_score;
  const outcome = won
    ? `Beat ${match.opponent_name} ${score}`
    : lost
      ? `Lost to ${match.opponent_name} ${score}`
      : `Drew with ${match.opponent_name} ${score}`;
  const has = (kind: Highlight["kind"]) => highlights.some((item) => item.kind === kind);

  let kind: ActivityKind;
  let title: string;
  let detail: string | null;
  if (has("maximum")) {
    kind = "maximum";
    title = `Made a maximum 147 against ${match.opponent_name}`;
    detail = outcome;
  } else if (has("century")) {
    kind = "century";
    title = `Made a ${highBreak} break against ${match.opponent_name}`;
    detail = outcome;
  } else if (has("personal-best")) {
    kind = "high_break";
    title = `New high break: ${highBreak}`;
    detail = outcome;
  } else if (won) {
    kind = "match";
    title = outcome;
    detail = null;
  } else {
    return null;
  }

  const others = highlights
    .filter((item) => !["maximum", "century", "personal-best"].includes(item.kind))
    .map((item) => item.sentence);
  if (others.length) detail = [detail, ...others].filter(Boolean).join(" ");

  return {
    kind,
    title: clip(title, 120),
    detail: detail ? clip(detail, 200) : null,
    payload: {
      matchId: match.id,
      userScore: match.user_score,
      opponentScore: match.opponent_score,
      opponent: clip(match.opponent_name, 60),
      bestOf: bestOfFor(match) ?? null,
      highBreak: highBreak || null,
    },
    dedupeKey: `match:${match.id}`,
  };
};

/** A new best on a routine that has a leaderboard. */
export const personalBestActivity = (routineKey: string, name: string, raw: string): ActivityDraft => ({
  kind: "personal_best",
  title: clip(`New best on ${name}`, 120),
  detail: raw,
  payload: { routineKey, name: clip(name, 60), raw },
  dedupeKey: clip(`pb:${routineKey}:${raw}`, 120),
});

export const levelActivity = (level: number): ActivityDraft => ({
  kind: "level_up",
  title: `Reached level ${level}`,
  detail: null,
  payload: { level },
  dedupeKey: `level:${level}`,
});

/** Only the hardest achievements are worth telling people about. */
export const achievementActivity = (achievement: {
  id: string;
  title: string;
  description: string;
  tier: string;
}): ActivityDraft | null =>
  achievement.tier === "gold" || achievement.tier === "platinum"
    ? {
        kind: "achievement",
        title: clip(`Unlocked ${achievement.title}`, 120),
        detail: clip(achievement.description, 200),
        payload: { achievementId: achievement.id, tier: achievement.tier },
        dedupeKey: `achievement:${achievement.id}`,
      }
    : null;

/** Whether a new score beats the old best; for a timed routine, less is better. */
export const beats = (value: number, previous: number | undefined, kind: string) =>
  previous === undefined ? false : kind === "time" ? value < previous : value > previous;
