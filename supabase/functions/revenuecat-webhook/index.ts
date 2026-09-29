// @ts-nocheck
// RevenueCat webhook: keeps the stored subscription tier in step with the store (API v2).
//
// Renewals, cancellations, billing failures and refunds all arrive here, so a lapsed
// subscription drops back to free without the app being opened. The event body is only used
// for the app user id; entitlements are then read back from RevenueCat, so a forged request
// cannot grant a tier.
//
// Deploy with JWT verification OFF; the shared secret below authenticates the caller.
//
// Note: the v2 API identifies things by internal object ids ("entl...", "prod..."), not by the
// identifiers shown in the dashboard, so the project catalog is fetched to translate them.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const RC_PROJECT_ID = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "2c1d0f01";
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

const parseIds = (raw, fallback) =>
  (raw ?? fallback).split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);

const CENTURY_IDS = parseIds(Deno.env.get("RC_CENTURY_IDS"), "century,century_monthly,monthly_12,entlc40a5bb905");
const HALF_CENTURY_IDS = parseIds(Deno.env.get("RC_HALF_CENTURY_IDS"), "half_century,half_century_monthly,monthly_3_46,entl243f0aff7d");

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time comparison, so the secret cannot be guessed a character at a time. */
const secretMatches = (provided, expected) => {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

const rcGet = async (path) => {
  const response = await fetch(`https://api.revenuecat.com/v2${path}`, {
    headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}`, Accept: "application/json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`revenuecat_${response.status}`);
  return response.json();
};

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

const loadCustomerState = async (customerId) => {
  const id = encodeURIComponent(customerId);
  const [entitlements, subscriptions] = await Promise.all([
    rcGet(`/projects/${RC_PROJECT_ID}/customers/${id}/active_entitlements`),
    rcGet(`/projects/${RC_PROJECT_ID}/customers/${id}/subscriptions`),
  ]);

  if (entitlements === null && subscriptions === null) return null;
  return { entitlements: entitlements?.items ?? [], subscriptions: subscriptions?.items ?? [] };
};

const liveTokens = (state, catalog, now = Date.now()) => {
  const tokens = [];

  for (const entitlement of state?.entitlements ?? []) {
    const expires = toMillis(entitlement?.expires_at);
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

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WEBHOOK_SECRET || !RC_SECRET_API_KEY) return json({ error: "not_configured" }, 503);

  const provided = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secretMatches(provided, WEBHOOK_SECRET)) return json({ error: "unauthorized" }, 401);

  let event;
  try {
    event = (await request.json())?.event ?? {};
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  // Sign-in uses the Supabase user id as the RevenueCat app user id, so this is a uuid.
  const appUserId = event?.app_user_id ?? event?.original_app_user_id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(appUserId)) return json({ ok: true, skipped: "no_account_for_user" });

  try {
    const [state, catalog] = await Promise.all([loadCustomerState(appUserId), loadCatalog()]);
    const tokens = liveTokens(state, catalog);
    const tier = tierFromTokens(tokens);
    const anchor = anchorFromCustomerState(state);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: existing, error: readError } = await admin.auth.admin.getUserById(appUserId);
    if (readError || !existing?.user) return json({ ok: true, skipped: "unknown_user" });

    const appMetadata = { ...(existing.user.app_metadata ?? {}) };
    appMetadata.subscription_tier = tier;
    if (tier === "free") {
      delete appMetadata.subscription_anchor_date;
    } else if (anchor && !appMetadata.subscription_anchor_date) {
      appMetadata.subscription_anchor_date = anchor;
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(appUserId, { app_metadata: appMetadata });
    if (updateError) return json({ error: "update_failed" }, 500);

    // Synced, public-readable copy for the subscriber badge (see 20261019_0001) - best-effort,
    // same reasoning as sync-subscription.
    const { error: profileError } = await admin.from("profiles").update({ subscription_tier: tier }).eq("id", appUserId);
    if (profileError) console.warn("subscription badge sync failed", { message: profileError.message });

    console.log("revenuecat-webhook applied", { type: event?.type, tokens, tier });
    return json({ ok: true, tier });
  } catch (error) {
    console.error("revenuecat-webhook failed", { message: error?.message });
    return json({ error: "webhook_failed" }, 500);
  }
});
