import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { Session } from "@supabase/supabase-js";
import { configured, supabase } from "./supabase";
import { DialogProvider } from "./dialog";
import { Overview, type OverviewData } from "./pages/Overview";
import { Applications } from "./pages/Applications";
import { Reports } from "./pages/Reports";
import { Feedback } from "./pages/Feedback";
import { Crashes } from "./pages/Crashes";
import { Players } from "./pages/Players";
import { Routines } from "./pages/Routines";

type Status = "checking" | "signed-out" | "not-admin" | "admin";
export type Page = "overview" | "applications" | "reports" | "feedback" | "crashes" | "players" | "routines";

const PAGES: Array<{ value: Page; label: string }> = [
  { value: "overview", label: "Overview" },
  { value: "applications", label: "Coach applications" },
  { value: "reports", label: "Reports" },
  { value: "feedback", label: "Feedback" },
  { value: "crashes", label: "Crashes" },
  { value: "players", label: "Players" },
  { value: "routines", label: "Routines" },
];

const pageFromHash = (): Page => {
  const value = window.location.hash.replace("#", "").split("/")[0] as Page;
  return PAGES.some((page) => page.value === value) ? value : "overview";
};

export function App() {
  const [status, setStatus] = useState<Status>("checking");
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    if (!configured) return;
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setStatus(data.session ? "checking" : "signed-out");
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setStatus(next ? "checking" : "signed-out");
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    void supabase
      .from("app_admins")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setStatus(data ? "admin" : "not-admin");
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!configured) {
    return (
      <Centered>
        <h1 className="gate-title">Can't find the Supabase settings</h1>
        <p className="muted">
          The dashboard reads <code>EXPO_PUBLIC_SUPABASE_URL</code> and <code>EXPO_PUBLIC_SUPABASE_ANON_KEY</code> from the
          app's <code>.env</code> file, two folders up. Check they're there, then restart <code>npm run dev</code>.
        </p>
      </Centered>
    );
  }
  if (status === "checking") return <Centered><p className="muted">Checking your account…</p></Centered>;
  if (status === "signed-out") return <SignIn />;
  if (status === "not-admin") {
    return (
      <Centered>
        <h1 className="gate-title">This account isn't an admin</h1>
        <p className="muted">Sign in with the account that's listed in app_admins.</p>
        <button type="button" className="btn" onClick={() => void supabase.auth.signOut()}>
          Sign out
        </button>
      </Centered>
    );
  }
  return (
    <DialogProvider>
      <Dashboard email={session?.user.email ?? ""} />
    </DialogProvider>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="gate">
      <div className="gate-card">
        <p className="brand-mark">SNOOKERED · ADMIN</p>
        {children}
      </div>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (signInError) setError(signInError.message);
  };

  return (
    <Centered>
      <h1 className="gate-title">Sign in</h1>
      <form onSubmit={submit} className="stack">
        <label className="field">
          <span>Email</span>
          <input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        {error ? <p className="error-text">{error}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Centered>
  );
}

function Dashboard({ email }: { email: string }) {
  const [page, setPage] = useState<Page>(pageFromHash);
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  const loadOverview = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_overview");
    if (error) {
      setOverviewError(
        error.code === "PGRST202"
          ? "The admin_overview function isn't in the database yet. Run 20261106_0001_admin_dashboard.sql."
          : error.message
      );
      return;
    }
    setOverviewError(null);
    setOverview(data as OverviewData);
  }, []);

  useEffect(() => {
    void loadOverview();
    const timer = window.setInterval(() => void loadOverview(), 60_000);
    return () => window.clearInterval(timer);
  }, [loadOverview]);

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const go = (next: Page) => {
    window.location.hash = next;
    setPage(next);
  };

  const attention = overview?.attention;
  const badge: Partial<Record<Page, number>> = {
    applications: attention?.applications,
    reports: attention?.reports,
    crashes: attention?.errors_24h,
  };

  return (
    <div className="shell">
      <aside className="side">
        <p className="brand-mark">SNOOKERED · ADMIN</p>
        <nav className="nav" aria-label="Sections">
          {PAGES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={item.value === page ? "nav-item active" : "nav-item"}
              aria-current={item.value === page ? "page" : undefined}
              onClick={() => go(item.value)}
            >
              <span>{item.label}</span>
              {badge[item.value] ? <span className="nav-badge">{badge[item.value]}</span> : null}
            </button>
          ))}
        </nav>
        <div className="side-foot">
          <p className="side-email">{email}</p>
          <button type="button" className="link-btn" onClick={() => void supabase.auth.signOut()}>
            Sign out
          </button>
        </div>
      </aside>
      <main className={page === "routines" ? "main main-wide" : "main"}>
        {page === "overview" ? (
          <Overview data={overview} error={overviewError} onRefresh={loadOverview} onOpen={go} />
        ) : page === "applications" ? (
          <Applications onChanged={loadOverview} />
        ) : page === "reports" ? (
          <Reports onChanged={loadOverview} />
        ) : page === "feedback" ? (
          <Feedback />
        ) : page === "crashes" ? (
          <Crashes />
        ) : page === "routines" ? (
          <Routines />
        ) : (
          <Players />
        )}
      </main>
    </div>
  );
}
