import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/**
 * Permissions the player gives us that are not an iOS system prompt.
 *
 * Coach clips leave the app: they go to Google's Gemini API to be analysed. App Review
 * guideline 5.1.2(i) asks for that to be disclosed and agreed to before it happens, so the
 * first upload asks, and the answer is kept per device.
 */
type ConsentState = {
  /** When the player agreed to clips being sent for analysis, or null if they have not. */
  coachAnalysisAt: string | null;
  allowCoachAnalysis: () => void;
  clearConsents: () => void;
};

export const useConsentStore = create<ConsentState>()(
  persist(
    (set) => ({
      coachAnalysisAt: null,
      allowCoachAnalysis: () => set({ coachAnalysisAt: new Date().toISOString() }),
      clearConsents: () => set({ coachAnalysisAt: null }),
    }),
    {
      name: "consent-storage",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
