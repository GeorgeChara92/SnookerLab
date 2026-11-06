import { useEffect, useMemo, useState } from "react";
import { ago, formatDayTime, supabase } from "../supabase";

type ErrorRow = {
  id: string;
  user_id: string | null;
  created_at: string;
  source: "render" | "global";
  fatal: boolean;
  message: string;
  stack: string | null;
  screen: string | null;
  app_version: string | null;
  update_id: string | null;
  platform: string | null;
};

type Group = { message: string; rows: ErrorRow[]; players: number; screens: string[]; versions: string[]; fatal: boolean };

const RANGES = [
  { days: 1, label: "24 hours" },
  { days: 7, label: "7 days" },
  { days: 30, label: "30 days" },
];

/**
 * Crashes sent by the app (app_errors), the same error grouped together so the one hitting most
 * players is at the top. Kept for 90 days.
 */
export function Crashes() {
  const [days, setDays] = useState(7);
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void supabase
      .from("app_errors")
      .select("id, user_id, created_at, source, fatal, message, stack, screen, app_version, update_id, platform")
      .gte("created_at", new Date(Date.now() - days * 86_400_000).toISOString())
      .order("created_at", { ascending: false })
      .limit(1000)
      .then(({ data }) => {
        if (cancelled) return;
        setRows((data ?? []) as ErrorRow[]);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const groups = useMemo<Group[]>(() => {
    const byMessage = new Map<string, ErrorRow[]>();
    rows.forEach((row) => byMessage.set(row.message, [...(byMessage.get(row.message) ?? []), row]));
    return [...byMessage.entries()]
      .map(([message, list]) => ({
        message,
        rows: list,
        players: new Set(list.map((row) => row.user_id)).size,
        screens: [...new Set(list.map((row) => row.screen).filter((screen): screen is string => Boolean(screen)))],
        versions: [...new Set(list.map((row) => row.app_version).filter((version): version is string => Boolean(version)))],
        fatal: list.some((row) => row.fatal),
      }))
      .sort((a, b) => b.players - a.players || b.rows.length - a.rows.length);
  }, [rows]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Crashes</h1>
          <p className="muted">
            {loading
              ? "Loading…"
              : rows.length
                ? `${rows.length} ${rows.length === 1 ? "crash" : "crashes"}, ${groups.length} different ${groups.length === 1 ? "problem" : "problems"}`
                : "No crashes"}
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="Time range">
          {RANGES.map((range) => (
            <button key={range.days} type="button" role="tab" aria-selected={days === range.days} onClick={() => setDays(range.days)}>
              {range.label}
            </button>
          ))}
        </div>
      </header>

      {!loading && groups.length === 0 ? (
        <div className="card empty">Nothing in the last {RANGES.find((range) => range.days === days)?.label}. When the app hits an error it shows up here.</div>
      ) : null}

      <div className="list">
        {groups.map((group) => {
          const latest = group.rows[0];
          const expanded = open === group.message;
          return (
            <article key={group.message} className={group.fatal ? "card card-flagged" : "card"}>
              <div className="item-head">
                <div className="crash-head">
                  <h2 className="item-title mono">{group.message}</h2>
                  <p className="muted small">
                    {group.rows.length}× · {group.players} {group.players === 1 ? "player" : "players"} · last {ago(latest.created_at)}
                    {group.screens.length ? ` · on ${group.screens.join(", ")}` : ""}
                    {group.versions.length ? ` · version ${group.versions.join(", ")}` : ""}
                  </p>
                </div>
                <div className="pill-row">
                  {group.fatal ? <span className="pill pill-bad">Closed the app</span> : null}
                  <span className="pill">{latest.source === "render" ? "Screen failed to draw" : "Error"}</span>
                </div>
              </div>
              <button type="button" className="link-btn" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : group.message)}>
                {expanded ? "Hide details" : "Show the latest one"}
              </button>
              {expanded ? (
                <div className="crash-detail">
                  <p className="muted small">
                    {formatDayTime(latest.created_at)} · {latest.platform ?? "unknown phone"} · update {latest.update_id?.slice(0, 8) ?? "none"}
                  </p>
                  <pre className="stack-trace">{latest.stack ?? "No stack trace was sent."}</pre>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </>
  );
}
