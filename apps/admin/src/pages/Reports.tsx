import { useEffect, useState } from "react";
import { formatDayTime, nameOf, supabase } from "../supabase";
import { useDialog } from "../dialog";

type ReportRow = { id: string; target_type: string; target_id: string; reason: string; details: string | null; created_at: string };

type ReportCase = {
  key: string;
  targetType: string;
  targetId: string;
  reports: ReportRow[];
  title: string;
  quote: string | null;
  hidden: boolean;
  missing: boolean;
};

type Row = { id: string; sender?: string; body?: string; name?: string; description?: string | null; bio?: string | null; hidden_at: string | null; display_name?: string | null; handle?: string | null };

const TABLES: Record<string, string> = { profile: "profiles", message: "messages", group: "groups", routine: "shared_routines" };
const HIDE_LABEL: Record<string, string> = { profile: "Hide profile", message: "Hide message", group: "Hide group", routine: "Hide routine" };
const TYPE_LABEL: Record<string, string> = { profile: "Profile", message: "Message", group: "Group", routine: "Routine" };
const REASON_LABEL: Record<string, string> = {
  harassment: "Bullying or harassment",
  hate: "Hate or abuse",
  inappropriate: "Inappropriate content",
  impersonation: "Pretending to be someone",
  spam: "Spam or scams",
  other: "Something else",
};

/**
 * Open reports, one card per reported thing however many people reported it. Uses the same tables
 * and admin RLS as the app's Reports screen, so a decision here shows there too.
 */
export function Reports({ onChanged }: { onChanged: () => void }) {
  const dialog = useDialog();
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("reports")
        .select("id, target_type, target_id, reason, details, created_at")
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(300);
      const rows = (data ?? []) as ReportRow[];

      const grouped = new Map<string, ReportRow[]>();
      rows.forEach((row) => {
        const key = `${row.target_type}:${row.target_id}`;
        grouped.set(key, [...(grouped.get(key) ?? []), row]);
      });
      const idsOf = (type: string) =>
        [...grouped.values()].filter((group) => group[0].target_type === type).map((group) => group[0].target_id);
      const fetchRows = (type: string, columns: string) =>
        idsOf(type).length
          ? supabase.from(TABLES[type]).select(columns).in("id", idsOf(type)).then(({ data: found }) => (found ?? []) as unknown as Row[])
          : Promise.resolve([] as Row[]);

      const [profiles, messages, groups, routines] = await Promise.all([
        fetchRows("profile", "id, display_name, handle, bio, hidden_at"),
        fetchRows("message", "id, sender, body, hidden_at"),
        fetchRows("group", "id, name, description, hidden_at"),
        fetchRows("routine", "id, name, description, hidden_at"),
      ]);
      const byId = new Map<string, Row>();
      [...profiles, ...messages, ...groups, ...routines].forEach((row) => byId.set(row.id, row));

      const senderIds = messages.map((row) => row.sender).filter((id): id is string => Boolean(id));
      const { data: senders } = senderIds.length
        ? await supabase.from("profiles").select("id, display_name, handle").in("id", senderIds)
        : { data: [] as Row[] };
      const senderById = new Map(((senders ?? []) as Row[]).map((row) => [row.id, row]));

      if (cancelled) return;
      setCases(
        [...grouped.entries()].map(([key, group]) => {
          const type = group[0].target_type;
          const row = byId.get(group[0].target_id);
          const base = { key, targetType: type, targetId: group[0].target_id, reports: group, hidden: Boolean(row?.hidden_at), missing: !row };
          if (type === "profile") return { ...base, title: row ? nameOf(row) : "Deleted profile", quote: row?.bio ?? null };
          if (type === "message") {
            return { ...base, title: row ? `Message from ${nameOf(senderById.get(row.sender ?? ""))}` : "Deleted message", quote: row?.body ?? null };
          }
          return { ...base, title: row?.name ?? `Deleted ${type}`, quote: row?.description ?? null };
        })
      );
      setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const resolve = async (item: ReportCase, status: "actioned" | "dismissed", hide: boolean | null) => {
    setBusyKey(item.key);
    const table = TABLES[item.targetType];
    if (hide !== null && table && !item.missing) {
      const { error } = await supabase.from(table).update({ hidden_at: hide ? new Date().toISOString() : null }).eq("id", item.targetId);
      if (error) {
        setBusyKey(null);
        dialog.alert({ title: `Couldn't change the ${item.targetType}`, message: error.message });
        return;
      }
    }
    const { data: auth } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("reports")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: auth.user?.id ?? null })
      .in(
        "id",
        item.reports.map((row) => row.id)
      );
    setBusyKey(null);
    if (error) {
      dialog.alert({ title: "Couldn't update the reports", message: error.message });
      return;
    }
    setCases((prev) => prev.filter((entry) => entry.key !== item.key));
    onChanged();
  };

  const confirmHide = (item: ReportCase) =>
    dialog.confirm({
      title: `${HIDE_LABEL[item.targetType]}?`,
      message: "Nobody else will see it any more. You can restore it later from the SQL editor.",
      confirmLabel: HIDE_LABEL[item.targetType],
      tone: "danger",
      onConfirm: () => void resolve(item, "actioned", true),
    });

  const total = cases.reduce((sum, item) => sum + item.reports.length, 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Reports</h1>
          <p className="muted">
            {loading ? "Loading…" : `${total} open ${total === 1 ? "report" : "reports"} about ${cases.length} ${cases.length === 1 ? "thing" : "things"}`}
          </p>
        </div>
      </header>

      {!loading && cases.length === 0 ? <div className="card empty">No open reports.</div> : null}

      <div className="list">
        {cases.map((item) => (
          <article key={item.key} className={item.hidden ? "card card-flagged" : "card"}>
            <div className="item-head">
              <div>
                <h2 className="item-title">{item.title}</h2>
                <p className="muted small">
                  {TYPE_LABEL[item.targetType] ?? item.targetType} · {item.reports.length} {item.reports.length === 1 ? "report" : "reports"} · latest{" "}
                  {formatDayTime(item.reports[0].created_at)}
                </p>
              </div>
              {item.hidden ? <span className="pill pill-bad">Hidden</span> : null}
            </div>
            {item.quote ? <blockquote className="quote">{item.quote}</blockquote> : null}
            <ul className="reasons">
              {item.reports.map((row) => (
                <li key={row.id}>
                  <strong>{REASON_LABEL[row.reason] ?? row.reason}</strong>
                  {row.details ? ` — ${row.details}` : ""}
                </li>
              ))}
            </ul>
            <div className="row-actions">
              <button
                type="button"
                className="btn"
                disabled={busyKey === item.key}
                onClick={() => void resolve(item, "dismissed", item.hidden ? false : null)}
              >
                {item.hidden ? "Restore and dismiss" : "Dismiss, nothing wrong"}
              </button>
              {!item.missing ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busyKey === item.key}
                  onClick={() => (item.hidden ? void resolve(item, "actioned", true) : confirmHide(item))}
                >
                  {item.hidden ? "Keep hidden" : HIDE_LABEL[item.targetType]}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
