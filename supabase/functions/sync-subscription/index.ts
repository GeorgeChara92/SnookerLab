// @ts-nocheck
// Refreshes the caller's subscription tier from RevenueCat.
//
// The app used to write the tier itself with supabase.auth.updateUser({ data: ... }), which any
// user could forge. The tier now lives in app_metadata, which only the service role can write,
// and the entitlement is verified against RevenueCat's API here rather than trusted from the phone.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";

const CENTURY_TOKENS = (Deno.env.get("RC_CENTURY_IDS") ?? "century,century_monthly,monthly,snookerlab pro")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const HALF_CENTURY_TOKENS = (Deno.env.get("RC_HALF_CENTURY_IDS") ?? "half_century,half_century_monthly")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export type Tier = "free" | "half_century" | "century";

/** Highest tier among RevenueCat's currently-active entitlements and subscriptions. */
export const tierFromSubscriber = (subscriber: any, now = Date.now()): Tier => {
  const active: string[] = [];

  const entitlements = subscriber?.entitlements ?? {};
  for (const [id, entitlement] of Object.entries<any>(entitlements)) {
    const expires = entitlement?.expires_date ? Date.parse(entitlement.expires_date) : Number.POSITIVE_INFINITY;
    if (expires > now) active.push(id, entitlement?.product_identifier ?? "");
  }

  const subscriptions = subscriber?.subscriptions ?? {};
  for (const [productId, subscription] of Object.entries<any>(subscriptions)) {
    const expires = subscription?.expires_date ? Date.parse(subscription.expires_date) : Number.POSITIVE_INFINITY;
    if (expires > now) active.push(productId);
  }

  const tokens = active.filter(Boolean).map((value) => value.toLowerCase());
  if (tokens.some((token) => CENTURY_TOKENS.includes(token))) return "century";
  if (tokens.some((token) => HALF_CENTURY_TOKENS.includes(token))) return "half_century";
  return "free";
};

/** Earliest purchase date of an active subscription: the day of the month the quota resets on. */
const anchorFromSubscriber = (subscriber: any, now = Date.now()): string | null => {
  const dates = Object.values<any>(subscriber?.subscriptions ?? {})
    .filter((subscription) => {
      const expires = subscription?.expires_date ? Date.parse(subscription.expires_date) : Number.POSITIVE_INFINITY;
      return expires > now;
    })
    .map((subscription) => subscription?.original_purchase_date ?? subscription?.purchase_date)
    .filter((value): value is string => typeof value === "string");

  if (dates.length === 0) return null;
  return dates.sort()[0];
};

export const applyTier = async (admin: any, userId: string, subscriber: any) => {
  const tier = tierFromSubscriber(subscriber);
  const anchor = anchorFromSubscriber(subscriber);

  const { data: existing, error: readError } = await admin.auth.admin.getUserById(userId);
  if (readError) throw readError;

  const appMetadata = { ...(existing?.user?.app_metadata ?? {}) };
  appMetadata.subscription_tier = tier;
  // Keep the first anchor we saw for a continuing subscription so the monthly quota window is stable.
  if (tier === "free") {
    delete appMetadata.subscription_anchor_date;
  } else if (anchor && !appMetadata.subscription_anchor_date) {
    appMetadata.subscription_anchor_date = anchor;
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { app_metadata: appMetadata });
  if (updateError) throw updateError;

  return tier;
};

export const fetchSubscriber = async (appUserId: string) => {
  const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
    headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}`, Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(`revenuecat_lookup_failed_${response.status}`);
  }

  const body = await response.json();
  return body?.subscriber ?? {};
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
    const subscriber = await fetchSubscriber(caller.user.id);
    const tier = await applyTier(admin, caller.user.id, subscriber);
    return json({ tier });
  } catch (error) {
    console.error("sync-subscription failed", error);
    return json({ error: "sync_failed" }, 502);
  }
});
