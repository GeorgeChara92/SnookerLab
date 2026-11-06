// The two files behind the Routines checklist:
//
// - src/constants/routines.data.json: every routine's write-up. The app reads it (routines.ts)
//   and shows the ones marked inApp; the rest are drafts written in the dashboard. builtIn marks
//   the ones the app shipped with, which other code refers to by id, so they stay in the app.
// - apps/admin/routine-checklist.json: your sign-offs and notes. Dashboard only, never shipped.
//
// Routines are checked here before they're written, against the same rules the app's own tests
// hold them to (src/constants/__tests__/routines.test.ts), so a save can't break the build.

/** App section -> the layout category the builder files it under. */
export const SECTIONS = {
  "cat-basics": "fundamentals",
  "cat-break-building": "break-building",
  "cat-safety": "safety",
  "cat-straight-cueing": "cueing",
  "cat-cue-ball-control": "cue-ball-control",
  "cat-long-potting": "long-potting",
};
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];
const SCORING = ["points", "percentage", "count", "time"];
const ID = /^routine-[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const text = (value, max) => typeof value === "string" && value.length <= max;
const filled = (value, min) => typeof value === "string" && value.trim().length > min;
const count = (list) => (list ?? []).filter((item) => item.trim()).length;

/** What a routine's write-up still needs before players can see it, in words. */
export function writeUpGaps(routine) {
  const gaps = [];
  if (!filled(routine.summary, 20)) gaps.push("a summary (over 20 characters)");
  if (routine.content_type === "guide") {
    if (!filled(routine.description, 20)) gaps.push("a description (over 20 characters)");
    if (count(routine.steps) < 3) gaps.push(`at least 3 steps (has ${count(routine.steps)})`);
    return gaps;
  }
  if (!filled(routine.setup_instructions, 20)) gaps.push("how to set it up (over 20 characters)");
  if (count(routine.steps) < 3) gaps.push(`at least 3 steps (has ${count(routine.steps)})`);
  if (!filled(routine.success_criteria, 10)) gaps.push("how it's scored (over 10 characters)");
  if (count(routine.improves) < 2) gaps.push(`at least 2 things it improves (has ${count(routine.improves)})`);
  if (!(routine.estimated_duration_minutes > 0)) gaps.push("how long it takes");
  return gaps;
}

const checkVideo = (video, label) => {
  if (video === undefined) return;
  if (!video || typeof video !== "object") throw new Error(`The ${label} isn't valid.`);
  if (!VIDEO_ID.test(video.id ?? "")) throw new Error(`The ${label} needs a YouTube link or 11-character video id.`);
  if (!filled(video.title, 0) || !text(video.title, 200)) throw new Error(`The ${label} needs a title.`);
  if (!text(video.channel ?? "", 120)) throw new Error(`The ${label}'s channel name is too long.`);
};

/** Throws with a plain message if `routine` can't go in the routines file. */
export function validateRoutine(routine) {
  if (!routine || typeof routine !== "object") throw new Error("Expected a routine.");
  if (!ID.test(routine.id ?? "")) throw new Error("That routine has a bad id.");
  if (!filled(routine.name, 2) || !text(routine.name, 80)) throw new Error("Give it a name (3 to 80 characters).");
  if (routine.content_type !== undefined && routine.content_type !== "guide") throw new Error("Unknown kind of routine.");
  const guide = routine.content_type === "guide";
  if (!(routine.category_id in SECTIONS)) throw new Error("Pick a section for it.");
  if (guide !== (routine.category_id === "cat-basics")) throw new Error("Technique guides go in the Fundamentals Library, and table drills go anywhere else.");
  if (routine.icon !== undefined && !text(routine.icon, 8)) throw new Error("The icon should be a single emoji.");
  if (!DIFFICULTIES.includes(routine.difficulty)) throw new Error("Pick a level.");
  if (!SCORING.includes(routine.scoring_type)) throw new Error("Pick how it's scored.");
  for (const key of ["summary", "description", "setup_instructions", "success_criteria"]) {
    if (routine[key] !== undefined && !text(routine[key], 3000)) throw new Error(`The ${key.replace("_", " ")} is too long.`);
  }
  for (const key of ["steps", "improves"]) {
    const list = routine[key];
    if (!Array.isArray(list) || list.length > 20 || list.some((item) => !text(item, 600))) throw new Error(`The ${key} list isn't valid.`);
  }
  const minutes = routine.estimated_duration_minutes;
  if (minutes !== undefined && !(Number.isInteger(minutes) && minutes > 0 && minutes <= 240)) throw new Error("Minutes should be a whole number from 1 to 240.");
  if (routine.max_score !== undefined) {
    if (!(typeof routine.max_score === "number" && routine.max_score > 0 && routine.max_score <= 10000)) throw new Error("The top score should be above 0.");
    if (routine.scoring_type === "time") throw new Error("A timed routine can't have a top score.");
  }
  checkVideo(routine.video, "video");
  checkVideo(routine.altVideo, "second video");
  if (routine.altVideo && !routine.video) throw new Error("Add the main video before a second one.");
  if (typeof routine.inApp !== "boolean") throw new Error("Say whether it's in the app.");
  if (routine.builtIn && !routine.inApp) throw new Error("This routine came with the app and other parts of the app use it, so it stays in.");
  if (routine.inApp) {
    const gaps = writeUpGaps(routine);
    if (gaps.length) throw new Error(`Before it's in the app it needs ${gaps.join(", ")}.`);
  }
}

const KEY_ORDER = [
  "id",
  "inApp",
  "builtIn",
  "category_id",
  "name",
  "icon",
  "content_type",
  "difficulty",
  "summary",
  "description",
  "setup_instructions",
  "steps",
  "success_criteria",
  "improves",
  "scoring_type",
  "max_score",
  "estimated_duration_minutes",
  "video",
  "altVideo",
];

/** Trims and drops empty fields, in a stable key order, so the file diffs cleanly. */
export function cleanRoutine(routine) {
  const out = {};
  for (const key of KEY_ORDER) {
    let value = routine[key];
    if (typeof value === "string") value = value.trim();
    if (Array.isArray(value)) value = value.map((item) => String(item).trim()).filter(Boolean);
    if (value && typeof value === "object" && !Array.isArray(value)) {
      value = { id: String(value.id ?? "").trim(), title: String(value.title ?? "").trim(), channel: String(value.channel ?? "").trim() };
    }
    if (key === "builtIn" && value !== true) continue;
    if (value === undefined || value === "" || value === null) continue;
    out[key] = value;
  }
  if (!out.steps) out.steps = [];
  if (!out.improves) out.improves = [];
  return out;
}

export const formatRoutinesDataFile = (data) => `${JSON.stringify({ routines: data.routines }, null, 2)}\n`;

/** A fresh id from the name, not clashing with any routine already in the app or the file. */
export function idFromName(name, taken) {
  const slug =
    name
      .toLowerCase()
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48)
      .replace(/-+$/g, "") || "new";
  let id = `routine-${slug}`;
  for (let n = 2; taken.has(id); n++) id = `routine-${slug}-${n}`;
  return id;
}

/** Applies one sign-off or note change; returns the whole checklist, empty entries dropped. */
export function applyChecklistChange(checklist, change) {
  if (!change || !ID.test(change.id ?? "")) throw new Error("Unknown routine.");
  const entry = { ...(checklist[change.id] ?? {}) };
  if ("done" in change) {
    if (change.done === null) delete entry.done;
    else if (typeof change.done === "string" && DATE.test(change.done)) entry.done = change.done;
    else throw new Error("A sign-off needs a date.");
  }
  if ("note" in change) {
    if (!text(change.note ?? "", 600)) throw new Error("Keep the note under 600 characters.");
    if (change.note && change.note.trim()) entry.note = change.note.trim();
    else delete entry.note;
  }
  const next = { ...checklist };
  if (Object.keys(entry).length) next[change.id] = entry;
  else delete next[change.id];
  return next;
}

export const formatChecklistFile = (checklist) => {
  const sorted = Object.fromEntries(Object.keys(checklist).sort().map((id) => [id, checklist[id]]));
  return `${JSON.stringify({ routines: sorted }, null, 2)}\n`;
};

/** The image type from the file's own first bytes, whatever its name or the browser claims. */
export function imageKind(bytes) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes.toString("ascii", 1, 4) === "PNG") return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (bytes.length > 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

/**
 * routineLayouts.ts with one routine's picture pointed at `assetPath` (repo-relative, under
 * assets/). The app needs a static require() per picture, so the map lives in code; this edits
 * only that routine's line inside REFERENCE_IMAGES, or adds one at the end of it.
 */
export function setImageInMap(tsSource, routineId, assetPath) {
  const start = tsSource.indexOf("const REFERENCE_IMAGES");
  const open = start < 0 ? -1 : tsSource.indexOf("{", start);
  const close = open < 0 ? -1 : tsSource.indexOf("\n};", open);
  if (close < 0) throw new Error("Couldn't find REFERENCE_IMAGES in routineLayouts.ts.");
  const body = tsSource.slice(open + 1, close);
  const line = `  "${routineId}": require("../../../${assetPath}"),`;
  const existing = new RegExp(`\\n[ \\t]*"${routineId}":\\s*require\\("[^"]+"\\),?`);
  const nextBody = assetPath === null ? body.replace(existing, "") : existing.test(body) ? body.replace(existing, `\n${line}`) : `${body.replace(/,?\s*$/, ",")}\n${line}`;
  return tsSource.slice(0, open + 1) + nextBody + tsSource.slice(close);
}

/** routineLayouts.ts without that routine's picture line (the file itself stays in assets/). */
export const removeImageFromMap = (tsSource, routineId) => setImageInMap(tsSource, routineId, null);
