import { create } from "zustand";
import { fetchMyCoachApplication } from "../features/coach/applications";
import type { CoachApplication } from "../features/coach/types";

/**
 * This account's own coach application, if it has ever made one - fetched once and shared, so the
 * player-view header pill, Profile's coaching row and the decision popup all agree on the same
 * value instead of each fetching it separately. Not persisted: refetched each session.
 */
type MyCoachApplicationState = {
  application: CoachApplication | null;
  loaded: boolean;
  refresh: (userId: string, email: string) => Promise<void>;
  clear: () => void;
};

export const useMyCoachApplicationStore = create<MyCoachApplicationState>((set) => ({
  application: null,
  loaded: false,
  refresh: async (userId, email) => {
    const application = await fetchMyCoachApplication(userId, email);
    set({ application, loaded: true });
  },
  clear: () => set({ application: null, loaded: false }),
}));
