import { supabase } from "../../api/supabase";
import type { ActivityDraft, ActivityKind } from "./activityItems";

/**
 * The feed (what friends and group-mates have done) and the routines a group pins, talking to
 * the database. Who can see whose activity is decided there.
 */

export type FeedItem = {
  id: string;
  userId: string;
  kind: ActivityKind;
  title: string;
  detail: string | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
};

const FEED_COLUMNS = "id, user_id, kind, title, detail, payload, created_at";

const feedFromRow = (row: any): FeedItem => ({
  id: row.id,
  userId: row.user_id,
  kind: row.kind,
  title: row.title,
  detail: row.detail ?? null,
  payload: row.payload ?? null,
  createdAt: row.created_at,
});

/** Posts moments to the feed; ones already posted are skipped. False if nothing could be sent. */
export const postActivity = async (userId: string, drafts: ActivityDraft[]): Promise<boolean> => {
  if (!drafts.length) return true;
  const { error } = await supabase.from("activity").upsert(
    drafts.map((draft) => ({
      user_id: userId,
      kind: draft.kind,
      title: draft.title,
      detail: draft.detail,
      payload: draft.payload,
      dedupe_key: draft.dedupeKey,
    })),
    { onConflict: "user_id,dedupe_key", ignoreDuplicates: true }
  );
  if (error) console.warn("Could not post to the feed:", error.message);
  return !error;
};

/** The latest from these players, newest first; older pages by passing the oldest date seen. */
export const loadFeed = async (userIds: string[], before?: string): Promise<FeedItem[]> => {
  if (!userIds.length) return [];
  let request = supabase
    .from("activity")
    .select(FEED_COLUMNS)
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(30);
  if (before) request = request.lt("created_at", before);
  const { data, error } = await request;
  if (error) return [];
  return (data ?? []).map(feedFromRow);
};

/** Whether the player shares their results in the feed (on unless they turned it off). */
export const loadShareActivity = async (userId: string): Promise<boolean> => {
  const { data, error } = await supabase.from("profiles").select("share_activity").eq("id", userId).maybeSingle();
  if (error || !data) return true;
  return data.share_activity !== false;
};

export const saveShareActivity = async (userId: string, value: boolean) => {
  const { error } = await supabase.from("profiles").update({ share_activity: value }).eq("id", userId);
  return !error;
};

// ------------------------------------------------------------------ group routines

export type GroupRoutine = { routineKey: string; name: string; addedBy: string; createdAt: string };

export const groupRoutines = async (groupId: string): Promise<GroupRoutine[]> => {
  const { data, error } = await supabase
    .from("group_routines")
    .select("routine_key, name, added_by, created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: true });
  if (error) return [];
  return (data ?? []).map((row: any) => ({
    routineKey: row.routine_key,
    name: row.name,
    addedBy: row.added_by,
    createdAt: row.created_at,
  }));
};

export const pinRoutine = async (groupId: string, routineKey: string, name: string) => {
  const { error } = await supabase
    .from("group_routines")
    .insert({ group_id: groupId, routine_key: routineKey, name: name.slice(0, 60) });
  if (!error) return { ok: true as const };
  if (error.code === "23505") return { ok: true as const };
  return {
    ok: false as const,
    message: error.message?.includes("12 routines")
      ? "A group can pin up to 12 routines."
      : "Could not pin that. Try again.",
  };
};

export const unpinRoutine = async (groupId: string, routineKey: string) => {
  const { error } = await supabase
    .from("group_routines")
    .delete()
    .eq("group_id", groupId)
    .eq("routine_key", routineKey);
  return !error;
};
