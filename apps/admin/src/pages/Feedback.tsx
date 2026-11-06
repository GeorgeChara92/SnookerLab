import { useEffect, useState } from "react";
import { formatDayTime, nameOf, supabase } from "../supabase";

type FeedbackRow = { id: string; user_id: string | null; message: string; created_at: string };
type Sender = { id: string; display_name: string | null; handle: string | null };
type Contact = { id: string; email: string | null };

/** Everything sent from Send feedback in the app, newest first, with who sent it and how to reply. */
export function Feedback() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [senders, setSenders] = useState<Map<string, Sender>>(new Map());
  const [emails, setEmails] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("app_feedback")
        .select("id, user_id, message, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      const feedback = (data ?? []) as FeedbackRow[];
      const ids = [...new Set(feedback.map((row) => row.user_id).filter((id): id is string => Boolean(id)))];
      const [{ data: profiles }, { data: players }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, display_name, handle").in("id", ids) : Promise.resolve({ data: [] }),
        // Emails come from the admin-only players function; the newest 500 accounts cover it for now.
        ids.length ? supabase.rpc("admin_players", { search: null, lim: 500 }) : Promise.resolve({ data: [] }),
      ]);
      if (cancelled) return;
      setRows(feedback);
      setSenders(new Map(((profiles ?? []) as Sender[]).map((row) => [row.id, row])));
      setEmails(new Map(((players ?? []) as Contact[]).filter((row) => row.email).map((row) => [row.id, row.email as string])));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Feedback</h1>
          <p className="muted">{loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "message" : "messages"}, newest first`}</p>
        </div>
      </header>
      {!loading && rows.length === 0 ? <div className="card empty">No feedback yet. Messages from Send feedback in the app land here.</div> : null}
      <div className="list">
        {rows.map((row) => {
          const email = row.user_id ? emails.get(row.user_id) : undefined;
          return (
            <article key={row.id} className="card">
              <p className="muted small">
                {row.user_id ? nameOf(senders.get(row.user_id)) : "Deleted account"} · {formatDayTime(row.created_at)}
                {email ? (
                  <>
                    {" · "}
                    <a href={`mailto:${email}?subject=${encodeURIComponent("Your Snookered feedback")}`}>Reply by email</a>
                  </>
                ) : null}
              </p>
              <p className="pre feedback-body">{row.message}</p>
            </article>
          );
        })}
      </div>
    </>
  );
}
