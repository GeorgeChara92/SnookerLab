import { useMemo } from "react";
import { useAchievementsStore } from "../store/achievementsStore";

/**
 * The achievements this player has unlocked, from their account (see achievementsStore).
 * `reloadToken` is no longer needed - the store updates on its own - and is kept so callers
 * do not have to change.
 */
export const useSeenAchievements = (_reloadToken?: string | number) => {
  const unlocked = useAchievementsStore((state) => state.unlocked);

  return useMemo(() => {
    const seenAchievementIdsOrdered = Object.entries(unlocked)
      .sort(([, a], [, b]) => a.localeCompare(b))
      .map(([id]) => id);
    return { seenAchievementIds: new Set(seenAchievementIdsOrdered), seenAchievementIdsOrdered };
  }, [unlocked]);
};
