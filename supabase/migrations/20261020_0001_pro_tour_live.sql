-- Live scores and results from the snooker.org API (api.snooker.org), approved for this app under
-- the header value "CharalambousAppSnookered440" - see poll-pro-tour, the only caller of that API.
--
-- snooker.org enforces a 2 requests/minute limit, shared across every user of this app, so no
-- client ever calls it directly: poll-pro-tour polls on a schedule and writes here; the app just
-- reads these tables (and subscribes to pro_tour_matches for live updates) like any other data.
--
-- Public read-only cache: anyone signed in can see pro tour scores, but only the service role
-- (poll-pro-tour) can write, so there are no insert/update/delete policies at all.
--
-- Safe to run more than once.

begin;

create table if not exists public.pro_tour_events (
  id bigint primary key,
  name text,
  season int,
  tour text,
  start_date timestamptz,
  end_date timestamptz,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_tour_players (
  id bigint primary key,
  display_name text not null,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.pro_tour_matches (
  id bigint primary key,
  event_id bigint not null,
  round int not null,
  number int not null,
  player1_id bigint,
  player2_id bigint,
  score1 int not null default 0,
  score2 int not null default 0,
  winner_id bigint,
  unfinished boolean not null default false,
  on_break boolean not null default false,
  scheduled_at timestamptz,
  live_url text,
  details_url text,
  table_no int,
  note text,
  raw jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists pro_tour_matches_event_id_idx on public.pro_tour_matches (event_id);
create index if not exists pro_tour_matches_unfinished_idx on public.pro_tour_matches (unfinished) where unfinished;

create table if not exists public.pro_tour_rankings (
  ranking_type text not null,
  season int not null,
  rows jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (ranking_type, season)
);

-- Tracks when each kind of snooker.org data was last polled, so poll-pro-tour can decide what is
-- due next and never make more than one call per invocation.
create table if not exists public.pro_tour_poll_state (
  kind text primary key,
  last_fetched_at timestamptz,
  last_error text,
  -- Small cached values that aren't worth their own table, e.g. {"season": 2026} from t=20.
  last_value jsonb
);

alter table public.pro_tour_events enable row level security;
alter table public.pro_tour_players enable row level security;
alter table public.pro_tour_matches enable row level security;
alter table public.pro_tour_rankings enable row level security;
alter table public.pro_tour_poll_state enable row level security;

drop policy if exists "pro tour events are publicly readable" on public.pro_tour_events;
create policy "pro tour events are publicly readable" on public.pro_tour_events for select using (true);

drop policy if exists "pro tour players are publicly readable" on public.pro_tour_players;
create policy "pro tour players are publicly readable" on public.pro_tour_players for select using (true);

drop policy if exists "pro tour matches are publicly readable" on public.pro_tour_matches;
create policy "pro tour matches are publicly readable" on public.pro_tour_matches for select using (true);

drop policy if exists "pro tour rankings are publicly readable" on public.pro_tour_rankings;
create policy "pro tour rankings are publicly readable" on public.pro_tour_rankings for select using (true);

-- poll_state is operational bookkeeping, not app content - no public policy, so only the service
-- role (which bypasses RLS) can read or write it.

do $$
declare
  target text;
begin
  foreach target in array array['pro_tour_matches']
  loop
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end
$$;

commit;
