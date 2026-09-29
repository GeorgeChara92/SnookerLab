import { createClient } from "@supabase/supabase-js";

// Same Supabase project as the app. The anon key is meant to be public - it is the URL and RLS
// policies, not this key, that decide what a signed-in session can see or do. Used only by the
// admin coach-applications page; nothing else on the site talks to Supabase.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// createClient throws immediately on an empty URL, which would otherwise crash the whole SSR
// prerender step (every page, not just this one) whenever the env vars are not set - locally, or
// before they are added on Vercel. A harmless placeholder keeps construction safe; every real use
// is already gated on supabaseConfigured.
export const supabase = createClient(supabaseUrl || "https://placeholder.supabase.co", supabaseAnonKey || "placeholder", {
  auth: { persistSession: true, autoRefreshToken: true },
});
