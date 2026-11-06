import { useMemo, useState, type FormEvent } from "react";
import { useDialog } from "../dialog";
import { GUIDE_SECTION, LEVEL, SCORING, SECTIONS, needsLayout, writeUpGaps, youtubeId, type Category, type Difficulty, type Scoring, type StoredRoutine } from "./library";
import type { Layout } from "./RoutineEditor";

type Props = {
  existing: StoredRoutine | null;
  layout: Layout | null;
  /** The routine's picture, if it has one: a technique guide needs its photo to go in the app. */
  image: string | null;
  categories: Category[];
  routinesFile: string;
  onSaved: (routine: StoredRoutine, created: boolean) => void;
  onDeleted: () => void;
  onCancel: () => void;
};

type Form = {
  guide: boolean;
  name: string;
  category_id: string;
  icon: string;
  difficulty: Difficulty;
  summary: string;
  description: string;
  setup_instructions: string;
  steps: string[];
  success_criteria: string;
  improves: string;
  scoring_type: Scoring;
  max_score: string;
  minutes: string;
  video: string;
  videoTitle: string;
  videoChannel: string;
  alt: string;
  altTitle: string;
  altChannel: string;
  inApp: boolean;
};

const fromRoutine = (r: StoredRoutine | null, categories: Category[]): Form => ({
  guide: r?.content_type === "guide",
  name: r?.name ?? "",
  category_id: r?.category_id ?? SECTIONS[0],
  icon: r?.icon ?? categories.find((c) => c.id === (r?.category_id ?? SECTIONS[0]))?.icon ?? "",
  difficulty: r?.difficulty ?? "intermediate",
  summary: r?.summary ?? "",
  description: r?.description ?? "",
  setup_instructions: r?.setup_instructions ?? "",
  steps: r?.steps?.length ? [...r.steps] : ["", "", ""],
  success_criteria: r?.success_criteria ?? "",
  improves: (r?.improves ?? []).join(", "),
  scoring_type: r?.scoring_type ?? "count",
  max_score: r?.max_score ? String(r.max_score) : "",
  minutes: r?.estimated_duration_minutes ? String(r.estimated_duration_minutes) : "20",
  video: r?.video?.id ?? "",
  videoTitle: r?.video?.title ?? "",
  videoChannel: r?.video?.channel ?? "",
  alt: r?.altVideo?.id ?? "",
  altTitle: r?.altVideo?.title ?? "",
  altChannel: r?.altVideo?.channel ?? "",
  inApp: r?.inApp ?? false,
});

const splitList = (text: string) =>
  text
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

/**
 * Write a new routine, or edit any routine's write-up. A new one goes in the app only when you
 * switch it on; the ones the app came with stay in it.
 */
export function RoutineForm({ existing, layout, image, categories, routinesFile, onSaved, onDeleted, onCancel }: Props) {
  const dialog = useDialog();
  const [initial] = useState(() => fromRoutine(existing, categories));
  const [form, setForm] = useState<Form>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAlt, setShowAlt] = useState(Boolean(existing?.altVideo));
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const sections = categories.filter((c) => SECTIONS.includes(c.id)).sort((a, b) => a.order_index - b.order_index);
  const minutes = Number(form.minutes);
  const gaps = useMemo(
    () =>
      writeUpGaps({
        content_type: form.guide ? "guide" : undefined,
        summary: form.summary,
        description: form.description,
        setup_instructions: form.setup_instructions,
        steps: form.steps,
        success_criteria: form.success_criteria,
        improves: splitList(form.improves),
        estimated_duration_minutes: Number.isInteger(minutes) ? minutes : 0,
      }),
    [form, minutes]
  );
  const builtIn = Boolean(existing?.builtIn);
  const hasBalls = form.guide ? Boolean(image) : Boolean(layout && !needsLayout(layout, !builtIn));
  const videoId = form.video.trim() ? youtubeId(form.video) : null;
  const altId = form.alt.trim() ? youtubeId(form.alt) : null;
  const canGoInApp = !gaps.length && (hasBalls || Boolean(existing?.inApp));

  const build = (inApp: boolean): StoredRoutine | string => {
    if (!form.name.trim()) return "Give it a name.";
    if (form.video.trim() && !videoId) return "That video link doesn't look like YouTube. Paste the watch link or the 11-character id.";
    if (videoId && !form.videoTitle.trim()) return "Give the video its title, as it's shown on YouTube.";
    if (form.alt.trim() && !altId) return "The second video link doesn't look like YouTube.";
    if (altId && !form.altTitle.trim()) return "Give the second video its title.";
    if (altId && !videoId) return "Add the main video before a second one.";
    const max = form.max_score.trim() ? Number(form.max_score) : undefined;
    if (max !== undefined && !(max > 0)) return "The top score should be a number above 0, or left empty.";
    if (form.minutes.trim() && !(Number.isInteger(minutes) && minutes > 0 && minutes <= 240)) return "Minutes should be a whole number from 1 to 240.";
    return {
      id: existing?.id ?? "routine-new",
      inApp: builtIn ? true : inApp,
      builtIn: existing?.builtIn,
      content_type: form.guide ? "guide" : undefined,
      category_id: form.guide ? GUIDE_SECTION : form.category_id,
      name: form.name.trim(),
      icon: form.icon.trim() || undefined,
      difficulty: form.difficulty,
      summary: form.summary,
      description: form.description,
      setup_instructions: form.setup_instructions,
      steps: form.steps,
      success_criteria: form.success_criteria,
      improves: splitList(form.improves),
      scoring_type: form.scoring_type,
      max_score: form.scoring_type === "time" ? undefined : max,
      estimated_duration_minutes: form.minutes.trim() ? minutes : undefined,
      video: videoId ? { id: videoId, title: form.videoTitle, channel: form.videoChannel } : undefined,
      altVideo: altId ? { id: altId, title: form.altTitle, channel: form.altChannel } : undefined,
    };
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const routine = build(form.inApp);
    if (typeof routine === "string") {
      setError(routine);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/__admin/routine", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ routine, create: !existing }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `Couldn't save (${res.status}).`);
      onSaved(body.routine as StoredRoutine, !existing);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    setSaving(false);
  };

  const cancel = () => {
    if (!dirty) return onCancel();
    dialog.confirm({ title: "Leave without saving?", message: "What you've written here hasn't been saved.", confirmLabel: "Leave", tone: "danger", onConfirm: onCancel });
  };

  const remove = () =>
    dialog.confirm({
      title: `Delete ${existing?.name}?`,
      message: "This removes the draft, its table layout and any note. It was never in the app, so players won't notice. Any picture you added stays in assets/routines.",
      confirmLabel: "Delete draft",
      tone: "danger",
      onConfirm: () => {
        void (async () => {
          const res = await fetch("/__admin/routine", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: existing?.id }) });
          const body = await res.json();
          if (res.ok) onDeleted();
          else setError(body.error ?? "Couldn't delete it.");
        })();
      },
    });

  const moveStep = (from: number, to: number) =>
    setForm((f) => {
      const steps = [...f.steps];
      const [step] = steps.splice(from, 1);
      steps.splice(to, 0, step);
      return { ...f, steps };
    });

  return (
    <form className="rf" onSubmit={submit}>
      <div className="rf-main">
        <section className="card">
          <h2 className="section-title">The routine</h2>
          {!existing ? (
            <div className="field">
              <span>Kind</span>
              <div className="segmented" role="radiogroup" aria-label="Kind">
                <button type="button" role="radio" aria-checked={!form.guide} onClick={() => set("guide", false)}>
                  Table drill
                </button>
                <button type="button" role="radio" aria-checked={form.guide} onClick={() => setForm((f) => ({ ...f, guide: true, icon: f.icon || "🎯" }))}>
                  Technique guide
                </button>
              </div>
              <span className="muted small">{form.guide ? "Taught with a photo, like grip or stance. It goes in the Fundamentals Library." : "Played on the table, with the balls placed in the builder."}</span>
            </div>
          ) : null}
          <div className="rf-row">
            <label className="field rf-grow">
              <span>Name</span>
              <input value={form.name} maxLength={80} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Pink and black clearance" autoFocus={!existing} />
            </label>
            <label className="field rf-icon">
              <span>Icon</span>
              <input value={form.icon} maxLength={8} onChange={(e) => set("icon", e.target.value)} aria-describedby="rf-icon-hint" />
            </label>
          </div>
          <p id="rf-icon-hint" className="muted small rf-hint-tight">
            One emoji, shown next to the name in the app.
          </p>
          <div className="rf-row">
            {form.guide ? (
              <div className="field rf-grow">
                <span>Section in the app</span>
                <p className="rf-fixed">{categories.find((c) => c.id === GUIDE_SECTION)?.name ?? "Fundamentals Library"}</p>
              </div>
            ) : (
            <label className="field rf-grow">
              <span>Section in the app</span>
              <select
                className="rf-select"
                value={form.category_id}
                onChange={(e) => {
                  const next = e.target.value;
                  const oldIcon = categories.find((c) => c.id === form.category_id)?.icon;
                  setForm((f) => ({ ...f, category_id: next, icon: !f.icon || f.icon === oldIcon ? categories.find((c) => c.id === next)?.icon ?? f.icon : f.icon }));
                }}
              >
                {sections.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            )}
            <div className="field">
              <span>Level</span>
              <div className="segmented" role="radiogroup" aria-label="Level">
                {(Object.keys(LEVEL) as Difficulty[]).map((level) => (
                  <button key={level} type="button" role="radio" aria-checked={form.difficulty === level} onClick={() => set("difficulty", level)}>
                    {LEVEL[level]}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <label className="field">
            <span>Summary</span>
            <textarea rows={2} value={form.summary} onChange={(e) => set("summary", e.target.value)} placeholder="One or two lines, shown on the routine's card." />
          </label>
          <label className="field">
            <span>
              About it {form.guide ? null : <em className="rf-optional">optional</em>}
            </span>
            <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Why it matters and what it trains." />
          </label>
        </section>

        <section className="card">
          <h2 className="section-title">How to play it</h2>
          <label className="field">
            <span>Setup</span>
            <textarea rows={3} value={form.setup_instructions} onChange={(e) => set("setup_instructions", e.target.value)} placeholder="Where the balls go and where the cue ball starts. You'll place them on the table in the builder too." />
          </label>
          <div className="field">
            <span>Steps</span>
            <ol className="rf-steps">
              {form.steps.map((step, i) => (
                <li key={i}>
                  <span className="rf-step-n" aria-hidden="true">
                    {i + 1}
                  </span>
                  <textarea
                    rows={2}
                    value={step}
                    aria-label={`Step ${i + 1}`}
                    onChange={(e) => setForm((f) => ({ ...f, steps: f.steps.map((s, j) => (j === i ? e.target.value : s)) }))}
                  />
                  <span className="rf-step-tools">
                    <button type="button" className="rb-del" aria-label={`Move step ${i + 1} up`} disabled={i === 0} onClick={() => moveStep(i, i - 1)}>
                      ↑
                    </button>
                    <button type="button" className="rb-del" aria-label={`Move step ${i + 1} down`} disabled={i === form.steps.length - 1} onClick={() => moveStep(i, i + 1)}>
                      ↓
                    </button>
                    <button type="button" className="rb-del" aria-label={`Remove step ${i + 1}`} onClick={() => setForm((f) => ({ ...f, steps: f.steps.filter((_, j) => j !== i) }))}>
                      ✕
                    </button>
                  </span>
                </li>
              ))}
            </ol>
            {form.steps.length < 20 ? (
              <button type="button" className="link-btn" onClick={() => setForm((f) => ({ ...f, steps: [...f.steps, ""] }))}>
                + Add a step
              </button>
            ) : null}
          </div>
          <label className="field">
            <span>What it improves</span>
            <input value={form.improves} onChange={(e) => set("improves", e.target.value)} placeholder="Cue ball control, Touch, Break building" />
          </label>
          <p className="muted small rf-hint-tight">Separate them with commas.</p>
        </section>

        <section className="card">
          <h2 className="section-title">Scoring</h2>
          <label className="field">
            <span>How it's scored</span>
            <textarea rows={2} value={form.success_criteria} onChange={(e) => set("success_criteria", e.target.value)} placeholder="e.g. Count the clearances you finish in 20 minutes." />
          </label>
          <div className="rf-row">
            <label className="field">
              <span>Score type</span>
              <select className="rf-select" value={form.scoring_type} onChange={(e) => set("scoring_type", e.target.value as Scoring)}>
                {(Object.keys(SCORING) as Scoring[]).map((s) => (
                  <option key={s} value={s}>
                    {SCORING[s]}
                  </option>
                ))}
              </select>
            </label>
            {form.scoring_type !== "time" ? (
              <label className="field">
                <span>
                  Top score <em className="rf-optional">optional</em>
                </span>
                <input inputMode="numeric" value={form.max_score} onChange={(e) => set("max_score", e.target.value)} placeholder="e.g. 147" />
              </label>
            ) : null}
            <label className="field">
              <span>Minutes</span>
              <input inputMode="numeric" value={form.minutes} onChange={(e) => set("minutes", e.target.value)} />
            </label>
          </div>
        </section>

        <section className="card">
          <h2 className="section-title">Video</h2>
          <p className="muted small rf-hint-tight">Optional, but most routines have one. Check the video plays before adding it.</p>
          <VideoFields label="YouTube link" id={form.video} title={form.videoTitle} channel={form.videoChannel} parsed={videoId} onChange={(k, v) => set(k === "id" ? "video" : k === "title" ? "videoTitle" : "videoChannel", v)} />
          {showAlt ? (
            <VideoFields label="Second video" id={form.alt} title={form.altTitle} channel={form.altChannel} parsed={altId} onChange={(k, v) => set(k === "id" ? "alt" : k === "title" ? "altTitle" : "altChannel", v)} />
          ) : (
            <button type="button" className="link-btn" onClick={() => setShowAlt(true)}>
              + Add a second video
            </button>
          )}
        </section>
      </div>

      <aside className="rf-side">
        <section className="card rf-ready">
          <h2 className="section-title">{builtIn || existing?.inApp ? "Checks" : "Before it goes in the app"}</h2>
          <ul className="rf-checks">
            <li className={gaps.length ? "" : "ok"}>
              <span className="ck-mark" aria-hidden="true">
                {gaps.length ? "✕" : "✓"}
              </span>
              <span>{gaps.length ? `The write-up needs ${gaps.join(", ")}.` : "The write-up is complete."}</span>
            </li>
            <li className={hasBalls ? "ok" : ""}>
              <span className="ck-mark" aria-hidden="true">
                {hasBalls ? "✓" : "✕"}
              </span>
              <span>
                {form.guide
                  ? hasBalls
                    ? "It has its photo."
                    : existing
                      ? "Add its photo from the routine's page."
                      : "Save it, then add its photo from the routine's page."
                  : hasBalls
                    ? "The balls are placed."
                    : existing
                      ? "Place the balls in the builder (and save them)."
                      : "Save it, then place the balls in the builder."}
              </span>
            </li>
          </ul>
          {builtIn ? (
            <p className="muted small">This routine came with the app and other parts of the app use it, so it stays in. Players see your changes with the next app build, and the write-up has to stay complete.</p>
          ) : (
          <label className={canGoInApp ? "rf-toggle" : "rf-toggle off"}>
            <input type="checkbox" checked={form.inApp} disabled={!canGoInApp && !form.inApp} onChange={(e) => set("inApp", e.target.checked)} />
            <span>
              <strong>Show it in the app</strong>
              <span className="muted small">{form.inApp ? "Players get it with the next app build." : "Until then it's a draft only you can see."}</span>
            </span>
          </label>
          )}
          {error ? (
            <p className="rb-warn" role="alert">
              {error}
            </p>
          ) : null}
          <div className="rf-buttons">
            <button type="submit" className="btn btn-primary" disabled={saving || (!dirty && Boolean(existing))}>
              {saving ? "Saving…" : existing ? "Save changes" : "Save draft"}
            </button>
            <button type="button" className="btn" onClick={cancel}>
              Cancel
            </button>
          </div>
          <p className="muted small">
            Saves into <code>{routinesFile}</code>.
          </p>
          {existing && !existing.inApp && !builtIn ? (
            <button type="button" className="btn btn-sm btn-danger-ghost" onClick={remove}>
              Delete this draft
            </button>
          ) : null}
        </section>
      </aside>
    </form>
  );
}

function VideoFields({ label, id, title, channel, parsed, onChange }: { label: string; id: string; title: string; channel: string; parsed: string | null; onChange: (key: "id" | "title" | "channel", value: string) => void }) {
  return (
    <div className="rf-video">
      <label className="field">
        <span>{label}</span>
        <input value={id} onChange={(e) => onChange("id", e.target.value)} placeholder="https://www.youtube.com/watch?v=…" spellCheck={false} />
      </label>
      {id.trim() ? (
        parsed ? (
          <a className="rf-video-check" href={`https://www.youtube.com/watch?v=${parsed}`} target="_blank" rel="noreferrer">
            <img src={`https://i.ytimg.com/vi/${parsed}/mqdefault.jpg`} alt="" width={96} height={54} />
            <span>Video {parsed}. Open it to check it plays.</span>
          </a>
        ) : (
          <p className="error-text small">That doesn't look like a YouTube link.</p>
        )
      ) : null}
      <div className="rf-row">
        <label className="field rf-grow">
          <span>Title</span>
          <input value={title} onChange={(e) => onChange("title", e.target.value)} />
        </label>
        <label className="field rf-grow">
          <span>Channel</span>
          <input value={channel} onChange={(e) => onChange("channel", e.target.value)} />
        </label>
      </div>
    </div>
  );
}
