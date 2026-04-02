import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { RoutineScoreEntry } from "../types";
import { safeStorage } from "../utils/storage";
import { supabase } from "../api/supabase";

interface RoutineScoresState {
  ownerUserId: string | null;
  entries: RoutineScoreEntry[];
  addEntry: (entry: Omit<RoutineScoreEntry, "id" | "recorded_at">) => Promise<void>;
  getEntriesForRoutine: (routineId: string) => RoutineScoreEntry[];
  setOwnerUserId: (userId: string | null) => void;
  hydrateEntriesForUser: (userId: string) => Promise<void>;
}

const mapRow = (row: any): RoutineScoreEntry => ({
  id: row.id,
  routine_id: row.routine_id,
  routine_name: row.routine_name,
  score: row.score,
  notes: row.notes ?? undefined,
  recorded_at: row.recorded_at,
});

export const useRoutineScoresStore = create<RoutineScoresState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      entries: [],
      addEntry: async (entryData) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to add routine scores.");

        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("routine_score_entries")
          .insert({
            user_id: authUser.id,
            routine_id: entryData.routine_id,
            routine_name: entryData.routine_name,
            score: entryData.score,
            notes: entryData.notes ?? null,
            recorded_at: now,
            created_at: now,
          })
          .select()
          .single();

        if (error) throw error;

        const entry = mapRow(data);
        set((state) => ({
          entries: [entry, ...state.entries],
        }));
      },
      getEntriesForRoutine: (routineId) => get().entries.filter((entry) => entry.routine_id === routineId),
      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return { ownerUserId: userId, entries: [] };
        });
      },
      hydrateEntriesForUser: async (userId) => {
        const { data, error } = await supabase
          .from("routine_score_entries")
          .select("*")
          .eq("user_id", userId)
          .order("recorded_at", { ascending: false });

        if (error) throw error;
        set({ entries: (data ?? []).map(mapRow) });
      },
    }),
    {
      name: "routine-scores-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 3,
      migrate: () => ({
        ownerUserId: null,
        entries: [],
      }),
    }
  )
);
