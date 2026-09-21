/**
 * The player's progress as the screens need it, built from the stores. The calculations live in
 * playerStats.ts so they can be tested without the phone's storage.
 */

import { useMemo } from "react";
import { ACHIEVEMENTS, levelProgress, type Achievement } from "../../constants/achievements";
import { useMatchesStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { useSeenAchievements } from "../../hooks/useSeenAchievements";
import { achievementCurrent, computePlayerStats, isAchievementEarned, type PlayerStats } from "./playerStats";

export type { PlayerStats } from "./playerStats";

export const usePlayerProgress = () => {
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const routines = useRoutinesStore((state) => state.routines);

  const totalFrames = useMemo(
    () => Object.values(liveFramesByMatch).reduce((sum, frames) => sum + frames.length, 0),
    [liveFramesByMatch]
  );
  const { seenAchievementIds, seenAchievementIdsOrdered } = useSeenAchievements(
    `${matches.length}-${sessions.length}-${entries.length}-${totalFrames}`
  );

  return useMemo(() => {
    const base = computePlayerStats(matches, sessions, entries, routines, liveFramesByMatch);
    const unlocked = ACHIEVEMENTS.filter((achievement) => isAchievementEarned(achievement, base, seenAchievementIds));
    const xp = unlocked.reduce((sum, achievement) => sum + achievement.xpReward, 0);
    const level = levelProgress(xp);
    const stats: PlayerStats = { ...base, playerLevel: level.level };

    // The locked achievement you are closest to, for "next goal".
    const nextGoal = ACHIEVEMENTS.filter((achievement) => !unlocked.includes(achievement))
      .map((achievement) => {
        const current = achievementCurrent(achievement, base);
        return { achievement, current, progress: Math.min(1, current / achievement.requirement.value) };
      })
      .sort((a, b) => b.progress - a.progress)[0];

    const recentUnlocks = seenAchievementIdsOrdered
      .map((id) => ACHIEVEMENTS.find((achievement) => achievement.id === id))
      .filter((achievement): achievement is Achievement => Boolean(achievement))
      .slice(-3)
      .reverse();

    return { stats, unlocked, xp, level, nextGoal, recentUnlocks };
  }, [entries, liveFramesByMatch, matches, routines, seenAchievementIds, seenAchievementIdsOrdered, sessions]);
};
