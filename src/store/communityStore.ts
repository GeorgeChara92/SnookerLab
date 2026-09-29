import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import { useAuthStore } from "./authStore";
import { setBlockedWords } from "../features/community/wordFilter";
import { loadShareActivity, saveShareActivity } from "../features/community/groupFeed";
import {
  PROFILE_COLUMNS,
  friendshipFromRow,
  profileFromRow,
  type Friendship,
  type PublicProfile,
  type PublicStats,
  type ReportReason,
} from "../features/community/types";

/**
 * The player's place in the community: their own public profile, their friends and requests,
 * who they have blocked, and the profiles of everyone those involve. Loaded when they sign in
 * and refreshed live when a request arrives or is answered.
 */

type Result = { ok: true } | { ok: false; message: string };

type CommunityState = {
  ownerId: string | null;
  me: PublicProfile | null;
  /** Whether the community tables exist yet and the player's data has loaded. */
  loaded: boolean;
  friendships: Friendship[];
  /** Everyone the player has a friendship, request or block with, by id. */
  profiles: Record<string, PublicProfile>;
  blocked: string[];
  isAdmin: boolean;
  /** Whether the player's results go in friends' and groups' feeds. */
  shareActivity: boolean;
  setShareActivity: (value: boolean) => Promise<boolean>;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  saveMe: (
    patch: Partial<
      Pick<
        PublicProfile,
        | "handle"
        | "bio"
        | "discoverable"
        | "messagePrivacy"
        | "statsPrivacy"
        | "leaderboards"
        | "coachQualifications"
        | "wpbsaAccredited"
        | "coachLocation"
        | "coachLat"
        | "coachLng"
      >
    >
  ) => Promise<Result>;
  handleIsFree: (handle: string) => Promise<boolean>;
  /** Of these handles, the ones nobody has. */
  freeHandles: (handles: string[]) => Promise<string[]>;
  search: (query: string) => Promise<PublicProfile[]>;
  loadProfile: (id: string) => Promise<{ profile: PublicProfile | null; stats: PublicStats | null }>;
  sendRequest: (to: string) => Promise<Result>;
  accept: (friendshipId: string) => Promise<Result>;
  removeFriendship: (friendshipId: string) => Promise<Result>;
  block: (userId: string) => Promise<Result>;
  unblock: (userId: string) => Promise<Result>;
  report: (input: {
    targetType: "profile" | "message" | "routine" | "group";
    targetId: string;
    reportedUser?: string;
    reason: ReportReason;
    details?: string;
  }) => Promise<Result>;
};

/** A database error in words a player can act on. */
const explain = (error: { code?: string; message?: string } | null): string => {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "23505") return "That is already taken.";
  if (error.code === "P0001" || error.message?.includes("not allowed"))
    return "That contains a word that is not allowed.";
  if (error.code === "42501" || error.message?.includes("row-level security")) return "That is not allowed.";
  if (error.message?.includes("does not exist")) return "Community is not switched on yet.";
  return "Check your connection and try again.";
};

export const useCommunityStore = create<CommunityState>()(
  persist(
    (set, get) => {
      const loadProfiles = async (ids: string[]) => {
        const missing = [...new Set(ids)].filter(Boolean);
        if (!missing.length) return;
        const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", missing);
        if (!data) return;
        set((state) => ({
          profiles: { ...state.profiles, ...Object.fromEntries(data.map((row) => [row.id, profileFromRow(row)])) },
        }));
      };

      return {
        ownerId: null,
        me: null,
        loaded: false,
        friendships: [],
        profiles: {},
        blocked: [],
        isAdmin: false,
        shareActivity: true,

        setOwner: (userId) => {
          if (get().ownerId === userId) return;
          set({
            ownerId: userId,
            me: null,
            loaded: false,
            friendships: [],
            profiles: {},
            blocked: [],
            isAdmin: false,
            shareActivity: true,
          });
        },

        hydrate: async (userId) => {
          const [meResult, friendsResult, blocksResult, adminResult, wordsResult] = await Promise.all([
            supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", userId).maybeSingle(),
            supabase.from("friendships").select("*"),
            supabase.from("blocks").select("blocked"),
            supabase.from("app_admins").select("user_id").eq("user_id", userId).maybeSingle(),
            supabase.from("blocked_words").select("word"),
          ]);
          if (get().ownerId !== userId) return;
          if (meResult.error || friendsResult.error) {
            console.warn("Could not load the community:", (meResult.error ?? friendsResult.error)?.message);
            return;
          }
          if (wordsResult.data) setBlockedWords(wordsResult.data.map((row) => row.word));

          // A brand new account has no profiles row yet - seed it with what the registration wizard
          // collected, so it starts with a real name rather than an empty one nobody ever gets
          // prompted to fill in. is_coach is never seeded here: a "Coach" or "Both" signup instead
          // submits a coach_applications row (see RegisterScreen and 20261016_0001), and is_coach is
          // only ever granted by an admin approving one - trg_freeze_is_coach now zeroes it back to
          // false on this very insert if anything ever tried to set it from an ordinary client.
          // Older accounts, with nothing in these fields on their auth metadata, are left exactly as
          // they are - this never runs again once the row exists.
          let meRow = meResult.data;
          const authUser = useAuthStore.getState().user;
          const fullName = authUser?.full_name?.trim();
          if (!meRow && fullName) {
            const seed: Record<string, unknown> = { id: userId };
            seed.display_name = fullName;
            if (authUser?.handle) seed.handle = authUser.handle;
            if (authUser?.bio) seed.bio = authUser.bio;
            if (authUser?.cue_preference) seed.cue_preference = authUser.cue_preference;
            const { data: seeded, error: seedError } = await supabase
              .from("profiles")
              .upsert(seed, { onConflict: "id" })
              .select(PROFILE_COLUMNS)
              .single();
            if (seeded) {
              meRow = seeded;
            } else if (seedError?.code === "23505" && seed.handle) {
              // Someone else claimed that handle between registration and this first login - the
              // rest of the seed still matters, so retry once without it rather than losing it all.
              const { handle: _handle, ...withoutHandle } = seed;
              const { data: retried } = await supabase
                .from("profiles")
                .upsert(withoutHandle, { onConflict: "id" })
                .select(PROFILE_COLUMNS)
                .single();
              if (retried) meRow = retried;
            }
          } else if (fullName && !meRow?.display_name) {
            const { data: seeded } = await supabase
              .from("profiles")
              .upsert({ id: userId, display_name: fullName }, { onConflict: "id" })
              .select(PROFILE_COLUMNS)
              .single();
            if (seeded) meRow = seeded;
          }

          const friendships = (friendsResult.data ?? []).map(friendshipFromRow);
          const blocked = (blocksResult.data ?? []).map((row) => row.blocked as string);
          set({
            me: meRow ? profileFromRow(meRow) : null,
            friendships,
            blocked,
            isAdmin: Boolean(adminResult.data),
            loaded: true,
          });
          void loadShareActivity(userId).then((value) => {
            if (get().ownerId === userId) set({ shareActivity: value });
          });
          await loadProfiles([
            ...friendships.map((item) => (item.requester === userId ? item.addressee : item.requester)),
            ...blocked,
          ]);
        },

        saveMe: async (patch) => {
          const { ownerId, me } = get();
          if (!ownerId) return { ok: false, message: "Sign in first." };
          const row: Record<string, unknown> = { id: ownerId };
          if (patch.handle !== undefined) row.handle = patch.handle;
          if (patch.bio !== undefined) row.bio = patch.bio?.trim() || null;
          if (patch.discoverable !== undefined) row.discoverable = patch.discoverable;
          if (patch.messagePrivacy !== undefined) row.message_privacy = patch.messagePrivacy;
          if (patch.statsPrivacy !== undefined) row.stats_privacy = patch.statsPrivacy;
          if (patch.leaderboards !== undefined) row.leaderboards = patch.leaderboards;
          if (patch.coachQualifications !== undefined) row.coach_qualifications = patch.coachQualifications;
          if (patch.wpbsaAccredited !== undefined) row.wpbsa_accredited = patch.wpbsaAccredited;
          if (patch.coachLocation !== undefined) row.coach_location = patch.coachLocation?.trim() || null;
          if (patch.coachLat !== undefined) row.coach_lat = patch.coachLat;
          if (patch.coachLng !== undefined) row.coach_lng = patch.coachLng;
          const { data, error } = await supabase
            .from("profiles")
            .upsert(row, { onConflict: "id" })
            .select(PROFILE_COLUMNS)
            .single();
          if (error) {
            return { ok: false, message: error.code === "23505" ? "That handle is taken." : explain(error) };
          }
          set({ me: profileFromRow(data ?? { ...me, ...row }) });
          return { ok: true };
        },

        setShareActivity: async (value) => {
          const { ownerId, shareActivity } = get();
          if (!ownerId) return false;
          set({ shareActivity: value });
          const ok = await saveShareActivity(ownerId, value);
          if (!ok) set({ shareActivity });
          return ok;
        },

        handleIsFree: async (handle) => {
          const { data } = await supabase.from("profiles").select("id").eq("handle", handle).maybeSingle();
          return !data || data.id === get().ownerId;
        },

        freeHandles: async (handles) => {
          if (!handles.length) return [];
          const { data } = await supabase.from("profiles").select("handle").in("handle", handles);
          const taken = new Set((data ?? []).map((row) => row.handle as string));
          return handles.filter((handle) => !taken.has(handle));
        },

        search: async (query) => {
          const { ownerId, blocked } = get();
          const text = query
            .trim()
            .replace(/^@/, "")
            .replace(/[%_,()]/g, "");
          if (text.length < 2) return [];
          const { data, error } = await supabase
            .from("profiles")
            .select(PROFILE_COLUMNS)
            .eq("discoverable", true)
            .not("handle", "is", null)
            .or(`handle.ilike.${text.toLowerCase()}%,display_name.ilike.%${text}%`)
            .limit(25);
          if (error || !data) return [];
          return data.map(profileFromRow).filter((profile) => profile.id !== ownerId && !blocked.includes(profile.id));
        },

        loadProfile: async (id) => {
          const [profileResult, statsResult] = await Promise.all([
            supabase.from("profiles").select(PROFILE_COLUMNS).eq("id", id).maybeSingle(),
            supabase.from("profile_stats").select("stats").eq("user_id", id).maybeSingle(),
          ]);
          const profile = profileResult.data ? profileFromRow(profileResult.data) : null;
          if (profile) set((state) => ({ profiles: { ...state.profiles, [id]: profile } }));
          return { profile, stats: (statsResult.data?.stats as PublicStats | undefined) ?? null };
        },

        sendRequest: async (to) => {
          const { ownerId } = get();
          if (!ownerId) return { ok: false, message: "Sign in first." };
          const { data, error } = await supabase
            .from("friendships")
            .insert({ requester: ownerId, addressee: to })
            .select("*")
            .single();
          if (error) {
            return {
              ok: false,
              message: error.code === "23505" ? "You are already connected, or they have asked you." : explain(error),
            };
          }
          set((state) => ({ friendships: [...state.friendships, friendshipFromRow(data)] }));
          return { ok: true };
        },

        accept: async (friendshipId) => {
          const { data, error } = await supabase
            .from("friendships")
            .update({ status: "accepted" })
            .eq("id", friendshipId)
            .select("*")
            .single();
          if (error) return { ok: false, message: explain(error) };
          set((state) => ({
            friendships: state.friendships.map((item) => (item.id === friendshipId ? friendshipFromRow(data) : item)),
          }));
          return { ok: true };
        },

        removeFriendship: async (friendshipId) => {
          const { error } = await supabase.from("friendships").delete().eq("id", friendshipId);
          if (error) return { ok: false, message: explain(error) };
          set((state) => ({ friendships: state.friendships.filter((item) => item.id !== friendshipId) }));
          return { ok: true };
        },

        block: async (userId) => {
          const { ownerId } = get();
          if (!ownerId) return { ok: false, message: "Sign in first." };
          const { error } = await supabase.from("blocks").insert({ blocker: ownerId, blocked: userId });
          if (error && error.code !== "23505") return { ok: false, message: explain(error) };
          // The database ends any friendship between the two; this mirrors it at once.
          set((state) => ({
            blocked: [...new Set([...state.blocked, userId])],
            friendships: state.friendships.filter((item) => item.requester !== userId && item.addressee !== userId),
          }));
          return { ok: true };
        },

        unblock: async (userId) => {
          const { error } = await supabase.from("blocks").delete().eq("blocked", userId);
          if (error) return { ok: false, message: explain(error) };
          set((state) => ({ blocked: state.blocked.filter((id) => id !== userId) }));
          return { ok: true };
        },

        report: async ({ targetType, targetId, reportedUser, reason, details }) => {
          const { ownerId } = get();
          if (!ownerId) return { ok: false, message: "Sign in first." };
          const { error } = await supabase.from("reports").insert({
            reporter: ownerId,
            target_type: targetType,
            target_id: targetId,
            reported_user: reportedUser ?? null,
            reason,
            details: details?.trim() || null,
          });
          // Reporting the same thing twice is not an error to the player: it is already with us.
          if (error && error.code !== "23505") return { ok: false, message: explain(error) };
          return { ok: true };
        },
      };
    },
    {
      name: "community-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({
        ownerId: state.ownerId,
        me: state.me,
        friendships: state.friendships,
        profiles: state.profiles,
        blocked: state.blocked,
        isAdmin: state.isAdmin,
        shareActivity: state.shareActivity,
      }),
    }
  )
);
