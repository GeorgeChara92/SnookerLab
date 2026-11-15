import { useMemo } from "react";
import { SHARE_THEMES, SUBSCRIPTION_LIMITS, TIER_LABELS } from "../constants";
import {
  useAIAnalysesStore,
  useAuthStore,
  useCustomRoutinesStore,
  useMatchesStore,
  useSessionsStore,
  useTournamentsStore,
} from "../store";
import type { SubscriptionTier } from "../types";

const toDate = (value?: string) => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const clampDayToMonth = (year: number, month: number, day: number) => {
  const max = new Date(year, month + 1, 0).getDate();
  return Math.min(Math.max(1, day), max);
};

const periodStartFromAnchor = (anchorDateISO: string | undefined, now = new Date()) => {
  const anchorDate = toDate(anchorDateISO) ?? now;
  const anchorDay = anchorDate.getDate();
  const year = now.getFullYear();
  const month = now.getMonth();

  const currentMonthAnchor = new Date(year, month, clampDayToMonth(year, month, anchorDay), 0, 0, 0, 0);
  if (now >= currentMonthAnchor) {
    return currentMonthAnchor;
  }

  const prevMonth = month === 0 ? 11 : month - 1;
  const prevYear = month === 0 ? year - 1 : year;
  return new Date(prevYear, prevMonth, clampDayToMonth(prevYear, prevMonth, anchorDay), 0, 0, 0, 0);
};

const periodEndFromStart = (start: Date) => {
  const year = start.getFullYear();
  const month = start.getMonth();
  const day = start.getDate();
  const nextMonth = month === 11 ? 0 : month + 1;
  const nextYear = month === 11 ? year + 1 : year;
  const end = new Date(nextYear, nextMonth, clampDayToMonth(nextYear, nextMonth, day), 0, 0, 0, 0);
  return end;
};

const countInPeriod = (dates: string[], start: Date, end: Date) => {
  const startMs = start.getTime();
  const endMs = end.getTime();
  return dates.reduce((acc, value) => {
    const parsed = toDate(value);
    if (!parsed) return acc;
    const ms = parsed.getTime();
    return ms >= startMs && ms < endMs ? acc + 1 : acc;
  }, 0);
};

const resolveTier = (tier?: SubscriptionTier): SubscriptionTier => {
  if (tier === "half_century" || tier === "century") return tier;
  return "free";
};

export const useSubscriptionAccess = () => {
  const user = useAuthStore((state) => state.user);
  const matches = useMatchesStore((state) => state.matches);
  const tournaments = useTournamentsStore((state) => state.tournaments);
  const analyses = useAIAnalysesStore((state) => state.analyses);
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  const templates = useSessionsStore((state) => state.templates);

  return useMemo(() => {
    const tier = resolveTier(user?.subscription_tier);
    const limits = SUBSCRIPTION_LIMITS[tier];
    const coach = user?.coach_subscription_active === true;
    const periodStart = periodStartFromAnchor(user?.subscription_anchor_date ?? user?.created_at);
    const periodEnd = periodEndFromStart(periodStart);

    const usage = {
      matches: countInPeriod(matches.map((item) => item.created_at), periodStart, periodEnd),
      tournaments: countInPeriod(tournaments.map((item) => item.created_at), periodStart, periodEnd),
      aiAnalyses: countInPeriod(analyses.map((item) => item.created_at), periodStart, periodEnd),
      // Routines the player built, not ones saved from the community.
      customRoutines: customRoutines.filter((routine) => !routine.sourceSharedId).length,
      savedSessions: templates.length,
    };

    const remaining = {
      matches: limits.matchesPerPeriod === null ? null : Math.max(0, limits.matchesPerPeriod - usage.matches),
      tournaments: limits.tournamentsPerPeriod === null ? null : Math.max(0, limits.tournamentsPerPeriod - usage.tournaments),
      aiAnalyses: limits.aiAnalysesPerPeriod === null ? null : Math.max(0, limits.aiAnalysesPerPeriod - usage.aiAnalyses),
    };

    return {
      tier,
      tierLabel: TIER_LABELS[tier],
      limits,
      usage,
      remaining,
      periodStart,
      periodEnd,
      canCreateMatch: remaining.matches === null || remaining.matches > 0,
      canCreateTournament: remaining.tournaments === null || remaining.tournaments > 0,
      canUseAI: remaining.aiAnalyses === null || remaining.aiAnalyses > 0,
      // A coach on the Coach plan builds routines and sessions for clients, so has no limit on them.
      canBuildRoutine: coach || limits.customRoutines === null || usage.customRoutines < limits.customRoutines,
      canSaveSession: coach || limits.savedSessions === null || usage.savedSessions < limits.savedSessions,
      /** The oldest date the Stats page shows on this plan, or null for everything. */
      statsSince: limits.statsHistoryDays === null ? null : new Date(Date.now() - limits.statsHistoryDays * 86_400_000),
      /** Whether a result card background can be picked on this plan. */
      canUseShareTheme: (themeId: string) => SHARE_THEMES[tier] === null || SHARE_THEMES[tier]!.includes(themeId),
    };
  }, [analyses, customRoutines, matches, templates, tournaments, user?.created_at, user?.subscription_anchor_date, user?.subscription_tier, user?.coach_subscription_active]);
};
