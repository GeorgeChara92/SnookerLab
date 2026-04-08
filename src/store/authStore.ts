import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { supabase } from "../api/supabase";
import { User, SkillLevel } from "../types";
import { logoutBilling } from "../services/billing";

const mapAuthUser = (authUser: any): User => ({
  id: authUser.id,
  email: authUser.email ?? "",
  username: authUser.user_metadata?.username,
  profile_image_url: authUser.user_metadata?.profile_image_url,
  avatar_preset: authUser.user_metadata?.avatar_preset,
  country_code: authUser.user_metadata?.country_code,
  bio: authUser.user_metadata?.bio,
  cue_preference: authUser.user_metadata?.cue_preference,
  skill_level: authUser.user_metadata?.skill_level,
  subscription_tier: authUser.user_metadata?.subscription_tier,
  subscription_anchor_date: authUser.user_metadata?.subscription_anchor_date,
  created_at: authUser.created_at ?? new Date().toISOString(),
  updated_at: authUser.updated_at ?? new Date().toISOString(),
});

const normalizeUser = (user: any | null): User | null => {
  if (!user) return null;
  if (user.user_metadata || !user.created_at) return mapAuthUser(user);
  return user as User;
};

const LEGACY_STORE_KEYS = [
  "sessions-storage",
  "matches-storage",
  "routine-scores-storage",
  "tournaments-storage",
  "ai-analyses-storage",
  "seen_achievements",
];

const DATA_STORE_KEYS = [
  "sessions-storage",
  "matches-storage",
  "routine-scores-storage",
  "tournaments-storage",
  "ai-analyses-storage",
  "seen_achievements",
];

const AUTH_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL ?? "snookerlab://auth/callback";
const AUTH_CONFIRM_REDIRECT_URL = process.env.EXPO_PUBLIC_AUTH_CONFIRM_REDIRECT_URL ?? AUTH_REDIRECT_URL;

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  requiresPasswordReset: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string, skillLevel?: SkillLevel, countryCode?: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  resetProfile: () => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  setRequiresPasswordReset: (value: boolean) => void;
  updateAvatarPreset: (presetId: string) => Promise<void>;
  uploadProfilePhoto: (photoUri: string) => Promise<void>;
  updateProfile: (updates: { skill_level?: SkillLevel; country_code?: string; cue_preference?: string }) => Promise<void>;
  setUser: (user: User | any | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      requiresPasswordReset: false,
      signIn: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          set({ user: mapAuthUser(data.user), session: data.session, isAuthenticated: true, requiresPasswordReset: false });
        } finally {
          set({ isLoading: false });
        }
      },
      signUp: async (email, password, username, skillLevel, countryCode) => {
        set({ isLoading: true });
        try {
          const nowIso = new Date().toISOString();
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: AUTH_CONFIRM_REDIRECT_URL,
              data: {
                username,
                subscription_tier: "free",
                subscription_anchor_date: nowIso,
                ...(skillLevel && { skill_level: skillLevel }),
                ...(countryCode && { country_code: countryCode }),
              },
            },
          });
          if (error) throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
        await logoutBilling();
        await Promise.all(LEGACY_STORE_KEYS.map((key) => safeStorage.removeItem(key)));
        set({ user: null, session: null, isAuthenticated: false, requiresPasswordReset: false });
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
              subscription_tier: authUser.user_metadata?.subscription_tier,
              subscription_anchor_date: authUser.user_metadata?.subscription_anchor_date,
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
          const extension = photoUri.split(".").pop()?.toLowerCase() || "jpg";
          const path = `${authUser.id}/avatar-${Date.now()}.${extension}`;
          const fileResponse = await fetch(photoUri);
          const fileBlob = await fileResponse.blob();

          const { error: uploadError } = await supabase.storage
            .from("profile-images")
            .upload(path, fileBlob, {
              contentType: fileBlob.type || "image/jpeg",
              upsert: true,
            });

          if (uploadError) throw uploadError;

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
