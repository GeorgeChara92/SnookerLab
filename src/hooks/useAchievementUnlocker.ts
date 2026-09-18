import { useEffect, useRef, useCallback } from "react";
import { useMatchesStore, useSessionsStore, useRoutineScoresStore } from "../store";
import { ACHIEVEMENTS, type Achievement } from "../constants/achievements";
import { useUnlockQueue } from "../components/achievements/UnlockQueueProvider";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "seen_achievements";
const INITIALIZED_KEY = "achievement_system_initialized";

type AchievementStats = {
  matchesWon: number;
  matchesPlayed: number;
  sessionsLogged: number;
  bestBreak: number;
  centuries: number;
  longestWinStreak: number;
};

const getPlayerStats = (
  matches: { result: string; date: string }[],
  sessions: unknown[],
  entries: unknown[],
  liveFramesByMatch: Record<string, { highest_break_user: number }[]>
): AchievementStats => {
  const matchesWon = matches.filter((m) => m.result === "win").length;
  const matchesPlayed = matches.length;
  const sessionsLogged = sessions.length + entries.length;

  let longestStreak = 0;
  let currentStreak = 0;
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  for (const match of sortedMatches) {
    if (match.result === "win") {
      currentStreak++;
      longestStreak = Math.max(longestStreak, currentStreak);
    } else {
      currentStreak = 0;
    }
  }

  const allFrames = Object.values(liveFramesByMatch).flat();
  const bestBreak = allFrames.reduce((max, frame) => Math.max(max, frame.highest_break_user ?? 0), 0);
  const centuries = allFrames.filter((frame) => (frame.highest_break_user ?? 0) >= 100).length;

  return {
    matchesWon,
    matchesPlayed,
    sessionsLogged,
    bestBreak,
    centuries,
    longestWinStreak: longestStreak,
  };
};

const getUnlockedAchievements = (stats: AchievementStats): Achievement[] => {
  return ACHIEVEMENTS.filter((a) => {
    switch (a.requirement.type) {
      case "matches_won":
        return stats.matchesWon >= a.requirement.value;
      case "matches_played":
        return stats.matchesPlayed >= a.requirement.value;
      case "sessions_logged":
        return stats.sessionsLogged >= a.requirement.value;
      case "win_streak":
        return stats.longestWinStreak >= a.requirement.value;
      case "best_break":
        return stats.bestBreak >= a.requirement.value;
      case "centuries":
        return stats.centuries >= a.requirement.value;
      default:
        return false;
    }
  });
};

export const useAchievementUnlocker = () => {
  const { showAchievementUnlock } = useUnlockQueue();
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const sessions = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const seenAchievementsRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);
  const prevStatsRef = useRef<AchievementStats | null>(null);

  useEffect(() => {
    const initialize = async () => {
      try {
        const [storedSeen, initializedFlag] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(INITIALIZED_KEY),
        ]);

        const stats = getPlayerStats(matches, sessions, entries, liveFramesByMatch);
        const currentlyUnlocked = getUnlockedAchievements(stats);
        const currentlyUnlockedIds = new Set(currentlyUnlocked.map(a => a.id));

        if (storedSeen) {
          seenAchievementsRef.current = new Set(JSON.parse(storedSeen));
        }

        if (initializedFlag !== "true") {
          const allSeen = new Set(seenAchievementsRef.current);
          currentlyUnlocked.forEach((a) => allSeen.add(a.id));
          seenAchievementsRef.current = allSeen;
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...allSeen]));
          await AsyncStorage.setItem(INITIALIZED_KEY, "true");
        }

        prevStatsRef.current = stats;
        isInitializedRef.current = true;
      } catch (error) {
        console.warn("Failed to initialize achievement system:", error);
        isInitializedRef.current = true;
      }
    };

    initialize();
  }, []);

  useEffect(() => {
    if (!isInitializedRef.current) return;

    const currentStats = getPlayerStats(matches, sessions, entries, liveFramesByMatch);
    const prevStats = prevStatsRef.current;

    const hasStatsChanged = !prevStats || 
      currentStats.matchesWon !== prevStats.matchesWon ||
      currentStats.matchesPlayed !== prevStats.matchesPlayed ||
      currentStats.sessionsLogged !== prevStats.sessionsLogged ||
      currentStats.bestBreak !== prevStats.bestBreak ||
      currentStats.centuries !== prevStats.centuries ||
      currentStats.longestWinStreak !== prevStats.longestWinStreak;

    if (!hasStatsChanged) return;

    const currentlyUnlocked = getUnlockedAchievements(currentStats);
    const currentlyUnlockedIds = new Set(currentlyUnlocked.map(a => a.id));
    const seenIds = seenAchievementsRef.current;
    const newlyUnlocked = currentlyUnlocked.filter((a) => !seenIds.has(a.id));

    if (newlyUnlocked.length > 0) {
      const allSeen = new Set(seenIds);
      newlyUnlocked.forEach((a) => {
        allSeen.add(a.id);
        showAchievementUnlock(a.id);
      });
      seenAchievementsRef.current = allSeen;
      prevStatsRef.current = currentStats;
      
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...allSeen])).catch(() => {});
    } else {
      prevStatsRef.current = currentStats;
    }
  }, [matches, liveFramesByMatch, sessions, entries, showAchievementUnlock]);
};
