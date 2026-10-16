import type { Homework, HomeworkProgress } from "./types";

/** Routine scores are stored as text ("42", "7/10", "7 of 10"): the leading number is the score. */
export const scoreNumber = (score: string | number | null | undefined): number | null => {
  if (score == null) return null;
  const match = String(score).match(/^\s*(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

/** Monday 00:00 local, the start of "this week" for homework counts. */
export const startOfWeek = (now = new Date()) => {
  const day = (now.getDay() + 6) % 7;
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day);
};

/** A player's progress on a piece of homework, from their own routine scores since it was set. */
export const homeworkProgress = (
  homework: Homework,
  entries: Array<{ routine_id: string; score: string | number; recorded_at: string }>,
  now = new Date()
): HomeworkProgress => {
  const since = new Date(homework.createdAt).getTime();
  const weekStart = startOfWeek(now).getTime();
  let best: number | null = null;
  let attempts = 0;
  let thisWeek = 0;
  let lastAt: string | null = null;
  for (const entry of entries) {
    if (entry.routine_id !== homework.routineId) continue;
    const at = new Date(entry.recorded_at).getTime();
    if (at < since) continue;
    attempts++;
    if (at >= weekStart) thisWeek++;
    if (!lastAt || entry.recorded_at > lastAt) lastAt = entry.recorded_at;
    const value = scoreNumber(entry.score);
    if (value != null && (best == null || value > best)) best = value;
  }
  return { best, attempts, thisWeek, lastAt };
};

/** "Best 42 · target 50 · 3 of 4 this week" - the one line under a piece of homework. */
export const progressLine = (homework: Homework, progress: HomeworkProgress | undefined): string => {
  const parts: string[] = [];
  if (progress?.best != null) parts.push(`Best ${progress.best}`);
  else parts.push(progress?.attempts ? `${progress.attempts} tries` : "Not tried yet");
  if (homework.targetScore != null) parts.push(`target ${homework.targetScore}`);
  if (homework.perWeek) parts.push(`${progress?.thisWeek ?? 0} of ${homework.perWeek} this week`);
  return parts.join(" · ");
};

/** Whether the homework's target has been reached. */
export const targetMet = (homework: Homework, progress: HomeworkProgress | undefined) =>
  homework.targetScore != null && progress?.best != null && progress.best >= homework.targetScore;
