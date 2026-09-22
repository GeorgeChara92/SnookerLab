import React, { useEffect, useRef } from "react";
import { useAuthStore } from "../../store";
import { useAchievementsStore } from "../../store/achievementsStore";
import { useAchievementUnlocker } from "../../hooks/useAchievementUnlocker";
import { usePlayerProgress } from "../../features/profile/playerProgress";
import { supabase } from "../../api/supabase";
import { useLevelSeenStore } from "../../store/levelSeenStore";
import { useCommunitySync } from "../../features/community/useCommunitySync";
import { useUnlockQueue } from "./UnlockQueueProvider";

/** Straight after sign in, levels already reached are not celebrated again (see useAchievementUnlocker). */
const QUIET_AFTER_LOAD_MS = 8000;

export const AchievementWatcher: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state: { isAuthenticated: boolean }) => state.isAuthenticated);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const setOwner = useAchievementsStore((state) => state.setOwner);
  const hydrate = useAchievementsStore((state) => state.hydrate);

  // Load the player's achievements from their account whenever someone signs in, and forget
  // them when they sign out.
  useEffect(() => {
    const owner = isAuthenticated ? userId : null;
    setOwner(owner);
    if (owner) void hydrate(owner);
  }, [hydrate, isAuthenticated, setOwner, userId]);

  if (isAuthenticated) {
    return <AchievementWatcherInner userId={userId}>{children}</AchievementWatcherInner>;
  }

  return <>{children}</>;
};

const AchievementWatcherInner: React.FC<{ children: React.ReactNode; userId: string | null }> = ({
  children,
  userId,
}) => {
  useAchievementUnlocker();
  useLevelUpCelebration(userId);
  useCommunitySync(userId);
  useProgressOnProfile(userId);
  return <>{children}</>;
};

/**
 * Copies the player's XP and level onto their profile, so other parts of the app (and later,
 * other players) can see them without working them out. Only ever moves up: while their data
 * is still loading after sign in the figure is briefly low, and that should not be saved.
 */
const useProgressOnProfile = (userId: string | null) => {
  const hydrated = useAchievementsStore((state) => state.hydrated);
  const { xp, level } = usePlayerProgress();
  const saved = useRef(0);

  useEffect(() => {
    saved.current = 0;
  }, [userId]);

  useEffect(() => {
    if (!userId || !hydrated || xp <= saved.current) return;
    const previous = saved.current;
    saved.current = xp;
    void supabase
      .from("profiles")
      .upsert(
        { id: userId, xp, level: level.level, progress_updated_at: new Date().toISOString() },
        { onConflict: "id" }
      )
      .then(({ error }) => {
        if (error) {
          // Most likely the progress columns have not been added yet; try again next change.
          saved.current = previous;
          console.warn("Could not save XP to the profile:", error.message);
        }
      });
  }, [hydrated, level.level, userId, xp]);
};

/**
 * Celebrates reaching a new level, once. The first time a player is seen on this phone, or
 * while their data is still arriving after sign in, their level is just noted.
 */
const useLevelUpCelebration = (userId: string | null) => {
  const hydrated = useAchievementsStore((state) => state.hydrated);
  const hydratedAt = useAchievementsStore((state) => state.hydratedAt);
  const { level } = usePlayerProgress();
  const seenOwner = useLevelSeenStore((state) => state.ownerId);
  const seenLevel = useLevelSeenStore((state) => state.level);
  const setSeen = useLevelSeenStore((state) => state.set);
  const { showLevelUp } = useUnlockQueue();

  useEffect(() => {
    if (!userId || !hydrated) return;
    const now = level.level;
    if (seenOwner !== userId || seenLevel === null) {
      setSeen(userId, now);
      return;
    }
    if (now <= seenLevel) return;
    setSeen(userId, now);
    if (Date.now() - hydratedAt < QUIET_AFTER_LOAD_MS) return;
    showLevelUp(now, seenLevel);
  }, [hydrated, hydratedAt, level.level, seenLevel, seenOwner, setSeen, showLevelUp, userId]);
};
