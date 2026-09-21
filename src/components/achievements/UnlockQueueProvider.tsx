import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Modal } from "react-native";
import { ACHIEVEMENTS } from "../../constants/achievements";
import { LEVELS } from "../../constants/achievements";
import { BALLS, CUSTOM_RING_LEVEL } from "../../features/profile/avatarSpec";
import { rewardsBetween } from "../../features/profile/levelRewards";
import { navigationRef } from "../../navigation/navigationRef";
import { Celebration, type CelebrationItem } from "./Celebration";

/**
 * A queue of things to celebrate, shown one at a time: achievements first, then the level they
 * lifted the player to, so the story reads in order.
 */

type UnlockQueueContextType = {
  showAchievementUnlock: (achievementId: string) => void;
  /** A new level reached, from the level before it (for a jump of several, everything between). */
  showLevelUp: (level: number, fromLevel: number) => void;
  clearQueue: () => void;
};

const UnlockQueueContext = createContext<UnlockQueueContextType | null>(null);

export const useUnlockQueue = () => {
  const context = useContext(UnlockQueueContext);
  if (!context) throw new Error("useUnlockQueue must be used within an UnlockQueueProvider");
  return context;
};

const ringColourFor = (level: number) =>
  level >= CUSTOM_RING_LEVEL
    ? "#C9A44C"
    : ([...BALLS].reverse().find((ball) => level >= ball.level)?.colour ?? BALLS[0].colour);

export const UnlockQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [queue, setQueue] = useState<CelebrationItem[]>([]);
  const current = queue[0] ?? null;

  const enqueue = useCallback((item: CelebrationItem) => {
    setQueue((prev) => {
      if (prev.some((existing) => existing.id === item.id)) return prev;
      // Levels wait until the achievements that earned them have been shown.
      const next = [...prev, item];
      const [first, ...rest] = next;
      return [
        first,
        ...rest.filter((entry) => entry.kind === "achievement"),
        ...rest.filter((entry) => entry.kind === "level"),
      ];
    });
  }, []);

  const showAchievementUnlock = useCallback(
    (achievementId: string) => {
      const achievement = ACHIEVEMENTS.find((item) => item.id === achievementId);
      if (!achievement) return;
      enqueue({
        kind: "achievement",
        id: `achievement-${achievement.id}`,
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon as never,
        tier: achievement.tier,
        xpReward: achievement.xpReward,
      });
    },
    [enqueue]
  );

  const showLevelUp = useCallback(
    (level: number, fromLevel: number) => {
      const info = LEVELS[level - 1];
      if (!info) return;
      enqueue({
        kind: "level",
        id: `level-${level}`,
        level,
        title: info.title,
        rewards: rewardsBetween(fromLevel, level),
        ringColour: ringColourFor(level),
      });
    },
    [enqueue]
  );

  const clearQueue = useCallback(() => setQueue([]), []);
  const dismiss = useCallback(() => setQueue((prev) => prev.slice(1)), []);

  const tryOn = useCallback(() => {
    if (navigationRef.isReady()) navigationRef.navigate("ProfileModal", { screen: "AvatarPicker" });
  }, []);

  const value = useMemo(
    () => ({ showAchievementUnlock, showLevelUp, clearQueue }),
    [showAchievementUnlock, showLevelUp, clearQueue]
  );

  return (
    <UnlockQueueContext.Provider value={value}>
      {children}
      <Modal visible={current !== null} transparent animationType="none" onRequestClose={dismiss} statusBarTranslucent>
        {current ? <Celebration key={current.id} item={current} onClose={dismiss} onTryOn={tryOn} /> : null}
      </Modal>
    </UnlockQueueContext.Provider>
  );
};
