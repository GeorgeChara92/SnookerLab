import { useEffect } from "react";
import { useMatchesStore, useSessionsStore, useRoutineScoresStore, useRoutinesStore } from "../store";
import { useAchievementsStore } from "../store/achievementsStore";
import { ACHIEVEMENTS } from "../constants/achievements";
import { useUnlockQueue } from "../components/achievements/UnlockQueueProvider";
import { computePlayerStats, isAchievementEarned } from "../features/profile/playerStats";

/**
 * Right after signing in, the player's matches and practice arrive from their account over a
 * few seconds, and every achievement they earned long ago "unlocks" again as the numbers fill
 * in. Anything found in this window is recorded without the celebration.
 */
const QUIET_AFTER_LOAD_MS = 8000;

/** Watches the player's numbers and records - and celebrates - each achievement they reach. */
export const useAchievementUnlocker = () => {
  const { showAchievementUnlock } = useUnlockQueue();
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const routines = useRoutinesStore((state) => state.routines);
  const hydrated = useAchievementsStore((state) => state.hydrated);
  const hydratedAt = useAchievementsStore((state) => state.hydratedAt);
  const unlock = useAchievementsStore((state) => state.unlock);

  useEffect(() => {
    if (!hydrated) return;
    const stats = computePlayerStats(matches, sessions, entries, routines, liveFramesByMatch);
    const earned = ACHIEVEMENTS.filter((achievement) => isAchievementEarned(achievement, stats, new Set())).map(
      (achievement) => achievement.id
    );
    const fresh = unlock(earned);
    if (Date.now() - hydratedAt < QUIET_AFTER_LOAD_MS) return;
    fresh.forEach((id) => showAchievementUnlock(id));
  }, [entries, hydrated, hydratedAt, liveFramesByMatch, matches, routines, sessions, showAchievementUnlock, unlock]);
};
