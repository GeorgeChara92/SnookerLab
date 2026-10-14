-- A fixture's "Round" from the snooker.org API (20261020_0001_pro_tour_live.sql) is just a number,
-- and what it means isn't fixed across events: round 17 is a quarter-final in a 128-player ranking
-- event but could be the final of a small invitational. snooker.org's own "round info" endpoint
-- (t=12&e=<event>) gives the real name for each round of a specific event, which is what this
-- caches - poll-pro-tour backfills it one event at a time, same shape as pro_tour_players and
-- pro_tour_events filling in gradually rather than all at once.
--
-- Safe to run more than once.

begin;

create table if not exists public.pro_tour_rounds (
  event_id bigint not null,
  round int not null,
  name text,
  raw jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (event_id, round)
);

alter table public.pro_tour_rounds enable row level security;

drop policy if exists "pro tour round names are publicly readable" on public.pro_tour_rounds;
create policy "pro tour round names are publicly readable" on public.pro_tour_rounds for select using (true);

commit;
