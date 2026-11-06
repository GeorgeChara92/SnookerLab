import { useCallback, useEffect, useState } from "react";
import { TIER_LABEL, ago, formatDay, formatDayTime, supabase } from "../supabase";
import { useDialog } from "../dialog";

type ReportItem = { id: string; target_type: string; reason: string; details: string | null; status: string; created_at: string };

type Summary = {
  account: {
    id: string;
    email: string | null;
    confirmed_at: string | null;
    created_at: string;
    last_sign_in_at: string | null;
    last_seen: string | null;
    sessions: number;
    providers: string[];
    is_admin: boolean;
  };
  profile: {
    display_name: string | null;
    handle: string | null;
    skill_level: string | null;
    level: number | null;
    xp: number | null;
    best_break: number | null;
    centuries: number | null;
    matches_won: number | null;
    subscription_tier: string | null;
    is_coach: boolean;
    coach_location: string | null;
    hidden_at: string | null;
    discoverable: boolean;
    message_privacy: string;
    stats_privacy: string;
  } | null;
  counts: Record<string, number>;
  reports_about: ReportItem[];
  reports_made: ReportItem[];
  feedback: Array<{ id: string; message: string; created_at: string }>;
  errors: Array<{ id: string; created_at: string; message: string; screen: string | null; app_version: string | null; platform: string | null; fatal: boolean }>;
  applications: Array<{ id: string; status: string; created_at: string; reviewed_at: string | null; reviewer_note: string | null }>;
};

const REASON_LABEL: Record<string, string> = {
  harassment: "Bullying or harassment",
  hate: "Hate or abuse",
  inappropriate: "Inappropriate content",
  impersonation: "Pretending to be someone",
  spam: "Spam or scams",
  other: "Something else",
};
const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  actioned: "Acted on",
  dismissed: "Dismissed",
  pending: "Waiting",
  approved: "Approved",
  rejected: "Turned down",
};
const PRIVACY_LABEL: Record<string, string> = { everyone: "Everyone", friends: "Friends", nobody: "Nobody", none: "Nobody" };

const COUNTS: Array<[string, string]> = [
  ["matches", "Matches"],
  ["practice", "Practice sessions"],
  ["analyses", "AI coach videos"],
  ["messages", "Messages sent"],
  ["friends", "Friends"],
  ["groups", "Groups"],
  ["shared_routines", "Shared routines"],
  ["following_pros", "Pros followed"],
  ["bookings_made", "Bookings made"],
  ["bookings_taken", "Bookings as coach"],
  ["devices", "Phones with notifications"],
  ["blocked_by", "Blocked by"],
];

// Same link the app's Forgot password uses, so the email opens the app's new-password screen.
const RESET_REDIRECT = "snookerlab://auth/callback";

/** Removes everything under <bucket>/<id>/, as the delete-account function does. */
const removeFolder = async (bucket: string, id: string) => {
  for (let round = 0; round < 50; round += 1) {
    const { data: files, error } = await supabase.storage.from(bucket).list(id, { limit: 100 });
    if (error) throw new Error(`Couldn't list their ${bucket} files: ${error.message}`);
    if (!files?.length) return;
    const { error: removeError } = await supabase.storage.from(bucket).remove(files.map((file) => `${id}/${file.name}`));
    if (removeError) throw new Error(`Couldn't remove their ${bucket} files: ${removeError.message}`);
    if (files.length < 100) return;
  }
};

type Props = { id: string; onBack: () => void; onChanged: () => void };

export function PlayerDetail({ id, onBack, onChanged }: Props) {
  const dialog = useDialog();
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: result, error: rpcError } = await supabase.rpc("admin_player", { target: id });
    setError(rpcError ? rpcError.message : result ? null : "This account doesn't exist any more.");
    setData((result as Summary) ?? null);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading) return <p className="muted">Loading…</p>;
  if (error || !data) {
    return (
      <>
        <button type="button" className="link-btn back" onClick={onBack}>
          ← All players
        </button>
        <div className="card error-card">{error}</div>
      </>
    );
  }

  const { account, profile, counts } = data;
  const name = profile?.display_name?.trim() || (profile?.handle ? `@${profile.handle}` : account.email ?? "Player");
  const hidden = Boolean(profile?.hidden_at);
  const locked = account.is_admin;

  /** Runs an action, shows what happened, and reloads the summary. */
  const run = async (key: string, action: () => Promise<string>, after?: () => void) => {
    setBusy(key);
    try {
      const message = await action();
      dialog.alert({ title: "Done", message });
      onChanged();
      if (after) after();
      else await load();
    } catch (caught) {
      dialog.alert({ title: "That didn't go through", message: caught instanceof Error ? caught.message : String(caught) });
    } finally {
      setBusy(null);
    }
  };

  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data: result, error: rpcError } = await supabase.rpc(fn, args);
    if (rpcError) throw new Error(rpcError.message);
    return result as unknown;
  };

  const sendReset = () =>
    dialog.confirm({
      title: "Send a password reset email?",
      message: `${account.email} gets an email with a link to choose a new password. Their current password keeps working until they do.`,
      confirmLabel: "Send email",
      onConfirm: () =>
        void run("reset-email", async () => {
          const { error: resetError } = await supabase.auth.resetPasswordForEmail(account.email ?? "", { redirectTo: RESET_REDIRECT });
          if (resetError) throw new Error(resetError.message);
          return `Sent to ${account.email}.`;
        }),
    });

  const toggleHidden = () =>
    dialog.confirm({
      title: hidden ? `Show ${name} again?` : `Hide ${name}?`,
      message: hidden
        ? "Their profile shows to other players again: in search, leaderboards and chats."
        : "Other players stop seeing their profile in search, leaderboards and chats. Their own data stays as it is.",
      confirmLabel: hidden ? "Show profile" : "Hide profile",
      tone: hidden ? undefined : "danger",
      onConfirm: () =>
        void run("hide", async () => {
          await rpc("admin_set_hidden", { target: id, hide: !hidden });
          return hidden ? "Their profile shows again." : "Their profile is hidden.";
        }),
    });

  const removeCoach = () =>
    dialog.confirm({
      title: `Remove ${name} from Find a coach?`,
      message: "They become a normal player account. Bookings already made stay. They'd have to apply again to coach.",
      confirmLabel: "Remove coach listing",
      tone: "danger",
      onConfirm: () =>
        void run("coach", async () => {
          await rpc("admin_remove_coach", { target: id });
          return "They're no longer listed as a coach.";
        }),
    });

  const signOut = () =>
    dialog.confirm({
      title: `Sign ${name} out everywhere?`,
      message: "Every phone they're signed in on is signed out within the hour and asks for their password again. Nothing is deleted.",
      confirmLabel: "Sign out everywhere",
      onConfirm: () =>
        void run("signout", async () => {
          const removed = (await rpc("admin_sign_out", { target: id })) as number;
          return removed ? `Ended ${removed} ${removed === 1 ? "session" : "sessions"}.` : "They weren't signed in anywhere.";
        }),
    });

  const reset = () =>
    dialog.confirm({
      title: `Reset ${name}'s account?`,
      message:
        "Deletes their matches, practice sessions, tournaments, routine scores and AI coach videos, and clears their profile details, the same as Reset profile in the app. Their plan, friends, chats and the account itself stay. They're signed out so the app reloads. This can't be undone.",
      confirmLabel: "Reset account",
      tone: "danger",
      requireText: "RESET",
      onConfirm: () =>
        void run("reset", async () => {
          await rpc("admin_reset_player", { target: id });
          return "Their account is reset and they've been signed out.";
        }),
    });

  const remove = () =>
    dialog.confirm({
      title: `Delete ${name}'s account?`,
      message:
        "Deletes the account and everything in it: matches, practice, chats, friends, groups, routines, uploaded videos and photos. Their email can be used to sign up again. This can't be undone. If they pay for a plan, cancel it in RevenueCat too.",
      confirmLabel: "Delete account",
      tone: "danger",
      requireText: account.email ?? "DELETE",
      onConfirm: () =>
        void run(
          "delete",
          async () => {
            await removeFolder("ai-videos", id);
            await removeFolder("profile-images", id);
            await rpc("admin_delete_player", { target: id });
            return `${name}'s account is deleted.`;
          },
          onBack
        ),
    });

  return (
    <>
      <button type="button" className="link-btn back" onClick={onBack}>
        ← All players
      </button>

      <header className="player-head card">
        <div className="player-id">
          <h1 className="page-title">{name}</h1>
          <p className="muted">
            {profile?.handle ? `@${profile.handle} · ` : ""}
            {account.email ?? "No email"}
          </p>
          <div className="pill-row">
            <span className={profile?.subscription_tier && profile.subscription_tier !== "free" ? "pill pill-brass" : "pill"}>
              {TIER_LABEL[profile?.subscription_tier ?? "free"] ?? profile?.subscription_tier}
            </span>
            {profile?.is_coach ? <span className="pill pill-good">Coach</span> : null}
            {hidden ? <span className="pill pill-bad">Hidden since {formatDay(profile?.hidden_at)}</span> : null}
            {!account.confirmed_at ? <span className="pill">Email not confirmed</span> : null}
            {locked ? <span className="pill pill-brass">Admin</span> : null}
          </div>
        </div>
        <div className="player-seen">
          <p className="board-label dark">Last seen</p>
          <p className="seen-value">{ago(account.last_seen)}</p>
          <p className="muted small">Joined {formatDay(account.created_at)}</p>
        </div>
      </header>

      <section className="card">
        <h2 className="card-title">Actions</h2>
        {locked ? <p className="muted small">This is an admin account, so only emailing them is available here.</p> : null}
        <div className="actions">
          {account.email ? (
            <a className="btn" href={`mailto:${account.email}?subject=${encodeURIComponent("Snookered")}`}>
              Email them
            </a>
          ) : null}
          {account.email && !locked ? (
            <button type="button" className="btn" disabled={busy !== null} onClick={sendReset}>
              Send password reset
            </button>
          ) : null}
          {!locked ? (
            <>
              <button type="button" className="btn" disabled={busy !== null} onClick={signOut}>
                Sign out everywhere
              </button>
              {profile ? (
                <button type="button" className="btn" disabled={busy !== null} onClick={toggleHidden}>
                  {hidden ? "Show profile" : "Hide profile"}
                </button>
              ) : null}
              {profile?.is_coach ? (
                <button type="button" className="btn" disabled={busy !== null} onClick={removeCoach}>
                  Remove from Find a coach
                </button>
              ) : null}
              <span className="actions-gap" />
              <button type="button" className="btn btn-danger-ghost" disabled={busy !== null} onClick={reset}>
                Reset account
              </button>
              <button type="button" className="btn btn-danger" disabled={busy !== null} onClick={remove}>
                {busy === "delete" ? "Deleting…" : "Delete account"}
              </button>
            </>
          ) : null}
        </div>
      </section>

      <div className="grid-3">
        <section className="card">
          <h2 className="card-title">Account</h2>
          <dl className="facts">
            <Row label="Joined" value={formatDayTime(account.created_at)} />
            <Row label="Email confirmed" value={account.confirmed_at ? formatDay(account.confirmed_at) : "Not yet"} />
            <Row label="Last signed in" value={formatDayTime(account.last_sign_in_at)} />
            <Row label="Signed in on" value={`${account.sessions} ${account.sessions === 1 ? "device" : "devices"}`} />
            <Row label="Signs in with" value={account.providers.length ? account.providers.map(providerLabel).join(", ") : "—"} />
          </dl>
        </section>
        <section className="card">
          <h2 className="card-title">Profile</h2>
          {profile ? (
            <dl className="facts">
              <Row label="Level" value={profile.level != null ? `${profile.level} (${(profile.xp ?? 0).toLocaleString()} XP)` : "—"} />
              <Row label="Skill" value={profile.skill_level ?? "—"} />
              <Row label="Best break" value={profile.best_break ?? "—"} />
              <Row label="Centuries" value={profile.centuries ?? "—"} />
              <Row label="Matches won" value={profile.matches_won ?? "—"} />
              <Row label="Shows in search" value={profile.discoverable ? "Yes" : "No"} />
              <Row label="Who can message" value={PRIVACY_LABEL[profile.message_privacy] ?? profile.message_privacy} />
              <Row label="Who sees stats" value={PRIVACY_LABEL[profile.stats_privacy] ?? profile.stats_privacy} />
              {profile.is_coach ? <Row label="Coaches in" value={profile.coach_location ?? "—"} /> : null}
            </dl>
          ) : (
            <p className="muted">They haven't set up a profile yet.</p>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">What they've used</h2>
          <dl className="facts">
            {COUNTS.map(([key, label]) => (
              <div className="fact" key={key}>
                <dt>{label}</dt>
                <dd className={key === "blocked_by" && counts[key] > 0 ? "warn" : undefined}>{(counts[key] ?? 0).toLocaleString()}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <div className="charts">
        <ReportList title="Reports about them" items={data.reports_about} empty="Nobody has reported them." flagOpen />
        <ReportList title="Reports they made" items={data.reports_made} empty="They haven't reported anyone." />
      </div>

      <div className="charts">
        <section className="card">
          <h2 className="card-title">Feedback and questions</h2>
          {data.feedback.length ? (
            <ul className="timeline">
              {data.feedback.map((item) => (
                <li key={item.id}>
                  <p className="muted small">{formatDayTime(item.created_at)}</p>
                  <p className="pre">{item.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">Nothing sent from Send feedback.</p>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">Crashes</h2>
          {data.errors.length ? (
            <ul className="timeline">
              {data.errors.map((item) => (
                <li key={item.id}>
                  <p className="muted small">
                    {formatDayTime(item.created_at)}
                    {item.screen ? ` · ${item.screen}` : ""}
                    {item.app_version ? ` · v${item.app_version}` : ""}
                    {item.platform ? ` · ${item.platform}` : ""}
                    {item.fatal ? " · closed the app" : ""}
                  </p>
                  <p className="mono">{item.message}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No crashes from their phone in the last 90 days.</p>
          )}
        </section>
      </div>

      {data.applications.length ? (
        <section className="card">
          <h2 className="card-title">Coach applications</h2>
          <ul className="timeline">
            {data.applications.map((item) => (
              <li key={item.id}>
                <p>
                  <span className={item.status === "approved" ? "pill pill-good" : item.status === "rejected" ? "pill pill-bad" : "pill pill-brass"}>
                    {STATUS_LABEL[item.status] ?? item.status}
                  </span>{" "}
                  <span className="muted small">
                    applied {formatDay(item.created_at)}
                    {item.reviewed_at ? ` · decided ${formatDay(item.reviewed_at)}` : ""}
                  </span>
                </p>
                {item.reviewer_note ? <p className="pre muted">Reason given: {item.reviewer_note}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const providerLabel = (provider: string) =>
  ({ email: "Email and password", apple: "Apple", google: "Google" } as Record<string, string>)[provider] ?? provider;

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd className="text">{value}</dd>
    </div>
  );
}

function ReportList({ title, items, empty, flagOpen }: { title: string; items: ReportItem[]; empty: string; flagOpen?: boolean }) {
  const open = items.filter((item) => item.status === "open").length;
  return (
    <section className="card">
      <h2 className="card-title">
        {title}
        {items.length ? <span className="title-count">{items.length}</span> : null}
      </h2>
      {flagOpen && open ? <p className="small warn-text">{open} still open. Decide on them in Reports.</p> : null}
      {items.length ? (
        <ul className="timeline">
          {items.map((item) => (
            <li key={item.id}>
              <p>
                <strong>{REASON_LABEL[item.reason] ?? item.reason}</strong>{" "}
                <span className="muted small">
                  · {item.target_type} · {formatDay(item.created_at)} ·{" "}
                </span>
                <span className={item.status === "open" ? "pill pill-brass" : "pill"}>{STATUS_LABEL[item.status] ?? item.status}</span>
              </p>
              {item.details ? <p className="pre muted">{item.details}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted">{empty}</p>
      )}
    </section>
  );
}
