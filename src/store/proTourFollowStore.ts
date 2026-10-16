import { Platform } from "react-native";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import { useAuthStore } from "./authStore";

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

/** Registers this phone for push and stores its token against the signed-in account. Quietly does
 *  nothing when permission is refused, on a simulator, or signed out - following still works. */
export const registerForProTourPush = async (ask = true): Promise<boolean> => {
  const uid = userId();
  if (!uid) return false;
  try {
    const { status } = ask ? await Notifications.requestPermissionsAsync() : await Notifications.getPermissionsAsync();
    if (status !== "granted") return false;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    if (!token) return false;
    await supabase.from("push_tokens").upsert({ token, user_id: uid, platform: Platform.OS, updated_at: new Date().toISOString() }, { onConflict: "token" });
    return true;
  } catch (error) {
    console.warn("pro tour push registration failed", error);
    return false;
  }
};

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
