import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import type { PlacedBall } from "../features/scanSnooker/position";
import { newRoutineId, type CustomRoutine } from "../features/customRoutines/customRoutine";

/**
 * The routines a player has built, kept with their account.
 *
 * Saving is instant on the phone and sent to Supabase straight after. Anything that could not be
 * sent (no signal at the club) is marked pending and goes the next time the store loads, so a
 * routine built offline still reaches the player's other devices.
 */

type Row = {
  id: string;
  name: string;
  description: string | null;
  max_score: number | null;
  balls: PlacedBall[];
  created_at: string;
  updated_at: string;
  shared_id?: string | null;
  source_shared_id?: string | null;
};

const fromRow = (row: Row): CustomRoutine => ({
  id: row.id,
  name: row.name,
  description: row.description,
  maxScore: row.max_score,
  balls: Array.isArray(row.balls) ? row.balls : [],
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  sharedId: row.shared_id ?? null,
  sourceSharedId: row.source_shared_id ?? null,
});

const toRow = (routine: CustomRoutine, userId: string) => ({
  id: routine.id,
  user_id: userId,
  name: routine.name,
  description: routine.description ?? null,
  max_score: routine.maxScore ?? null,
  balls: routine.balls,
  created_at: routine.createdAt,
  updated_at: routine.updatedAt,
  shared_id: routine.sharedId ?? null,
  source_shared_id: routine.sourceSharedId ?? null,
});

type Pending = Record<string, "upsert" | "delete">;

type CustomRoutinesState = {
  ownerId: string | null;
  routines: CustomRoutine[];
  pending: Pending;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  save: (input: {
    id?: string;
    name: string;
    description: string | null;
    maxScore: number | null;
    balls: PlacedBall[];
    sourceSharedId?: string | null;
  }) => CustomRoutine;
  /** Records the community copy of a routine, or clears it. */
  setShared: (id: string, sharedId: string | null) => void;
  remove: (id: string) => void;
  getById: (id: string) => CustomRoutine | undefined;
};

const newestFirst = (a: CustomRoutine, b: CustomRoutine) => b.updatedAt.localeCompare(a.updatedAt);

export const useCustomRoutinesStore = create<CustomRoutinesState>()(
  persist(
    (set, get) => {
      /** Sends one change; if it fails, it stays pending for next time. */
      const push = async (id: string) => {
        const { ownerId, routines, pending } = get();
        if (!ownerId || !pending[id]) return;
        const action = pending[id];
        const routine = routines.find((item) => item.id === id);
        const { error } =
          action === "delete"
            ? await supabase.from("custom_routines").delete().eq("id", id).eq("user_id", ownerId)
            : routine
              ? await supabase.from("custom_routines").upsert(toRow(routine, ownerId), { onConflict: "id" })
              : { error: null };
        if (error) {
          console.warn("Custom routine not saved to the account yet:", error.message);
          return;
        }
        // Only clear it if nothing newer happened to the same routine while this was in flight.
        if (get().pending[id] === action && get().ownerId === ownerId) {
          const next = { ...get().pending };
          delete next[id];
          set({ pending: next });
        }
      };

      return {
        ownerId: null,
        routines: [],
        pending: {},

        setOwner: (userId) => {
          if (get().ownerId === userId) return;
          set({ ownerId: userId, routines: [], pending: {} });
        },

        hydrate: async (userId) => {
          const { data, error } = await supabase
            .from("custom_routines")
            .select("id, name, description, max_score, balls, created_at, updated_at, shared_id, source_shared_id")
            .eq("user_id", userId)
            .order("updated_at", { ascending: false });
          if (get().ownerId !== userId) return;
          if (error) {
            console.warn("Could not load custom routines:", error.message);
            return;
          }
          // The account's copy, with anything changed on this phone and not yet sent kept on top.
          const { routines: local, pending } = get();
          const server = (data as Row[]).map(fromRow).filter((item) => pending[item.id] !== "delete");
          const unsent = local.filter((item) => pending[item.id] === "upsert");
          const merged = [...unsent, ...server.filter((item) => !unsent.some((mine) => mine.id === item.id))];
          set({ routines: merged.sort(newestFirst) });
          await Promise.all(Object.keys(pending).map(push));
        },

        save: ({ id, name, description, maxScore, balls, sourceSharedId }) => {
          const now = new Date().toISOString();
          const existing = id ? get().routines.find((item) => item.id === id) : undefined;
          const routine: CustomRoutine = {
            id: existing?.id ?? newRoutineId(),
            name,
            description,
            maxScore,
            balls,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            sharedId: existing?.sharedId ?? null,
            sourceSharedId: existing?.sourceSharedId ?? sourceSharedId ?? null,
          };
          set((state) => ({
            routines: [routine, ...state.routines.filter((item) => item.id !== routine.id)].sort(newestFirst),
            pending: { ...state.pending, [routine.id]: "upsert" },
          }));
          void push(routine.id);
          return routine;
        },

        setShared: (id, sharedId) => {
          const routine = get().routines.find((item) => item.id === id);
          if (!routine) return;
          set((state) => ({
            routines: state.routines.map((item) => (item.id === id ? { ...item, sharedId } : item)),
            pending: { ...state.pending, [id]: "upsert" },
          }));
          void push(id);
        },

        remove: (id) => {
          set((state) => ({
            routines: state.routines.filter((item) => item.id !== id),
            pending: { ...state.pending, [id]: "delete" },
          }));
          void push(id);
        },

        getById: (id) => get().routines.find((item) => item.id === id),
      };
    },
    {
      name: "custom-routines-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ ownerId: state.ownerId, routines: state.routines, pending: state.pending }),
    }
  )
);
