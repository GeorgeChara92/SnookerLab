import { useState } from "react";
import type { Page } from "../App";
import { formatDayTime } from "../supabase";
import { BarChart } from "../BarChart";

export type OverviewData = {
  generated_at: string;
  players: {
    total: number;
    new_today: number;
    new_7d: number;
    new_30d: number;
    active_1d: number;
    active_7d: number;
    active_30d: number;
  };
  signups: Array<{ day: string; count: number; active: number }>;
  plans: { free: number; half_century: number; century: number };
  coaches: { listed: number; pending_applications: number; approved_30d: number; bookings_30d: number; bookings_waiting: number };
  usage: {
    matches_7d: number;
    matches_30d: number;
    practice_7d: number;
    practice_30d: number;
    analyses_7d: number;
    analyses_30d: number;
    analyses_failed_30d: number;
    messages_7d: number;
    messages_30d: number;
    shared_routines: number;
    groups: number;
    pro_tour_followers: number;
    push_players: number;
  };
  attention: { applications: number; reports: number; feedback_7d: number; errors_24h: number; errors_7d: number };
};

const n = (value: number | undefined) => (value ?? 0).toLocaleString();
const pct = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "—");

type Props = { data: OverviewData | null; error: string | null; onRefresh: () => Promise<void>; onOpen: (page: Page) => void };

export function Overview({ data, error, onRefresh, onOpen }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  if (error) {
    return (
      <>
        <Header refreshing={refreshing} onRefresh={refresh} updated={null} />
        <div className="card error-card">{error}</div>
      </>
    );
  }
  if (!data) {
    return (
      <>
        <Header refreshing={refreshing} onRefresh={refresh} updated={null} />
        <p className="muted">Loading…</p>
      </>
    );
  }

  const { players, plans, coaches, usage, attention } = data;
  const paying = plans.half_century + plans.century;

  return (
    <>
      <Header refreshing={refreshing} onRefresh={refresh} updated={data.generated_at} />

      <section className="board" aria-label="Headline numbers">
        <BoardCell label="Players" value={players.total} sub={`+${n(players.new_7d)} this week`} />
        <BoardCell label="Used the app this week" value={players.active_7d} sub={`${pct(players.active_7d, players.total)} of players`} />
        <BoardCell label="Paying" value={paying} sub={`${pct(paying, players.total)} of players`} accent />
        <BoardCell label="Coaches listed" value={coaches.listed} sub={`${n(coaches.bookings_30d)} bookings in 30 days`} />
      </section>

      <h2 className="section-title">Waiting on you</h2>
      <div className="queue">
        <QueueCard label="Coach applications" count={attention.applications} empty="None waiting" onOpen={() => onOpen("applications")} />
        <QueueCard label="Open reports" count={attention.reports} empty="None open" onOpen={() => onOpen("reports")} urgent />
        <QueueCard label="Crashes, last 24 hours" count={attention.errors_24h} empty="None" onOpen={() => onOpen("crashes")} urgent />
        <QueueCard label="Feedback this week" count={attention.feedback_7d} empty="None" onOpen={() => onOpen("feedback")} />
      </div>

      <div className="charts">
        <div className="card">
          <h3 className="card-title">New players per day</h3>
          <p className="card-sub">Last 30 days · {n(players.new_30d)} in all</p>
          <BarChart points={data.signups.map((point) => ({ day: point.day, value: point.count }))} unit="new player" />
        </div>
        <div className="card">
          <h3 className="card-title">Players who opened the app</h3>
          <p className="card-sub">Each player counted on the last day they were seen · {n(players.active_30d)} in 30 days</p>
          <BarChart points={data.signups.map((point) => ({ day: point.day, value: point.active }))} unit="player" />
        </div>
      </div>

      <div className="grid-3">
        <div className="card">
          <h3 className="card-title">Players</h3>
          <dl className="facts">
            <Fact label="Joined today" value={players.new_today} />
            <Fact label="Joined in 7 days" value={players.new_7d} />
            <Fact label="Joined in 30 days" value={players.new_30d} />
            <Fact label="Seen in 24 hours" value={players.active_1d} />
            <Fact label="Seen in 7 days" value={players.active_7d} />
            <Fact label="Seen in 30 days" value={players.active_30d} />
          </dl>
        </div>
        <div className="card">
          <h3 className="card-title">Plans</h3>
          <dl className="facts">
            <Fact label="Free" value={plans.free} note={pct(plans.free, players.total)} />
            <Fact label="Half Century" value={plans.half_century} note={pct(plans.half_century, players.total)} />
            <Fact label="Century" value={plans.century} note={pct(plans.century, players.total)} />
          </dl>
          <p className="card-foot">From each player's profile, kept in step with RevenueCat. Revenue is in the RevenueCat dashboard.</p>
        </div>
        <div className="card">
          <h3 className="card-title">Coaching</h3>
          <dl className="facts">
            <Fact label="Coaches listed" value={coaches.listed} />
            <Fact label="Applications waiting" value={coaches.pending_applications} />
            <Fact label="Approved in 30 days" value={coaches.approved_30d} />
            <Fact label="Bookings in 30 days" value={coaches.bookings_30d} />
            <Fact label="Booking requests not answered" value={coaches.bookings_waiting} />
          </dl>
        </div>
      </div>

      <div className="card">
        <h3 className="card-title">What's being used</h3>
        <table className="table usage">
          <thead>
            <tr>
              <th scope="col">Feature</th>
              <th scope="col" className="num">7 days</th>
              <th scope="col" className="num">30 days</th>
            </tr>
          </thead>
          <tbody>
            <UsageRow label="Matches recorded" week={usage.matches_7d} month={usage.matches_30d} />
            <UsageRow label="Practice sessions logged" week={usage.practice_7d} month={usage.practice_30d} />
            <UsageRow
              label="AI coach videos"
              week={usage.analyses_7d}
              month={usage.analyses_30d}
              note={usage.analyses_failed_30d ? `${n(usage.analyses_failed_30d)} failed in 30 days` : undefined}
            />
            <UsageRow label="Chat messages sent" week={usage.messages_7d} month={usage.messages_30d} />
          </tbody>
        </table>
        <dl className="facts facts-inline">
          <Fact label="Shared routines" value={usage.shared_routines} />
          <Fact label="Groups" value={usage.groups} />
          <Fact label="Following pro players" value={usage.pro_tour_followers} />
          <Fact label="Players with notifications on" value={usage.push_players} />
        </dl>
      </div>
    </>
  );
}

function Header({ refreshing, onRefresh, updated }: { refreshing: boolean; onRefresh: () => void; updated: string | null }) {
  return (
    <header className="page-head">
      <div>
        <h1 className="page-title">Overview</h1>
        <p className="muted">{updated ? `Updated ${formatDayTime(updated)} · refreshes every minute` : "Live numbers from the database"}</p>
      </div>
      <button type="button" className="btn" onClick={onRefresh} disabled={refreshing}>
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </header>
  );
}

function BoardCell({ label, value, sub, accent }: { label: string; value: number; sub: string; accent?: boolean }) {
  return (
    <div className="board-cell">
      <p className="board-label">{label}</p>
      <p className={accent ? "board-value accent" : "board-value"}>{n(value)}</p>
      <p className="board-sub">{sub}</p>
    </div>
  );
}

function QueueCard({ label, count, empty, onOpen, urgent }: { label: string; count: number; empty: string; onOpen: () => void; urgent?: boolean }) {
  const has = count > 0;
  return (
    <button type="button" className={`queue-card${has ? (urgent ? " urgent" : " waiting") : ""}`} onClick={onOpen}>
      <span className="queue-count">{has ? n(count) : "0"}</span>
      <span className="queue-label">{label}</span>
      <span className="queue-state">{has ? "Open →" : empty}</span>
    </button>
  );
}

function Fact({ label, value, note }: { label: string; value: number; note?: string }) {
  return (
    <div className="fact">
      <dt>{label}</dt>
      <dd>
        {n(value)}
        {note ? <span className="fact-note">{note}</span> : null}
      </dd>
    </div>
  );
}

function UsageRow({ label, week, month, note }: { label: string; week: number; month: number; note?: string }) {
  return (
    <tr>
      <th scope="row">
        {label}
        {note ? <span className="row-note">{note}</span> : null}
      </th>
      <td className="num">{n(week)}</td>
      <td className="num">{n(month)}</td>
    </tr>
  );
}
