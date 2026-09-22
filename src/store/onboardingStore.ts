import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * The welcome tour and the "What's new" sheet: which accounts have been through the tour on this
 * phone (per account, so a new account on a phone someone else used still gets it), the last
 * version whose notes were shown, and which of the two is open right now.
 */
type OnboardingState = {
  toursDone: string[];
  seenVersion: string | null;
  open: "tour" | "whatsNew" | null;
  openTour: () => void;
  openWhatsNew: () => void;
  close: () => void;
  finishTour: (userId: string | null, version: string) => void;
  skipTour: (userId: string) => void;
  markSeen: (version: string) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      toursDone: [],
      seenVersion: null,
      open: null,
      openTour: () => set({ open: "tour" }),
      openWhatsNew: () => set({ open: "whatsNew" }),
      close: () => set({ open: null }),
      // Someone who has just been shown round does not need telling what is new as well.
      finishTour: (userId, version) =>
        set((state) => ({
          toursDone: userId ? [...state.toursDone.filter((id) => id !== userId), userId].slice(-20) : state.toursDone,
          seenVersion: version,
          open: null,
        })),
      skipTour: (userId) =>
        set((state) => ({ toursDone: [...state.toursDone.filter((id) => id !== userId), userId].slice(-20) })),
      markSeen: (version) => set({ seenVersion: version }),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 2,
      // Version 1 kept one flag for the whole phone; start the per-account list afresh.
      migrate: (persisted: any) => ({ toursDone: [], seenVersion: persisted?.seenVersion ?? null }),
      partialize: (state) => ({ toursDone: state.toursDone, seenVersion: state.seenVersion }),
    }
  )
);
