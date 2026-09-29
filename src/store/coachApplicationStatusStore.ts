import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * Which coach application decisions this phone has already told the player about, keyed by
 * application id (globally unique, so no per-account keying needed the way onboardingStore has).
 * A decision popup only shows once per application, the first time its status is seen as no longer
 * "pending".
 */
type CoachApplicationStatusState = {
  seen: Record<string, string>;
  markSeen: (applicationId: string, status: string) => void;
};

export const useCoachApplicationStatusStore = create<CoachApplicationStatusState>()(
  persist(
    (set) => ({
      seen: {},
      markSeen: (applicationId, status) =>
        set((state) => ({ seen: { ...state.seen, [applicationId]: status } })),
    }),
    { name: "coach-application-status-storage", storage: createJSONStorage(() => safeStorage) }
  )
);
