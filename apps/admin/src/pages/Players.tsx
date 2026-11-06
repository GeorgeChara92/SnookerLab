import { useEffect, useState } from "react";
import { TIER_LABEL, ago, formatDay, supabase } from "../supabase";
import { PlayerDetail } from "./PlayerDetail";

type Player = {
  id: string;
  email: string | null;
  display_name: string | null;
  handle: string | null;
  subscription_tier: string;
  is_coach: boolean;
  hidden: boolean;
  confirmed: boolean;
  joined: string;
  last_seen: string | null;
  total: number;
};

type Filters = { plan: string; kind: string; activity: string; account: string; sort: string };

const NONE: Filters = { plan: "", kind: "", activity: "", account: "", sort: "newest" };
const PAGE = 100;

const FILTERS: Array<{ key: keyof Filters; label: string; options: Array<[string, string]> }> = [
  {
    key: "plan",
    label: "Plan",
    options: [
      ["", "Any plan"],
      ["paying", "Paying"],
      ["free", "Free"],
      ["half_century", "Half Century"],
      ["century", "Century"],
    ],
  },
  {
    key: "kind",
    label: "Type",
    options: [
      ["", "Players and coaches"],
      ["coach", "Coaches"],
      ["player", "Players only"],
    ],
  },
  {
    key: "activity",
    label: "Last seen",
    options: [
      ["", "Any time"],
      ["today", "In the last 24 hours"],
      ["week", "In the last 7 days"],
      ["month", "In the last 30 days"],
      ["quiet", "Not in 30 days"],
      ["never", "Never"],
    ],
  },
  {
    key: "account",
    label: "Account",
    options: [
      ["", "Any account"],
      ["unconfirmed", "Email not confirmed"],
      ["hidden", "Hidden profile"],
    ],
  },
  {
    key: "sort",
    label: "Sort",
    options: [
      ["newest", "Newest first"],
      ["oldest", "Oldest first"],
      ["last_seen", "Seen most recently"],
      ["name", "Name A–Z"],
    ],
  },
];

const selectedFromHash = () => {
  const [page, id] = window.location.hash.replace("#", "").split("/");
  return page === "players" && id ? id : null;
};

/** Every account, filtered and searchable. Click one to see everything about them. */
export function Players() {
  const [selected, setSelected] = useState<string | null>(selectedFromHash);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(NONE);
  const [rows, setRows] = useState<Player[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onHash = () => setSelected(selectedFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  // Searches a moment after typing stops rather than on every key.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const fetchPage = (skip: number) =>
    supabase.rpc("admin_players", {
      search: query || null,
      plan: filters.plan || null,
      kind: filters.kind || null,
      activity: filters.activity || null,
      account: filters.account || null,
      sort: filters.sort,
      lim: PAGE,
      skip,
    });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void fetchPage(0).then(({ data, error: rpcError }) => {
      if (cancelled) return;
      const list = (data ?? []) as Player[];
      setError(rpcError ? rpcError.message : null);
      setRows(list);
      setTotal(list[0]?.total ?? 0);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
    // fetchPage reads query and filters, which are what this depends on.
  }, [query, filters, version]);

  const loadMore = async () => {
    setLoadingMore(true);
    const { data } = await fetchPage(rows.length);
    setRows((prev) => [...prev, ...((data ?? []) as Player[])]);
    setLoadingMore(false);
  };

  const open = (id: string) => {
    window.location.hash = `players/${id}`;
  };

  if (selected) {
    return (
      <PlayerDetail
        id={selected}
        onBack={() => {
          window.location.hash = "players";
        }}
        onChanged={() => setVersion((value) => value + 1)}
      />
    );
  }

  const filtered = Object.entries(filters).some(([key, value]) => (key === "sort" ? value !== "newest" : value !== "")) || Boolean(query);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Players</h1>
          <p className="muted">
            {loading ? "Loading…" : `${total.toLocaleString()} ${total === 1 ? "account" : "accounts"}${filtered ? " match" : ""}`}
          </p>
        </div>
        <label className="search">
          <span className="sr-only">Search players</span>
          <input type="search" placeholder="Search name, @handle or email" value={search} onChange={(event) => setSearch(event.target.value)} />
        </label>
      </header>

      <div className="filters" role="group" aria-label="Filter players">
        {FILTERS.map((filter) => (
          <label key={filter.key} className={filters[filter.key] && filter.key !== "sort" ? "filter on" : "filter"}>
            <span>{filter.label}</span>
            <select value={filters[filter.key]} onChange={(event) => setFilters((prev) => ({ ...prev, [filter.key]: event.target.value }))}>
              {filter.options.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        ))}
        {filtered ? (
          <button
            type="button"
            className="link-btn"
            onClick={() => {
              setFilters(NONE);
              setSearch("");
            }}
          >
            Clear all
          </button>
        ) : null}
      </div>

      {error ? <div className="card error-card">{error}</div> : null}

      <div className="card table-card">
        <div className="table-scroll">
          <table className="table players">
            <thead>
              <tr>
                <th scope="col">Player</th>
                <th scope="col">Email</th>
                <th scope="col">Plan</th>
                <th scope="col">Joined</th>
                <th scope="col">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="clickable" onClick={() => open(row.id)}>
                  <th scope="row">
                    <button type="button" className="row-link" onClick={(event) => {
                      event.stopPropagation();
                      open(row.id);
                    }}>
                      {row.display_name?.trim() || "No name yet"}
                    </button>
                    {row.handle ? <span className="row-note">@{row.handle}</span> : null}
                    <span className="pill-row inline">
                      {row.is_coach ? <span className="pill pill-good">Coach</span> : null}
                      {row.hidden ? <span className="pill pill-bad">Hidden</span> : null}
                      {!row.confirmed ? <span className="pill">Email not confirmed</span> : null}
                    </span>
                  </th>
                  <td className="cell-email">{row.email ?? "—"}</td>
                  <td>
                    <span className={row.subscription_tier === "free" ? "plan" : "plan plan-paid"}>
                      {TIER_LABEL[row.subscription_tier] ?? row.subscription_tier}
                    </span>
                  </td>
                  <td>{formatDay(row.joined)}</td>
                  <td>{ago(row.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!loading && rows.length === 0 && !error ? <p className="empty">No players match. Try clearing a filter.</p> : null}
        {!loading && rows.length < total ? (
          <div className="load-more">
            <button type="button" className="btn" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore ? "Loading…" : `Show more (${(total - rows.length).toLocaleString()} left)`}
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
