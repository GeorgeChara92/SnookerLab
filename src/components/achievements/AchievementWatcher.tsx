import React from "react";
import { useAuthStore } from "../../store";
import { useAchievementUnlocker } from "../../hooks/useAchievementUnlocker";

export const AchievementWatcher: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((state: { isAuthenticated: boolean }) => state.isAuthenticated);

  if (isAuthenticated) {
    return <AchievementWatcherInner>{children}</AchievementWatcherInner>;
  }

  return <>{children}</>;
};

const AchievementWatcherInner: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useAchievementUnlocker();
  return <>{children}</>;
};