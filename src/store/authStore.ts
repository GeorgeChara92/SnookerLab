import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { supabase } from "../api/supabase";
import { User } from "../types";

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
];

interface AuthState {
  user: User | null;
  session: any | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, username: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updateAvatarPreset: (presetId: string) => Promise<void>;
  uploadProfilePhoto: (photoUri: string) => Promise<void>;
  setUser: (user: User | any | null) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      session: null,
      isLoading: false,
      isAuthenticated: false,
      signIn: async (email, password) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
          });
          if (error) throw error;
          set({ user: mapAuthUser(data.user), session: data.session, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },
      signUp: async (email, password, username) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } },
          });
          if (error) throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      signOut: async () => {
        await supabase.auth.signOut();
        await Promise.all(LEGACY_STORE_KEYS.map((key) => safeStorage.removeItem(key)));
        set({ user: null, session: null, isAuthenticated: false });
      },
      resetPassword: async (email) => {
        set({ isLoading: true });
        try {
          const { error } = await supabase.auth.resetPasswordForEmail(email);
          if (error) throw error;
        } finally {
          set({ isLoading: false });
        }
      },
      updateAvatarPreset: async (presetId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to set an avatar preset.");

        set({ isLoading: true });

        try {
          const { data, error } = await supabase.auth.updateUser({
            data: {
              avatar_preset: presetId,
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
                  avatar_preset: presetId,
                  updated_at: new Date().toISOString(),
                }
              : null,
          }));
        } finally {
          set({ isLoading: false });
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
