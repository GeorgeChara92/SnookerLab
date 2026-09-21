import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** The highest level each player has already been shown, so a level-up is celebrated once. */
type LevelSeenState = {
  ownerId: string | null;
  level: number | null;
  set: (ownerId: string, level: number) => void;
};

export const useLevelSeenStore = create<LevelSeenState>()(
  persist(
    (set) => ({
      ownerId: null,
      level: null,
      set: (ownerId, level) => set({ ownerId, level }),
    }),
    { name: "level-seen-storage", storage: createJSONStorage(() => safeStorage), version: 1 }
  )
);
