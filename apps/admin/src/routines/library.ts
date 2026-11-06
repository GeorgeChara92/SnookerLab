// What the checklist knows about each routine, and the rules for calling one done. The write-up
// rules are the app's own (src/constants/__tests__/routines.test.ts), so "done" here means the
// same thing the app's tests do, plus your own sign-off after checking it on the table.
import { autoSpotBalls, isOnBed, overlapping } from "./geometry";
import type { Layout } from "./RoutineEditor";

export type Difficulty = "beginner" | "intermediate" | "advanced";
export type Scoring = "points" | "percentage" | "count" | "time";
export type Video = { id: string; title: string; channel: string };

/** A routine as the app has it (src/constants/routines.ts). */
export type AppRoutine = {
  id: string;
  category_id: string;
  name: string;
  icon?: string;
  content_type?: "routine" | "guide";
  difficulty: Difficulty;
  summary?: string;
  description?: string;
  setup_instructions?: string;
  steps?: string[];
  success_criteria?: string;
  improves?: string[];
  scoring_type: Scoring;
  max_score?: number;
  estimated_duration_minutes?: number;
  youtube_video_id?: string;
  youtube_title?: string;
  youtube_channel?: string;
  youtube_alt_video_id?: string;
  youtube_alt_title?: string;
  youtube_alt_channel?: string;
};

/** A routine as it's stored in src/constants/routines.data.json. builtIn: it came with the app. */
export type StoredRoutine = Omit<
  AppRoutine,
  "youtube_video_id" | "youtube_title" | "youtube_channel" | "youtube_alt_video_id" | "youtube_alt_title" | "youtube_alt_channel"
> & { inApp: boolean; builtIn?: boolean; video?: Video; altVideo?: Video };

export type Category = { id: string; name: string; icon?: string; order_index: number };
export type SignOff = { done?: string; note?: string };
export type Library = {
  categories: Category[];
  routines: StoredRoutine[];
  checklist: Record<string, SignOff>;
  paused: number;
  files: { routines: string; checklist: string };
};

/** The sections a table drill can go in; technique guides all go in the Fundamentals Library. */
export const SECTIONS = ["cat-break-building", "cat-safety", "cat-straight-cueing", "cat-cue-ball-control", "cat-long-potting"];
export const GUIDE_SECTION = "cat-basics";

export const LEVEL: Record<Difficulty, string> = { beginner: "Beginner", intermediate: "Intermediate", advanced: "Advanced" };
export const SCORING: Record<Scoring, string> = { points: "Points", percentage: "Percentage", count: "Count", time: "Time" };

export const toAppRoutine = (r: StoredRoutine): AppRoutine => {
  const { inApp: _inApp, builtIn: _builtIn, video, altVideo, ...rest } = r;
  return {
    ...rest,
    youtube_video_id: video?.id,
    youtube_title: video?.title,
    youtube_channel: video?.channel,
    youtube_alt_video_id: altVideo?.id,
    youtube_alt_title: altVideo?.title,
    youtube_alt_channel: altVideo?.channel,
  };
};

const longer = (value: string | undefined, than: number) => (value ?? "").trim().length > than;
const count = (list: string[] | undefined) => (list ?? []).filter((item) => item.trim()).length;

/** What the write-up still needs, in words. Empty when it's complete. */
export function writeUpGaps(r: Pick<AppRoutine, "content_type" | "summary" | "description" | "setup_instructions" | "steps" | "success_criteria" | "improves" | "estimated_duration_minutes">) {
  const gaps: string[] = [];
  if (!longer(r.summary, 20)) gaps.push("a summary");
  if (r.content_type === "guide") {
    if (!longer(r.description, 20)) gaps.push("a description");
    if (count(r.steps) < 3) gaps.push(`3 steps (has ${count(r.steps)})`);
    return gaps;
  }
  if (!longer(r.setup_instructions, 20)) gaps.push("the setup");
  if (count(r.steps) < 3) gaps.push(`3 steps (has ${count(r.steps)})`);
  if (!longer(r.success_criteria, 10)) gaps.push("how it's scored");
  if (count(r.improves) < 2) gaps.push(`2 things it improves (has ${count(r.improves)})`);
  if (!((r.estimated_duration_minutes ?? 0) > 0)) gaps.push("how long it takes");
  return gaps;
}

/**
 * A layout with nothing real on the table yet: no balls, or (for the built-in routines) the old
 * lone cue-ball placeholder. A routine added here can be just a cue ball with the colours on
 * their spots, so for those any placed ball counts.
 */
export const needsLayout = (l: Layout, added = false) =>
  l.balls.length === 0 || (!added && l.balls.length === 1 && l.balls[0].color === "white");

export type PartState = "ok" | "missing" | "warn" | "optional";
export type Part = { key: "table" | "writeup" | "video"; label: string; state: PartState; detail: string };
export type Status = "done" | "ready" | "todo";

export type Entry = {
  id: string;
  name: string;
  icon?: string;
  categoryId: string;
  difficulty: Difficulty;
  guide: boolean;
  /** Added in the dashboard, rather than one the app came with. */
  added: boolean;
  inApp: boolean;
  routine: AppRoutine;
  stored: StoredRoutine;
  layout: Layout | null;
  image: string | null;
  signOff: SignOff;
  parts: Part[];
  status: Status;
  /** Signed off once, but something has gone missing since. */
  lapsed: boolean;
  unsaved: boolean;
};

function tablePart(guide: boolean, added: boolean, layout: Layout | null, image: string | null): Part {
  if (guide) {
    return image
      ? { key: "table", label: "Photo", state: "ok", detail: "Has its photo" }
      : { key: "table", label: "Photo", state: "missing", detail: "No photo yet" };
  }
  if (!layout || needsLayout(layout, added)) return { key: "table", label: "Table", state: "missing", detail: "No balls placed" };
  const all = [...layout.balls, ...autoSpotBalls(layout.balls, layout.spotMarkers)];
  const clash = overlapping(all).size;
  const off = layout.balls.filter((b) => !isOnBed(b)).length;
  if (clash || off) {
    const bits = [clash ? `${clash} balls overlap` : "", off ? `${off} off the table` : ""].filter(Boolean);
    return { key: "table", label: "Table", state: "warn", detail: bits.join(", ") };
  }
  return { key: "table", label: "Table", state: "ok", detail: `${all.length} balls` };
}

export function buildEntries(
  library: Library,
  layouts: Map<string, Layout>,
  drafts: Record<string, Layout>,
  images: Record<string, string>,
  unsavedIds: Set<string>
): Entry[] {
  return library.routines.map((stored) => {
    const routine = toAppRoutine(stored);
    const added = !stored.builtIn;
    const inApp = stored.inApp;
    const guide = routine.content_type === "guide";
    const layout = layouts.get(routine.id) ?? null;
    const shown = drafts[routine.id] ?? layout;
    const image = images[routine.id] ?? null;
    const gaps = writeUpGaps(routine);
    const parts: Part[] = [
      tablePart(guide, added, shown, image),
      gaps.length
        ? { key: "writeup", label: "Write-up", state: "missing", detail: `Needs ${gaps.join(", ")}` }
        : { key: "writeup", label: "Write-up", state: "ok", detail: guide ? `${count(routine.steps)} steps` : `${count(routine.steps)} steps, ${routine.estimated_duration_minutes} min` },
      routine.youtube_video_id
        ? { key: "video", label: "Video", state: "ok", detail: routine.youtube_channel || routine.youtube_title || "Has a video" }
        : { key: "video", label: "Video", state: "optional", detail: "None yet" },
    ];
    const complete = parts.every((p) => p.state === "ok" || p.state === "optional");
    const signOff = library.checklist[routine.id] ?? {};
    const status: Status = complete && inApp && signOff.done ? "done" : complete ? "ready" : "todo";
    return {
      id: routine.id,
      name: routine.name,
      icon: routine.icon,
      categoryId: routine.category_id,
      difficulty: routine.difficulty,
      guide,
      added,
      inApp,
      routine,
      stored,
      layout,
      image,
      signOff,
      parts,
      status,
      lapsed: Boolean(signOff.done) && !complete,
      unsaved: unsavedIds.has(routine.id),
    };
  });
}

/** "2026-11-06" as "6 Nov". */
export const shortDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/** A YouTube link (watch, youtu.be, shorts, embed) or a bare id, as the 11-character id. */
export const youtubeId = (input: string) => {
  const value = input.trim();
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;
  const match = /(?:v=|youtu\.be\/|shorts\/|embed\/|live\/)([A-Za-z0-9_-]{11})/.exec(value);
  return match ? match[1] : null;
};
