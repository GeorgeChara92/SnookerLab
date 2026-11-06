// Lets the Routines page read and save the app's routine files. This only exists inside the
// dashboard's dev server, which listens on 127.0.0.1 and is never deployed, and it only touches:
//
// - src/features/ar/routineLayouts.data.json   the ball layouts (read and write)
// - src/constants/routines.data.json           every routine's write-up (read and write)
// - apps/admin/routine-checklist.json          your sign-offs and notes (read and write)
// - src/features/ar/routineLayouts.ts          only its REFERENCE_IMAGES map, when a picture changes
// - assets/routines/                           routine pictures (written only when you upload one)
// - src/constants/routines.ts                  the section list (read only)
// - image files under assets/                  pictures (read only)
import { createHash } from "node:crypto";
import { access, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { formatRoutinesFile, readImageMap, validateRoutines, SPOT_IDS } from "./routinesFile.mjs";
import {
  SECTIONS,
  applyChecklistChange,
  cleanRoutine,
  formatChecklistFile,
  formatRoutinesDataFile,
  idFromName,
  imageKind,
  removeImageFromMap,
  setImageInMap,
  validateRoutine,
} from "./libraryFile.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, "../../..");
const LAYOUTS_FILE = path.join(REPO, "src/features/ar/routineLayouts.data.json");
const LAYOUTS_TS = path.join(REPO, "src/features/ar/routineLayouts.ts");
const ROUTINES_FILE = path.join(REPO, "src/constants/routines.data.json");
const LIBRARY_TS = path.join(REPO, "src/constants/routines.ts");
const DRILLS_TS = path.join(REPO, "src/constants/routineDrills.ts");
const CHECKLIST_FILE = path.resolve(HERE, "../routine-checklist.json");
const ASSETS = path.join(REPO, "assets");
const PICTURES = path.join(ASSETS, "routines");
const ORIGINS = new Set(["http://127.0.0.1:5620", "http://localhost:5620"]);
const HOSTS = new Set(["127.0.0.1:5620", "localhost:5620"]);
const IMAGE_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };
const MAX_BODY = 2 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;

const versionOf = (text) => createHash("sha1").update(text).digest("hex");
const repoPath = (file) => path.relative(REPO, file).split(path.sep).join("/");
const exists = (file) => access(file).then(() => true, () => false);

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
};

class Refused extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const readBytes = (req, max) =>
  new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > max) {
        reject(new Refused(413, `That's too big. Keep it under ${Math.round(max / 1024 / 1024)} MB.`));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
const readJsonBody = async (req) => JSON.parse((await readBytes(req, MAX_BODY)).toString("utf8"));

/** Writes go one at a time, each to a temp file renamed over the real one. */
let queue = Promise.resolve();
const serially = (task) => {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
};
const writeAtomic = async (file, contents) => {
  const temp = `${file}.saving`;
  await writeFile(temp, contents);
  await rename(temp, file);
};

const readJson = async (file, fallback) => {
  const text = await readFile(file, "utf8").catch((error) => (error.code === "ENOENT" ? null : Promise.reject(error)));
  return text === null ? { text: "", data: fallback } : { text, data: JSON.parse(text) };
};

async function layouts() {
  const [{ text, data }, ts] = await Promise.all([readJson(LAYOUTS_FILE, { routines: [] }), readFile(LAYOUTS_TS, "utf8")]);
  return { text, data, ts, images: readImageMap(ts) };
}
const routines = async () => (await readJson(ROUTINES_FILE, { routines: [] })).data.routines;
const checklist = async () => (await readJson(CHECKLIST_FILE, { routines: {} })).data.routines ?? {};

/** The app's sections and the paused count, loaded through Vite so the TypeScript just works. */
async function appModules(server) {
  const graph = server.environments?.ssr?.moduleGraph ?? server.moduleGraph;
  graph.invalidateAll();
  const library = await server.ssrLoadModule(LIBRARY_TS);
  const drills = await server.ssrLoadModule(DRILLS_TS).catch(() => ({}));
  return { categories: library.DEFAULT_CATEGORIES, paused: drills.EXTRA_ROUTINES?.length ?? 0 };
}

const imageUrls = (images) => Object.fromEntries(Object.entries(images).map(([id, file]) => [id, `/__admin/asset/${file}`]));

const dashboardOnly = (req, type = "application/json") => {
  if (!ORIGINS.has(req.headers.origin ?? "")) throw new Refused(403, "Saves only come from the dashboard.");
  if (!(req.headers["content-type"] ?? "").startsWith(type)) throw new Refused(415, "Wrong kind of upload.");
};

async function handle(server, req, res, next) {
  const url = new URL(req.url ?? "/", "http://127.0.0.1");
  if (!url.pathname.startsWith("/__admin/")) return next();

  // Only this computer's own dashboard page: refuses other hosts (DNS rebinding) and, for saves,
  // any page that isn't the dashboard (another site posting to localhost).
  if (!HOSTS.has(req.headers.host ?? "")) return send(res, 403, { error: "Not available." });

  try {
    if (url.pathname === "/__admin/routines" && req.method === "GET") {
      const { text, data, images } = await layouts();
      return send(res, 200, { version: versionOf(text), file: repoPath(LAYOUTS_FILE), routines: data.routines, images: imageUrls(images) });
    }

    if (url.pathname === "/__admin/routines" && req.method === "PUT") {
      dashboardOnly(req);
      const body = await readJsonBody(req);
      return await serially(async () => {
        const { text } = await layouts();
        if (body.version !== versionOf(text)) {
          return send(res, 409, { error: "The layouts file changed since you opened it.", version: versionOf(text) });
        }
        const next = { routines: body.routines };
        validateRoutines(next);
        const out = formatRoutinesFile(next);
        await writeAtomic(LAYOUTS_FILE, out);
        return send(res, 200, { version: versionOf(out) });
      });
    }

    // Everything the checklist needs: every routine's write-up, the sections, your sign-offs.
    if (url.pathname === "/__admin/library" && req.method === "GET") {
      const [app, list, signoffs] = await Promise.all([appModules(server), routines(), checklist()]);
      return send(res, 200, {
        categories: app.categories,
        routines: list,
        checklist: signoffs,
        paused: app.paused,
        files: { routines: repoPath(ROUTINES_FILE), checklist: repoPath(CHECKLIST_FILE) },
      });
    }

    if (url.pathname === "/__admin/checklist" && req.method === "PUT") {
      dashboardOnly(req);
      const change = await readJsonBody(req);
      return await serially(async () => {
        const next = applyChecklistChange(await checklist(), change);
        await writeAtomic(CHECKLIST_FILE, formatChecklistFile(next));
        return send(res, 200, { checklist: next });
      });
    }

    // Add a routine, or update any routine's write-up. A new one also gets an empty table
    // layout, so it shows up in the builder ready for its balls.
    if (url.pathname === "/__admin/routine" && req.method === "PUT") {
      dashboardOnly(req);
      const body = await readJsonBody(req);
      return await serially(async () => {
        const [list, table] = await Promise.all([routines(), layouts()]);
        const routine = { ...body.routine };
        const before = list.find((r) => r.id === routine.id);
        if (body.create) {
          const taken = new Set([...list.map((r) => r.id), ...table.data.routines.map((r) => r.routineId)]);
          routine.id = idFromName(String(routine.name ?? ""), taken);
          routine.builtIn = false;
        } else {
          if (!before) throw new Refused(404, "That routine isn't in the file any more. Reload the page.");
          // Whether it came with the app, and whether it's a guide or a drill, never change here.
          routine.builtIn = before.builtIn;
          routine.content_type = before.content_type;
        }
        const clean = cleanRoutine(routine);
        validateRoutine(clean);
        const layout = table.data.routines.find((r) => r.routineId === clean.id);
        const goingLive = clean.inApp && !before?.inApp;
        if (goingLive && clean.content_type === "guide" && !table.images[clean.id]) {
          throw new Refused(400, "Add its photo before it goes in the app.");
        }
        if (goingLive && clean.content_type !== "guide" && !(layout?.ballPlacements.length ?? 0)) {
          throw new Refused(400, "Place its balls in the builder before it goes in the app.");
        }
        const nextList = before ? list.map((r) => (r.id === clean.id ? clean : r)) : [...list, clean];
        const category = SECTIONS[clean.category_id];
        const nextLayouts = {
          routines: layout
            ? table.data.routines.map((r) => (r.routineId === clean.id ? { ...r, displayName: clean.name, category } : r))
            : [...table.data.routines, { routineId: clean.id, displayName: clean.name, category, spotMarkers: clean.content_type === "guide" ? [] : [...SPOT_IDS], ballPlacements: [] }],
        };
        validateRoutines(nextLayouts);
        await writeAtomic(ROUTINES_FILE, formatRoutinesDataFile({ routines: nextList }));
        const layoutsText = formatRoutinesFile(nextLayouts);
        if (layoutsText !== table.text) await writeAtomic(LAYOUTS_FILE, layoutsText);
        return send(res, 200, { routine: clean });
      });
    }

    // Removes a draft added here, with its layout and sign-off. Never one the app came with, and
    // never one players can already see. Its picture, if it had one, stays in assets/.
    if (url.pathname === "/__admin/routine" && req.method === "DELETE") {
      dashboardOnly(req);
      const { id } = await readJsonBody(req);
      return await serially(async () => {
        const [list, table, signoffs] = await Promise.all([routines(), layouts(), checklist()]);
        const routine = list.find((r) => r.id === id);
        if (!routine) throw new Refused(404, "That routine isn't in the file.");
        if (routine.builtIn) throw new Refused(400, "This routine came with the app, so it can't be deleted here.");
        if (routine.inApp) throw new Refused(400, "Take it out of the app before deleting it.");
        const nextSignoffs = { ...signoffs };
        delete nextSignoffs[id];
        await writeAtomic(ROUTINES_FILE, formatRoutinesDataFile({ routines: list.filter((r) => r.id !== id) }));
        await writeAtomic(LAYOUTS_FILE, formatRoutinesFile({ routines: table.data.routines.filter((r) => r.routineId !== id) }));
        await writeAtomic(CHECKLIST_FILE, formatChecklistFile(nextSignoffs));
        if (table.images[id]) await writeAtomic(LAYOUTS_TS, removeImageFromMap(table.ts, id));
        return send(res, 200, { ok: true, picture: table.images[id] ?? null });
      });
    }

    // A new picture for a routine: its photo (technique guides) or its reference picture (drills).
    // It replaces the file in place when the type matches; otherwise it's saved next to the old
    // one and routineLayouts.ts is pointed at it. The old file is never deleted from here.
    if (url.pathname === "/__admin/routine-image" && req.method === "POST") {
      dashboardOnly(req, "image/");
      const id = url.searchParams.get("id") ?? "";
      const bytes = await readBytes(req, MAX_IMAGE);
      const kind = imageKind(bytes);
      if (!kind) throw new Refused(415, "That isn't a PNG, JPEG or WebP picture.");
      return await serially(async () => {
        const [list, table] = await Promise.all([routines(), layouts()]);
        if (!list.some((r) => r.id === id) || !table.data.routines.some((r) => r.routineId === id)) throw new Refused(404, "Unknown routine.");
        const current = table.images[id];
        let target;
        let replaced = null;
        if (current) {
          const parsed = path.posix.parse(current);
          const sameType = parsed.ext.toLowerCase() === `.${kind}` || (kind === "jpg" && parsed.ext.toLowerCase() === ".jpeg");
          target = sameType ? current : `${parsed.dir}/${parsed.name}.${kind}`;
          if (!sameType) replaced = current;
        } else {
          target = `assets/routines/${id.replace(/^routine-/, "")}.${kind}`;
        }
        // Never write over a different routine's picture, or anywhere outside assets/routines.
        const others = new Set(Object.entries(table.images).filter(([other]) => other !== id).map(([, file]) => file));
        const base = target.replace(/\.[a-z]+$/, "");
        for (let n = 2; others.has(target) || (target !== current && (await exists(path.join(REPO, target)))); n++) target = `${base}-${n}.${kind}`;
        const file = path.resolve(REPO, target);
        if (!file.startsWith(PICTURES + path.sep)) throw new Refused(400, "Pictures can only go in assets/routines.");
        await writeAtomic(file, bytes);
        if (target !== current) await writeAtomic(LAYOUTS_TS, setImageInMap(table.ts, id, target));
        return send(res, 200, { file: target, url: `/__admin/asset/${target}`, replaced: current === target ? null : replaced });
      });
    }

    if (url.pathname.startsWith("/__admin/asset/") && req.method === "GET") {
      const relative = decodeURIComponent(url.pathname.slice("/__admin/asset/".length));
      const file = path.resolve(REPO, relative);
      const type = IMAGE_TYPES[path.extname(file).toLowerCase()];
      if (!type || !file.startsWith(ASSETS + path.sep)) return send(res, 404, { error: "No such image." });
      const bytes = await readFile(file).catch(() => null);
      if (!bytes) return send(res, 404, { error: "No such image." });
      res.statusCode = 200;
      res.setHeader("Content-Type", type);
      res.setHeader("Cache-Control", "no-cache");
      return res.end(bytes);
    }

    return send(res, 404, { error: "Unknown admin route." });
  } catch (error) {
    if (error instanceof Refused) return send(res, error.status, { error: error.message });
    if (error instanceof SyntaxError) return send(res, 400, { error: "That wasn't valid JSON." });
    // The validators throw plain Errors with a message meant for you; file errors carry a code.
    return send(res, error?.code ? 500 : 400, { error: error instanceof Error ? error.message : String(error) });
  }
}

export function routinesPlugin() {
  return {
    name: "snookered-admin-routines",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handle(server, req, res, next);
      });
    },
  };
}
