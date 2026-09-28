import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * Which whole experience is on screen: the player's app, or a coach's. Purely a device-side
 * preference - it is not who the account is (that is `is_coach` on the profile), just which of
 * the two views they last chose to look at, the way Instagram remembers your last-used account.
 */

type UiModeState = {
  viewMode: "player" | "coach";
  setViewMode: (mode: "player" | "coach") => void;
};

export const useUiModeStore = create<UiModeState>()(
  persist(
    (set) => ({
      viewMode: "player",
      setViewMode: (mode) => set({ viewMode: mode }),
    }),
    {
      name: "ui-mode-storage",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
