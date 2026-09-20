// @ts-nocheck
// Refreshes the caller's subscription tier from RevenueCat (API v2).
//
// The app used to write the tier itself with supabase.auth.updateUser({ data: ... }), which any
// user could forge. The tier now lives in app_metadata, which only the service role can write,
// and the entitlement is verified against RevenueCat here rather than trusted from the phone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const RC_PROJECT_ID = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "2c1d0f01";

const parseIds = (raw: string | undefined, fallback: string) =>
  (raw ?? fallback)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const CENTURY_IDS = parseIds(Deno.env.get("RC_CENTURY_IDS"), "century,century_monthly,monthly_12");
const HALF_CENTURY_IDS = parseIds(Deno.env.get("RC_HALF_CENTURY_IDS"), "half_century,half_century_monthly,monthly_3_46");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** Reads live entitlements and subscriptions. null means RevenueCat has no such customer. */
const loadCustomerState = async (customerId: string) => {
  const get = async (path: string) => {
    const response = await fetch(`https://api.revenuecat.com/v2${path}`, {
      headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}`, Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`revenuecat_${response.status}`);
    return response.json();
  };

  const id = encodeURIComponent(customerId);
  const [entitlements, subscriptions] = await Promise.all([
    get(`/projects/${RC_PROJECT_ID}/customers/${id}/active_entitlements`),
    get(`/projects/${RC_PROJECT_ID}/customers/${id}/subscriptions`),
  ]);

  if (entitlements === null && subscriptions === null) return null;
  return { entitlements: entitlements?.items ?? [], subscriptions: subscriptions?.items ?? [] };
};

/** RevenueCat sends timestamps as epoch milliseconds, but accept ISO strings too. */
const toMillis = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const LIVE_STATUSES = ["active", "trialing", "in_trial", "in_grace_period", "grace_period", "paused"];

const isLive = (subscription: any, now: number) => {
  if (subscription?.gives_access === true) return true;
  if (typeof subscription?.status === "string" && LIVE_STATUSES.includes(subscription.status.toLowerCase())) return true;
  const ends = toMillis(subscription?.current_period_ends_at ?? subscription?.expires_at);
  return ends === null ? false : ends > now;
};

const tierFromCustomerState = (state: any, now = Date.now()) => {
  if (!state) return "free";

  const tokens: string[] = [];
  for (const entitlement of state.entitlements) {
    const expires = toMillis(entitlement?.expires_at);
    // A null expiry means lifetime access, not expired.
    const live = entitlement?.expires_at === null || entitlement?.expires_at === undefined || (expires !== null && expires > now);
    if (live && entitlement?.entitlement_id) tokens.push(String(entitlement.entitlement_id));
  }
  for (const subscription of state.subscriptions) {
    if (!isLive(subscription, now)) continue;
    if (subscription?.product_id) tokens.push(String(subscription.product_id));
    // Subscriptions can carry their entitlements inline depending on the expand used.
    const inline = subscription?.entitlements?.items ?? subscription?.entitlements ?? [];
    if (Array.isArray(inline)) {
      for (const item of inline) {
        const id = typeof item === "string" ? item : item?.entitlement_id ?? item?.id;
        if (id) tokens.push(String(id));
      }
    }
  }

  const lower = tokens.map((token) => token.toLowerCase());
  if (lower.some((token) => CENTURY_IDS.includes(token))) return "century";
  if (lower.some((token) => HALF_CENTURY_IDS.includes(token))) return "half_century";
  return "free";
};

const anchorFromCustomerState = (state: any, now = Date.now()) => {
  if (!state) return null;
  const starts = state.subscriptions
    .filter((subscription: any) => isLive(subscription, now))
    .map((subscription: any) => subscription?.starts_at ?? subscription?.current_period_starts_at)
    .filter((value: unknown) => typeof value === "number");

  return starts.length ? new Date(Math.min(...starts)).toISOString() : null;
};

export const applyTier = async (admin: any, userId: string, state: any) => {
  const tier = tierFromCustomerState(state);
  const anchor = anchorFromCustomerState(state);

  const { data: existing, error: readError } = await admin.auth.admin.getUserById(userId);
  if (readError) throw readError;

  const appMetadata = { ...(existing?.user?.app_metadata ?? {}) };
  appMetadata.subscription_tier = tier;
  // Keep the first anchor seen for a continuing subscription so the quota window is stable.
  if (tier === "free") {
    delete appMetadata.subscription_anchor_date;
  } else if (anchor && !appMetadata.subscription_anchor_date) {
    appMetadata.subscription_anchor_date = anchor;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { app_metadata: appMetadata });
  if (updateError) throw updateError;

  return tier;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!RC_SECRET_API_KEY) return json({ error: "billing_not_configured" }, 503);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  // Identify the caller from their own JWT: never take a user id from the request body.
  const { data: caller, error: callerError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerError || !caller?.user) return json({ error: "unauthorized" }, 401);

  try {
    const state = await loadCustomerState(caller.user.id);
    console.log("sync-subscription state", {
      found: state !== null,
      entitlements: (state?.entitlements ?? []).map((item: any) => ({
        id: item?.entitlement_id,
        expires_at: item?.expires_at,
      })),
      subscriptions: (state?.subscriptions ?? []).map((item: any) => ({
        product_id: item?.product_id,
        status: item?.status,
        gives_access: item?.gives_access,
        ends: item?.current_period_ends_at,
        store: item?.store,
      })),
    });

    const tier = await applyTier(admin, caller.user.id, state);
    console.log("sync-subscription result", { tier });
    return json({ tier });
  } catch (error) {
    console.error("sync-subscription failed", { message: (error as any)?.message });
    return json({ error: "sync_failed" }, 502);
  }
});
