import type { SubscriptionTier } from "../types";

export type TierLimits = {
  matchesPerPeriod: number | null;
  tournamentsPerPeriod: number | null;
  aiAnalysesPerPeriod: number | null;
  /** Routines a player builds themselves, in all (not a month). Saved community routines don't count. */
  customRoutines: number | null;
  /** Practice sessions a player saves, in all. */
  savedSessions: number | null;
  /** Record a Snooker positions saved a month. Putting the balls back again is always free. */
  recordSnookerPerPeriod: number | null;
  /** How far back the Stats page looks, in days; null for all of it. */
  statsHistoryDays: number | null;
};

/** The result card backgrounds each plan can pick (cardThemes ids). The gold Century card still
 *  opens by itself, on any plan, when a match had a century or a maximum in it. */
export const SHARE_THEMES: Record<SubscriptionTier, string[] | null> = {
  free: ["baize", "table"],
  half_century: ["baize", "table", "scoreboard", "spotlight"],
  century: null,
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
    customRoutines: 3,
    savedSessions: 1,
    recordSnookerPerPeriod: 3,
    statsHistoryDays: 30,
  },
  half_century: {
    matchesPerPeriod: 40,
    tournamentsPerPeriod: 4,
    aiAnalysesPerPeriod: 8,
    customRoutines: null,
    savedSessions: null,
    recordSnookerPerPeriod: null,
    statsHistoryDays: null,
  },
  century: {
    matchesPerPeriod: null,
    tournamentsPerPeriod: null,
    aiAnalysesPerPeriod: 20,
    customRoutines: null,
    savedSessions: null,
    recordSnookerPerPeriod: null,
    statsHistoryDays: null,
  },
};

/** Something a plan gives more of, for the upgrade prompt: what each plan gets, in words. */
export type PlanFeature =
  | "matches"
  | "tournaments"
  | "aiAnalyses"
  | "customRoutines"
  | "savedSessions"
  | "recordSnooker"
  | "statsHistory"
  | "shareThemes";

const count = (value: number | null, one: string, many: string, suffix = "") =>
  value === null ? `Unlimited ${many}` : `${value} ${value === 1 ? one : many}${suffix}`;

/** One line per plan for a feature, built from the limits above so the two can't disagree. */
export const planLine = (feature: PlanFeature, tier: SubscriptionTier): string => {
  const limits = SUBSCRIPTION_LIMITS[tier];
  switch (feature) {
    case "matches":
      return count(limits.matchesPerPeriod, "match", "matches", " a month");
    case "tournaments":
      return count(limits.tournamentsPerPeriod, "tournament", "tournaments", " a month");
    case "aiAnalyses":
      return count(limits.aiAnalysesPerPeriod, "AI Coach review", "AI Coach reviews", " a month");
    case "customRoutines":
      return limits.customRoutines === null ? "Build as many routines as you like" : `Build up to ${limits.customRoutines} routines`;
    case "savedSessions":
      return limits.savedSessions === null
        ? "Save as many practice sessions as you like"
        : `Save ${limits.savedSessions} practice ${limits.savedSessions === 1 ? "session" : "sessions"}`;
    case "recordSnooker":
      return count(limits.recordSnookerPerPeriod, "recorded snooker", "recorded snookers", " a month");
    case "statsHistory":
      return limits.statsHistoryDays === null ? "Your full stats history" : `Stats from the last ${limits.statsHistoryDays} days`;
    case "shareThemes": {
      const themes = SHARE_THEMES[tier];
      return themes === null ? "Every result card background, gold Century card included" : `${themes.length} result card backgrounds`;
    }
  }
};
