import type { LiveFrameRecord, Match } from "../../types";
import { countsAsResult } from "./matchSummary";
import { matchStory } from "./matchStory";

/**
 * What made a match worth talking about, for the player: a maximum, a century, a new highest
 * break, a whitewash, a first win over someone. Most remarkable first, so the card can lead with
 * the best of them and the message can say it in words.
 */

export type HighlightKind =
  "maximum" | "century" | "personal-best" | "fifties" | "whitewash" | "comeback" | "decider" | "first-win" | "streak";

export type Highlight = {
  kind: HighlightKind;
  /** For the card: short, in capitals. */
  label: string;
  /** For the message: a sentence. */
  sentence: string;
};

const userBreaks = (frames: LiveFrameRecord[]) =>
  frames
    .filter((frame) => !frame.abandoned)
    .flatMap((frame) => [
      ...(frame.breaks ?? []).filter((made) => made.player === "user").map((made) => made.points),
      frame.highest_break_user ?? 0,
    ]);

/** Whether one match was played before another: by date, then by when it was entered. */
const before = (a: Match, b: Match) => a.date < b.date || (a.date === b.date && a.created_at < b.created_at);

export const matchHighlights = (
  match: Match,
  matches: Match[],
  liveFramesByMatch: Record<string, LiveFrameRecord[]>,
  firstTo?: number
): Highlight[] => {
  const frames = liveFramesByMatch[match.id] ?? [];
  const breaks = userBreaks(frames);
  const high = Math.max(0, ...breaks);
  const centuries = (frames ?? [])
    .filter((frame) => !frame.abandoned)
    .flatMap((frame) => (frame.breaks ?? []).filter((made) => made.player === "user" && made.points >= 100)).length;
  const fifties = (frames ?? [])
    .filter((frame) => !frame.abandoned)
    .flatMap((frame) => (frame.breaks ?? []).filter((made) => made.player === "user" && made.points >= 50)).length;
  const won = match.user_score > match.opponent_score;
  const story = matchStory(frames, firstTo);
  const earlier = matches.filter((other) => other.id !== match.id && before(other, match));
  const earlierBreaks = earlier.flatMap((other) => userBreaks(liveFramesByMatch[other.id] ?? []));
  const previousBest = Math.max(0, ...earlierBreaks);

  const highlights: Highlight[] = [];

  if (high >= 147) {
    highlights.push({ kind: "maximum", label: "MAXIMUM 147", sentence: "A maximum 147!" });
  } else if (centuries > 0) {
    highlights.push({
      kind: "century",
      label: centuries > 1 ? `${centuries} CENTURIES` : `CENTURY · ${high}`,
      sentence: centuries > 1 ? `${centuries} centuries, the best a ${high}.` : `A century break of ${high}.`,
    });
  }

  // A new highest break, beating one set before - the first break ever tracked is not a record.
  if (high > previousBest && previousBest > 0 && high < 147) {
    highlights.push({
      kind: "personal-best",
      label: `NEW HIGH BREAK · ${high}`,
      sentence: `A new personal best break of ${high}, beating ${previousBest}.`,
    });
  }

  if (!centuries && high < 147 && fifties > 0) {
    highlights.push({
      kind: "fifties",
      label: fifties > 1 ? `${fifties} × 50+ BREAKS` : `50+ BREAK · ${high}`,
      sentence: fifties > 1 ? `${fifties} breaks over 50.` : `A break of ${high}.`,
    });
  }

  if (won && story.whitewash) {
    highlights.push({ kind: "whitewash", label: "WHITEWASH", sentence: "A whitewash." });
  }
  if (won && story.cameFromBehind >= 2) {
    highlights.push({
      kind: "comeback",
      label: `CAME BACK FROM ${story.cameFromBehind} DOWN`,
      sentence: `Came back from ${story.cameFromBehind} frames down.`,
    });
  }
  if (won && story.decider) {
    highlights.push({ kind: "decider", label: "WON THE DECIDER", sentence: "Won it in a deciding frame." });
  }

  if (won) {
    const key = match.opponent_name.trim().toLowerCase();
    const againstThem = earlier.filter(
      (other) => countsAsResult(other) && other.opponent_name.trim().toLowerCase() === key
    );
    if (againstThem.length > 0 && againstThem.every((other) => other.result !== "win")) {
      highlights.push({
        kind: "first-win",
        label: `FIRST WIN V ${match.opponent_name.toUpperCase()}`,
        sentence: `A first win over ${match.opponent_name}.`,
      });
    }

    // Wins in a row, ending with this one.
    const results = [...earlier.filter(countsAsResult), match].sort((a, b) => (before(a, b) ? -1 : 1));
    let streak = 0;
    for (let index = results.length - 1; index >= 0 && results[index].result === "win"; index -= 1) streak += 1;
    if (streak >= 3) {
      highlights.push({ kind: "streak", label: `${streak} WINS IN A ROW`, sentence: `${streak} wins in a row.` });
    }
  }

  return highlights;
};
