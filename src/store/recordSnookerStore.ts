import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import type { PlacedBall, RecordedPosition } from "../features/scanSnooker/position";

/**
 * The positions recorded by walking a lap, one per frame. Kept on the phone and apart from Scan
 * Snooker's store on purpose: while the lap is being tested, nothing it finds can replace a
 * position a player scanned by hand.
 */

const keyFor = (matchId: string, frameNumber: number) => `${matchId}:${frameNumber}`;

type RecordSnookerState = {
  positions: Record<string, RecordedPosition>;
  savePosition: (matchId: string, frameNumber: number, balls: PlacedBall[]) => void;
};

export const selectLapPosition = (matchId: string, frameNumber: number) => (state: RecordSnookerState) =>
  state.positions[keyFor(matchId, frameNumber)];

export const useRecordSnookerStore = create<RecordSnookerState>()(
  persist(
    (set) => ({
      positions: {},
      savePosition: (matchId, frameNumber, balls) =>
        set((state) => ({
          positions: {
            ...state.positions,
            [keyFor(matchId, frameNumber)]: { matchId, frameNumber, recordedAt: new Date().toISOString(), balls },
          },
        })),
    }),
    { name: "record-snooker-storage", storage: createJSONStorage(() => safeStorage) }
  )
);
