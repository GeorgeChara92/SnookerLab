import { useState } from "react";
import "./checklist.css";
import { LEVEL, SCORING, shortDate, type Category, type Entry, type Part, type Status } from "./library";

type Props = {
  entries: Entry[];
  categories: Category[];
  paused: number;
  checklistFile: string;
  busyId: string | null;
  onOpenBuilder: (id: string) => void;
  onView: (id: string) => void;
  onAdd: () => void;
  onSignOff: (id: string, done: boolean) => void;
  onNote: (id: string, note: string) => void;
  onPutInApp: (id: string) => void;
};

const SECTIONS: Array<{ status: Status; title: string; hint: string }> = [
  { status: "todo", title: "Still to do", hint: "Something's missing. Each row says what." },
  { status: "ready", title: "Ready for you to check", hint: "Everything's there. Look it over on the table, then sign it off." },
  { status: "done", title: "Done", hint: "Complete, in the app, and signed off by you." },
];

const MARK: Record<Part["state"], string> = { ok: "✓", missing: "✕", warn: "!", optional: "–" };

/** Every routine in one list: what's done, what's ready for you to check, and what's left. */
export function Checklist(props: Props) {
  const { entries, categories } = props;
  const [section, setSection] = useState("all");
  const order = new Map(categories.map((c) => [c.id, c.order_index]));
  const names = new Map(categories.map((c) => [c.id, c.name]));
  const shown = entries
    .filter((e) => section === "all" || e.categoryId === section)
    .sort((a, b) => (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99));
  const tally = (status: Status) => entries.filter((e) => e.status === status).length;
  const total = entries.length;
  const drafts = entries.filter((e) => e.added && !e.inApp).length;
  const share = (n: number) => `${total ? (n / total) * 100 : 0}%`;

  return (
    <div className="ck">
      <section className="ck-board" aria-label="Progress">
        <div className="board">
          <div className="board-cell">
            <span className="board-label">Done</span>
            <span className="board-value accent">
              {tally("done")}
              <span className="ck-of">/{total}</span>
            </span>
            <span className="board-sub">signed off by you</span>
          </div>
          <div className="board-cell">
            <span className="board-label">Ready to check</span>
            <span className="board-value">{tally("ready")}</span>
            <span className="board-sub">everything's there</span>
          </div>
          <div className="board-cell">
            <span className="board-label">Still to do</span>
            <span className="board-value">{tally("todo")}</span>
            <span className="board-sub">something missing</span>
          </div>
          <div className="board-cell">
            <span className="board-label">Drafts</span>
            <span className="board-value">{drafts}</span>
            <span className="board-sub">added, not in the app</span>
          </div>
        </div>
        <div className="ck-bar" role="img" aria-label={`${tally("done")} done, ${tally("ready")} ready to check, ${tally("todo")} still to do`}>
          <span className="ck-bar-done" style={{ width: share(tally("done")) }} />
          <span className="ck-bar-ready" style={{ width: share(tally("ready")) }} />
        </div>
      </section>

      <div className="ck-tools">
        <label className={section === "all" ? "filter" : "filter on"}>
          Section
          <select value={section} onChange={(event) => setSection(event.target.value)}>
            <option value="all">All sections</option>
            {categories
              .filter((c) => entries.some((e) => e.categoryId === c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
        </label>
        <button type="button" className="btn btn-primary" onClick={props.onAdd}>
          Add a routine
        </button>
      </div>

      {SECTIONS.map(({ status, title, hint }) => {
        const rows = shown.filter((e) => e.status === status);
        return (
          <section key={status} className={`ck-section ck-${status}`} aria-labelledby={`ck-${status}`}>
            <header className="ck-section-head">
              <h2 id={`ck-${status}`} className="section-title">
                {title} <span className="ck-count">{rows.length}</span>
              </h2>
              <p className="muted small">{hint}</p>
            </header>
            {rows.length ? (
              <ul className="ck-list">
                {rows.map((entry) => (
                  <Row key={entry.id} entry={entry} section={names.get(entry.categoryId) ?? entry.categoryId} {...props} />
                ))}
              </ul>
            ) : (
              <p className="card empty">{status === "todo" ? "Nothing left to do here." : status === "ready" ? "Nothing waiting for you." : "Nothing signed off yet."}</p>
            )}
          </section>
        );
      })}

      <p className="muted small ck-foot">
        Sign-offs and notes are kept in <code>{props.checklistFile}</code>, which only the dashboard uses.
        {props.paused ? ` ${props.paused} more routines are paused in routineDrills.ts and aren't counted here.` : ""}
      </p>
    </div>
  );
}

function Row({ entry, section, busyId, onOpenBuilder, onView, onSignOff, onNote, onPutInApp }: Props & { entry: Entry; section: string }) {
  const [editingNote, setEditingNote] = useState(false);
  const [note, setNote] = useState(entry.signOff.note ?? "");
  const busy = busyId === entry.id;
  const r = entry.routine;
  const complete = entry.status !== "todo";

  return (
    <li className={`ck-row card${entry.lapsed ? " card-flagged" : ""}`}>
      <div className="ck-main">
        <div className="ck-name">
          <span className="ck-icon" aria-hidden="true">
            {entry.icon ?? "•"}
          </span>
          <div>
            <h3 className="ck-title">
              <button type="button" className="row-link" onClick={() => onView(entry.id)}>
                {entry.name}
              </button>
              {entry.unsaved ? <span className="rb-dot" title="Unsaved layout changes" aria-label="Unsaved layout changes" /> : null}
            </h3>
            <p className="ck-meta">
              {section} · {LEVEL[entry.difficulty]}
              {entry.guide ? " · Technique guide" : ""}
              {entry.added ? (entry.inApp ? <span className="pill pill-good">Added here · in the app</span> : <span className="pill pill-brass">Draft · not in the app</span>) : null}
            </p>
          </div>
        </div>

        <ul className="ck-parts" aria-label="What it has">
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

        <div className="ck-actions">
          {!entry.guide ? (
            <button type="button" className="btn btn-sm" onClick={() => onOpenBuilder(entry.id)}>
              {entry.parts[0].state === "missing" ? "Place the balls" : "Open in builder"}
            </button>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => onView(entry.id)}>
            View details
          </button>
          {entry.signOff.done && entry.status === "done" ? (
            <span className="ck-signed">
              <span className="pill pill-good">✓ Signed off {shortDate(entry.signOff.done)}</span>
              <button type="button" className="link-btn" disabled={busy} onClick={() => onSignOff(entry.id, false)}>
                Undo
              </button>
            </span>
          ) : complete && entry.added && !entry.inApp ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onPutInApp(entry.id)}>
              Put in the app
            </button>
          ) : complete ? (
            <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => onSignOff(entry.id, true)}>
              Sign off
            </button>
          ) : null}
        </div>
      </div>

      {entry.lapsed ? (
        <p className="rb-warn">
          You signed this off on {shortDate(entry.signOff.done!)}, but something's missing now.{" "}
          <button type="button" className="link-btn" disabled={busy} onClick={() => onSignOff(entry.id, false)}>
            Clear the sign-off
          </button>
        </p>
      ) : null}

      {editingNote ? (
        <form
          className="ck-note-form"
          onSubmit={(event) => {
            event.preventDefault();
            onNote(entry.id, note);
            setEditingNote(false);
          }}
        >
          <label className="field">
            <span>Note to yourself</span>
            <textarea rows={2} maxLength={600} value={note} autoFocus onChange={(event) => setNote(event.target.value)} placeholder="e.g. scoring needs a rethink, check the reds against the video" />
          </label>
          <div className="row-actions">
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setNote(entry.signOff.note ?? "");
                setEditingNote(false);
              }}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-sm btn-primary" disabled={busy}>
              Save note
            </button>
          </div>
        </form>
      ) : (
        <div className="ck-foot-row">
          {entry.signOff.note ? <p className="ck-note">{entry.signOff.note}</p> : null}
          <button type="button" className="link-btn" onClick={() => setEditingNote(true)}>
            {entry.signOff.note ? "Edit note" : "Add a note"}
          </button>
          <details className="ck-details">
            <summary>Read the write-up</summary>
            <dl className="ck-writeup">
              {r.summary ? <Line term="Summary" text={r.summary} /> : null}
              {r.setup_instructions ? <Line term="Setup" text={r.setup_instructions} /> : null}
              {r.description && entry.guide ? <Line term="About" text={r.description} /> : null}
              {r.steps?.length ? (
                <div>
                  <dt>Steps</dt>
                  <dd>
                    <ol>
                      {r.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </dd>
                </div>
              ) : null}
              {r.success_criteria ? <Line term="Scored by" text={`${r.success_criteria} (${SCORING[r.scoring_type]}${r.max_score ? `, top score ${r.max_score}` : ""})`} /> : null}
              {r.improves?.length ? <Line term="Improves" text={r.improves.join(", ")} /> : null}
              {r.youtube_video_id ? (
                <div>
                  <dt>Video</dt>
                  <dd>
                    <a href={`https://www.youtube.com/watch?v=${r.youtube_video_id}`} target="_blank" rel="noreferrer">
                      {r.youtube_title ?? r.youtube_video_id}
                    </a>
                    {r.youtube_channel ? ` · ${r.youtube_channel}` : ""}
                  </dd>
                </div>
              ) : null}
            </dl>
          </details>
        </div>
      )}
    </li>
  );
}

const Line = ({ term, text }: { term: string; text: string }) => (
  <div>
    <dt>{term}</dt>
    <dd>{text}</dd>
  </div>
);
