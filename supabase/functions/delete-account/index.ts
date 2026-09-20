// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/** Removes every object under <bucket>/<userId>/, in pages, ignoring an empty folder. */
const removeUserFolder = async (adminClient: any, bucket: string, userId: string) => {
  for (let page = 0; page < 50; page += 1) {
    const { data: files, error } = await adminClient.storage
      .from(bucket)
      .list(userId, { limit: 100, offset: 0 });
    if (error) {
      console.error("storage list failed", { bucket, message: error.message });
      return;
    }
    if (!files || files.length === 0) return;

    const paths = files.map((file: any) => `${userId}/${file.name}`);
    const { error: removeError } = await adminClient.storage.from(bucket).remove(paths);
    if (removeError) {
      console.error("storage remove failed", { bucket, message: removeError.message });
      return;
    }
    if (files.length < 100) return;
  }
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Supabase env vars missing for delete-account function");
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ ok: false, error: "Missing Authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid auth token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Delete the user's uploaded clips first. Table rows cascade from auth.users, but
    // storage objects do not, and leaving them behind would keep personal data after
    // the account is gone.
    await removeUserFolder(adminClient, "ai-videos", user.id);

    const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
    if (deleteError) throw deleteError;

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ ok: false, error: error?.message ?? "Account deletion failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
