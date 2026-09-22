import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * What the feed has already been told about on this phone: when posting began (nothing from
 * before then is posted, so a new install does not flood friends with old results), each
 * routine's best and the level last seen, and the moments already sent.
 */
type ActivityState = {
  ownerId: string | null;
  since: string | null;
  bests: Record<string, number>;
  level: number | null;
  posted: string[];
  start: (ownerId: string, bests: Record<string, number>, level: number) => void;
  setBest: (key: string, value: number) => void;
  setLevel: (level: number) => void;
  markPosted: (keys: string[]) => void;
};

export const useActivityStore = create<ActivityState>()(
  persist(
    (set) => ({
      ownerId: null,
      since: null,
      bests: {},
      level: null,
      posted: [],
      start: (ownerId, bests, level) => set({ ownerId, since: new Date().toISOString(), bests, level, posted: [] }),
      setBest: (key, value) => set((state) => ({ bests: { ...state.bests, [key]: value } })),
      setLevel: (level) => set({ level }),
      // The last few hundred are enough: the database refuses a repeat anyway.
      markPosted: (keys) => set((state) => ({ posted: [...state.posted, ...keys].slice(-300) })),
    }),
    { name: "activity-storage", storage: createJSONStorage(() => safeStorage), version: 1 }
  )
);
