// @ts-nocheck
// Approves (or rejects) a row in coach_applications. This is the only path that can ever set
// is_coach = true - see 20261016_0001_coach_applications.sql, which freezes that column against
// every ordinary write, insert or update.
//
// On approval: look up an existing account by email; if there is not one yet (a website applicant,
// or someone who applied before confirming a brand-new registration), create one with
// inviteUserByEmail, which sends Supabase's own "you've been invited" email with a secure link to
// set a password - safer than generating a password ourselves and emailing it in plain text, and
// it satisfies the same goal (a new coach signs in and immediately has to choose their own
// password). Either way the profile is seeded from what they submitted, and the application is
// marked reviewed.
//
// Only an admin (public.is_admin()) may call this. Deploy with JWT verification ON: the caller's
// own Supabase session is what proves they are signed in at all, and is_admin() is checked here.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

/** The admin REST endpoint supports an exact-match email filter; the JS SDK does not expose it. */
const findUserByEmail = async (email) => {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(email)}`, {
    headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}`, apikey: SERVICE_ROLE_KEY },
  });
  if (!response.ok) throw new Error(`lookup_failed_${response.status}`);
  const body = await response.json();
  const users = Array.isArray(body) ? body : body?.users ?? [];
  return users.find((user) => user?.email?.toLowerCase() === email.toLowerCase()) ?? null;
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) return json({ error: "not_configured" }, 503);

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

  const { data: caller, error: callerError } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
  if (callerError || !caller?.user) return json({ error: "unauthorized" }, 401);

  const { data: adminRow } = await admin.from("app_admins").select("user_id").eq("user_id", caller.user.id).maybeSingle();
  if (!adminRow) return json({ error: "forbidden" }, 403);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_body" }, 400);
  }

  const applicationId = body?.applicationId;
  const action = body?.action;
  const reviewerNote = typeof body?.reviewerNote === "string" ? body.reviewerNote.slice(0, 500) : null;
  if (!applicationId || (action !== "approve" && action !== "reject")) {
    return json({ error: "invalid_request" }, 400);
  }

  const { data: application, error: loadError } = await admin
    .from("coach_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();
  if (loadError) return json({ error: "load_failed" }, 500);
  if (!application) return json({ error: "not_found" }, 404);
  if (application.status !== "pending") return json({ error: "already_reviewed" }, 409);

  if (action === "reject") {
    const { error: rejectError } = await admin
      .from("coach_applications")
      .update({ status: "rejected", reviewer_note: reviewerNote, reviewed_at: new Date().toISOString() })
      .eq("id", applicationId);
    if (rejectError) return json({ error: "reject_failed" }, 500);
    return json({ ok: true, status: "rejected" });
  }

  // action === "approve"
  try {
    const email = String(application.email).trim().toLowerCase();
    let userId = application.user_id;
    let created = false;

    if (!userId) {
      const existing = await findUserByEmail(email);
      if (existing) {
        userId = existing.id;
      } else {
        // account_type: "coach" matters beyond labelling - AppNavigator treats an account with no
        // account_type at all as a dual player/coach account (a rule meant for accounts that
        // predate the registration wizard) and sends it through the "choose your view" prompt,
        // which also blocks the welcome tour from ever mounting until it's dismissed. An invited
        // coach never goes through that wizard, so without this they'd hit an unexpected prompt
        // and skip straight past the tour a brand new player would normally see.
        const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
          data: { full_name: application.full_name, account_type: "coach" },
        });
        if (inviteError) throw inviteError;
        userId = invited.user.id;
        created = true;
      }
    }

    const profileSeed = {
      id: userId,
      is_coach: true,
      ...(application.full_name && { display_name: application.full_name }),
      ...(application.bio && { bio: application.bio }),
      ...(application.location && { coach_location: application.location }),
      ...(application.lat != null && { coach_lat: application.lat }),
      ...(application.lng != null && { coach_lng: application.lng }),
      wpbsa_accredited: application.wpbsa_accredited,
      ...(application.qualifications?.length && { coach_qualifications: application.qualifications }),
      ...(application.experience && { coach_experience: application.experience }),
    };
    const { error: profileError } = await admin.from("profiles").upsert(profileSeed, { onConflict: "id" });
    if (profileError) throw profileError;

    const { error: approveError } = await admin
      .from("coach_applications")
      .update({ status: "approved", reviewer_note: reviewerNote, reviewed_at: new Date().toISOString(), user_id: userId })
      .eq("id", applicationId);
    if (approveError) throw approveError;

    return json({ ok: true, status: "approved", userId, created });
  } catch (error) {
    console.error("approve-coach-application failed", { message: error?.message });
    return json({ error: "approve_failed", message: error?.message }, 500);
  }
});
