// @ts-nocheck
// RevenueCat webhook: keeps the stored subscription tier in step with the store.
//
// Renewals, cancellations, billing failures and refunds all arrive here, so a lapsed
// subscription drops back to free without the app having to be opened. The event body is
// only used for the app user id; entitlements are then read back from RevenueCat's API,
// so a forged request cannot grant a tier.
//
// Deploy with --no-verify-jwt (RevenueCat does not send a Supabase JWT); the shared secret
// below is what authenticates the caller.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RC_SECRET_API_KEY = Deno.env.get("REVENUECAT_SECRET_API_KEY") ?? "";
const WEBHOOK_SECRET = Deno.env.get("REVENUECAT_WEBHOOK_SECRET") ?? "";

const CENTURY_TOKENS = (Deno.env.get("RC_CENTURY_IDS") ?? "century,century_monthly,monthly,snookerlab pro")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);
const HALF_CENTURY_TOKENS = (Deno.env.get("RC_HALF_CENTURY_IDS") ?? "half_century,half_century_monthly")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean);

type Tier = "free" | "half_century" | "century";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

/** Constant-time comparison, so a wrong secret cannot be guessed a character at a time. */
const secretMatches = (provided: string, expected: string) => {
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i += 1) diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
};

const tierFromSubscriber = (subscriber: any, now = Date.now()): Tier => {
  const active: string[] = [];

  for (const [id, entitlement] of Object.entries<any>(subscriber?.entitlements ?? {})) {
    const expires = entitlement?.expires_date ? Date.parse(entitlement.expires_date) : Number.POSITIVE_INFINITY;
    if (expires > now) active.push(id, entitlement?.product_identifier ?? "");
  }

  for (const [productId, subscription] of Object.entries<any>(subscriber?.subscriptions ?? {})) {
    const expires = subscription?.expires_date ? Date.parse(subscription.expires_date) : Number.POSITIVE_INFINITY;
    if (expires > now) active.push(productId);
  }

  const tokens = active.filter(Boolean).map((value) => value.toLowerCase());
  if (tokens.some((token) => CENTURY_TOKENS.includes(token))) return "century";
  if (tokens.some((token) => HALF_CENTURY_TOKENS.includes(token))) return "half_century";
  return "free";
};

const anchorFromSubscriber = (subscriber: any, now = Date.now()): string | null => {
  const dates = Object.values<any>(subscriber?.subscriptions ?? {})
    .filter((subscription) => {
      const expires = subscription?.expires_date ? Date.parse(subscription.expires_date) : Number.POSITIVE_INFINITY;
      return expires > now;
    })
    .map((subscription) => subscription?.original_purchase_date ?? subscription?.purchase_date)
    .filter((value): value is string => typeof value === "string");

  return dates.length ? dates.sort()[0] : null;
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

  // RevenueCat sends the app user id it knows; we log in with the Supabase user id, so this
  // is a uuid. Anything else (an anonymous RevenueCat id) has no account to update.
  const appUserId: string = event?.app_user_id ?? event?.original_app_user_id ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(appUserId)) return json({ ok: true, skipped: "no_account_for_user" });

  try {
    const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(appUserId)}`, {
      headers: { Authorization: `Bearer ${RC_SECRET_API_KEY}`, Accept: "application/json" },
    });
    if (!response.ok) return json({ error: "revenuecat_lookup_failed" }, 502);

    const subscriber = (await response.json())?.subscriber ?? {};
    const tier = tierFromSubscriber(subscriber);
    const anchor = anchorFromSubscriber(subscriber);

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
    console.error("revenuecat-webhook failed", error);
    return json({ error: "webhook_failed" }, 500);
  }
});
