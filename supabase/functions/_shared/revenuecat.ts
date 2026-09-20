// @ts-nocheck
// Reference copy of the RevenueCat v2 helpers used by sync-subscription and
// revenuecat-webhook. Both functions inline this logic so each one can be deployed
// from the dashboard as a single file; keep the three copies in step.

export const RC_API_BASE = "https://api.revenuecat.com/v2";

export type Tier = "free" | "half_century" | "century";

export const parseIds = (raw: string | undefined, fallback: string) =>
  (raw ?? fallback)
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

/**
 * Reads a customer's active entitlements and subscriptions.
 * Returns null when RevenueCat has never seen this customer (404), which means free.
 */
export const loadCustomerState = async (apiKey: string, projectId: string, customerId: string) => {
  const get = async (path: string) => {
    const response = await fetch(`${RC_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`revenuecat_${response.status}`);
    return response.json();
  };

  const id = encodeURIComponent(customerId);
  const [entitlements, subscriptions] = await Promise.all([
    get(`/projects/${projectId}/customers/${id}/active_entitlements`),
    get(`/projects/${projectId}/customers/${id}/subscriptions`),
  ]);

  if (entitlements === null && subscriptions === null) return null;

  return {
    entitlements: entitlements?.items ?? [],
    subscriptions: subscriptions?.items ?? [],
  };
};

const isLive = (subscription: any, now: number) => {
  if (subscription?.gives_access === true) return true;
  const ends = subscription?.current_period_ends_at;
  return typeof ends === "number" ? ends > now : false;
};

/** Highest tier implied by the customer's live entitlements and subscriptions. */
export const tierFromCustomerState = (
  state: { entitlements: any[]; subscriptions: any[] } | null,
  centuryIds: string[],
  halfCenturyIds: string[],
  now = Date.now()
): Tier => {
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
  if (lower.some((token) => centuryIds.includes(token))) return "century";
  if (lower.some((token) => halfCenturyIds.includes(token))) return "half_century";
  return "free";
};

/** Start of the earliest live subscription: the day of the month the quota resets on. */
export const anchorFromCustomerState = (
  state: { subscriptions: any[] } | null,
  now = Date.now()
): string | null => {
  if (!state) return null;

  const starts = state.subscriptions
    .filter((subscription: any) => isLive(subscription, now))
    .map((subscription: any) => subscription?.starts_at ?? subscription?.current_period_starts_at)
    .filter((value: unknown): value is number => typeof value === "number");

  if (starts.length === 0) return null;
  return new Date(Math.min(...starts)).toISOString();
};
