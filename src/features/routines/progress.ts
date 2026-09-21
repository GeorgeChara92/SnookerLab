import type { Routine, RoutineScoreEntry, SessionLog } from "../../types";

/**
 * A player's progress on one routine: every score they have recorded for it - on its own or as
 * part of a session - as numbers over time, with their best, their recent form and how that
 * compares with before.
 *
 * Scores are stored as the player typed them, in the routine's own terms: points ("12"), a count
 * ("8"), a percentage ("72%", or made and attempts, "18/25") or a time ("07:35", where less is
 * better).
 */

export type ScoreKind = "number" | "percent" | "time";

export type ScorePoint = {
  /** ISO date and time the score was recorded. */
  at: string;
  /** The score as a number: points, a count, a percentage, or seconds for a time. */
  value: number;
  /** The score as it was entered, for showing. */
  raw: string;
};

export type RoutineProgress = {
  kind: ScoreKind;
  /** Less is better only for times. */
  higherIsBetter: boolean;
  /** Oldest first. */
  points: ScorePoint[];
  best: ScorePoint | null;
  latest: ScorePoint | null;
  /** The average of the last five scores. */
  recentAverage: number | null;
  /** The average of the five before those, to compare against. */
  previousAverage: number | null;
  /** How the last five compare with the five before, in the score's own units (positive is better). */
  change: number | null;
  /** The best possible score, if the routine has one: the top of the chart. */
  ceiling: number | null;
};

const RECENT = 5;

/** A stored score as a number, or null if it cannot be read. */
export const parseScore = (
  raw: string,
  routine?: Pick<Routine, "scoring_type" | "max_score">
): { value: number; kind: ScoreKind } | null => {
  const text = raw.trim();
  if (!text) return null;

  const time = text.match(/^(\d{1,3}):(\d{2})$/);
  if (time) return { value: Number(time[1]) * 60 + Number(time[2]), kind: "time" };

  const percent = text.match(/^(\d+(?:\.\d+)?)\s*%$/);
  if (percent) return { value: Math.min(100, Number(percent[1])), kind: "percent" };

  const fraction = text.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
  if (fraction) {
    const made = Number(fraction[1]);
    const attempts = Number(fraction[2]);
    return attempts > 0 ? { value: Math.min(100, (made / attempts) * 100), kind: "percent" } : null;
  }

  const number = Number(text);
  if (!Number.isFinite(number)) return null;
  return { value: number, kind: routine?.scoring_type === "percentage" ? "percent" : "number" };
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

/** Everything recorded for a routine, on its own and in sessions, as progress over time. */
export const routineProgress = (
  routine: Pick<Routine, "id" | "scoring_type" | "max_score">,
  entries: RoutineScoreEntry[],
  logs: SessionLog[]
): RoutineProgress => {
  const recorded = [
    ...entries
      .filter((entry) => entry.routine_id === routine.id)
      .map((entry) => ({ at: entry.recorded_at, raw: entry.score })),
    ...logs.flatMap((log) =>
      log.results
        .filter((result) => result.routine_id === routine.id)
        .map((result) => ({ at: log.recorded_at ?? log.date, raw: result.score }))
    ),
  ];

  const parsed = recorded
    .map((item) => ({ item, score: parseScore(item.raw, routine) }))
    .filter(
      (row): row is { item: { at: string; raw: string }; score: { value: number; kind: ScoreKind } } =>
        row.score !== null
    );

  // The routine's own type decides, unless the scores say otherwise (a time entered as mm:ss).
  const kinds = parsed.map((row) => row.score.kind);
  const kind: ScoreKind =
    routine.scoring_type === "time" || kinds.includes("time")
      ? "time"
      : routine.scoring_type === "percentage" || (kinds.length > 0 && kinds.every((k) => k === "percent"))
        ? "percent"
        : "number";

  const points = parsed
    .filter((row) => (kind === "time" ? row.score.kind === "time" : row.score.kind !== "time"))
    .map((row) => ({ at: row.item.at, value: row.score.value, raw: row.item.raw }))
    .sort((a, b) => a.at.localeCompare(b.at));

  const higherIsBetter = kind !== "time";
  const better = (a: ScorePoint, b: ScorePoint) => (higherIsBetter ? a.value > b.value : a.value < b.value);
  // The first to reach the best score keeps it; matching it later is not a new best.
  const best = points.reduce<ScorePoint | null>((top, point) => (!top || better(point, top) ? point : top), null);

  const recent = points.slice(-RECENT).map((point) => point.value);
  const before = points.slice(-RECENT * 2, -RECENT).map((point) => point.value);
  const recentAverage = average(recent);
  const previousAverage = before.length ? average(before) : null;
  const change =
    recentAverage !== null && previousAverage !== null
      ? higherIsBetter
        ? recentAverage - previousAverage
        : previousAverage - recentAverage
      : null;

  return {
    kind,
    higherIsBetter,
    points,
    best,
    latest: points[points.length - 1] ?? null,
    recentAverage,
    previousAverage,
    change,
    ceiling: kind === "percent" ? 100 : kind === "number" && routine.max_score ? routine.max_score : null,
  };
};

/** A score for showing: "12", "72%" or "7:35". */
export const formatScore = (value: number, kind: ScoreKind) => {
  if (kind === "time") {
    const seconds = Math.round(value);
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }
  const rounded = Math.round(value * 10) / 10;
  return kind === "percent" ? `${rounded}%` : `${rounded}`;
};

/** What to aim for next time: one better than the best, within the routine's ceiling. */
export const nextTarget = (progress: RoutineProgress): string | null => {
  const { best, kind, ceiling } = progress;
  if (!best) return null;
  if (kind === "time") return best.value > 1 ? `Under ${formatScore(best.value, kind)} for a new best` : null;
  if (ceiling !== null && best.value >= ceiling) return "You have hit the maximum. Keep it there.";
  return `${formatScore(Math.min(ceiling ?? Infinity, Math.floor(best.value) + 1), kind)} for a new best`;
};
