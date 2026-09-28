import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { safeStorage } from "../utils/storage";
import { supabase } from "../api/supabase";
import { User, SkillLevel } from "../types";
import { logoutBilling } from "../services/billing";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const mapAuthUser = (authUser: any): User => ({
  id: authUser.id,
  email: authUser.email ?? "",
  username: authUser.user_metadata?.username,
  full_name: authUser.user_metadata?.full_name,
  account_type: authUser.user_metadata?.account_type,
  profile_image_url: authUser.user_metadata?.profile_image_url,
  avatar_preset: authUser.user_metadata?.avatar_preset,
  country_code: authUser.user_metadata?.country_code,
  bio: authUser.user_metadata?.bio,
  cue_preference: authUser.user_metadata?.cue_preference,
  skill_level: authUser.user_metadata?.skill_level,
  handle: authUser.user_metadata?.handle,
  coach_location: authUser.user_metadata?.coach_location,
  coach_lat: authUser.user_metadata?.coach_lat,
  coach_lng: authUser.user_metadata?.coach_lng,
  wpbsa_accredited: authUser.user_metadata?.wpbsa_accredited,
  coach_qualifications: authUser.user_metadata?.coach_qualifications,
  tour_seen: authUser.user_metadata?.tour_seen === true,
  // app_metadata is written only by the service role (the RevenueCat webhook and the
  // sync-subscription function), so the tier cannot be forged from the client.
  subscription_tier: authUser.app_metadata?.subscription_tier,
  subscription_anchor_date: authUser.app_metadata?.subscription_anchor_date,
  created_at: authUser.created_at ?? new Date().toISOString(),
  updated_at: authUser.updated_at ?? new Date().toISOString(),
});

const normalizeUser = (user: any | null): User | null => {
  if (!user) return null;
  if (user.user_metadata || user.app_metadata || !user.created_at) return mapAuthUser(user);
  return user as User;
};

const LEGACY_STORE_KEYS = [
  "sessions-storage",
  "matches-storage",
  "routine-scores-storage",
  "tournaments-storage",
  "ai-analyses-storage",
  "seen_achievements",
  "scan-snooker-storage",
  "custom-routines-storage",
  "practice-plan-storage",
  "community-storage",
];

const DATA_STORE_KEYS = [
  "sessions-storage",
  "matches-storage",
  "routine-scores-storage",
  "tournaments-storage",
  "ai-analyses-storage",
  "seen_achievements",
  "scan-snooker-storage",
  "custom-routines-storage",
  "practice-plan-storage",
  "community-storage",
];

const AUTH_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? "snookerlab://auth/callback";
const AUTH_CONFIRM_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_CONFIRM_REDIRECT_URL ?? AUTH_REDIRECT_URL;

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresPasswordReset: boolean;
  /** A real photo picked during registration, before there was a session to upload it with. Copied
   * to a stable local path so it survives leaving the app to confirm the email; uploaded the moment
   * a session exists (see uploadPendingAvatar), so the photo appears to have "just been there". */
  pendingAvatarPath: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  /** Everything the registration wizard collected, stashed in user_metadata until the account is
   * confirmed and signed in - communityStore.hydrate seeds the real profile from it on first login,
   * since a handle/coach profile cannot be written to a row that does not exist yet.
   * alreadyRegistered: the email has an account. Supabase then sends no email and reports success
   * anyway (so strangers cannot probe who has an account), which left the player waiting for a
   * confirmation that was never coming. */
  signUp: (input: {
    email: string;
    password: string;
    username: string;
    fullName: string;
    accountType: "player" | "coach" | "both";
    skillLevel?: SkillLevel;
    countryCode?: string;
    cuePreference?: string;
    avatarPreset?: string;
    handle?: string;
    bio?: string;
    coachLocation?: string;
    coachLat?: number;
    coachLng?: number;
    wpbsaAccredited?: boolean;
    coachQualifications?: string[];
  }) => Promise<{ alreadyRegistered: boolean }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetProfile: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  setRequiresPasswordReset: (value: boolean) => void;
  updateAvatarPreset: (presetId: string) => Promise<void>;
  uploadProfilePhoto: (photoUri: string) => Promise<void>;
  /** Back to the generated avatar - clears the photo rather than the other way around. */
  removeProfilePhoto: () => Promise<void>;
  /** Stashes a photo picked pre-signup somewhere that survives the trip to Mail and back. */
  stagePendingAvatar: (photoUri: string) => Promise<void>;
  /** Uploads a staged pre-signup photo now that a session exists, then clears it either way - a
   * corrupt or now-missing local file should not keep retrying forever. Safe to call whenever the
   * user becomes authenticated; a no-op when nothing is staged. */
  uploadPendingAvatar: () => Promise<void>;
  updateProfile: (updates: {
    skill_level?: SkillLevel;
    country_code?: string;
    cue_preference?: string;
  }) => Promise<void>;
  setUser: (user: User | any | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      requiresPasswordReset: false,
      pendingAvatarPath: null,
      signIn: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          set({
            user: mapAuthUser(data.user),
            session: data.session,
            isAuthenticated: true,
            requiresPasswordReset: false,
          });
        } finally {
          set({ isLoading: false });
        }
      },
      signUp: async ({
        email,
        password,
        username,
        fullName,
        accountType,
        skillLevel,
        countryCode,
        cuePreference,
        avatarPreset,
        handle,
        bio,
        coachLocation,
        coachLat,
        coachLng,
        wpbsaAccredited,
        coachQualifications,
      }) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: AUTH_CONFIRM_REDIRECT_URL,
              data: {
                username,
                full_name: fullName,
                account_type: accountType,
                ...(skillLevel && { skill_level: skillLevel }),
                ...(countryCode && { country_code: countryCode }),
                ...(cuePreference && { cue_preference: cuePreference }),
                ...(avatarPreset && { avatar_preset: avatarPreset }),
                ...(handle && { handle }),
                ...(bio && { bio }),
                ...(coachLocation && { coach_location: coachLocation }),
                ...(coachLat != null && { coach_lat: coachLat }),
                ...(coachLng != null && { coach_lng: coachLng }),
                ...(wpbsaAccredited && { wpbsa_accredited: wpbsaAccredited }),
                ...(coachQualifications?.length && { coach_qualifications: coachQualifications }),
              },
            },
          });
          if (error) throw error;
          // An existing account comes back as a user with no sign-in identities.
          return { alreadyRegistered: Boolean(data.user && (data.user.identities ?? []).length === 0) };
        } finally {
          set({ isLoading: false });
        }
      },
      signOut: async () => {
        // Signing out must always work on this phone, even offline or if Supabase is slow: the
        // local session is cleared whatever happens to the calls around it.
        try {
          await Promise.race([
            supabase.auth.signOut({ scope: "local" }),
            new Promise((resolve) => setTimeout(resolve, 4000)),
          ]);
          await logoutBilling();
          await Promise.all(LEGACY_STORE_KEYS.map((key) => safeStorage.removeItem(key)));
        } catch (error) {
          console.warn("Sign out cleanup failed:", error);
        } finally {
          set({ user: null, session: null, isAuthenticated: false, requiresPasswordReset: false });
        }
      },
      resetPassword: async (email) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: AUTH_REDIRECT_URL,
          });
          if (error) throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      resendEmailVerification: async (email) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.resend({
            type: "signup",
            email,
            options: {
              emailRedirectTo: AUTH_CONFIRM_REDIRECT_URL,
            },
          });
          if (error) throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      deleteAccount: async () => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.functions.invoke("delete-account", {
            body: {},
          });
          if (error) throw error;

          await logoutBilling();
          await Promise.all(LEGACY_STORE_KEYS.map((key) => safeStorage.removeItem(key)));
          set({ user: null, session: null, isAuthenticated: false, requiresPasswordReset: false });
        } finally {
          set({ isLoading: false });
        }
      },
      resetProfile: async () => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to reset your profile.");

        set({ isLoading: true });
        try {
          // First clear AsyncStorage (before clearing in-memory to prevent persist from re-saving)
          await Promise.all(DATA_STORE_KEYS.map((key) => safeStorage.removeItem(key)));

          // Then clear in-memory stores
          const { useMatchesStore } = await import("./matchesStore");
          const { useSessionsStore } = await import("./sessionsStore");
          const { useTournamentsStore } = await import("./tournamentsStore");
          const { useRoutineScoresStore } = await import("./routineScoresStore");
          const { useAIAnalysesStore } = await import("./aiAnalysesStore");

          useMatchesStore.setState({ ownerUserId: null, matches: [], liveFramesByMatch: {} });
          useSessionsStore.setState({ ownerUserId: null, templates: [], logs: [], activeResults: [] });
          useTournamentsStore.setState({ ownerUserId: null, tournaments: [] });
          useRoutineScoresStore.setState({ ownerUserId: null, entries: [] });
          useAIAnalysesStore.setState({ ownerUserId: null, analyses: [] });

          // Then delete from server
          const { error } = await supabase.functions.invoke("reset-profile", {
            body: {},
          });
          if (error) throw error;

          // Finally update user metadata
          const updatedUser = mapAuthUser({
            ...authUser,
            user_metadata: {
              ...authUser.user_metadata,
              avatar_preset: undefined,
              skill_level: undefined,
              country_code: undefined,
              cue_preference: undefined,
              bio: undefined,
            },
          });
          set({ user: updatedUser });
        } finally {
          set({ isLoading: false });
        }
      },
      updatePassword: async (password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.updateUser({ password });
          if (error) throw error;

          if (data.user) {
            set({ user: mapAuthUser(data.user), isAuthenticated: true, requiresPasswordReset: false });
          } else {
            set({ requiresPasswordReset: false });
          }
        } finally {
          set({ isLoading: false });
        }
      },
      setRequiresPasswordReset: (value) => {
        set({ requiresPasswordReset: value });
      },
      updateAvatarPreset: async (presetId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to set an avatar preset.");

        // Optimistic update - immediately update UI
        set((state) => ({
          user: state.user
            ? {
                ...state.user,
                avatar_preset: presetId,
                updated_at: new Date().toISOString(),
              }
            : null,
        }));

        try {
          const { data, error } = await supabase.auth.updateUser({
            data: {
              avatar_preset: presetId,
            },
          });

          if (error) throw error;

          if (data.user) {
            set({ user: mapAuthUser(data.user) });
          }
        } catch (error) {
          // Revert on error
          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  avatar_preset: authUser.user_metadata?.avatar_preset,
                }
              : null,
          }));
          throw error;
        }
      },
      uploadProfilePhoto: async (photoUri) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to upload a profile photo.");

        set({ isLoading: true });

        try {
          if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Upload service is not fully configured.");
          const session = (await supabase.auth.getSession()).data.session;
          if (!session?.access_token) throw new Error("You need to be signed in to upload a profile photo.");

          // fetch(uri).blob() silently produces a truncated or empty file for a local photo library
          // URI on React Native - the same reason coach group media uploads through FileSystem's
          // own uploadAsync instead. This is that same direct-to-storage approach.
          const extension = (photoUri.split(".").pop() || "jpg").toLowerCase();
          const path = `${authUser.id}/avatar-${Date.now()}.${extension}`;
          const contentType = extension === "png" ? "image/png" : extension === "heic" ? "image/heic" : "image/jpeg";
          const uploadUrl = `${SUPABASE_URL}/storage/v1/object/profile-images/${encodeURIComponent(path)}`;

          const result = await FileSystemLegacy.uploadAsync(uploadUrl, photoUri, {
            httpMethod: "POST",
            uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              apikey: SUPABASE_ANON_KEY,
              "Content-Type": contentType,
              "x-upsert": "true",
            },
          });
          if (result.status < 200 || result.status >= 300) throw new Error(`Upload failed (status ${result.status}).`);

          const { data: publicData } = supabase.storage.from("profile-images").getPublicUrl(path);
          const photoUrl = publicData.publicUrl;

          const { data, error } = await supabase.auth.updateUser({
            data: {
              profile_image_url: photoUrl,
            },
          });

          if (error) throw error;

          if (data.user) {
            set({ user: mapAuthUser(data.user), isAuthenticated: true });
            return;
          }

          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  profile_image_url: photoUrl,
                  updated_at: new Date().toISOString(),
                }
              : null,
          }));
        } finally {
          set({ isLoading: false });
        }
      },
      removeProfilePhoto: async () => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.updateUser({ data: { profile_image_url: null } });
          if (error) throw error;

          if (data.user) {
            set({ user: mapAuthUser(data.user), isAuthenticated: true });
            return;
          }

          set((state) => ({
            user: state.user ? { ...state.user, profile_image_url: undefined, updated_at: new Date().toISOString() } : null,
          }));
        } finally {
          set({ isLoading: false });
        }
      },
      stagePendingAvatar: async (photoUri) => {
        // documentDirectory (unlike the picker's own cache/tmp URI) is never cleared by iOS just for
        // backgrounding or relaunching the app, so the file is still there when the user comes back
        // from confirming their email.
        const extension = (photoUri.split(".").pop() || "jpg").toLowerCase();
        const path = `${FileSystemLegacy.documentDirectory}pending-avatar-${Date.now()}.${extension}`;
        await FileSystemLegacy.copyAsync({ from: photoUri, to: path });
        set({ pendingAvatarPath: path });
      },
      uploadPendingAvatar: async () => {
        const path = get().pendingAvatarPath;
        if (!path) return;
        try {
          const info = await FileSystemLegacy.getInfoAsync(path);
          if (info.exists) await get().uploadProfilePhoto(path);
        } catch (error) {
          console.warn("Pending avatar upload failed:", error);
          return; // leave it staged - the next launch will retry
        }
        set({ pendingAvatarPath: null });
        try {
          await FileSystemLegacy.deleteAsync(path, { idempotent: true });
        } catch {
          // The file sticking around costs nothing now that it is no longer referenced.
        }
      },
      updateProfile: async (updates) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to update your profile.");

        set({ isLoading: true });

        try {
          const { data, error } = await supabase.auth.updateUser({
            data: updates,
          });

          if (error) throw error;

          if (data.user) {
            set({ user: mapAuthUser(data.user), isAuthenticated: true });
            return;
          }

          set((state) => ({
            user: state.user
              ? {
                  ...state.user,
                  ...updates,
                  updated_at: new Date().toISOString(),
                }
              : null,
          }));
        } finally {
          set({ isLoading: false });
        }
      },
      setUser: (user) => {
        const normalized = normalizeUser(user);
        set({ user: normalized, isAuthenticated: !!normalized });
      },
    }),
    {
      name: "auth-storage",
      storage: createJSONStorage(() => safeStorage),
    }
  )
);
