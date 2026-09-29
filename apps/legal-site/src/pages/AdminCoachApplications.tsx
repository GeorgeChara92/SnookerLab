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

type Status = "checking" | "signed-out" | "not-admin" | "admin";

const box: React.CSSProperties = {
  border: "1px solid var(--line)",
  borderRadius: 16,
  background: "var(--card)",
  padding: 24,
};

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

/**
 * A private, login-gated admin page - not linked anywhere on the site, and excluded from the
 * sitemap, but real security is the Supabase sign-in plus the same app_admins check and RLS the
 * in-app Coach applications screen relies on, not the URL being obscure. Reuses the exact same
 * backend: approve-coach-application is the only thing that can actually grant is_coach.
 */
export default function AdminCoachApplications() {
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<Session | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Coach applications";
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
        if (cancelled) return;
        setStatus(data ? "admin" : "not-admin");
      });
    return () => {
      cancelled = true;
    };
  }, [session]);

  const loadApplications = async () => {
    setLoadingApps(true);
    const { data } = await supabase
      .from("coach_applications")
      .select(
        "id, full_name, email, bio, location, experience, qualifications, wpbsa_accredited, wpbsa_number, social_links, created_at"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });
    setApplications(data ?? []);
    setLoadingApps(false);
  };

  useEffect(() => {
    if (status === "admin") void loadApplications();
  }, [status]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    setSigningIn(true);
    setAuthError(null);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setSigningIn(false);
    if (error) setAuthError(error.message);
  };

  const decide = async (application: Application, action: "approve" | "reject") => {
    if (action === "reject" && !window.confirm(`Turn down ${application.full_name}? They can apply again later.`)) return;
    if (action === "approve" && !window.confirm(`Approve ${application.full_name}? This creates or updates their account right away.`)) return;
    setBusyId(application.id);
    const { data, error } = await supabase.functions.invoke("approve-coach-application", {
      body: { applicationId: application.id, action },
    });
    setBusyId(null);
    if (error || data?.error) {
      window.alert(data?.message ?? data?.error ?? "That did not work. Try again.");
      return;
    }
    setApplications((prev) => prev.filter((item) => item.id !== application.id));
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
          <input
            id="admin-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            style={field}
            required
          />
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

  return (
    <div className="wrap section">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 className="display-l">Coach applications</h1>
        <button type="button" className="btn btn-ghost" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </div>

      <p style={{ color: "var(--ink-2)", marginBottom: 20 }}>
        {loadingApps ? "Loading…" : `${applications.length} waiting on a decision`}
      </p>

      {!loadingApps && applications.length === 0 ? <div style={box}>Nothing to review.</div> : null}

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
    </div>
  );
}
