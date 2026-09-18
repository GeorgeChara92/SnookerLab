import { useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "seen_achievements";

export const useSeenAchievements = (reloadToken?: string | number) => {
  const [seenAchievementIdsOrdered, setSeenAchievementIdsOrdered] = useState<string[]>([]);

  useEffect(() => {
    let isMounted = true;

    const loadSeenAchievements = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (!isMounted || !stored) return;
        const parsed = JSON.parse(stored) as string[];
        setSeenAchievementIdsOrdered(Array.isArray(parsed) ? parsed : []);
      } catch {
        if (isMounted) {
          setSeenAchievementIdsOrdered([]);
        }
      }
    };

    loadSeenAchievements();

    return () => {
      isMounted = false;
    };
  }, [reloadToken]);

  const seenAchievementIds = useMemo(() => new Set(seenAchievementIdsOrdered), [seenAchievementIdsOrdered]);

  return { seenAchievementIds, seenAchievementIdsOrdered };
};
