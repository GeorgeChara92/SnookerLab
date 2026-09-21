import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** How the player last styled a result card, so the next one starts the same way. */
type SharePrefsState = {
  themeId: string | null;
  frames: boolean;
  highBreaks: boolean;
  set: (prefs: Partial<Pick<SharePrefsState, "themeId" | "frames" | "highBreaks">>) => void;
};

export const useSharePrefsStore = create<SharePrefsState>()(
  persist(
    (set) => ({
      themeId: null,
      frames: true,
      highBreaks: true,
      set: (prefs) => set(prefs),
    }),
    {
      name: "share-prefs-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ themeId: state.themeId, frames: state.frames, highBreaks: state.highBreaks }),
    }
  )
);
