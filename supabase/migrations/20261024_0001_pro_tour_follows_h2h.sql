-- Pro tour v3: following players (with push notifications), head-to-head records, and the
-- bookkeeping poll-pro-tour needs to notify followers once per match event.
--
--   pro_tour_follows        who follows which pro player (the user's own rows only)
--   push_tokens             a device's Expo push token, per signed-in user (own rows only)
--   pro_tour_h2h            head-to-head meetings between two players, cached by poll-pro-tour
--   pro_tour_notifications  which (match, kind) notifications have gone out - service role only
--
-- Safe to run more than once.

begin;

create table if not exists public.pro_tour_follows (
  user_id uuid not null references auth.users (id) on delete cascade,
  player_id bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, player_id)
);
alter table public.pro_tour_follows enable row level security;
drop policy if exists "users manage their own pro follows" on public.pro_tour_follows;
create policy "users manage their own pro follows" on public.pro_tour_follows
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists pro_tour_follows_player_idx on public.pro_tour_follows (player_id);

create table if not exists public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  platform text,
  updated_at timestamptz not null default now()
);
alter table public.push_tokens enable row level security;
drop policy if exists "users manage their own push tokens" on public.push_tokens;
create policy "users manage their own push tokens" on public.push_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists push_tokens_user_idx on public.push_tokens (user_id);

-- player_a < player_b always, so a pair has one row whichever way round it's asked for.
create table if not exists public.pro_tour_h2h (
  player_a bigint not null,
  player_b bigint not null,
  matches jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (player_a, player_b)
);
alter table public.pro_tour_h2h enable row level security;
drop policy if exists "pro tour head to heads are publicly readable" on public.pro_tour_h2h;
create policy "pro tour head to heads are publicly readable" on public.pro_tour_h2h for select using (true);

create table if not exists public.pro_tour_notifications (
  match_id bigint not null,
  kind text not null,
  sent_at timestamptz not null default now(),
  primary key (match_id, kind)
);
alter table public.pro_tour_notifications enable row level security;

commit;
