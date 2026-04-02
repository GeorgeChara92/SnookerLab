import type { SubscriptionTier } from "../types";

export type TierLimits = {
  matchesPerPeriod: number | null;
  tournamentsPerPeriod: number | null;
  aiAnalysesPerPeriod: number | null;
};

export const SUBSCRIPTION_LIMIT_ERROR_PREFIX = "subscription_limit_exceeded";

export const isSubscriptionLimitError = (error: unknown) => {
  const message =
    typeof error === "string"
      ? error
      : error && typeof error === "object" && "message" in error && typeof (error as any).message === "string"
      ? (error as any).message
      : "";

  return message.includes(SUBSCRIPTION_LIMIT_ERROR_PREFIX);
};

export const TIER_LABELS: Record<SubscriptionTier, string> = {
  free: "Free",
  half_century: "Half-Century",
  century: "Century",
};

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, TierLimits> = {
  free: {
    matchesPerPeriod: 12,
    tournamentsPerPeriod: 1,
    aiAnalysesPerPeriod: 1,
  },
  half_century: {
    matchesPerPeriod: 40,
    tournamentsPerPeriod: 4,
    aiAnalysesPerPeriod: 8,
  },
  century: {
    matchesPerPeriod: null,
    tournamentsPerPeriod: null,
    aiAnalysesPerPeriod: 20,
  },
};
