import { useEffect, useMemo, useRef } from "react";
import { supabase } from "../../api/supabase";
import { useAuthStore, useMatchesStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useAchievementsStore } from "../../store/achievementsStore";
import { usePlayerProgress } from "../profile/playerProgress";
import { breakStats } from "../matches/breaks";
import type { PublicStats } from "./types";

/**
 * Keeps what other players see of this one up to date: their name, avatar, country and skill
 * on their profile, and the summary of their record they may choose to share. Sent only when
 * something has changed, and only once the community tables exist.
 */
export const useCommunitySync = (userId: string | null) => {
  const user = useAuthStore((state) => state.user);
  const loaded = useCommunityStore((state) => state.loaded);
  const onBoards = useCommunityStore((state) => state.me?.leaderboards ?? true);
  const achievementsHydrated = useAchievementsStore((state) => state.hydrated);
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const { stats, unlocked } = usePlayerProgress();
  const sentProfile = useRef("");
  const sentStats = useRef("");
  const sentBoard = useRef("");

  useEffect(() => {
    sentProfile.current = "";
    sentStats.current = "";
    sentBoard.current = "";
  }, [userId]);

  const profile = useMemo(
    () =>
      user
        ? {
            id: user.id,
            display_name: user.username?.trim() || null,
            avatar_preset: user.avatar_preset ?? null,
            avatar_url: user.profile_image_url ?? null,
            country_code: user.country_code ?? null,
            skill_level: user.skill_level ?? null,
            cue_preference: user.cue_preference ?? null,
          }
        : null,
    [user]
  );

  useEffect(() => {
    if (!userId || !loaded || !profile || profile.id !== userId) return;
    const key = JSON.stringify(profile);
    if (key === sentProfile.current) return;
    sentProfile.current = key;
    void supabase
      .from("profiles")
      .upsert(profile, { onConflict: "id" })
      .then(({ error }) => {
        if (error) {
          sentProfile.current = "";
          console.warn("Could not update the public profile:", error.message);
        }
      });
  }, [loaded, profile, userId]);

  const summary = useMemo<PublicStats>(() => {
    const breaks = breakStats(matches, liveFramesByMatch);
    return {
      matchesPlayed: stats.matchesPlayed,
      matchesWon: stats.matchesWon,
      winRate: stats.winRate,
      bestBreak: Math.max(stats.bestBreak, breaks.highest?.points ?? 0),
      centuries: breaks.milestones[100],
      fifties: breaks.milestones[50],
      longestPracticeStreak: stats.longestPracticeStreak,
      achievements: unlocked.length,
    };
  }, [liveFramesByMatch, matches, stats, unlocked.length]);

  // The numbers the all-player leaderboards rank by, or nothing while the player opts out.
  useEffect(() => {
    if (!userId || !loaded || !achievementsHydrated) return;
    const board = onBoards
      ? { best_break: summary.bestBreak, centuries: summary.centuries, matches_won: summary.matchesWon }
      : { best_break: null, centuries: null, matches_won: null };
    const key = JSON.stringify(board);
    if (key === sentBoard.current) return;
    sentBoard.current = key;
    void supabase
      .from("profiles")
      .update(board)
      .eq("id", userId)
      .then(({ error }) => {
        if (error) {
          sentBoard.current = "";
          console.warn("Could not update leaderboard numbers:", error.message);
        }
      });
  }, [achievementsHydrated, loaded, onBoards, summary, userId]);

  useEffect(() => {
    // Wait for the player's own numbers to finish loading, so a half-loaded record is never shared.
    if (!userId || !loaded || !achievementsHydrated) return;
    const key = JSON.stringify(summary);
    if (key === sentStats.current) return;
    sentStats.current = key;
    void supabase
      .from("profile_stats")
      .upsert({ user_id: userId, stats: summary, updated_at: new Date().toISOString() }, { onConflict: "user_id" })
      .then(({ error }) => {
        if (error) {
          sentStats.current = "";
          console.warn("Could not update shared stats:", error.message);
        }
      });
  }, [achievementsHydrated, loaded, summary, userId]);
};
