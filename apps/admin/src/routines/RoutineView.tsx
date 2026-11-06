import { useEffect, useRef, useState } from "react";
import { LEVEL, SCORING, needsLayout, shortDate, type Entry, type Part } from "./library";
import type { Layout } from "./RoutineEditor";
import { TableView, tableToPng } from "./TableView";

type Props = {
  entry: Entry;
  section: string;
  /** The layout as saved in the app's file (not any unsaved builder changes). */
  savedLayout: Layout | null;
  /** Bumped after a new picture is saved, so the same file path shows the new picture. */
  pictureStamp: number;
  busy: boolean;
  onBack: () => void;
  onEdit: () => void;
  onOpenBuilder: () => void;
  onSignOff: (done: boolean) => void;
  onNote: (note: string) => void;
  onPutInApp: () => void;
  onPicture: (file: File) => Promise<void>;
};

const MARK: Record<Part["state"], string> = { ok: "✓", missing: "✕", warn: "!", optional: "–" };
const STATUS = { done: { label: "Done", tone: "pill-good" }, ready: { label: "Ready to check", tone: "pill-brass" }, todo: { label: "Still to do", tone: "pill-bad" } };

/** One routine, everything about it: the write-up as players read it, its picture and its checks. */
export function RoutineView({ entry, section, savedLayout, pictureStamp, busy, onBack, onEdit, onOpenBuilder, onSignOff, onNote, onPutInApp, onPicture }: Props) {
  const r = entry.routine;
  const [enlarged, setEnlarged] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(entry.signOff.note ?? "");
  const fileInput = useRef<HTMLInputElement>(null);
  const tableRef = useRef<SVGSVGElement>(null);
  const hasTable = Boolean(!entry.guide && savedLayout && !needsLayout(savedLayout, entry.added));
  const picture = entry.image ? `${entry.image}?v=${pictureStamp}` : null;
  const pictureName = entry.guide ? "Photo" : "Reference picture";
  const complete = entry.status !== "todo";

  useEffect(() => setNote(entry.signOff.note ?? ""), [entry.signOff.note]);

  useEffect(() => {
    if (!enlarged) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setEnlarged(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enlarged]);

  const fromTable = async () => {
    if (!tableRef.current) return;
    setUploading(true);
    try {
      const png = await tableToPng(tableRef.current);
      await onPicture(new File([png], "layout.png", { type: "image/png" }));
    } finally {
      setUploading(false);
    }
  };

  const choose = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    await onPicture(file);
    setUploading(false);
    if (fileInput.current) fileInput.current.value = "";
  };

  return (
    <div className="rv">
      <button type="button" className="link-btn rv-back" onClick={onBack}>
        ← Back to the checklist
      </button>

      <header className="rv-head">
        <div className="ck-name">
          <span className="ck-icon rv-icon" aria-hidden="true">
            {entry.icon ?? "•"}
          </span>
          <div>
            <h2 className="rv-title">{entry.name}</h2>
            <p className="ck-meta">
              {section} · {LEVEL[entry.difficulty]} · {entry.guide ? "Technique guide" : "Table drill"}
              <span className={`pill ${STATUS[entry.status].tone}`}>{STATUS[entry.status].label}</span>
              {entry.inApp ? <span className="pill">In the app</span> : <span className="pill pill-brass">Draft · not in the app</span>}
            </p>
          </div>
        </div>
        <div className="row-actions">
          {!entry.guide ? (
            <button type="button" className="btn" onClick={onOpenBuilder}>
              {entry.parts[0].state === "missing" ? "Place the balls" : "Open in builder"}
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={onEdit}>
            Edit details
          </button>
        </div>
      </header>

      <div className="rv-grid">
        <div className="rv-main">
          {!entry.guide ? (
            <section className="card rv-picture">
              <div className="rb-panel-head">
                <h3 className="section-title">Table layout</h3>
                <span className="pill pill-good">What players see</span>
              </div>
              {hasTable && savedLayout ? (
                <div className="rv-table">
                  <TableView svgRef={tableRef} layout={savedLayout} label={`Saved table layout for ${entry.name}`} />
                </div>
              ) : (
                <p className="rv-nopicture">No balls placed yet, so the app shows the reference picture or the video instead.</p>
              )}
              {entry.unsaved ? (
                <p className="rb-warn">You have unsaved changes to this layout in the builder. Players only get them after you press Save there.</p>
              ) : (
                <p className="muted small">
                  This is the layout saved in the app, drawn the way the app draws it. Saving in the builder updates it straight away here, and on
                  players' phones with the next app build.
                </p>
              )}
            </section>
          ) : null}

          <section className="card rv-picture">
            <div className="rb-panel-head">
              <h3 className="section-title">{pictureName}</h3>
              <span className="muted small">{entry.guide ? "Shown in the app" : hasTable ? "Not shown in the app while the layout above exists" : "Shown in the app until the balls are placed"}</span>
            </div>
            {!entry.guide ? (
              <p className="muted small rv-ref-note">
                A separate picture file the builder shows for tracing. Saving the layout doesn't change it
                {hasTable ? ", so it can look out of date. Replace it with the layout above to keep them matching." : "."}
              </p>
            ) : null}
            {picture ? (
              <button type="button" className="rv-picture-btn" onClick={() => setEnlarged(true)} aria-label={`Open the ${pictureName.toLowerCase()} full size`}>
                <img src={picture} alt={`${pictureName} for ${entry.name}`} />
                <span className="rv-zoom">View full size</span>
              </button>
            ) : (
              <p className="rv-nopicture">No {pictureName.toLowerCase()} yet.</p>
            )}
            <div className="rv-picture-actions">
              {picture ? (
                <button type="button" className="btn btn-sm" onClick={() => setEnlarged(true)}>
                  Open full size
                </button>
              ) : null}
              {hasTable ? (
                <button type="button" className="btn btn-sm btn-primary" disabled={uploading} onClick={() => void fromTable()}>
                  {uploading ? "Saving…" : "Replace with the table layout"}
                </button>
              ) : null}
              <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => fileInput.current?.click()}>
                {uploading ? "Saving…" : picture ? "Change picture" : "Add a picture"}
              </button>
              <input ref={fileInput} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={(event) => void choose(event.target.files?.[0])} />
              <span className="muted small">PNG, JPEG or WebP, up to 10 MB.{entry.guide ? "" : " Landscape, black end on the left."}</span>
            </div>
          </section>

          <section className="card">
            <h3 className="section-title">Write-up</h3>
            <dl className="ck-writeup rv-writeup">
              <Line term="Summary" text={r.summary} />
              <Line term="About" text={r.description} />
              <Line term="Setup" text={r.setup_instructions} />
              <div>
                <dt>Steps</dt>
                <dd>
                  {r.steps?.length ? (
                    <ol>
                      {r.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  ) : (
                    <span className="rv-empty">None yet</span>
                  )}
                </dd>
              </div>
              <Line term="Scored by" text={r.success_criteria} />
              <Line term="Score" text={`${SCORING[r.scoring_type]}${r.max_score ? `, top score ${r.max_score}` : ""}`} />
              <Line term="Time" text={r.estimated_duration_minutes ? `${r.estimated_duration_minutes} minutes` : undefined} />
              <Line term="Improves" text={r.improves?.length ? r.improves.join(", ") : undefined} />
            </dl>
          </section>
        </div>

        <aside className="rv-side">
          <section className="card">
            <h3 className="section-title">Checklist</h3>
            <ul className="rv-parts">
              {entry.parts.map((part) => (
                <li key={part.key} className={`ck-part ck-part-${part.state}`}>
                  <span className="ck-mark" aria-hidden="true">
                    {MARK[part.state]}
                  </span>
                  <span className="ck-part-text">
                    <span className="ck-part-label">{part.label}</span>
                    <span className="ck-part-detail">{part.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
            {entry.lapsed ? <p className="rb-warn">You signed this off on {shortDate(entry.signOff.done!)}, but something's missing now.</p> : null}
            {entry.signOff.done ? (
              <div className="ck-signed">
                <span className="pill pill-good">✓ Signed off {shortDate(entry.signOff.done)}</span>
                <button type="button" className="link-btn" disabled={busy} onClick={() => onSignOff(false)}>
                  Undo
                </button>
              </div>
            ) : complete && !entry.inApp ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={onPutInApp}>
                Put in the app
              </button>
            ) : complete ? (
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => onSignOff(true)}>
                Sign off
              </button>
            ) : (
              <p className="muted small">Fix what's marked ✕, then you can sign it off.</p>
            )}

            {editingNote ? (
              <form
                className="ck-note-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  onNote(note);
                  setEditingNote(false);
                }}
              >
                <label className="field">
                  <span>Note to yourself</span>
                  <textarea rows={3} maxLength={600} value={note} autoFocus onChange={(event) => setNote(event.target.value)} />
                </label>
                <div className="row-actions">
                  <button type="button" className="btn btn-sm" onClick={() => setEditingNote(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
                    Save note
                  </button>
                </div>
              </form>
            ) : (
              <>
                {entry.signOff.note ? <p className="ck-note">{entry.signOff.note}</p> : null}
                <button type="button" className="link-btn" onClick={() => setEditingNote(true)}>
                  {entry.signOff.note ? "Edit note" : "Add a note"}
                </button>
              </>
            )}
          </section>

          <section className="card">
            <h3 className="section-title">Videos</h3>
            {r.youtube_video_id ? (
              <VideoLink id={r.youtube_video_id} title={r.youtube_title} channel={r.youtube_channel} />
            ) : (
              <p className="muted small">No video yet.</p>
            )}
            {r.youtube_alt_video_id ? <VideoLink id={r.youtube_alt_video_id} title={r.youtube_alt_title} channel={r.youtube_alt_channel} /> : null}
          </section>
        </aside>
      </div>

      {enlarged && picture ? (
        <div className="overlay rv-lightbox" role="dialog" aria-modal="true" aria-label={`${pictureName} for ${entry.name}`} onClick={() => setEnlarged(false)}>
          <img src={picture} alt={`${pictureName} for ${entry.name}`} onClick={(event) => event.stopPropagation()} />
          <button type="button" className="btn rv-close" onClick={() => setEnlarged(false)} autoFocus>
            Close
          </button>
        </div>
      ) : null}
    </div>
  );
}

const Line = ({ term, text }: { term: string; text?: string }) => (
  <div>
    <dt>{term}</dt>
    <dd>{text?.trim() ? text : <span className="rv-empty">None yet</span>}</dd>
  </div>
);

const VideoLink = ({ id, title, channel }: { id: string; title?: string; channel?: string }) => (
  <a className="rv-video" href={`https://www.youtube.com/watch?v=${id}`} target="_blank" rel="noreferrer">
    <img src={`https://i.ytimg.com/vi/${id}/mqdefault.jpg`} alt="" width={128} height={72} />
    <span>
      <strong>{title ?? id}</strong>
      {channel ? <span className="muted small">{channel}</span> : null}
    </span>
  </a>
);
