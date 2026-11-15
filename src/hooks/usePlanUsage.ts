import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "../store";
import { recordSnookerUsesSince } from "../features/scanSnooker/recordAllowance";
import { useSubscriptionAccess } from "./useSubscriptionAccess";

export type PlanUsageRow = {
  label: string;
  used: number;
  /** null: no limit on this plan. */
  limit: number | null;
  /** "month" resets each period; "total" is how many you have at once. */
  per: "month" | "total";
  /** Why there's no limit when it isn't the plan itself, e.g. the Coach plan. */
  note?: string;
};

/**
 * Everything a plan limits, with how much of it is used: the monthly allowances (matches,
 * tournaments, coach reviews, recorded snookers) and the ones you hold at once (routines you've
 * built, saved practice sessions). Shared by Profile and the Plans screen so they always agree.
 *
 * Recorded snookers are counted on the server (they're limited there too), so that row fills in a
 * moment after the rest; until then it reads 0.
 */
export const usePlanUsage = () => {
  const subscription = useSubscriptionAccess();
  const coach = useAuthStore((state) => state.user?.coach_subscription_active === true);
  const [recorded, setRecorded] = useState(0);
  const periodStartMs = subscription.periodStart.getTime();

  useEffect(() => {
    let live = true;
    void recordSnookerUsesSince(new Date(periodStartMs)).then((count) => {
      if (live && count !== null) setRecorded(count);
    });
    return () => {
      live = false;
    };
  }, [periodStartMs]);

  const rows = useMemo<PlanUsageRow[]>(() => {
    const { usage, limits } = subscription;
    return [
      { label: "Matches", used: usage.matches, limit: limits.matchesPerPeriod, per: "month" },
      { label: "Tournaments", used: usage.tournaments, limit: limits.tournamentsPerPeriod, per: "month" },
      { label: "AI Coach reviews", used: usage.aiAnalyses, limit: limits.aiAnalysesPerPeriod, per: "month" },
      { label: "Recorded snookers", used: recorded, limit: limits.recordSnookerPerPeriod, per: "month" },
      {
        label: "Your routines",
        used: usage.customRoutines,
        limit: coach ? null : limits.customRoutines,
        per: "total",
        note: coach && limits.customRoutines !== null ? "Coach plan" : undefined,
      },
      {
        label: "Saved sessions",
        used: usage.savedSessions,
        limit: coach ? null : limits.savedSessions,
        per: "total",
        note: coach && limits.savedSessions !== null ? "Coach plan" : undefined,
      },
    ];
  }, [coach, recorded, subscription]);

  return { subscription, rows };
};

/** "2 of 3 this month", "1 of 1", or "Unlimited". */
export const usageText = (row: PlanUsageRow) => {
  if (row.limit === null) return row.note ? `Unlimited · ${row.note}` : "Unlimited";
  return row.per === "month" ? `${row.used} of ${row.limit} this month` : `${row.used} of ${row.limit}`;
};
