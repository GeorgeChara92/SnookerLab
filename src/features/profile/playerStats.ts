/**
 * A player's progress: the stats achievements are measured against, which achievements are
 * unlocked, the XP they are worth, and the level that XP puts you at.
 *
 * The Profile and Achievements screens each used to work this out for themselves, and both
 * worked out two different levels: the one on screen came from achievement XP, while avatar
 * unlocks checked a level made from ten XP a win and five a session. An avatar could say
 * "Reach level 3" to a player shown as level 3 and stay locked. There is one answer now.
 */

import type { Achievement } from "../../constants/achievements";
import type { Match, Routine, RoutineScoreEntry, SessionLog } from "../../types";

export type PlayerStats = {
  matchesWon: number;
  matchesLost: number;
  matchesPlayed: number;
  sessionsLogged: number;
  bestBreak: number;
  centuries: number;
  longestWinStreak: number;
  winRate: number;
  /** The practice category you have logged most, from sessions and single routine scores. */
  mostTrainedCategory: string | null;
  /** Filled in from achievement XP once unlocks are known. */
  playerLevel: number;
};

export const computePlayerStats = (
  matches: Match[],
  sessions: SessionLog[],
  entries: RoutineScoreEntry[],
  routines: Routine[],
  liveFramesByMatch: Record<string, { highest_break_user: number }[]>
): Omit<PlayerStats, "playerLevel"> => {
  const matchesWon = matches.filter((match) => match.result === "win").length;
  const matchesLost = matches.filter((match) => match.result === "loss").length;

  let longestWinStreak = 0;
  let run = 0;
  [...matches]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .forEach((match) => {
      run = match.result === "win" ? run + 1 : 0;
      longestWinStreak = Math.max(longestWinStreak, run);
    });

  // Sessions count towards what you have trained, not only single routine scores.
  const categoryOf = new Map(routines.map((routine) => [routine.id, routine.category_id]));
  const counts = new Map<string, number>();
  const count = (routineId: string) => {
    const category = categoryOf.get(routineId);
    if (category) counts.set(category, (counts.get(category) ?? 0) + 1);
  };
  entries.forEach((entry) => count(entry.routine_id));
  sessions.forEach((session) => session.results?.forEach((result) => count(result.routine_id)));
  const mostTrainedCategory = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const frames = Object.values(liveFramesByMatch).flat();

  return {
    matchesWon,
    matchesLost,
    matchesPlayed: matches.length,
    sessionsLogged: sessions.length + entries.length,
    bestBreak: frames.reduce((best, frame) => Math.max(best, frame.highest_break_user ?? 0), 0),
    centuries: frames.filter((frame) => (frame.highest_break_user ?? 0) >= 100).length,
    longestWinStreak,
    winRate: matches.length ? Math.round((matchesWon / matches.length) * 100) : 0,
    mostTrainedCategory,
  };
};

/** How far along an achievement is, as the number it is measured by. */
export const achievementCurrent = (achievement: Achievement, stats: Omit<PlayerStats, "playerLevel">): number => {
  switch (achievement.requirement.type) {
    case "matches_won":
      return stats.matchesWon;
    case "matches_played":
      return stats.matchesPlayed;
    case "sessions_logged":
      return stats.sessionsLogged;
    case "win_streak":
      return stats.longestWinStreak;
    case "best_break":
      return stats.bestBreak;
    case "centuries":
      return stats.centuries;
    default:
      return 0;
  }
};

export const isAchievementEarned = (
  achievement: Achievement,
  stats: Omit<PlayerStats, "playerLevel">,
  seen: Set<string>
) => seen.has(achievement.id) || achievementCurrent(achievement, stats) >= achievement.requirement.value;

/**
 * XP short enough for a header: 450, 4.5K, 20.4K, 120K. Rounds down, so it never claims XP
 * the player has not reached yet.
 */
export const compactXp = (xp: number) => {
  const value = Math.max(0, Math.floor(xp));
  if (value < 1000) return `${value}`;
  if (value < 100000) {
    const thousands = Math.floor(value / 100) / 10;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}K`;
  }
  return `${Math.floor(value / 1000)}K`;
};
