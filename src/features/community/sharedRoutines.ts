import { supabase } from "../../api/supabase";
import type { PlacedBall } from "../scanSnooker/position";
import type { CustomRoutine } from "../customRoutines/customRoutine";
import type { ScoreKind } from "../routines/progress";
import { PROFILE_COLUMNS, profileFromRow, type PublicProfile } from "./types";
import { rankEntries } from "./links";

export { rankEntries, routineIdFromLink, routineLink } from "./links";

/**
 * Routines players share with the community, and the leaderboards: one for every routine, of
 * each player's best, and the all-player boards for XP, high break, centuries and wins.
 */

export type SharedRoutine = {
  id: string;
  owner: string;
  name: string;
  description: string | null;
  maxScore: number | null;
  balls: PlacedBall[];
  visibility: "public" | "link";
  likes: number;
  saves: number;
  createdAt: string;
  updatedAt: string;
  author: PublicProfile | null;
};

const COLUMNS =
  "id, owner, name, description, max_score, balls, visibility, likes_count, saves_count, created_at, updated_at";

const fromRow = (row: any, authors: Record<string, PublicProfile>): SharedRoutine => ({
  id: row.id,
  owner: row.owner,
  name: row.name,
  description: row.description ?? null,
  maxScore: row.max_score ?? null,
  balls: Array.isArray(row.balls) ? row.balls : [],
  visibility: row.visibility,
  likes: row.likes_count ?? 0,
  saves: row.saves_count ?? 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  author: authors[row.owner] ?? null,
});

const profilesById = async (ids: string[]) => {
  const unique = [...new Set(ids)].filter(Boolean);
  if (!unique.length) return {} as Record<string, PublicProfile>;
  const { data } = await supabase.from("profiles").select(PROFILE_COLUMNS).in("id", unique);
  return Object.fromEntries((data ?? []).map((row) => [row.id, profileFromRow(row)])) as Record<string, PublicProfile>;
};

const withAuthors = async (rows: any[]) => {
  const authors = await profilesById(rows.map((row) => row.owner));
  return rows.map((row) => fromRow(row, authors));
};

export type LibraryView = "top" | "new" | "friends" | "mine";

/** Routines for the library: the most liked, the newest, friends', or the player's own. */
export const listSharedRoutines = async (
  view: LibraryView,
  { me, friends, query }: { me: string | null; friends: string[]; query?: string }
): Promise<SharedRoutine[]> => {
  let request = supabase.from("shared_routines").select(COLUMNS).limit(50);
  if (view === "mine") {
    if (!me) return [];
    request = request.eq("owner", me);
  } else {
    request = request.eq("visibility", "public");
    if (view === "friends") {
      if (!friends.length) return [];
      request = request.in("owner", friends);
    }
  }
  const text = query?.trim().replace(/[%_,()]/g, "");
  if (text && text.length >= 2) request = request.ilike("name", `%${text}%`);
  request =
    view === "top"
      ? request.order("likes_count", { ascending: false }).order("created_at", { ascending: false })
      : request.order("created_at", { ascending: false });
  const { data, error } = await request;
  if (error || !data) return [];
  return withAuthors(data);
};

export const getSharedRoutine = async (id: string): Promise<SharedRoutine | null> => {
  const { data } = await supabase.from("shared_routines").select(COLUMNS).eq("id", id).maybeSingle();
  if (!data) return null;
  return (await withAuthors([data]))[0];
};

type Result<T = undefined> = { ok: true; value: T } | { ok: false; message: string };

const explain = (error: { code?: string; message?: string }) =>
  error.code === "P0001" || error.message?.includes("not allowed")
    ? "The name or description contains a word that is not allowed."
    : "Check your connection and try again.";

/** Shares one of the player's routines, or updates the copy already shared. */
export const publishRoutine = async (
  routine: CustomRoutine,
  visibility: "public" | "link"
): Promise<Result<string>> => {
  const row = {
    name: routine.name,
    description: routine.description ?? null,
    max_score: routine.maxScore ?? null,
    balls: routine.balls,
    visibility,
  };
  if (routine.sharedId) {
    const { error } = await supabase.from("shared_routines").update(row).eq("id", routine.sharedId);
    return error ? { ok: false, message: explain(error) } : { ok: true, value: routine.sharedId };
  }
  const { data, error } = await supabase.from("shared_routines").insert(row).select("id").single();
  return error || !data ? { ok: false, message: explain(error ?? {}) } : { ok: true, value: data.id as string };
};

export const unpublishRoutine = async (sharedId: string): Promise<Result> => {
  const { error } = await supabase.from("shared_routines").delete().eq("id", sharedId);
  return error ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

/** Which of these routines the player has liked and saved. */
export const myReactions = async (ids: string[]) => {
  if (!ids.length) return { liked: new Set<string>(), saved: new Set<string>() };
  const [likes, saves] = await Promise.all([
    supabase.from("routine_likes").select("routine_id").in("routine_id", ids),
    supabase.from("routine_saves").select("routine_id").in("routine_id", ids),
  ]);
  return {
    liked: new Set((likes.data ?? []).map((row) => row.routine_id as string)),
    saved: new Set((saves.data ?? []).map((row) => row.routine_id as string)),
  };
};

export const setLiked = async (id: string, liked: boolean): Promise<Result> => {
  const { error } = liked
    ? await supabase.from("routine_likes").insert({ routine_id: id })
    : await supabase.from("routine_likes").delete().eq("routine_id", id);
  return error && error.code !== "23505" ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

export const recordSave = async (id: string): Promise<Result> => {
  const { error } = await supabase.from("routine_saves").insert({ routine_id: id });
  return error && error.code !== "23505" ? { ok: false, message: explain(error) } : { ok: true, value: undefined };
};

// ------------------------------------------------------------------ leaderboards

export type BoardEntry = {
  rank: number;
  profile: PublicProfile;
  value: number;
  /** As entered, for a routine: "07:35", "72%", "23". */
  raw: string;
};

/** Everyone's best on one routine; less is better for timed ones. */
export const routineLeaderboard = async (
  routineKey: string,
  { friends, limit = 50 }: { friends?: string[]; limit?: number } = {}
): Promise<{ entries: BoardEntry[]; kind: ScoreKind }> => {
  const probe = await supabase.from("routine_bests").select("kind").eq("routine_key", routineKey).limit(1);
  const kind = ((probe.data?.[0]?.kind as ScoreKind) ?? "number") as ScoreKind;
  let request = supabase
    .from("routine_bests")
    .select("user_id, best, best_raw")
    .eq("routine_key", routineKey)
    .order("best", { ascending: kind === "time" })
    .limit(limit);
  if (friends) request = request.in("user_id", friends);
  const { data } = await request;
  const rows = data ?? [];
  const profiles = await profilesById(rows.map((row) => row.user_id));
  const entries = rankEntries(
    rows
      .filter((row) => profiles[row.user_id])
      .map((row) => ({ profile: profiles[row.user_id], value: Number(row.best), raw: row.best_raw as string })),
    kind !== "time"
  );
  return { entries, kind };
};

export type GlobalMetric = "xp" | "best_break" | "centuries" | "matches_won";

export const GLOBAL_METRICS: Array<{ value: GlobalMetric; label: string; unit: string }> = [
  { value: "xp", label: "Level", unit: "XP" },
  { value: "best_break", label: "High break", unit: "" },
  { value: "centuries", label: "Centuries", unit: "" },
  { value: "matches_won", label: "Wins", unit: "" },
];

/** The all-player boards: players who appear on leaderboards, best first. */
export const globalLeaderboard = async (
  metric: GlobalMetric,
  { friends, limit = 50 }: { friends?: string[]; limit?: number } = {}
): Promise<BoardEntry[]> => {
  let request = supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("leaderboards", true)
    .not("handle", "is", null)
    .not(metric, "is", null)
    .gt(metric, 0)
    .order(metric, { ascending: false })
    .limit(limit);
  if (friends) request = request.in("id", friends);
  const { data } = await request;
  return rankEntries(
    (data ?? []).map((row: any) => {
      const value = Number(row[metric] ?? 0);
      return { profile: profileFromRow(row), value, raw: String(value) };
    })
  );
};
