// @ts-nocheck
// Refreshes the caller's subscription tier from RevenueCat (API v2).
//
// The app used to write the tier itself with supabase.auth.updateUser({ data: ... }), which any
// user could forge. The tier now lives in app_metadata, which only the service role can write,
// and the entitlement is verified against RevenueCat here rather than trusted from the phone.
//
// Note: the v2 API identifies things by internal object ids ("entl...", "prod..."), not by the
// identifiers shown in the dashboard. The project's entitlements and products are fetched so
// those ids can be translated into lookup keys ("century") and store identifiers ("monthly_12").

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const RC_PROJECT_ID = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "2c1d0f01";

const parseIds = (raw, fallback) =>
  (raw ?? fallback).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

const CENTURY_IDS = parseIds(Deno.env.get("RC_CENTURY_IDS"), "century,century_monthly,monthly_12,entlc40a5bb905");
const HALF_CENTURY_IDS = parseIds(Deno.env.get("RC_HALF_CENTURY_IDS"), "half_century,half_century_monthly,monthly_3_46,entl243f0aff7d");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const rcGet = async (path) => {
  const response = await fetch(`https://api.revenuecat.com/v2${path}`, {
    headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}`, Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`revenuecat_${response.status}`);
  return response.json();
};

// The catalog changes rarely, so cache it for the life of the instance.
let catalogCache = null;

const loadCatalog = async () => {
  if (catalogCache) return catalogCache;

  // Optional: needs a key with project configuration read access. Without it the internal
  // ids configured above still identify the tier, so a failure here is not fatal.
  let entitlements = null;
  let products = null;
  try {
    [entitlements, products] = await Promise.all([
      rcGet(`/projects/${RC_PROJECT_ID}/entitlements`),
      rcGet(`/projects/${RC_PROJECT_ID}/products`),
    ]);
  } catch (error) {
    console.warn("catalog lookup unavailable", { message: error?.message });
  }

  const entitlementNames = new Map();
  for (const item of entitlements?.items ?? []) {
    if (item?.id) entitlementNames.set(item.id, String(item.lookup_key ?? item.display_name ?? item.id));
  }

  const productNames = new Map();
  for (const item of products?.items ?? []) {
    if (item?.id) productNames.set(item.id, String(item.store_identifier ?? item.display_name ?? item.id));
  }

  catalogCache = { entitlementNames, productNames };
  return catalogCache;
};

const toMillis = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return null;
};

const LIVE_STATUSES = ["active", "trialing", "in_trial", "in_grace_period", "grace_period", "paused"];

const isLive = (subscription, now) => {
  if (subscription?.gives_access === true) return true;
  if (typeof subscription?.status === "string" && LIVE_STATUSES.includes(subscription.status.toLowerCase())) return true;
  const ends = toMillis(subscription?.current_period_ends_at ?? subscription?.expires_at);
  return ends === null ? false : ends > now;
};

/** Reads live entitlements and subscriptions. null means RevenueCat has no such customer. */
const loadCustomerState = async (customerId) => {
  const id = encodeURIComponent(customerId);
  const [entitlements, subscriptions] = await Promise.all([
    rcGet(`/projects/${RC_PROJECT_ID}/customers/${id}/active_entitlements`),
    rcGet(`/projects/${RC_PROJECT_ID}/customers/${id}/subscriptions`),
  ]);

  if (entitlements === null && subscriptions === null) return null;
  return { entitlements: entitlements?.items ?? [], subscriptions: subscriptions?.items ?? [] };
};

/** Every name that currently grants access: entitlement lookup keys and product identifiers. */
const liveTokens = (state, catalog, now = Date.now()) => {
  const tokens = [];

  for (const entitlement of state?.entitlements ?? []) {
    const expires = toMillis(entitlement?.expires_at);
    // A missing expiry means lifetime access, not expired.
    const live =
      entitlement?.expires_at === null || entitlement?.expires_at === undefined || (expires !== null && expires > now);
    if (!live) continue;

    const rawId = entitlement?.entitlement_id ?? entitlement?.id;
    if (rawId) tokens.push(catalog.entitlementNames.get(rawId) ?? String(rawId));
    if (entitlement?.lookup_key) tokens.push(String(entitlement.lookup_key));
  }

  for (const subscription of state?.subscriptions ?? []) {
    if (!isLive(subscription, now)) continue;
    const rawId = subscription?.product_id;
    if (rawId) tokens.push(catalog.productNames.get(rawId) ?? String(rawId));
    if (subscription?.store_identifier) tokens.push(String(subscription.store_identifier));
  }

  return tokens.map((token) => token.toLowerCase());
};

const tierFromTokens = (tokens) => {
  if (tokens.some((token) => CENTURY_IDS.includes(token))) return "century";
  if (tokens.some((token) => HALF_CENTURY_IDS.includes(token))) return "half_century";
  return "free";
};

const anchorFromCustomerState = (state, now = Date.now()) => {
  const starts = (state?.subscriptions ?? [])
    .filter((subscription) => isLive(subscription, now))
    .map((subscription) => toMillis(subscription?.starts_at ?? subscription?.current_period_starts_at))
    .filter((value) => value !== null);

  return starts.length ? new Date(Math.min(...starts)).toISOString() : null;
};

const applyTier = async (admin, userId, tier, anchor) => {
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
    const [state, catalog] = await Promise.all([loadCustomerState(caller.user.id), loadCatalog()]);
    const tokens = liveTokens(state, catalog);
    const tier = tierFromTokens(tokens);
    const anchor = anchorFromCustomerState(state);

    console.log("sync-subscription", { tokens, tier });
    await applyTier(admin, caller.user.id, tier, anchor);

    return json({ tier });
  } catch (error) {
    console.error("sync-subscription failed", { message: error?.message });
    return json({ error: "sync_failed" }, 502);
  }
});
