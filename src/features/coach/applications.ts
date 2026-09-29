import { supabase } from "../../api/supabase";
import { COACH_APPLICATION_COLUMNS, coachApplicationFromRow, type CoachApplication } from "./types";

/**
 * Applying to become a coach - reviewed by hand before is_coach is ever granted, see
 * 20261016_0001_coach_applications.sql. Plain functions rather than a store: this only matters to
 * a signed-in player who is not yet a coach, checked once when a screen needs it rather than kept
 * hydrated for everyone the way bookings and slots are in coachStore.
 */

type Result = { ok: true } | { ok: false; message: string };

export type CoachApplicationInput = {
  email: string;
  fullName: string;
  bio?: string;
  location?: string;
  lat?: number;
  lng?: number;
  experience: string;
  qualifications?: string[];
  wpbsaAccredited?: boolean;
  wpbsaNumber?: string;
  socialLinks?: string;
};

const explain = (error: { code?: string; message?: string } | null): string => {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "23505") return "There is already a pending application for that email.";
  if (error.code === "42501" || error.message?.includes("row-level security")) return "That is not allowed.";
  return "Check your connection and try again.";
};

/** Submits a fresh application. userId is set for an existing signed-in player applying in-app;
 * left undefined for the registration wizard (no confirmed session yet) and the website form -
 * both are matched back to an account by email when the application is approved. */
export const submitCoachApplication = async (input: CoachApplicationInput, userId?: string): Promise<Result> => {
  const { error } = await supabase.from("coach_applications").insert({
    user_id: userId ?? null,
    email: input.email.trim().toLowerCase(),
    full_name: input.fullName.trim(),
    bio: input.bio?.trim() || null,
    location: input.location?.trim() || null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    experience: input.experience.trim(),
    qualifications: input.qualifications ?? [],
    wpbsa_accredited: input.wpbsaAccredited ?? false,
    wpbsa_number: input.wpbsaNumber?.trim() || null,
    social_links: input.socialLinks?.trim() || null,
  });
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};

/** This account's most recent application, if it has ever made one - so a player who already
 * applied sees their status instead of the form again. Matched by user_id OR email: a "Coach"/
 * "Both" registration has no session yet when it applies, so that row starts with user_id null and
 * is only linked by email (see 20261017_0001_coach_application_claim_by_email.sql). Found that way
 * once, it is claimed (user_id set) so later lookups are the simple case. */
export const fetchMyCoachApplication = async (userId: string, email: string): Promise<CoachApplication | null> => {
  const { data, error } = await supabase
    .from("coach_applications")
    .select(`${COACH_APPLICATION_COLUMNS}, user_id`)
    .or(`user_id.eq.${userId},email.eq.${email.trim().toLowerCase()}`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  if (!data.user_id) {
    // Best-effort: a future lookup should not need the email fallback at all. A failure here (the
    // claim policy is not live yet, say) just means it falls back to matching by email again.
    void supabase.from("coach_applications").update({ user_id: userId }).eq("id", data.id);
  }
  return coachApplicationFromRow(data);
};

/** Every application waiting on a decision - visible to an admin only, via coach_applications_select. */
export const fetchPendingCoachApplications = async (): Promise<CoachApplication[]> => {
  const { data, error } = await supabase
    .from("coach_applications")
    .select(COACH_APPLICATION_COLUMNS)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error || !data) return [];
  return data.map(coachApplicationFromRow);
};

/** Approves or rejects an application - the only path that can ever grant is_coach, run server-side
 * by approve-coach-application (service role) so it can create or invite the account too. */
export const reviewCoachApplication = async (
  applicationId: string,
  action: "approve" | "reject",
  reviewerNote?: string
): Promise<Result> => {
  const { data, error } = await supabase.functions.invoke("approve-coach-application", {
    body: { applicationId, action, reviewerNote },
  });
  if (error) return { ok: false, message: "Check your connection and try again." };
  if (data?.error) return { ok: false, message: data.message ?? data.error };
  return { ok: true };
};
