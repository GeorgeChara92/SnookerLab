import { supabase } from "../../api/supabase";
import { PROFILE_COLUMNS, profileFromRow, type PublicProfile } from "./types";

/**
 * Chat and groups, talking to the database. The rules (who can message whom, requests, who can
 * post in a group) live in the database's functions and policies; this is the app's side.
 */

export type Group = {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  emoji: string;
  colour: string;
  visibility: "public" | "invite";
  whoCanPost: "everyone" | "admins";
  whoCanInvite: "everyone" | "admins";
  memberCount: number;
  createdAt: string;
};

export type GroupRole = "owner" | "admin" | "member";

export type GroupMember = { profile: PublicProfile; role: GroupRole; joinedAt: string };

export type InboxRow = {
  conversationId: string;
  kind: "direct" | "group";
  groupId: string | null;
  otherUser: string | null;
  /** For a direct chat: in the player's chats, or waiting as a request to them. */
  status: "active" | "request";
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  lastSender: string | null;
  unread: number;
  muted: boolean;
};

export type Message = {
  id: string;
  conversationId: string;
  sender: string;
  kind: "text" | "routine" | "match" | "media";
  body: string;
  payload: Record<string, unknown> | null;
  hidden: boolean;
  createdAt: string;
};

type Result<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

const explain = (error: { code?: string; message?: string } | null): string => {
  if (!error) return "Something went wrong. Try again.";
  if (error.code === "P0001" || error.message?.includes("not allowed"))
    return "That contains a word that is not allowed.";
  if (error.message?.includes("row-level security")) return "You cannot do that here.";
  // The database's own reasons are written for players; pass them on.
  if (error.message && !error.message.includes("JWT") && error.message.length < 120) return error.message;
  return "Check your connection and try again.";
};

export const groupFromRow = (row: any): Group => ({
  id: row.id,
  owner: row.owner,
  name: row.name,
  description: row.description ?? null,
  emoji: row.emoji ?? "🎱",
  colour: row.colour ?? "#1E7A46",
  visibility: row.visibility,
  whoCanPost: row.who_can_post,
  whoCanInvite: row.who_can_invite,
  memberCount: row.member_count ?? 0,
  createdAt: row.created_at,
});

const GROUP_COLUMNS =
  "id, owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite, member_count, created_at";

export const messageFromRow = (row: any): Message => ({
  id: row.id,
  conversationId: row.conversation_id,
  sender: row.sender,
  kind: row.kind,
  body: row.body,
  payload: row.payload ?? null,
  hidden: Boolean(row.hidden_at),
  createdAt: row.created_at,
});

export const profilesFor = async (ids: string[]) => {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {} as Record<string, PublicProfile>;
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique);
  return Object.fromEntries((data ?? []).map((row) => [row.id, profileFromRow(row)])) as Record<string, PublicProfile>;
};

export const groupsFor = async (ids: string[]) => {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {} as Record<string, Group>;
  const { data } = await supabase.from("groups").select(GROUP_COLUMNS).in("id", unique);
  return Object.fromEntries((data ?? []).map((row) => [row.id, groupFromRow(row)])) as Record<string, Group>;
};

// ------------------------------------------------------------------ conversations

export const fetchInbox = async (): Promise<InboxRow[] | null> => {
  const { data, error } = await supabase.rpc("inbox");
  if (error) {
    console.warn("Could not load chats:", error.message);
    return null;
  }
  return (data ?? []).map((row: any) => ({
    conversationId: row.conversation_id,
    kind: row.kind,
    groupId: row.group_id ?? null,
    otherUser: row.other_user ?? null,
    status: row.status === "request" ? "request" : "active",
    lastMessageAt: row.last_message_at ?? null,
    lastMessagePreview: row.last_message_preview ?? null,
    lastSender: row.last_sender ?? null,
    unread: row.unread ?? 0,
    muted: Boolean(row.muted),
  }));
};

/** Opens (or starts) the direct chat with a player. */
export const startDirect = async (other: string): Promise<Result<string>> => {
  const { data, error } = await supabase.rpc("start_direct", { other });
  return error || !data ? { ok: false, message: explain(error) } : { ok: true, value: data as string };
};

export const answerRequest = async (conversationId: string, accept: boolean): Promise<Result> => {
  const { error } = await supabase.rpc("answer_request", { conversation: conversationId, accept });
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const markRead = async (conversationId: string) => {
  await supabase.rpc("mark_read", { conversation: conversationId });
};

export const setMuted = async (conversationId: string, userId: string, muted: boolean) => {
  await supabase.rpc("mark_read", { conversation: conversationId });
  await supabase
    .from("conversation_members")
    .update({ muted })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
};

/** A page of messages, newest first; older pages by passing the oldest date seen. */
export const loadMessages = async (conversationId: string, before?: string): Promise<Message[]> => {
  let request = supabase
    .from("messages")
    .select("id, conversation_id, sender, kind, body, payload, hidden_at, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40);
  if (before) request = request.lt("created_at", before);
  const { data } = await request;
  return (data ?? []).map(messageFromRow);
};

export const sendMessage = async (
  conversationId: string,
  body: string,
  kind: Message["kind"] = "text",
  payload: Record<string, unknown> | null = null
): Promise<Result<Message>> => {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, body: body.trim().slice(0, 2000), kind, payload })
    .select("id, conversation_id, sender, kind, body, payload, hidden_at, created_at")
    .single();
  return error || !data ? { ok: false, message: explain(error) } : { ok: true, value: messageFromRow(data) };
};

/** Who a conversation is with: the other player, or the group. */
export const conversationDetails = async (conversationId: string) => {
  const { data } = await supabase
    .from("conversations")
    .select("id, kind, group_id, pair_low, pair_high")
    .eq("id", conversationId)
    .maybeSingle();
  return data as {
    id: string;
    kind: "direct" | "group";
    group_id: string | null;
    pair_low: string | null;
    pair_high: string | null;
  } | null;
};

// ------------------------------------------------------------------ groups

export type GroupDraft = {
  name: string;
  description: string;
  emoji: string;
  colour: string;
  visibility: Group["visibility"];
  whoCanPost: Group["whoCanPost"];
  whoCanInvite: Group["whoCanInvite"];
};

export const createGroup = async (draft: GroupDraft): Promise<Result<string>> => {
  const { data, error } = await supabase.rpc("create_group", {
    group_name: draft.name,
    group_description: draft.description,
    group_emoji: draft.emoji,
    group_colour: draft.colour,
    group_visibility: draft.visibility,
    posting: draft.whoCanPost,
    inviting: draft.whoCanInvite,
  });
  return error || !data ? { ok: false, message: explain(error) } : { ok: true, value: data as string };
};

export const updateGroup = async (id: string, draft: GroupDraft): Promise<Result> => {
  const { error } = await supabase
    .from("groups")
    .update({
      name: draft.name.trim(),
      description: draft.description.trim() || null,
      emoji: draft.emoji,
      colour: draft.colour,
      visibility: draft.visibility,
      who_can_post: draft.whoCanPost,
      who_can_invite: draft.whoCanInvite,
    })
    .eq("id", id);
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const deleteGroup = async (id: string): Promise<Result> => {
  const { error } = await supabase.from("groups").delete().eq("id", id);
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const myGroups = async (me: string): Promise<Array<Group & { role: GroupRole }>> => {
  const { data } = await supabase.from("group_members").select("group_id, role").eq("user_id", me);
  const rows = data ?? [];
  const groups = await groupsFor(rows.map((row) => row.group_id as string));
  return rows
    .filter((row) => groups[row.group_id])
    .map((row) => ({ ...groups[row.group_id], role: row.role as GroupRole }))
    .sort((a, b) => a.name.localeCompare(b.name));
};

export const myGroupInvites = async (me: string): Promise<Array<{ group: Group; invitedBy: PublicProfile | null }>> => {
  const { data } = await supabase.from("group_invites").select("group_id, invited_by").eq("user_id", me);
  const rows = data ?? [];
  const [groups, people] = await Promise.all([
    groupsFor(rows.map((row) => row.group_id as string)),
    profilesFor(rows.map((row) => row.invited_by as string)),
  ]);
  return rows
    .filter((row) => groups[row.group_id])
    .map((row) => ({ group: groups[row.group_id], invitedBy: people[row.invited_by] ?? null }));
};

export const discoverGroups = async (query: string): Promise<Group[]> => {
  let request = supabase
    .from("groups")
    .select(GROUP_COLUMNS)
    .eq("visibility", "public")
    .order("member_count", { ascending: false })
    .limit(30);
  const text = query.trim().replace(/[%_,()]/g, "");
  if (text.length >= 2) request = request.ilike("name", `%${text}%`);
  const { data } = await request;
  return (data ?? []).map(groupFromRow);
};

export const getGroup = async (id: string) => {
  const [groupResult, membersResult, conversationResult] = await Promise.all([
    supabase.from("groups").select(GROUP_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("group_members").select("user_id, role, joined_at").eq("group_id", id),
    supabase.from("conversations").select("id").eq("group_id", id).maybeSingle(),
  ]);
  if (!groupResult.data) return null;
  const rows = membersResult.data ?? [];
  const people = await profilesFor(rows.map((row) => row.user_id as string));
  const order: Record<GroupRole, number> = { owner: 0, admin: 1, member: 2 };
  const members: GroupMember[] = rows
    .filter((row) => people[row.user_id])
    .map((row) => ({ profile: people[row.user_id], role: row.role as GroupRole, joinedAt: row.joined_at as string }))
    .sort(
      (a, b) =>
        order[a.role] - order[b.role] || (a.profile.displayName ?? "").localeCompare(b.profile.displayName ?? "")
    );
  return {
    group: groupFromRow(groupResult.data),
    members,
    conversationId: (conversationResult.data?.id as string | undefined) ?? null,
  };
};

export const joinGroup = async (id: string): Promise<Result> => {
  const { error } = await supabase.rpc("join_group", { target: id });
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const declineGroupInvite = async (groupId: string, me: string) => {
  await supabase.from("group_invites").delete().eq("group_id", groupId).eq("user_id", me);
};

export const leaveGroup = async (groupId: string, userId: string): Promise<Result> => {
  const { error } = await supabase.from("group_members").delete().eq("group_id", groupId).eq("user_id", userId);
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const inviteToGroup = async (groupId: string, player: string): Promise<Result> => {
  const { error } = await supabase.rpc("invite_to_group", { target: groupId, player });
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const setGroupRole = async (groupId: string, player: string, role: GroupRole): Promise<Result> => {
  const { error } = await supabase.rpc("set_group_role", { target: groupId, player, new_role: role });
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};
