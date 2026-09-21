import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import type { PlacedBall, RecordedPosition } from "../features/scanSnooker/position";

/**
 * The positions recorded with Scan Snooker, one per frame: the latest one is what the balls go
 * back to after a miss. Kept on the phone for now, so it works at a club with no signal.
 */

const keyFor = (matchId: string, frameNumber: number) => `${matchId}:${frameNumber}`;

type ScanSnookerState = {
  positions: Record<string, RecordedPosition>;
  getPosition: (matchId: string, frameNumber: number) => RecordedPosition | undefined;
  savePosition: (matchId: string, frameNumber: number, balls: PlacedBall[]) => RecordedPosition;
  clearPosition: (matchId: string, frameNumber: number) => void;
};

export const useScanSnookerStore = create<ScanSnookerState>()(
  persist(
    (set, get) => ({
      positions: {},
      getPosition: (matchId, frameNumber) => get().positions[keyFor(matchId, frameNumber)],
      savePosition: (matchId, frameNumber, balls) => {
        const position: RecordedPosition = { matchId, frameNumber, recordedAt: new Date().toISOString(), balls };
        set((state) => ({ positions: { ...state.positions, [keyFor(matchId, frameNumber)]: position } }));
        return position;
      },
      clearPosition: (matchId, frameNumber) =>
        set((state) => {
          const positions = { ...state.positions };
          delete positions[keyFor(matchId, frameNumber)];
          return { positions };
        }),
    }),
    { name: "scan-snooker-storage", storage: createJSONStorage(() => safeStorage), version: 1 }
  )
);
