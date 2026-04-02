import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { Match } from "../types";
import { supabase } from "../api/supabase";

interface MatchesState {
  ownerUserId: string | null;
  matches: Match[];
  isLoading: boolean;
  addMatch: (match: Omit<Match, "id" | "created_at" | "updated_at">) => Promise<void>;
  updateMatch: (id: string, updates: Partial<Match>) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  getMatches: () => Match[];
  getMatchById: (id: string) => Match | undefined;
  getOpponents: () => string[];
  setOwnerUserId: (userId: string | null) => void;
  hydrateMatchesForUser: (userId: string) => Promise<void>;
}

const mapDbMatch = (row: any): Match => ({
  id: row.id,
  user_id: row.user_id,
  opponent_name: row.opponent_name,
  opponent_id: row.opponent_id ?? undefined,
  date: row.date,
  location: row.location ?? undefined,
  match_type: row.match_type,
  format: row.format,
  target_frames: row.target_frames ?? undefined,
  frames_played: row.frames_played,
  user_score: row.user_score,
  opponent_score: row.opponent_score,
  result: row.result,
  notes: row.notes ?? undefined,
  sync_status: "synced",
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const useMatchesStore = create<MatchesState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      matches: [],
      isLoading: false,

      addMatch: async (matchData) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to add a match.");

        const now = new Date().toISOString();
        const payload = {
          user_id: authUser.id,
          opponent_name: matchData.opponent_name,
          opponent_id: matchData.opponent_id ?? null,
          date: matchData.date,
          location: matchData.location ?? null,
          match_type: matchData.match_type,
          format: matchData.format,
          target_frames: matchData.target_frames ?? null,
          frames_played: matchData.frames_played,
          user_score: matchData.user_score,
          opponent_score: matchData.opponent_score,
          result: matchData.result,
          notes: matchData.notes ?? null,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase.from("matches").insert(payload).select().single();
        if (error) throw error;

        const match = mapDbMatch(data);
        set((state) => ({ matches: [match, ...state.matches] }));
      },

      updateMatch: async (id, updates) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to update a match.");

        const payload: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };

        const keys: (keyof Match)[] = [
          "opponent_name",
          "opponent_id",
          "date",
          "location",
          "match_type",
          "format",
          "target_frames",
          "frames_played",
          "user_score",
          "opponent_score",
          "result",
          "notes",
        ];

        keys.forEach((key) => {
          if (updates[key] !== undefined) {
            payload[key] = updates[key] ?? null;
          }
        });

        const { data, error } = await supabase
          .from("matches")
          .update(payload)
          .eq("id", id)
          .eq("user_id", authUser.id)
          .select()
          .single();

        if (error) throw error;

        const updated = mapDbMatch(data);
        set((state) => ({
          matches: state.matches.map((m) => (m.id === id ? updated : m)),
        }));
      },

      deleteMatch: async (id) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to delete a match.");

        const { error } = await supabase.from("matches").delete().eq("id", id).eq("user_id", authUser.id);
        if (error) throw error;

        set((state) => ({
          matches: state.matches.filter((m) => m.id !== id),
        }));
      },

      getMatches: () => get().matches,
      getMatchById: (id) => get().matches.find((m) => m.id === id),
      getOpponents: () => {
        const opponents = new Set(get().matches.map((m) => m.opponent_name));
        return Array.from(opponents);
      },

      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return { ownerUserId: userId, matches: [], isLoading: !!userId };
        });
      },

      hydrateMatchesForUser: async (userId) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from("matches")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false });

          if (error) throw error;

          set({ matches: (data ?? []).map(mapDbMatch), isLoading: false });
        } catch (error) {
          console.warn("Failed to hydrate matches:", error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "matches-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 2,
      migrate: () => ({
        ownerUserId: null,
        matches: [],
        isLoading: false,
      }),
    }
  )
);
