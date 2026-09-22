import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * The welcome tour and the "What's new" sheet: whether this phone has been through the tour,
 * the last version whose notes were shown, and which of the two is open right now.
 */
type OnboardingState = {
  tourDone: boolean;
  seenVersion: string | null;
  open: "tour" | "whatsNew" | null;
  openTour: () => void;
  openWhatsNew: () => void;
  close: () => void;
  finishTour: (version: string) => void;
  markSeen: (version: string) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      tourDone: false,
      seenVersion: null,
      open: null,
      openTour: () => set({ open: "tour" }),
      openWhatsNew: () => set({ open: "whatsNew" }),
      close: () => set({ open: null }),
      // Someone who has just been shown round does not need telling what is new as well.
      finishTour: (version) => set({ tourDone: true, seenVersion: version, open: null }),
      markSeen: (version) => set({ seenVersion: version }),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ tourDone: state.tourDone, seenVersion: state.seenVersion }),
    }
  )
);
