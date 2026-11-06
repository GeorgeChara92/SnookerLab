import { createClient } from "@supabase/supabase-js";

// The same project and public key the app ships with. What a signed-in session can see is decided
// by the database (app_admins, RLS and the admin_ functions), not by this key.
const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL as string | undefined;
const key = import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && key);

export const supabase = createClient(url || "https://placeholder.supabase.co", key || "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: "snookered-admin" },
});

export const nameOf = (profile: { display_name?: string | null; handle?: string | null } | null | undefined) =>
  profile?.display_name?.trim() || (profile?.handle ? `@${profile.handle}` : "Player");

const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const dayTime = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const formatDay = (value: string | null | undefined) => (value ? day.format(new Date(value)) : "—");
export const formatDayTime = (value: string | null | undefined) => (value ? dayTime.format(new Date(value)) : "—");

/** "3 min ago", "5 h ago", "12 days ago", for last-seen times. */
export const ago = (value: string | null | undefined) => {
  if (!value) return "Never";
  const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Yesterday" : `${days} days ago`;
};

export const TIER_LABEL: Record<string, string> = { free: "Free", half_century: "Half Century", century: "Century" };
