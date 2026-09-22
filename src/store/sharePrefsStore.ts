import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** How the player last styled a result card, so the next one starts the same way, and live sharing. */
type SharePrefsState = {
  themeId: string | null;
  frames: boolean;
  highBreaks: boolean;
  highlights: boolean;
  /** Whether matches scored live can be followed by friends and groups. */
  liveSharing: boolean;
  set: (
    prefs: Partial<Pick<SharePrefsState, "themeId" | "frames" | "highBreaks" | "highlights" | "liveSharing">>
  ) => void;
};

export const useSharePrefsStore = create<SharePrefsState>()(
  persist(
    (set) => ({
      themeId: null,
      frames: true,
      highBreaks: true,
      highlights: true,
      liveSharing: true,
      set: (prefs) => set(prefs),
    }),
    {
      name: "share-prefs-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({
        themeId: state.themeId,
        frames: state.frames,
        highBreaks: state.highBreaks,
        highlights: state.highlights,
        liveSharing: state.liveSharing,
      }),
    }
  )
);
