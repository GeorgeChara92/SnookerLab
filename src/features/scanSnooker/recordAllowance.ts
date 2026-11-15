import { supabase } from "../../api/supabase";
import { isSubscriptionLimitError } from "../../constants";

/**
 * Record a Snooker's monthly allowance (3 saved positions on Free; no limit on a paid plan).
 * Each saved position is a row in record_snooker_uses, and the database refuses the row past the
 * limit - so the count is the same on every phone, and reinstalling doesn't reset it. Putting the
 * balls back from a saved position never counts. See 20261115_0001_plan_features.sql.
 *
 * If the server can't be reached, saving goes ahead: a scan made at the table shouldn't be lost
 * to a bad signal.
 */

/** How many positions have been saved since `since`, or null if that can't be found out. */
export const recordSnookerUsesSince = async (since: Date): Promise<number | null> => {
  const { count, error } = await supabase
    .from("record_snooker_uses")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since.toISOString());
  return error ? null : (count ?? 0);
};

/** Counts one saved position. "limit" means the plan's allowance for the month is used up. */
export const claimRecordSnooker = async (): Promise<"ok" | "limit"> => {
  const { error } = await supabase.from("record_snooker_uses").insert({});
  if (error && isSubscriptionLimitError(error)) return "limit";
  return "ok";
};
