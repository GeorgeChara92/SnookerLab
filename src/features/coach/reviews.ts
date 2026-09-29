import { supabase } from "../../api/supabase";
import { COACH_REVIEW_COLUMNS, coachReviewFromRow, type CoachReview } from "./types";

/**
 * Coach reviews: a player rates and reviews a coach they have actually had a finished session
 * with. Plain functions rather than a store - only the coach profile screen needs this, not
 * something kept hydrated for the whole app the way bookings are.
 */

type Result = { ok: true } | { ok: false; message: string };

const explain = (error: { code?: string; message?: string } | null): string => {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "42501" || error.message?.includes("row-level security")) {
    return "You can only review a coach once you have had a finished session with them.";
  }
  return "Check your connection and try again.";
};

/** Every review on a coach, newest first. */
export const fetchCoachReviews = async (coachId: string): Promise<CoachReview[]> => {
  const { data, error } = await supabase
    .from("coach_reviews")
    .select(COACH_REVIEW_COLUMNS)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(coachReviewFromRow);
};

/** This player's own review of this coach, if they have left one. */
export const fetchMyCoachReview = async (coachId: string, playerId: string): Promise<CoachReview | null> => {
  const { data, error } = await supabase
    .from("coach_reviews")
    .select(COACH_REVIEW_COLUMNS)
    .eq("coach_id", coachId)
    .eq("player_id", playerId)
    .maybeSingle();
  if (error || !data) return null;
  return coachReviewFromRow(data);
};

/** Whether this player has ever had a finished session with this coach - the same condition the
 * database enforces before it will accept a review, checked up front so the UI can offer or hide
 * "Leave a review" without a failed write. */
export const hasFinishedSessionWith = async (coachId: string, playerId: string): Promise<boolean> => {
  const { count } = await supabase
    .from("coach_bookings")
    .select("id", { count: "exact", head: true })
    .eq("coach_id", coachId)
    .eq("player_id", playerId)
    .eq("status", "accepted")
    .lt("ends_at", new Date().toISOString());
  return Boolean(count && count > 0);
};

/** Creates or updates this player's review of a coach - one row per pair, so leaving a new review
 * after another session just updates the existing one. */
export const upsertCoachReview = async (coachId: string, playerId: string, rating: number, body: string): Promise<Result> => {
  const { error } = await supabase
    .from("coach_reviews")
    .upsert({ coach_id: coachId, player_id: playerId, rating, body: body.trim() || null }, { onConflict: "coach_id,player_id" });
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};

export const deleteCoachReview = async (reviewId: string): Promise<Result> => {
  const { error } = await supabase.from("coach_reviews").delete().eq("id", reviewId);
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};
