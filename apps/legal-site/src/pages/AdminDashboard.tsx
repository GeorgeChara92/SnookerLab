import { useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "../api/supabase";

type Application = {
  id: string;
  full_name: string;
  email: string;
  bio: string | null;
  location: string | null;
  experience: string;
  qualifications: string[];
  wpbsa_accredited: boolean;
  wpbsa_number: string | null;
  social_links: string | null;
  created_at: string;
};

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

type FeedbackRow = { id: string; user_id: string | null; message: string; created_at: string };

type Status = "checking" | "signed-out" | "not-admin" | "admin";
type Tab = "applications" | "reports" | "feedback";

type ConfirmRequest = { title: string; message: string; confirmLabel: string; tone?: "danger"; onConfirm: () => void };
type AlertRequest = { title: string; message: string };
export type DialogApi = { confirm: (request: ConfirmRequest) => void; alert: (request: AlertRequest) => void };

const box: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 16, background: "var(--card)", padding: 24 };
const field: React.CSSProperties = {
  width: "100%",
  minHeight: 44,
  borderRadius: 10,
  border: "1px solid var(--line-2)",
  padding: "0 12px",
  fontSize: 15,
  fontFamily: "var(--body)",
  marginTop: 6,
  marginBottom: 14,
};

const nameOf = (profile: { display_name?: string | null; handle?: string | null } | null | undefined) =>
  profile?.display_name?.trim() || (profile?.handle ? `@${profile.handle}` : "Player");

const TABLES: Record<string, string> = { profile: "profiles", message: "messages", group: "groups", routine: "shared_routines" };
const HIDE_LABEL: Record<string, string> = { profile: "Hide profile", message: "Hide message", group: "Hide group", routine: "Hide routine" };
const reasonLabel: Record<string, string> = {
  harassment: "Bullying or harassment",
  hate: "Hate or abuse",
  inappropriate: "Inappropriate content",
  impersonation: "Pretending to be someone",
  spam: "Spam or scams",
  other: "Something else",
};

/**
 * A private, login-gated admin dashboard - not linked anywhere on the site, and excluded from the
 * sitemap, but real security is the Supabase sign-in plus the same app_admins check and RLS the
 * in-app admin screens rely on, not the URL being obscure. Coach applications reuse the same
 * approve-coach-application function the app does; reports and feedback read and write the same
 * tables the in-app AdminReportsScreen and app_feedback do.
 */
export default function AdminDashboard() {
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [tab, setTab] = useState<Tab>("applications");
  const [confirmReq, setConfirmReq] = useState<ConfirmRequest | null>(null);
  const [alertReq, setAlertReq] = useState<AlertRequest | null>(null);
  const dialog: DialogApi = { confirm: setConfirmReq, alert: setAlertReq };

  useEffect(() => {
    document.title = "Admin dashboard";
    document.querySelector('meta[name="robots"]')?.setAttribute("content", "noindex, nofollow");
  }, []);

  useEffect(() => {
    if (!supabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "checking" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "checking" : "signed-out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    void supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStatus(data ? "admin" : "not-admin");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (error) setAuthError(error.message);
  };

  if (!supabaseConfigured) {
    return (
      <div className="wrap section">
        <div style={box}>
          <p>
            Supabase is not configured for this build - set <code>VITE_SUPABASE_URL</code> and{" "}
            <code>VITE_SUPABASE_ANON_KEY</code> in the Vercel project's environment variables (same project as the app).
          </p>
        </div>
      </div>
    );
  }

  if (status === "signed-out") {
    return (
      <div className="wrap section" style={{ maxWidth: 420 }}>
        <h1 className="display-l">Sign in</h1>
        <form onSubmit={signIn} style={{ ...box, marginTop: 16 }}>
          <label htmlFor="admin-email">Email</label>
          <input id="admin-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} style={field} required />
          <label htmlFor="admin-password">Password</label>
          <input id="admin-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} style={field} required />
          {authError ? <p style={{ color: "var(--red)", marginBottom: 14 }}>{authError}</p> : null}
          <button type="submit" className="btn btn-primary" disabled={signingIn} style={{ width: "100%" }}>
            {signingIn ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  if (status === "checking") {
    return (
      <div className="wrap section">
        <p>Checking…</p>
      </div>
    );
  }

  if (status === "not-admin") {
    return (
      <div className="wrap section">
        <div style={box}>
          <p>This account is not an admin.</p>
          <button type="button" className="btn btn-ghost" onClick={() => void supabase.auth.signOut()} style={{ marginTop: 12 }}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const TABS: Array<{ value: Tab; label: string }> = [
    { value: "applications", label: "Coach applications" },
    { value: "reports", label: "Reports" },
    { value: "feedback", label: "Feedback" },
  ];

  return (
    <div className="wrap section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <h1 className="display-l">Admin dashboard</h1>
        <button type="button" className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap" }}>
        {TABS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setTab(item.value)}
            className={tab === item.value ? "btn btn-primary" : "btn btn-ghost"}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "applications" ? (
        <ApplicationsPanel dialog={dialog} />
      ) : tab === "reports" ? (
        <ReportsPanel dialog={dialog} />
      ) : (
        <FeedbackPanel />
      )}

      {confirmReq ? (
        <DialogOverlay>
          <h2 style={{ marginTop: 0 }}>{confirmReq.title}</h2>
          <p style={{ color: "var(--ink-2)" }}>{confirmReq.message}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmReq(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, ...(confirmReq.tone === "danger" ? { backgroundColor: "var(--red)", borderColor: "var(--red)" } : {}) }}
              onClick={() => {
                confirmReq.onConfirm();
                setConfirmReq(null);
              }}
            >
              {confirmReq.confirmLabel}
            </button>
          </div>
        </DialogOverlay>
      ) : null}

      {alertReq ? (
        <DialogOverlay>
          <h2 style={{ marginTop: 0 }}>{alertReq.title}</h2>
          <p style={{ color: "var(--ink-2)" }}>{alertReq.message}</p>
          <button type="button" className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => setAlertReq(null)}>
            OK
          </button>
        </DialogOverlay>
      ) : null}
    </div>
  );
}

/** The site's own look for a confirm/alert, instead of the browser's native dialog. */
function DialogOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(12, 23, 19, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 100,
      }}
    >
      <div style={{ ...box, maxWidth: 420, width: "100%" }}>{children}</div>
    </div>
  );
}

function ApplicationsPanel({ dialog }: { dialog: DialogApi }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("coach_applications")
      .select("id, full_name, email, bio, location, experience, qualifications, wpbsa_accredited, wpbsa_number, social_links, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setApplications(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const decide = (application: Application, action: "approve" | "reject") => {
    const reason = reasons[application.id]?.trim();

    const proceed = async () => {
      setBusyId(application.id);
      const { data, error } = await supabase.functions.invoke("approve-coach-application", {
        body: { applicationId: application.id, action, reviewerNote: action === "reject" ? reason || undefined : undefined },
      });
      setBusyId(null);
      if (error || data?.error) {
        dialog.alert({ title: "That did not work", message: data?.message ?? data?.error ?? "Try again." });
        return;
      }
      setApplications((prev) => prev.filter((item) => item.id !== application.id));
    };

    if (action === "approve") {
      dialog.confirm({
        title: `Approve ${application.full_name}?`,
        message: "This creates or updates their account and grants coach status right away.",
        confirmLabel: "Approve",
        onConfirm: () => void proceed(),
      });
      return;
    }
    dialog.confirm({
      title: `Turn down ${application.full_name}?`,
      message: reason
        ? `They will see: "${reason}". They can apply again later.`
        : "They will see a generic message - no reason was given. They can apply again later.",
      confirmLabel: "Turn down",
      tone: "danger",
      onConfirm: () => void proceed(),
    });
  };

  return (
    <>
      <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>{loading ? "Loading…" : `${applications.length} waiting on a decision`}</p>
      {!loading && applications.length === 0 ? <div style={box}>Nothing to review.</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {applications.map((application) => (
          <div key={application.id} style={box}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <strong style={{ fontSize: 18 }}>{application.full_name}</strong>
              <span style={{ color: "var(--ink-3)", fontSize: 13 }}>{new Date(application.created_at).toLocaleDateString()}</span>
            </div>
            <p>
              <strong>Email:</strong> {application.email}
            </p>
            {application.location ? (
              <p>
                <strong>Where they coach:</strong> {application.location}
              </p>
            ) : null}
            <p style={{ whiteSpace: "pre-wrap" }}>
              <strong>Experience:</strong> {application.experience}
            </p>
            {application.qualifications.length ? (
              <p>
                <strong>Qualifications:</strong> {application.qualifications.join(", ")}
              </p>
            ) : null}
            {application.wpbsa_accredited ? (
              <p>
                <strong>WPBSA number:</strong> {application.wpbsa_number || "Given, no number"}
              </p>
            ) : null}
            {application.social_links ? (
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>Social media / links:</strong> {application.social_links}
              </p>
            ) : null}
            {application.bio ? (
              <p style={{ whiteSpace: "pre-wrap" }}>
                <strong>Bio:</strong> {application.bio}
              </p>
            ) : null}
            <label style={{ display: "block", marginTop: 10 }}>
              <span style={{ fontSize: 13, color: "var(--ink-3)" }}>If turning down: reason (shown to them)</span>
              <textarea
                value={reasons[application.id] ?? ""}
                onChange={(event) => setReasons((prev) => ({ ...prev, [application.id]: event.target.value }))}
                placeholder="Optional, but helps them apply again properly"
                rows={2}
                style={{ ...field, minHeight: 60, resize: "vertical", fontFamily: "var(--body)" }}
              />
            </label>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === application.id}
                onClick={() => void decide(application, "reject")}
                style={{ flex: 1, borderColor: "var(--red)", color: "var(--red)" }}
              >
                Turn down
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busyId === application.id}
                onClick={() => void decide(application, "approve")}
                style={{ flex: 1 }}
              >
                {busyId === application.id ? "Working…" : "Approve"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ReportsPanel({ dialog }: { dialog: DialogApi }) {
  const [cases, setCases] = useState<ReportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    const rows = (data ?? []) as ReportRow[];

    const grouped = new Map<string, ReportRow[]>();
    rows.forEach((row) => {
      const key = `${row.target_type}:${row.target_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });
    const idsOf = (type: string) => [...grouped.values()].filter((group) => group[0].target_type === type).map((group) => group[0].target_id);

    const [profileRows, messageRows, groupRows, routineRows] = await Promise.all([
      idsOf("profile").length ? supabase.from("profiles").select("id, display_name, handle, bio, hidden_at").in("id", idsOf("profile")) : { data: [] },
      idsOf("message").length ? supabase.from("messages").select("id, sender, body, hidden_at").in("id", idsOf("message")) : { data: [] },
      idsOf("group").length ? supabase.from("groups").select("id, name, description, hidden_at").in("id", idsOf("group")) : { data: [] },
      idsOf("routine").length ? supabase.from("shared_routines").select("id, name, description, hidden_at").in("id", idsOf("routine")) : { data: [] },
    ]);
    const rowsById = new Map<string, any>();
    [profileRows, messageRows, groupRows, routineRows].forEach((result) => (result.data ?? []).forEach((row: any) => rowsById.set(row.id, row)));

    const senderIds = (messageRows.data ?? []).map((row: any) => row.sender).filter(Boolean);
    const { data: senders } = senderIds.length
      ? await supabase.from("profiles").select("id, display_name, handle").in("id", senderIds)
      : { data: [] };
    const sendersById = new Map((senders ?? []).map((row: any) => [row.id, row]));

    setCases(
      [...grouped.entries()].map(([key, groupReports]) => {
        const type = groupReports[0].target_type;
        const row = rowsById.get(groupReports[0].target_id);
        const base = { key, targetType: type, targetId: groupReports[0].target_id, reports: groupReports, hidden: Boolean(row?.hidden_at), missing: !row };
        if (type === "profile") return { ...base, title: row ? nameOf(row) : "Deleted profile", quote: row?.bio ?? null };
        if (type === "message") {
          const sender = row ? sendersById.get(row.sender) : null;
          return { ...base, title: row ? `Message from ${nameOf(sender)}` : "Deleted message", quote: row?.body ?? null };
        }
        return { ...base, title: row?.name ?? `Deleted ${type}`, quote: row?.description ?? null };
      })
    );
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const resolve = async (item: ReportCase, resolveStatus: "actioned" | "dismissed", hide: boolean | null) => {
    setBusyKey(item.key);
    const table = TABLES[item.targetType];
    if (hide !== null && table && !item.missing) {
      const { error } = await supabase.from(table).update({ hidden_at: hide ? new Date().toISOString() : null }).eq("id", item.targetId);
      if (error) {
        setBusyKey(null);
        dialog.alert({ title: `Could not change the ${item.targetType}`, message: error.message });
        return;
      }
    }
    const { error } = await supabase
      .from("reports")
      .update({ status: resolveStatus, reviewed_at: new Date().toISOString() })
      .in(
        "id",
        item.reports.map((row) => row.id)
      );
    setBusyKey(null);
    if (error) {
      dialog.alert({ title: "Could not update the reports", message: error.message });
      return;
    }
    setCases((prev) => prev.filter((entry) => entry.key !== item.key));
  };

  const totalReports = cases.reduce((sum, item) => sum + item.reports.length, 0);

  return (
    <>
      <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>
        {loading ? "Loading…" : `${totalReports} open ${totalReports === 1 ? "report" : "reports"} on ${cases.length} ${cases.length === 1 ? "thing" : "things"}`}
      </p>
      {!loading && cases.length === 0 ? <div style={box}>Nothing to review.</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {cases.map((item) => (
          <div key={item.key} style={{ ...box, borderColor: item.hidden ? "var(--red)" : "var(--line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
              <strong style={{ fontSize: 18 }}>{item.title}</strong>
              <span style={{ color: "var(--ink-3)", fontSize: 13 }}>
                {item.targetType.toUpperCase()} · {item.reports.length} {item.reports.length === 1 ? "report" : "reports"}
                {item.hidden ? " · HIDDEN" : ""}
              </span>
            </div>
            {item.quote ? <p style={{ borderLeft: "3px solid var(--line)", paddingLeft: 12 }}>{item.quote}</p> : null}
            {item.reports.map((row) => (
              <p key={row.id} style={{ marginTop: 8 }}>
                <strong>{reasonLabel[row.reason] ?? row.reason}</strong>
                {row.details ? ` - ${row.details}` : ""}
              </p>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyKey === item.key}
                onClick={() => void resolve(item, "dismissed", item.hidden ? false : null)}
                style={{ flex: 1 }}
              >
                {item.hidden ? "Restore" : "Dismiss"}
              </button>
              {!item.missing ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyKey === item.key}
                  onClick={() => void resolve(item, "actioned", true)}
                  style={{ flex: 1, backgroundColor: "var(--red)", borderColor: "var(--red)" }}
                >
                  {item.hidden ? "Keep hidden" : HIDE_LABEL[item.targetType]}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function FeedbackPanel() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void supabase
      .from("app_feedback")
      .select("id, user_id, message, created_at")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => {
        setRows(data ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <>
      <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>{loading ? "Loading…" : `${rows.length} messages`}</p>
      {!loading && rows.length === 0 ? <div style={box}>Nothing yet.</div> : null}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {rows.map((row) => (
          <div key={row.id} style={box}>
            <p style={{ color: "var(--ink-3)", fontSize: 13, marginBottom: 8 }}>{new Date(row.created_at).toLocaleString()}</p>
            <p style={{ whiteSpace: "pre-wrap" }}>{row.message}</p>
          </div>
        ))}
      </div>
    </>
  );
}
