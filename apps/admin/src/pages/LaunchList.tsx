import { useEffect, useState } from "react";
import { formatDayTime, supabase } from "../supabase";

type Signup = { email: string; platform: "iphone" | "android" | null; source: string | null; created_at: string };

const PHONE: Record<string, string> = { iphone: "iPhone", android: "Android" };

/**
 * Everyone who asked on snookeredapp.com to be told when the app launches, newest first. Read
 * through admin_launch_signups(), which refuses anyone who isn't an admin. The privacy policy
 * promises the list is used for the launch email only and deleted after it's sent.
 */
export function LaunchList() {
  const [rows, setRows] = useState<Signup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void supabase.rpc("admin_launch_signups").then(({ data, error: failure }) => {
      if (cancelled) return;
      if (failure) setError(failure.message);
      setRows((data ?? []) as Signup[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const count = (platform: Signup["platform"]) => rows.filter((row) => row.platform === platform).length;

  const copyEmails = async () => {
    await navigator.clipboard.writeText(rows.map((row) => row.email).join("\n"));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const download = () => {
    const cell = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const lines = [
      "email,phone,signed_up_on,page",
      ...rows.map((row) => [row.email, row.platform ?? "", row.created_at, row.source ?? ""].map(cell).join(",")),
    ];
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/csv" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `snookered-launch-list-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Launch list</h1>
          <p className="muted">
            {loading ? "Loading…" : `${rows.length} ${rows.length === 1 ? "person wants" : "people want"} to know when the app launches`}
          </p>
        </div>
        {rows.length ? (
          <div className="row-actions">
            <button type="button" className="btn" onClick={() => void copyEmails()}>
              {copied ? "Copied" : "Copy all emails"}
            </button>
            <button type="button" className="btn btn-primary" onClick={download}>
              Download CSV
            </button>
          </div>
        ) : null}
      </header>

      {error ? <div className="card error-card">{error}</div> : null}

      {rows.length ? (
        <section className="board" aria-label="Phones">
          <div className="board-cell">
            <span className="board-label">iPhone</span>
            <span className="board-value accent">{count("iphone")}</span>
          </div>
          <div className="board-cell">
            <span className="board-label">Android</span>
            <span className="board-value">{count("android")}</span>
          </div>
          <div className="board-cell">
            <span className="board-label">Didn't say</span>
            <span className="board-value">{count(null)}</span>
          </div>
        </section>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <div className="card empty">Nobody yet. Sign-ups from the form on snookeredapp.com land here.</div>
      ) : null}

      {rows.length ? (
        <div className="card table-card">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Email</th>
                  <th scope="col">Phone</th>
                  <th scope="col">Page</th>
                  <th scope="col">Signed up</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.email}>
                    <td>
                      <a href={`mailto:${row.email}`}>{row.email}</a>
                    </td>
                    <td>{row.platform ? PHONE[row.platform] : "—"}</td>
                    <td className="muted">{row.source ?? "—"}</td>
                    <td className="muted">{formatDayTime(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      <p className="muted small">
        The privacy policy says this list is only used for the launch email, and deleted once that's sent. Anyone can ask
        to come off it sooner at support@snookeredapp.com.
      </p>
    </>
  );
}
