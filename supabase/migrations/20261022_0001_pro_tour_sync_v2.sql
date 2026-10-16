-- Pro tour sync v2 (poll-pro-tour v5).
--
-- pro_tour_fetch_log: what poll-pro-tour has already asked snooker.org for, per kind and target
-- (an event id, a player id). The backfills used to decide "still missing" from the cache alone,
-- so an event that legitimately has nothing yet (a future tournament with no draw, an event with
-- no round info) looked missing forever and was re-requested every tick - the queue stalled on it
-- and nothing behind it was ever fetched. Service role only: it's bookkeeping, not app data.
--
-- pro_tour_event_extras: extra per-event data the app shows on a tournament page, starting with
-- `finals` (snooker.org t=19: the final of every past edition - the roll of honour).
--
-- Safe to run more than once.

begin;

create table if not exists public.pro_tour_fetch_log (
  kind text not null,
  target bigint not null,
  fetched_at timestamptz not null default now(),
  rows int not null default 0,
  primary key (kind, target)
);

alter table public.pro_tour_fetch_log enable row level security;

create table if not exists public.pro_tour_event_extras (
  event_id bigint not null,
  kind text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, kind)
);

alter table public.pro_tour_event_extras enable row level security;

drop policy if exists "pro tour event extras are publicly readable" on public.pro_tour_event_extras;
create policy "pro tour event extras are publicly readable" on public.pro_tour_event_extras for select using (true);

-- The app now reads matches by date window and by event, not "the first 300 by date".
create index if not exists pro_tour_matches_scheduled_at_idx on public.pro_tour_matches (scheduled_at);
create index if not exists pro_tour_matches_event_idx on public.pro_tour_matches (event_id, round);
create index if not exists pro_tour_matches_player1_idx on public.pro_tour_matches (player1_id);
create index if not exists pro_tour_matches_player2_idx on public.pro_tour_matches (player2_id);
create index if not exists pro_tour_events_dates_idx on public.pro_tour_events (start_date, end_date);

commit;
