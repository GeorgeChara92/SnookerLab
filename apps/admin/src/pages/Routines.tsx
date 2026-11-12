import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { useDialog } from "../dialog";
import { arrowFromStored, arrowToStored, fromStored, toStored, type Colour, type SpotId, type StoredArrow } from "../routines/geometry";
import { RoutineEditor, type Layout } from "../routines/RoutineEditor";
import { Checklist } from "../routines/Checklist";
import { RoutineForm } from "../routines/RoutineForm";
import { RoutineView } from "../routines/RoutineView";
import { buildEntries, needsLayout, today, type Library, type SignOff, type StoredRoutine as RoutineRecord } from "../routines/library";

type StoredRoutine = {
  routineId: string;
  displayName: string;
  category: string;
  spotMarkers: SpotId[];
  notes?: string;
  ballPlacements: Array<{ id: string; color: Colour; x: number; y: number; label?: string }>;
  arrows?: StoredArrow[];
};
type FileData = { version: string; file: string; layouts: Layout[]; images: Record<string, string> };

export const CATEGORY_LABEL: Record<string, string> = {
  "break-building": "Break building",
  safety: "Safety and escapes",
  cueing: "Cueing",
  "cue-ball-control": "Cue ball control",
  spin: "Spin",
  "long-potting": "Long potting",
  fundamentals: "Technique",
};
const CATEGORY_ORDER = ["break-building", "safety", "cueing", "cue-ball-control", "spin", "long-potting"];
const DRAFTS_KEY = "snookered-admin-routine-drafts";

const toLayout = (r: StoredRoutine): Layout => ({
  routineId: r.routineId,
  displayName: r.displayName,
  category: r.category,
  spotMarkers: r.spotMarkers,
  notes: r.notes ?? "",
  balls: r.ballPlacements.map(fromStored),
  arrows: (r.arrows ?? []).map(arrowFromStored),
});
const toFile = (l: Layout): StoredRoutine => {
  const out: StoredRoutine = { routineId: l.routineId, displayName: l.displayName, category: l.category, spotMarkers: l.spotMarkers, ballPlacements: [] };
  if (l.notes.trim()) out.notes = l.notes.trim();
  out.ballPlacements = l.balls.map(toStored);
  if (l.arrows.length) out.arrows = l.arrows.map(arrowToStored);
  return out;
};
/** Two layouts that would write the same file text are the same, whatever the float noise. */
const sameAs = (a: Layout, b: Layout) => JSON.stringify(toFile(a)) === JSON.stringify(toFile(b));


// ------------------------------------------------------------------ drafts and undo
type History = { past: Layout[]; future: Layout[] };
type State = { drafts: Record<string, Layout>; history: Record<string, History> };
type Action =
  | { type: "change"; id: string; base: Layout; next: Layout; record: boolean }
  | { type: "undo" | "redo"; id: string; base: Layout }
  | { type: "saved"; ids: string[] }
  | { type: "drop-all" }
  | { type: "restore"; drafts: Record<string, Layout> };

const EMPTY: History = { past: [], future: [] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "change": {
      const current = state.drafts[action.id] ?? action.base;
      const h = state.history[action.id] ?? EMPTY;
      return {
        drafts: { ...state.drafts, [action.id]: action.next },
        history: action.record ? { ...state.history, [action.id]: { past: [...h.past.slice(-99), current], future: [] } } : state.history,
      };
    }
    case "undo":
    case "redo": {
      const h = state.history[action.id] ?? EMPTY;
      const from = action.type === "undo" ? h.past : h.future;
      if (!from.length) return state;
      const current = state.drafts[action.id] ?? action.base;
      const target = from[from.length - 1];
      const rest = from.slice(0, -1);
      return {
        drafts: { ...state.drafts, [action.id]: target },
        history: {
          ...state.history,
          [action.id]: action.type === "undo" ? { past: rest, future: [...h.future, current] } : { past: [...h.past, current], future: rest },
        },
      };
    }
    case "saved": {
      const drafts = { ...state.drafts };
      action.ids.forEach((id) => delete drafts[id]);
      return { ...state, drafts };
    }
    case "drop-all":
      return { drafts: {}, history: {} };
    case "restore":
      return { drafts: action.drafts, history: {} };
  }
}

type View =
  | { kind: "checklist" }
  | { kind: "builder"; id: string | null }
  | { kind: "new" }
  | { kind: "view"; id: string }
  | { kind: "edit"; id: string };

/**
 * #routines is the checklist, #routines/view/<id> one routine's page, #routines/edit/<id> its
 * write-up, #routines/<id> its table in the builder, and #routines/new the form for a new one.
 */
const viewFromHash = (): View => {
  const [page, first, second] = window.location.hash.replace("#", "").split("/");
  if (page !== "routines" || !first) return { kind: "checklist" };
  if (first === "new") return { kind: "new" };
  if ((first === "view" || first === "edit") && second) return { kind: first, id: decodeURIComponent(second) };
  if (first === "builder") return { kind: "builder", id: null };
  return { kind: "builder", id: decodeURIComponent(first) };
};
const go = (path: string) => {
  window.location.hash = path ? `routines/${path}` : "routines";
};


/**
 * Every routine in the app: a checklist of what's done and what's left, the builder for their
 * ball layouts, and a form to add new ones. Everything saves straight into the app's files.
 */
export function Routines() {
  const dialog = useDialog();
  const [file, setFile] = useState<FileData | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [state, dispatch] = useReducer(reducer, { drafts: {}, history: {} });
  const [view, setView] = useState<View>(viewFromHash);
  const [lastBuilt, setLastBuilt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pictureStamp, setPictureStamp] = useState(() => Date.now());
  const [toast, setToast] = useState<{ text: string; tone?: "warn" } | null>(null);

  const load = useCallback(async (): Promise<FileData | null> => {
    try {
      const res = await fetch("/__admin/routines", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't load the layouts (${res.status}).`);
      const next: FileData = { version: body.version, file: body.file, layouts: (body.routines as StoredRoutine[]).map(toLayout), images: body.images };
      setFile(next);
      setLoadError(null);
      return next;
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
      return null;
    }
  }, []);

  const loadLibrary = useCallback(async () => {
    try {
      const res = await fetch("/__admin/library", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't load the routines (${res.status}).`);
      setLibrary(body as Library);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : String(error));
    }
  }, []);

  // Load, then bring back any unsaved work from last time (kept in this browser only).
  useEffect(() => {
    void loadLibrary();
    void load().then((loaded) => {
      if (!loaded) return;
      try {
        const raw = localStorage.getItem(DRAFTS_KEY);
        if (!raw) return;
        const kept = JSON.parse(raw) as Record<string, Layout>;
        const known = new Set(loaded.layouts.map((l) => l.routineId));
        // Drafts saved before arrows existed have none, rather than no list at all.
        const drafts = Object.fromEntries(
          Object.entries(kept)
            .filter(([id]) => known.has(id))
            .map(([id, draft]) => [id, { ...draft, arrows: draft.arrows ?? [] }])
        );
        if (Object.keys(drafts).length) {
          dispatch({ type: "restore", drafts });
          setToast({ text: `Brought back unsaved changes to ${Object.keys(drafts).length} ${Object.keys(drafts).length === 1 ? "routine" : "routines"}.` });
        }
      } catch {
        // Nothing kept, or storage is off. Either way there's nothing to restore.
      }
    });
  }, [load, loadLibrary]);

  useEffect(() => {
    const onHash = () => setView(viewFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  useEffect(() => {
    if (view.kind === "builder" && view.id) setLastBuilt(view.id);
    window.scrollTo({ top: 0 });
  }, [view]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.tone === "warn" ? 6000 : 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const savedById = useMemo(() => new Map((file?.layouts ?? []).map((l) => [l.routineId, l])), [file]);
  const dirtyIds = useMemo(
    () => Object.keys(state.drafts).filter((id) => savedById.has(id) && !sameAs(state.drafts[id], savedById.get(id)!)),
    [state.drafts, savedById]
  );

  useEffect(() => {
    try {
      const keep = Object.fromEntries(dirtyIds.map((id) => [id, state.drafts[id]]));
      if (dirtyIds.length) localStorage.setItem(DRAFTS_KEY, JSON.stringify(keep));
      else localStorage.removeItem(DRAFTS_KEY);
    } catch {
      // Storage off: drafts just won't survive a reload.
    }
  }, [dirtyIds, state.drafts]);

  useEffect(() => {
    if (!dirtyIds.length) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirtyIds.length]);

  const entries = useMemo(
    () => (library && file ? buildEntries(library, savedById, state.drafts, file.images, new Set(dirtyIds)) : []),
    [library, file, savedById, state.drafts, dirtyIds]
  );

  const editable = useMemo(
    () =>
      (file?.layouts ?? [])
        .filter((l) => l.category !== "fundamentals")
        .sort((a, b) => CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category)),
    [file]
  );
  const techniqueCount = (file?.layouts.length ?? 0) - editable.length;
  const wanted = view.kind === "builder" ? view.id ?? lastBuilt : lastBuilt;
  const currentId = wanted && savedById.has(wanted) ? wanted : editable[0]?.routineId ?? null;
  const base = currentId ? savedById.get(currentId) ?? null : null;
  const layout = currentId ? state.drafts[currentId] ?? base : null;
  const history = (currentId && state.history[currentId]) || EMPTY;
  const draftIds = new Set((library?.routines ?? []).filter((r) => !r.inApp).map((r) => r.id));
  const addedIds = new Set((library?.routines ?? []).filter((r) => !r.builtIn).map((r) => r.id));

  const save = useCallback(async () => {
    if (!file || !dirtyIds.length || saving) return;
    setSaving(true);
    const attempt = async (onto: FileData) => {
      const routines = onto.layouts.map((l) => toFile(dirtyIds.includes(l.routineId) ? state.drafts[l.routineId] : l));
      const res = await fetch("/__admin/routines", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: onto.version, routines }),
      });
      return { res, body: await res.json() };
    };
    try {
      const { res, body } = await attempt(file);
      if (res.status === 409) {
        setSaving(false);
        dialog.confirm({
          title: "The layouts file changed",
          message: `Someone (or another tab, or your editor) changed ${file.file} since this page loaded. Save over it? Only the ${dirtyIds.length === 1 ? "routine" : `${dirtyIds.length} routines`} you changed here get replaced; the rest keep what's in the file now.`,
          confirmLabel: "Save over it",
          onConfirm: () => {
            void (async () => {
              setSaving(true);
              const fresh = await load();
              if (fresh) {
                const retry = await attempt(fresh);
                if (retry.res.ok) {
                  dispatch({ type: "saved", ids: dirtyIds });
                  await load();
                  setToast({ text: `Saved ${dirtyIds.length} ${dirtyIds.length === 1 ? "routine" : "routines"} to the app.` });
                } else setToast({ text: retry.body.error ?? "Couldn't save.", tone: "warn" });
              }
              setSaving(false);
            })();
          },
        });
        return;
      }
      if (!res.ok) throw new Error(body.error ?? `Couldn't save (${res.status}).`);
      const count = dirtyIds.length;
      dispatch({ type: "saved", ids: dirtyIds });
      await load();
      setToast({ text: `Saved ${count} ${count === 1 ? "layout" : "layouts"} to the app. They're in the next build.` });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : String(error), tone: "warn" });
    }
    setSaving(false);
  }, [file, dirtyIds, saving, state.drafts, dialog, load]);

  const discardAll = () =>
    dialog.confirm({
      title: "Drop all unsaved changes?",
      message: `This puts ${dirtyIds.length === 1 ? "1 routine" : `${dirtyIds.length} routines`} back to what's saved in the app.`,
      confirmLabel: "Drop changes",
      tone: "danger",
      onConfirm: () => dispatch({ type: "drop-all" }),
    });

  const changeChecklist = async (change: { id: string; done?: string | null; note?: string }, message: string) => {
    setBusyId(change.id);
    try {
      const res = await fetch("/__admin/checklist", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(change) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't save (${res.status}).`);
      setLibrary((lib) => (lib ? { ...lib, checklist: body.checklist as Record<string, SignOff> } : lib));
      setToast({ text: message });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : String(error), tone: "warn" });
    }
    setBusyId(null);
  };

  const putInApp = async (id: string) => {
    const routine = library?.routines.find((r) => r.id === id);
    if (!routine) return;
    setBusyId(id);
    try {
      const res = await fetch("/__admin/routine", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ routine: { ...routine, inApp: true } }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't save (${res.status}).`);
      await Promise.all([loadLibrary(), load()]);
      setToast({ text: `${routine.name} is in the app now. Players get it with the next build.` });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : String(error), tone: "warn" });
    }
    setBusyId(null);
  };

  /** A new photo or reference picture, saved into assets/routines and pointed at from the app. */
  const uploadPicture = async (id: string, picture: File) => {
    try {
      const res = await fetch(`/__admin/routine-image?id=${encodeURIComponent(id)}`, {
        method: "POST",
        headers: { "Content-Type": picture.type || "image/png" },
        body: picture,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't save the picture (${res.status}).`);
      await load();
      setPictureStamp(Date.now());
      setToast({
        text: body.replaced
          ? `Picture saved as ${body.file}. The old one, ${body.replaced}, is still there if you want to delete it.`
          : `Picture saved as ${body.file}. The app shows it from the next build.`,
      });
    } catch (error) {
      setToast({ text: error instanceof Error ? error.message : String(error), tone: "warn" });
    }
  };

  if (loadError && (!file || !library)) {
    return (
      <>
        <header className="page-head">
          <h1 className="page-title">Routines</h1>
        </header>
        <div className="card error-card">
          {loadError} The Routines page reads the app's files through the dashboard's own server, so restart <code>npm run dev</code> in
          apps/admin if you've just updated it.
        </div>
      </>
    );
  }
  if (!file || !library) {
    return (
      <header className="page-head">
        <div>
          <h1 className="page-title">Routines</h1>
          <p className="muted">Loading…</p>
        </div>
      </header>
    );
  }

  const tab = view.kind === "view" || view.kind === "edit" ? "checklist" : view.kind;
  const groups = CATEGORY_ORDER.map((cat) => ({ cat, items: editable.filter((l) => l.category === cat) })).filter((g) => g.items.length);
  const editing = view.kind === "edit" ? library.routines.find((r) => r.id === view.id) ?? null : null;
  const viewing = view.kind === "view" ? entries.find((e) => e.id === view.id) ?? null : null;
  const sectionName = (id: string) => library.categories.find((c) => c.id === id)?.name ?? id;
  const signOff = (id: string, yes: boolean) =>
    void changeChecklist({ id, done: yes ? today() : null }, yes ? `Signed off ${entries.find((e) => e.id === id)?.name}.` : "Sign-off cleared.");
  const saveNote = (id: string, note: string) => void changeChecklist({ id, note }, note.trim() ? "Note saved." : "Note removed.");
  const done = entries.filter((e) => e.status === "done").length;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Routines</h1>
          <p className="muted">
            {done} of {entries.length} done · {entries.filter((e) => e.status === "todo").length} still to do. Everything here saves into the app's files, so it ships with
            the next app build.
          </p>
        </div>
        <div className="row-actions">
          {dirtyIds.length ? (
            <button type="button" className="btn" onClick={discardAll} disabled={saving}>
              Drop changes
            </button>
          ) : null}
          {dirtyIds.length || view.kind === "builder" ? (
            <button type="button" className="btn btn-primary" onClick={() => void save()} disabled={!dirtyIds.length || saving}>
              {saving ? "Saving…" : dirtyIds.length ? `Save ${dirtyIds.length} ${dirtyIds.length === 1 ? "layout" : "layouts"}` : "Layouts saved"}
            </button>
          ) : null}
        </div>
      </header>

      <div className="segmented rt-tabs" role="tablist" aria-label="Routines">
        {(
          [
            ["checklist", "Checklist", ""],
            ["builder", "Table builder", currentId ? currentId : "builder"],
            ["new", "Add a routine", "new"],
          ] as const
        ).map(([key, label, path]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => go(path)}>
            {label}
          </button>
        ))}
      </div>

      {view.kind === "checklist" ? (
        <Checklist
          entries={entries}
          categories={library.categories}
          paused={library.paused}
          checklistFile={library.files.checklist}
          busyId={busyId}
          onOpenBuilder={(id) => go(encodeURIComponent(id))}
          onView={(id) => go(`view/${encodeURIComponent(id)}`)}
          onAdd={() => go("new")}
          onSignOff={signOff}
          onNote={saveNote}
          onPutInApp={(id) => void putInApp(id)}
        />
      ) : null}

      {view.kind === "view" ? (
        viewing ? (
          <RoutineView
            key={viewing.id}
            entry={viewing}
            section={sectionName(viewing.categoryId)}
            savedLayout={savedById.get(viewing.id) ?? null}
            pictureStamp={pictureStamp}
            busy={busyId === viewing.id}
            onBack={() => go("")}
            onEdit={() => go(`edit/${encodeURIComponent(viewing.id)}`)}
            onOpenBuilder={() => go(encodeURIComponent(viewing.id))}
            onSignOff={(yes) => signOff(viewing.id, yes)}
            onNote={(note) => saveNote(viewing.id, note)}
            onPutInApp={() => void putInApp(viewing.id)}
            onPicture={(picture) => uploadPicture(viewing.id, picture)}
          />
        ) : (
          <div className="card empty">There's no routine called {view.id} any more.</div>
        )
      ) : null}

      {view.kind === "new" || view.kind === "edit" ? (
        view.kind === "edit" && !editing ? (
          <div className="card empty">There's no routine called {view.id} any more.</div>
        ) : (
          <RoutineForm
            key={view.kind === "edit" ? view.id : "new"}
            existing={editing}
            layout={editing ? state.drafts[editing.id] ?? savedById.get(editing.id) ?? null : null}
            image={editing ? file.images[editing.id] ?? null : null}
            categories={library.categories}
            routinesFile={library.files.routines}
            onSaved={(routine: RoutineRecord, created) => {
              void Promise.all([loadLibrary(), load()]).then(() => {
                go(`view/${encodeURIComponent(routine.id)}`);
                setToast({
                  text: created
                    ? `${routine.name} is saved as a draft. ${routine.content_type === "guide" ? "Add its photo" : "Place its balls"}, then put it in the app.`
                    : `Saved ${routine.name}. Players see it with the next app build.`,
                });
              });
            }}
            onDeleted={() => {
              void Promise.all([loadLibrary(), load()]).then(() => {
                go("");
                setToast({ text: "Draft deleted." });
              });
            }}
            onCancel={() => go(editing ? `view/${encodeURIComponent(editing.id)}` : "")}
          />
        )
      ) : null}

      {view.kind === "builder" && layout && base && currentId ? (
        <div className="rb">
          <nav className="rb-list card" aria-label="Routines">
            <label className="rb-picker field">
              <span>Routine</span>
              <select value={currentId} onChange={(event) => go(encodeURIComponent(event.target.value))}>
                {groups.map((g) => (
                  <optgroup key={g.cat} label={CATEGORY_LABEL[g.cat] ?? g.cat}>
                    {g.items.map((l) => (
                      <option key={l.routineId} value={l.routineId}>
                        {l.displayName}
                        {draftIds.has(l.routineId) ? " (draft)" : ""}
                        {dirtyIds.includes(l.routineId) ? " • unsaved" : ""}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="rb-groups">
              {groups.map((g) => (
                <div key={g.cat} className="rb-group">
                  <p className="rb-cat">{CATEGORY_LABEL[g.cat] ?? g.cat}</p>
                  {g.items.map((l) => {
                    const shown = state.drafts[l.routineId] ?? l;
                    const dirty = dirtyIds.includes(l.routineId);
                    const empty = needsLayout(shown, addedIds.has(l.routineId));
                    return (
                      <button
                        key={l.routineId}
                        type="button"
                        className={l.routineId === currentId ? "rb-item active" : "rb-item"}
                        aria-current={l.routineId === currentId ? "page" : undefined}
                        onClick={() => go(encodeURIComponent(l.routineId))}
                      >
                        <span className="rb-item-name">
                          {l.displayName}
                          {draftIds.has(l.routineId) ? <span className="rb-draft"> draft</span> : null}
                        </span>
                        <span className="rb-item-meta">
                          {dirty ? <span className="rb-dot" title="Unsaved changes" aria-label="Unsaved changes" /> : null}
                          {empty ? <span className="rb-todo">To do</span> : <span className="rb-count">{shown.balls.length}</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
            {techniqueCount ? (
              <p className="rb-foot">{techniqueCount} technique guides (grip, stance…) use photos, not a table, so they aren't here.</p>
            ) : null}
          </nav>

          <RoutineEditor
            key={currentId}
            layout={layout}
            saved={base}
            image={file.images[currentId] ?? null}
            dirty={dirtyIds.includes(currentId)}
            canUndo={history.past.length > 0}
            canRedo={history.future.length > 0}
            onChange={(next, record) => dispatch({ type: "change", id: currentId, base, next, record })}
            onUndo={() => dispatch({ type: "undo", id: currentId, base })}
            onRedo={() => dispatch({ type: "redo", id: currentId, base })}
            onSave={() => void save()}
            onToast={(text) => setToast({ text })}
          />
        </div>
      ) : null}

      {toast ? (
        <div className={toast.tone === "warn" ? "toast toast-warn" : "toast"} role="status">
          {toast.text}
        </div>
      ) : null}
    </>
  );
}
