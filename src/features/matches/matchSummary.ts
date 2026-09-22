/**
 * What a list of matches adds up to.
 *
 * Kept out of the screens so the Matches page and an opponent's page count the same way, and so
 * the one genuinely confusing rule is written down once: a match's score means different things
 * depending on how it was recorded.
 *
 * - Scored live, frame by frame: user_score and opponent_score are frames won.
 * - Entered by hand as a single frame: they are the points in that frame.
 *
 * Showing "20-1" beside "Frames 2-0" without saying which is which is how the two got confused.
 */

import type { Match, MatchResult } from "../../types";

export type RecordingMode = "live" | "manual";

export const getRecordingMode = (match: Match): RecordingMode => {
  if (match.recording_mode === "live" || match.recording_mode === "manual") return match.recording_mode;
  // Older rows have no mode. A one-frame match was only ever entered by hand.
  return match.target_frames === 1 ? "manual" : "live";
};

export type ScoreLine = {
  /** e.g. "20-1" */
  score: string;
  /** What the numbers count, so the screen can say so. */
  unit: "frames" | "points";
};

export const describeScore = (match: Match): ScoreLine => ({
  score: `${match.user_score}-${match.opponent_score}`,
  unit: getRecordingMode(match) === "manual" ? "points" : "frames",
});

/** "Best of 5", or nothing when the length is not known. */
export const bestOfLabel = (match: Match): string | null => {
  if (match.target_frames && match.target_frames > 0) return `Best of ${match.target_frames}`;
  if (match.frames_played && match.frames_played > 0) {
    const inferred = match.frames_played % 2 === 0 ? match.frames_played + 1 : match.frames_played;
    return `Best of ${inferred}`;
  }
  return null;
};

export type FormLetter = "W" | "L" | "D";

const letterFor = (result: MatchResult): FormLetter => (result === "win" ? "W" : result === "loss" ? "L" : "D");

/** Newest first, so it can be sorted once and reused. */
export const byNewest = (a: Match, b: Match) => new Date(b.date).getTime() - new Date(a.date).getTime();

export type MatchRecord = {
  played: number;
  wins: number;
  losses: number;
  draws: number;
  /** Whole-number percentage of matches won. */
  winRate: number;
  framesWon: number;
  framesLost: number;
  /** Only from matches entered by hand, where the score is points. */
  pointsFor: number;
  pointsAgainst: number;
  /** The last five results, newest first. */
  form: FormLetter[];
  lastPlayed?: string;
};

/**
 * Whether a match has a result to count. A live match is created before a ball is struck, so
 * until a frame has been finished it has no result - it is unfinished, not a 0-0 draw - and it
 * stays out of records, head-to-heads, stats and achievements. A match entered by hand is a
 * result from the start.
 */
export const countsAsResult = (match: Match) => getRecordingMode(match) === "manual" || match.frames_played > 0;

export const summariseMatches = (all: Match[]): MatchRecord => {
  const matches = all.filter(countsAsResult);
  const sorted = [...matches].sort(byNewest);
  const record: MatchRecord = {
    played: sorted.length,
    wins: 0,
    losses: 0,
    draws: 0,
    winRate: 0,
    framesWon: 0,
    framesLost: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    form: sorted.slice(0, 5).map((match) => letterFor(match.result)),
    lastPlayed: sorted[0]?.date,
  };

  sorted.forEach((match) => {
    if (match.result === "win") record.wins += 1;
    if (match.result === "loss") record.losses += 1;
    if (match.result === "draw") record.draws += 1;

    if (getRecordingMode(match) === "manual") {
      // One frame, decided by the result; the score is points.
      if (match.result === "win") record.framesWon += 1;
      if (match.result === "loss") record.framesLost += 1;
      record.pointsFor += match.user_score;
      record.pointsAgainst += match.opponent_score;
    } else {
      record.framesWon += match.user_score;
      record.framesLost += match.opponent_score;
    }
  });

  record.winRate = record.played ? Math.round((record.wins / record.played) * 100) : 0;
  return record;
};

export type OpponentRecord = MatchRecord & { name: string };

/** Everyone you have played, most-played first, then by who you have the better of. */
export const groupByOpponent = (matches: Match[]): OpponentRecord[] => {
  const byName = new Map<string, Match[]>();
  matches.filter(countsAsResult).forEach((match) => {
    const name = match.opponent_name.trim();
    byName.set(name, [...(byName.get(name) ?? []), match]);
  });

  return Array.from(byName.entries())
    .map(([name, list]) => ({ name, ...summariseMatches(list) }))
    .sort(
      (a, b) =>
        b.played - a.played || b.framesWon - b.framesLost - (a.framesWon - a.framesLost) || a.name.localeCompare(b.name)
    );
};

/** "Today", "Yesterday", "3 days ago", then a plain date. */
export const relativeDate = (dateStr: string, now = new Date()): string => {
  const date = new Date(dateStr);
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days > 1 && days < 7) return `${days} days ago`;
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
};

/**
 * Newest-first matches in runs by the day they were played, each run labelled as the rows used
 * to be ("Today", "Yesterday", "3 days ago", "12 Sept"), so several games on one day sit under
 * one heading.
 */
export const groupByDay = <T extends { date: string }>(
  items: T[],
  now = new Date()
): Array<{ key: string; label: string; items: T[] }> => {
  const groups: Array<{ key: string; label: string; items: T[] }> = [];
  items.forEach((item) => {
    const date = new Date(item.date);
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const last = groups[groups.length - 1];
    if (last && last.key === key) last.items.push(item);
    else groups.push({ key, label: relativeDate(item.date, now), items: [item] });
  });
  return groups;
};

/** Initials for an avatar: "John Smith" is "JS", "John" is "JO". */
export const initialsOf = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};
