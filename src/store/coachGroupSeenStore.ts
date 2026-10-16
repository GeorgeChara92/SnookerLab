import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** When this phone last opened each coach group, so the Coaching tab can say "2 new". */
type SeenState = {
  seen: Record<string, string>;
  markSeen: (groupId: string) => void;
};

export const useCoachGroupSeenStore = create<SeenState>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (groupId) => set((state) => ({ seen: { ...state.seen, [groupId]: new Date().toISOString() } })),
    }),
    { name: "coach-group-seen", storage: createJSONStorage(() => safeStorage), version: 1 }
  )
);
