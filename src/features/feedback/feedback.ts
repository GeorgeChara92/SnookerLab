import { supabase } from "../../api/supabase";

/** General feedback about the app itself, separate from a coach review - read only by an admin,
 * see 20261018_0001_coach_reviews_and_feedback.sql. */

type Result = { ok: true } | { ok: false; message: string };

export const submitAppFeedback = async (userId: string, message: string): Promise<Result> => {
  const trimmed = message.trim();
  if (!trimmed) return { ok: false, message: "Write something first." };
  const { error } = await supabase.from("app_feedback").insert({ user_id: userId, message: trimmed });
  if (error) return { ok: false, message: "Check your connection and try again." };
  return { ok: true };
};
