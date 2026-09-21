import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import type { PlacedBall, RecordedPosition } from "../features/scanSnooker/position";

/**
 * The positions recorded with Scan Snooker, one per frame: the latest one is what the balls go
 * back to after a miss.
 *
 * Saved on the phone straight away, so it works at a club with no signal, and sent to the
 * account after, so the tablet at the table and the phone in a pocket both have it. Anything
 * not sent yet is marked pending and goes the next time the store loads.
 */

const keyFor = (matchId: string, frameNumber: number) => `${matchId}:${frameNumber}`;

/** Only matches saved to the account have a uuid; a position for any other stays on the phone. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = { match_id: string; frame_number: number; balls: PlacedBall[]; recorded_at: string };

type Pending = Record<string, "upsert" | "delete">;

type ScanSnookerState = {
  ownerId: string | null;
  positions: Record<string, RecordedPosition>;
  pending: Pending;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  getPosition: (matchId: string, frameNumber: number) => RecordedPosition | undefined;
  savePosition: (matchId: string, frameNumber: number, balls: PlacedBall[]) => RecordedPosition;
  clearPosition: (matchId: string, frameNumber: number) => void;
};

export const useScanSnookerStore = create<ScanSnookerState>()(
  persist(
    (set, get) => {
      const push = async (key: string) => {
        const { ownerId, positions, pending } = get();
        const action = pending[key];
        if (!ownerId || !action) return;
        const [matchId, frame] = key.split(":");
        if (!UUID.test(matchId)) return;
        const position = positions[key];
        const { error } =
          action === "delete"
            ? await supabase
                .from("scan_positions")
                .delete()
                .eq("user_id", ownerId)
                .eq("match_id", matchId)
                .eq("frame_number", Number(frame))
            : position
              ? await supabase.from("scan_positions").upsert(
                  {
                    user_id: ownerId,
                    match_id: matchId,
                    frame_number: position.frameNumber,
                    balls: position.balls,
                    recorded_at: position.recordedAt,
                  },
                  { onConflict: "user_id,match_id,frame_number" }
                )
              : { error: null };
        if (error) {
          console.warn("Scan Snooker position not saved to the account yet:", error.message);
          return;
        }
        // Only clear it if nothing newer happened to the same frame while this was in flight.
        if (get().pending[key] === action && get().ownerId === ownerId) {
          const next = { ...get().pending };
          delete next[key];
          set({ pending: next });
        }
      };

      return {
        ownerId: null,
        positions: {},
        pending: {},

        setOwner: (userId) => {
          const { ownerId, positions, pending } = get();
          if (ownerId === userId) return;
          // Positions from before they were kept with an account belong to whoever signs in.
          if (ownerId === null && userId) {
            set({ ownerId: userId, positions, pending });
            return;
          }
          set({ ownerId: userId, positions: {}, pending: {} });
        },

        hydrate: async (userId) => {
          const { data, error } = await supabase
            .from("scan_positions")
            .select("match_id, frame_number, balls, recorded_at")
            .eq("user_id", userId);
          if (get().ownerId !== userId) return;
          if (error) {
            console.warn("Could not load Scan Snooker positions:", error.message);
            return;
          }
          const { positions: local, pending } = get();
          const merged: Record<string, RecordedPosition> = {};
          (data as Row[]).forEach((row) => {
            const key = keyFor(row.match_id, row.frame_number);
            if (pending[key] === "delete") return;
            merged[key] = {
              matchId: row.match_id,
              frameNumber: row.frame_number,
              recordedAt: row.recorded_at,
              balls: Array.isArray(row.balls) ? row.balls : [],
            };
          });
          // Anything changed here and not sent yet stays, as do positions for matches the
          // account does not have yet.
          Object.entries(local).forEach(([key, position]) => {
            if (pending[key] === "upsert" || !UUID.test(position.matchId)) merged[key] = position;
          });
          set({ positions: merged });
          await Promise.all(Object.keys(pending).map(push));
        },

        getPosition: (matchId, frameNumber) => get().positions[keyFor(matchId, frameNumber)],

        savePosition: (matchId, frameNumber, balls) => {
          const key = keyFor(matchId, frameNumber);
          const position: RecordedPosition = { matchId, frameNumber, recordedAt: new Date().toISOString(), balls };
          set((state) => ({
            positions: { ...state.positions, [key]: position },
            pending: { ...state.pending, [key]: "upsert" },
          }));
          void push(key);
          return position;
        },

        clearPosition: (matchId, frameNumber) => {
          const key = keyFor(matchId, frameNumber);
          set((state) => {
            const positions = { ...state.positions };
            delete positions[key];
            return { positions, pending: { ...state.pending, [key]: "delete" } };
          });
          void push(key);
        },
      };
    },
    {
      name: "scan-snooker-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 2,
      // Version 1 kept positions on the phone only; each is marked to be sent.
      migrate: (persisted, version) => {
        const saved = (persisted ?? {}) as Partial<ScanSnookerState>;
        if (version < 2) {
          const positions = saved.positions ?? {};
          const pending: Pending = Object.fromEntries(Object.keys(positions).map((key) => [key, "upsert" as const]));
          return { ownerId: null, positions, pending } as ScanSnookerState;
        }
        return saved as ScanSnookerState;
      },
      partialize: (state) => ({ ownerId: state.ownerId, positions: state.positions, pending: state.pending }),
    }
  )
);
