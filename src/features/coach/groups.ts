import { supabase } from "../../api/supabase";
import {
  COACH_GROUP_COLUMNS,
  COACH_GROUP_POST_COLUMNS,
  coachGroupFromRow,
  coachGroupMemberFromRow,
  coachGroupPostFromRow,
  type CoachGroup,
  type CoachGroupMember,
  type CoachGroupPost,
} from "./types";

/**
 * A coach's own broadcast groups: created and run entirely by the coach, talking to the database.
 * Kept apart from the general community groups feature (features/community/chat.ts) - these are a
 * one-way channel from a coach to their clients, not a social group players run themselves.
 */

type Result = { ok: true } | { ok: false; message: string };

const explain = (error: { message?: string } | null) =>
  error?.message ?? "Something went wrong. Try again.";

/** Groups this coach has made. */
export const listMyCoachGroups = async (coachId: string): Promise<CoachGroup[]> => {
  const { data, error } = await supabase
    .from("coach_groups")
    .select(COACH_GROUP_COLUMNS)
    .eq("coach_id", coachId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(coachGroupFromRow);
};

/** Groups a player has been added to, by any coach. */
export const listMemberCoachGroups = async (playerId: string): Promise<CoachGroup[]> => {
  const { data: memberships } = await supabase.from("coach_group_members").select("group_id").eq("player_id", playerId);
  const groupIds = (memberships ?? []).map((row: any) => row.group_id as string);
  if (!groupIds.length) return [];
  const { data, error } = await supabase
    .from("coach_groups")
    .select(COACH_GROUP_COLUMNS)
    .in("id", groupIds)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(coachGroupFromRow);
};

export const getCoachGroup = async (groupId: string): Promise<CoachGroup | null> => {
  const { data, error } = await supabase.from("coach_groups").select(COACH_GROUP_COLUMNS).eq("id", groupId).maybeSingle();
  if (error || !data) return null;
  return coachGroupFromRow(data);
};

export const createCoachGroup = async (coachId: string, name: string, memberIds: string[]): Promise<Result> => {
  const { data, error } = await supabase
    .from("coach_groups")
    .insert({ coach_id: coachId, name: name.trim().slice(0, 60) })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: explain(error) };
  if (memberIds.length) {
    const { error: memberError } = await supabase
      .from("coach_group_members")
      .insert(memberIds.map((playerId) => ({ group_id: data.id, player_id: playerId })));
    if (memberError) return { ok: false, message: explain(memberError) };
  }
  return { ok: true };
};

export const deleteCoachGroup = async (groupId: string): Promise<Result> => {
  const { error } = await supabase.from("coach_groups").delete().eq("id", groupId);
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};

export const groupMembers = async (groupId: string): Promise<CoachGroupMember[]> => {
  const { data, error } = await supabase
    .from("coach_group_members")
    .select("group_id, player_id, added_at")
    .eq("group_id", groupId);
  if (error || !data) return [];
  return data.map(coachGroupMemberFromRow);
};

export const addGroupMember = async (groupId: string, playerId: string): Promise<Result> => {
  const { error } = await supabase.from("coach_group_members").insert({ group_id: groupId, player_id: playerId });
  if (error) return { ok: false, message: error.code === "23505" ? "Already in this group." : explain(error) };
  return { ok: true };
};

export const removeGroupMember = async (groupId: string, playerId: string): Promise<Result> => {
  const { error } = await supabase
    .from("coach_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("player_id", playerId);
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};

export const groupPosts = async (groupId: string): Promise<CoachGroupPost[]> => {
  const { data, error } = await supabase
    .from("coach_group_posts")
    .select(COACH_GROUP_POST_COLUMNS)
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(coachGroupPostFromRow);
};

export const createGroupPost = async (
  groupId: string,
  coachId: string,
  mediaPath: string,
  mediaType: CoachGroupPost["mediaType"],
  caption: string,
  fileName?: string | null
): Promise<Result> => {
  const { error } = await supabase.from("coach_group_posts").insert({
    group_id: groupId,
    coach_id: coachId,
    media_path: mediaPath,
    media_type: mediaType,
    caption: caption.trim().slice(0, 500) || null,
    file_name: fileName ? fileName.slice(0, 150) : null,
  });
  if (error) return { ok: false, message: explain(error) };
  return { ok: true };
};

export const deleteGroupPost = async (postId: string, mediaPath: string): Promise<Result> => {
  const { error } = await supabase.from("coach_group_posts").delete().eq("id", postId);
  if (error) return { ok: false, message: explain(error) };
  await supabase.storage.from("coach-group-media").remove([mediaPath]);
  return { ok: true };
};
