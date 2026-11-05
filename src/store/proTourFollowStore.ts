import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import { useAuthStore } from "./authStore";
import { registerForPush } from "../features/notifications/push";

type FollowState = {
  /** Pro players this person follows. Kept on the phone so it works signed out; synced to their
   *  account when signed in, which is what lets poll-pro-tour send them a push when a match starts
   *  or finishes. */
  ids: number[];
  isFollowing: (playerId: number) => boolean;
  toggle: (playerId: number) => Promise<{ following: boolean; notifications: boolean }>;
  sync: () => Promise<void>;
};

const userId = () => useAuthStore.getState().user?.id ?? null;

/** Following a player is what asks for notification permission on the pro tour side. */
const registerForProTourPush = (ask = true) => registerForPush(userId(), ask);

export const useProTourFollowStore = create<FollowState>()(
  persist(
    (set, get) => ({
      ids: [],
      isFollowing: (playerId) => get().ids.includes(playerId),
      toggle: async (playerId) => {
        const following = !get().ids.includes(playerId);
        set((state) => ({ ids: following ? [...state.ids, playerId] : state.ids.filter((id) => id !== playerId) }));
        const uid = userId();
        let notifications = false;
        if (uid) {
          const { error } = following
            ? await supabase.from("pro_tour_follows").upsert({ user_id: uid, player_id: playerId }, { onConflict: "user_id,player_id" })
            : await supabase.from("pro_tour_follows").delete().eq("user_id", uid).eq("player_id", playerId);
          if (error) console.warn("pro tour follow sync failed", error);
          if (following) notifications = await registerForProTourPush();
        }
        return { following, notifications };
      },
      sync: async () => {
        const uid = userId();
        if (!uid) return;
        const { data, error } = await supabase.from("pro_tour_follows").select("player_id").eq("user_id", uid);
        if (error) return;
        const remote = (data ?? []).map((row) => Number(row.player_id));
        const local = get().ids;
        // Follows made signed out (or on this phone before signing in) are pushed up, then merged.
        const missing = local.filter((id) => !remote.includes(id));
        if (missing.length) {
          await supabase.from("pro_tour_follows").upsert(missing.map((player_id) => ({ user_id: uid, player_id })), { onConflict: "user_id,player_id" });
        }
        const ids = [...new Set([...remote, ...local])];
        set({ ids });
        // Keep this phone's push token current (tokens change on reinstall) - without asking again.
        if (ids.length) void registerForProTourPush(false);
      },
    }),
    { name: "pro-tour-follows", storage: createJSONStorage(() => safeStorage), version: 1, partialize: (state) => ({ ids: state.ids }) }
  )
);
