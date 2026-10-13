import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * The welcome tour and the "What's new" sheet, tracked separately for the player app and coach
 * view: which accounts have been through each tour on this phone (per account, so a new account on
 * a phone someone else used still gets it), the last version whose notes were shown in each view,
 * and which of the two is open right now.
 */

export type Audience = "player" | "coach";

type OnboardingOpen = { kind: "tour" | "whatsNew"; audience: Audience };

type OnboardingState = {
  toursDone: Record<Audience, string[]>;
  seenVersion: Record<Audience, string | null>;
  open: OnboardingOpen | null;
  openTour: (audience: Audience) => void;
  openWhatsNew: (audience: Audience) => void;
  close: () => void;
  finishTour: (userId: string | null, audience: Audience, version: string) => void;
  skipTour: (userId: string, audience: Audience) => void;
  markSeen: (audience: Audience, version: string) => void;
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      toursDone: { player: [], coach: [] },
      seenVersion: { player: null, coach: null },
      open: null,
      openTour: (audience) => set({ open: { kind: "tour", audience } }),
      openWhatsNew: (audience) => set({ open: { kind: "whatsNew", audience } }),
      close: () => set({ open: null }),
      // Someone who has just been shown round does not need telling what is new as well.
      finishTour: (userId, audience, version) =>
        set((state) => ({
          toursDone: {
            ...state.toursDone,
            [audience]: userId
              ? [...state.toursDone[audience].filter((id) => id !== userId), userId].slice(-20)
              : state.toursDone[audience],
          },
          seenVersion: { ...state.seenVersion, [audience]: version },
          open: null,
        })),
      skipTour: (userId, audience) =>
        set((state) => ({
          toursDone: {
            ...state.toursDone,
            [audience]: [...state.toursDone[audience].filter((id) => id !== userId), userId].slice(-20),
          },
        })),
      markSeen: (audience, version) => set((state) => ({ seenVersion: { ...state.seenVersion, [audience]: version } })),
    }),
    {
      name: "onboarding-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 4,
      // Versions 1-3 kept a single flat list/version, all of it the player's - version 4 splits
      // player and coach apart, so a coach account starts the coach tour fresh rather than being
      // wrongly marked done by having toured the player app already.
      migrate: (persisted: any) => ({
        toursDone: { player: Array.isArray(persisted?.toursDone) ? persisted.toursDone : [], coach: [] },
        seenVersion: { player: persisted?.seenVersion ?? null, coach: null },
      }),
      partialize: (state) => ({ toursDone: state.toursDone, seenVersion: state.seenVersion }),
    }
  )
);
