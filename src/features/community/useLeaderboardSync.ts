import { useEffect, useMemo, useRef } from "react";
import { supabase } from "../../api/supabase";
import { useCustomRoutinesStore, useRoutineScoresStore, useSessionsStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { DEFAULT_ROUTINES } from "../../constants/routines";
import { leaderboardKeyFor, toRoutine } from "../customRoutines/customRoutine";
import { formatScore, routineProgress } from "../routines/progress";

/**
 * Posts the player's best on every routine that has a leaderboard: each library routine that
 * takes a score, and each custom routine that is shared or was saved from the community. Only
 * bests that have changed are sent, all in one go.
 */
export const useLeaderboardSync = (userId: string | null) => {
  const loaded = useCommunityStore((state) => state.loaded);
  const hasHandle = useCommunityStore((state) => Boolean(state.me?.handle));
  const entries = useRoutineScoresStore((state) => state.entries);
  const logs = useSessionsStore((state) => state.logs);
  const custom = useCustomRoutinesStore((state) => state.routines);
  const sent = useRef<Record<string, string>>({});

  useEffect(() => {
    sent.current = {};
  }, [userId]);

  const bests = useMemo(() => {
    const boards = [
      ...DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide").map((routine) => ({
        key: routine.id,
        routine,
      })),
      ...custom
        .map((item) => ({ key: leaderboardKeyFor(item), routine: toRoutine(item) }))
        .filter((item): item is { key: string; routine: ReturnType<typeof toRoutine> } => Boolean(item.key)),
    ];
    return boards
      .map(({ key, routine }) => {
        const progress = routineProgress(routine, entries, logs);
        if (!progress.best) return null;
        return {
          routine_key: key,
          best: progress.best.value,
          best_raw: formatScore(progress.best.value, progress.kind).slice(0, 20),
          kind: progress.kind,
          scores: progress.points.length,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
  }, [custom, entries, logs]);

  useEffect(() => {
    // Only once the player is part of the community: a leaderboard needs a name to show.
    if (!userId || !loaded || !hasHandle) return;
    const changed = bests.filter((row) => sent.current[row.routine_key] !== JSON.stringify(row));
    if (!changed.length) return;
    changed.forEach((row) => {
      sent.current[row.routine_key] = JSON.stringify(row);
    });
    void supabase
      .from("routine_bests")
      .upsert(
        changed.map((row) => ({ ...row, user_id: userId, updated_at: new Date().toISOString() })),
        { onConflict: "routine_key,user_id" }
      )
      .then(({ error }) => {
        if (error) {
          changed.forEach((row) => delete sent.current[row.routine_key]);
          console.warn("Could not post routine bests:", error.message);
        }
      });
  }, [bests, hasHandle, loaded, userId]);
};
