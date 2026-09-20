// @ts-nocheck
// RevenueCat webhook: keeps the stored subscription tier in step with the store (API v2).
//
// Renewals, cancellations, billing failures and refunds all arrive here, so a lapsed
// subscription drops back to free without the app being opened. The event body is only used
// for the app user id; entitlements are then read back from RevenueCat, so a forged request
// cannot grant a tier.
//
// Deploy with JWT verification OFF (RevenueCat cannot send a Supabase JWT); the shared
// secret below is what authenticates the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const RC_PROJECT_ID = Deno.env.get("REVENUECAT_PROJECT_ID") ?? "2c1d0f01";
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

const parseIds = (raw: string | undefined, fallback: string) =>
  (raw ?? fallback)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

const CENTURY_IDS = parseIds(Deno.env.get("RC_CENTURY_IDS"), "century,century_monthly,monthly,snookerlab pro");
const HALF_CENTURY_IDS = parseIds(Deno.env.get("RC_HALF_CENTURY_IDS"), "half_century,half_century_monthly");

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time comparison, so the secret cannot be guessed a character at a time. */
const secretMatches = (provided: string, expected: string) => {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

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

const isLive = (subscription: any, now: number) => {
  if (subscription?.gives_access === true) return true;
  const ends = subscription?.current_period_ends_at;
  return typeof ends === "number" ? ends > now : false;
};

const tierFromCustomerState = (state: any, now = Date.now()) => {
  if (!state) return "free";

  const tokens: string[] = [];
  for (const entitlement of state.entitlements) {
    const expires = entitlement?.expires_at;
    const live = expires === null || expires === undefined || (typeof expires === "number" && expires > now);
    if (live && entitlement?.entitlement_id) tokens.push(String(entitlement.entitlement_id));
  }
  for (const subscription of state.subscriptions) {
    if (isLive(subscription, now) && subscription?.product_id) tokens.push(String(subscription.product_id));
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

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!WEBHOOK_SECRET || !RC_SECRET_API_KEY) return json({ error: "not_configured" }, 503);

  const provided = (request.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!secretMatches(provided, WEBHOOK_SECRET)) return json({ error: "unauthorized" }, 401);

  let event: any;
  try {
    event = (await request.json())?.event ?? {};
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  // Sign-in uses the Supabase user id as the RevenueCat app user id, so this is a uuid.
  // Anything else (an anonymous RevenueCat id) has no account to update.
  const appUserId: string = event?.app_user_id ?? event?.original_app_user_id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(appUserId)) return json({ ok: true, skipped: "no_account_for_user" });

  try {
    const state = await loadCustomerState(appUserId);
    const tier = tierFromCustomerState(state);
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

    console.log("revenuecat-webhook applied", { type: event?.type, tier });
    return json({ ok: true, tier });
  } catch (error) {
    console.error("revenuecat-webhook failed", { message: (error as any)?.message });
    return json({ error: "webhook_failed" }, 500);
  }
});
