import { supabase } from "../../api/supabase";
import { isLiveNow, liveFromRow, type LiveRow, type LiveScore } from "./liveScore";

export * from "./liveScore";

/**
 * Matches followed live. The scorer's phone posts the frame in progress - points, the break,
 * who is at the table, what is left - and the frames finished so far; friends, group-mates and
 * the opponent read it. Who can see what is decided by the database.
 */

export const postLive = async (row: LiveRow) => {
  const { error } = await supabase.from("live_scores").upsert(row, { onConflict: "match_id" });
  return !error;
};

export const stopLive = async (matchId: string) => {
  await supabase.from("live_scores").delete().eq("match_id", matchId);
};

/** Matches the player can follow: live now, or finished in the last hour. Not their own. */
export const loadLiveScores = async (me: string | null): Promise<LiveScore[]> => {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data, error } = await supabase
    .from("live_scores")
    .select("*")
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(30);
  if (error) return [];
  return (data ?? [])
    .map(liveFromRow)
    .filter((score) => score.userId !== me && (isLiveNow(score) || score.status === "finished"));
};

export const loadLiveScore = async (matchId: string): Promise<LiveScore | null> => {
  const { data } = await supabase.from("live_scores").select("*").eq("match_id", matchId).maybeSingle();
  return data ? liveFromRow(data) : null;
};
