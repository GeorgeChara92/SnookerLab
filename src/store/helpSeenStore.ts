import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** Which help topics this phone has opened, so a "?" can wear a dot until its first look. */
type HelpSeenState = {
  seen: string[];
  markSeen: (topicId: string) => void;
};

export const useHelpSeenStore = create<HelpSeenState>()(
  persist(
    (set) => ({
      seen: [],
      markSeen: (topicId) => set((state) => (state.seen.includes(topicId) ? state : { seen: [...state.seen, topicId] })),
    }),
    { name: "help-seen", storage: createJSONStorage(() => safeStorage), version: 1 }
  )
);
