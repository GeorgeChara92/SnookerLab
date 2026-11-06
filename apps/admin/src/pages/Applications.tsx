import { useEffect, useState } from "react";
import { formatDay, supabase } from "../supabase";
import { useDialog } from "../dialog";

type Application = {
  id: string;
  user_id: string | null;
  full_name: string;
  email: string;
  bio: string | null;
  location: string | null;
  experience: string;
  qualifications: string[];
  wpbsa_accredited: boolean;
  wpbsa_number: string | null;
  social_links: string | null;
  status: "pending" | "approved" | "rejected";
  reviewer_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

const COLUMNS =
  "id, user_id, full_name, email, bio, location, experience, qualifications, wpbsa_accredited, wpbsa_number, social_links, status, reviewer_note, created_at, reviewed_at";

/** Links in the applicant's text, so they can be opened to check. Only http(s) links become clickable. */
const Linkified = ({ text }: { text: string }) => (
  <>
    {text.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
      /^https?:\/\//.test(part) ? (
        <a key={index} href={part} target="_blank" rel="noreferrer noopener">
          {part}
        </a>
      ) : (
        <span key={index}>{part}</span>
      )
    )}
  </>
);

export function Applications({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const [view, setView] = useState<"pending" | "decided">("pending");
  const [rows, setRows] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const query = supabase.from("coach_applications").select(COLUMNS);
    void (view === "pending"
      ? query.eq("status", "pending").order("created_at", { ascending: true })
      : query.neq("status", "pending").order("reviewed_at", { ascending: false, nullsFirst: false }).limit(100)
    ).then(({ data }) => {
      if (cancelled) return;
      setRows((data ?? []) as Application[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [view]);

  const decide = (application: Application, action: "approve" | "reject") => {
    const reason = reasons[application.id]?.trim();
    const proceed = async () => {
      setBusyId(application.id);
      const { data, error } = await supabase.functions.invoke("approve-coach-application", {
        body: { applicationId: application.id, action, reviewerNote: action === "reject" ? reason || undefined : undefined },
      });
      setBusyId(null);
      if (error || data?.error) {
        dialog.alert({ title: "That didn't go through", message: data?.message ?? data?.error ?? error?.message ?? "Try again." });
        return;
      }
      setRows((prev) => prev.filter((item) => item.id !== application.id));
      onChanged();
    };

    if (action === "approve") {
      dialog.confirm({
        title: `Approve ${application.full_name}?`,
        message: "Their account becomes a coach account straight away and they appear in Find a coach.",
        confirmLabel: "Approve",
        onConfirm: () => void proceed(),
      });
      return;
    }
    dialog.confirm({
      title: `Turn down ${application.full_name}?`,
      message: reason
        ? `They'll see: "${reason}". They can apply again later.`
        : "They'll see a general message, because no reason was given. They can apply again later.",
      confirmLabel: "Turn down",
      tone: "danger",
      onConfirm: () => void proceed(),
    });
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Coach applications</h1>
          <p className="muted">
            {loading
              ? "Loading…"
              : view === "pending"
                ? `${rows.length} waiting on a decision, oldest first`
                : `Last ${rows.length} decisions`}
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="Which applications">
          <button type="button" role="tab" aria-selected={view === "pending"} onClick={() => setView("pending")}>
            Waiting
          </button>
          <button type="button" role="tab" aria-selected={view === "decided"} onClick={() => setView("decided")}>
            Decided
          </button>
        </div>
      </header>

      {!loading && rows.length === 0 ? (
        <div className="card empty">{view === "pending" ? "Nothing waiting. New applications show up here." : "No decisions yet."}</div>
      ) : null}

      <div className="list">
        {rows.map((application) => (
          <article key={application.id} className="card">
            <div className="item-head">
              <div>
                <h2 className="item-title">{application.full_name}</h2>
                <p className="muted small">
                  <a href={`mailto:${application.email}`}>{application.email}</a> · applied {formatDay(application.created_at)}
                  {application.user_id ? " · has an account" : " · no account yet, one is made on approval"}
                </p>
              </div>
              {application.status !== "pending" ? (
                <span className={application.status === "approved" ? "pill pill-good" : "pill pill-bad"}>
                  {application.status === "approved" ? "Approved" : "Turned down"} {formatDay(application.reviewed_at)}
                </span>
              ) : null}
            </div>

            <dl className="detail">
              {application.location ? (
                <>
                  <dt>Where they coach</dt>
                  <dd>{application.location}</dd>
                </>
              ) : null}
              <dt>Experience</dt>
              <dd className="pre">{application.experience}</dd>
              <dt>Qualifications</dt>
              <dd>{application.qualifications.length ? application.qualifications.join(", ") : "None given"}</dd>
              <dt>WPBSA</dt>
              <dd>{application.wpbsa_accredited ? application.wpbsa_number || "Says accredited, no number given" : "Not accredited"}</dd>
              {application.social_links ? (
                <>
                  <dt>Links to check</dt>
                  <dd className="pre">
                    <Linkified text={application.social_links} />
                  </dd>
                </>
              ) : null}
              {application.bio ? (
                <>
                  <dt>Bio</dt>
                  <dd className="pre">{application.bio}</dd>
                </>
              ) : null}
              {application.reviewer_note ? (
                <>
                  <dt>Reason given</dt>
                  <dd className="pre">{application.reviewer_note}</dd>
                </>
              ) : null}
            </dl>

            {application.status === "pending" ? (
              <>
                <label className="field">
                  <span>Reason, if turning them down (they'll see this)</span>
                  <textarea
                    rows={2}
                    value={reasons[application.id] ?? ""}
                    placeholder="Optional, but it helps them apply properly next time"
                    onChange={(event) => setReasons((prev) => ({ ...prev, [application.id]: event.target.value }))}
                  />
                </label>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-danger-ghost"
                    disabled={busyId === application.id}
                    onClick={() => decide(application, "reject")}
                  >
                    Turn down
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === application.id}
                    onClick={() => decide(application, "approve")}
                  >
                    {busyId === application.id ? "Working…" : "Approve"}
                  </button>
                </div>
              </>
            ) : null}
          </article>
        ))}
      </div>
    </>
  );
}
