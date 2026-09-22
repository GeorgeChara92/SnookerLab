-- Shared routines, likes, and leaderboards.
--
-- A player can publish one of their own routines to the community (for everyone, or only for
-- people with the link). Others can like it, save a copy to their own routines, and post their
-- best score on it. Every routine - the library's and shared ones - has a leaderboard of each
-- player's best, and there is a leaderboard across all players for XP, high break and centuries.
--
-- Leaderboards are opt-out: a player who turns "Appear on leaderboards" off is left out of all
-- of them. Shared routines use the same word filter, reports and auto-hide as profiles.
--
-- Safe to run more than once. Needs 20260924_0001_community_foundations.sql first.

-- ------------------------------------------------------------------ more of the profile
alter table public.profiles add column if not exists cue_preference text;
alter table public.profiles add column if not exists leaderboards boolean not null default true;
-- For the all-player leaderboards, written by the player's own app; null while they opt out.
alter table public.profiles add column if not exists best_break integer;
alter table public.profiles add column if not exists centuries integer;
alter table public.profiles add column if not exists matches_won integer;
alter table public.profiles add column if not exists joined_at timestamptz default now();

create index if not exists idx_profiles_board_xp on public.profiles (xp desc) where leaderboards and hidden_at is null;
create index if not exists idx_profiles_board_break on public.profiles (best_break desc) where leaderboards and hidden_at is null;

-- ------------------------------------------------------------------ shared routines
create table if not exists public.shared_routines (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  max_score integer check (max_score is null or (max_score between 1 and 999)),
  balls jsonb not null default '[]'::jsonb,
  -- 'public' shows in the library; 'link' only opens for someone with the link.
  visibility text not null default 'public' check (visibility in ('public', 'link')),
  likes_count integer not null default 0,
  saves_count integer not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shared_routines_top on public.shared_routines (likes_count desc, created_at desc)
  where visibility = 'public' and hidden_at is null;
create index if not exists idx_shared_routines_new on public.shared_routines (created_at desc)
  where visibility = 'public' and hidden_at is null;
create index if not exists idx_shared_routines_owner on public.shared_routines (owner);

alter table public.shared_routines enable row level security;
drop policy if exists shared_routines_select on public.shared_routines;
drop policy if exists shared_routines_insert_own on public.shared_routines;
drop policy if exists shared_routines_update_own on public.shared_routines;
drop policy if exists shared_routines_delete_own on public.shared_routines;
drop policy if exists shared_routines_admin on public.shared_routines;
create policy shared_routines_select on public.shared_routines for select using (
  auth.uid() = owner
  or public.is_admin()
  or (auth.role() = 'authenticated' and hidden_at is null and not public.is_blocked(auth.uid(), owner))
);
create policy shared_routines_insert_own on public.shared_routines for insert with check (auth.uid() = owner);
create policy shared_routines_update_own on public.shared_routines for update using (auth.uid() = owner) with check (auth.uid() = owner);
create policy shared_routines_delete_own on public.shared_routines for delete using (auth.uid() = owner or public.is_admin());
create policy shared_routines_admin on public.shared_routines for update using (public.is_admin());

-- Words, counts and hiding are the database's business, not the owner's.
create or replace function public.shared_routines_guard()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.name) or public.contains_blocked_word(new.description) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' and current_setting('snooker.counting', true) is distinct from 'on' then
    new.likes_count := old.likes_count;
    new.saves_count := old.saves_count;
    if not public.is_admin() and current_setting('snooker.moderating', true) is distinct from 'on' then
      new.hidden_at := old.hidden_at;
    end if;
  end if;
  if tg_op = 'INSERT' then
    new.likes_count := 0;
    new.saves_count := 0;
    new.hidden_at := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists shared_routines_guard on public.shared_routines;
create trigger shared_routines_guard before insert or update on public.shared_routines
  for each row execute function public.shared_routines_guard();

-- ------------------------------------------------------------------ likes and saves
create table if not exists public.routine_likes (
  routine_id uuid not null references public.shared_routines(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (routine_id, user_id)
);
create table if not exists public.routine_saves (
  routine_id uuid not null references public.shared_routines(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (routine_id, user_id)
);
create index if not exists idx_routine_likes_user on public.routine_likes (user_id);
create index if not exists idx_routine_saves_user on public.routine_saves (user_id);

alter table public.routine_likes enable row level security;
alter table public.routine_saves enable row level security;
drop policy if exists routine_likes_select_own on public.routine_likes;
drop policy if exists routine_likes_insert_own on public.routine_likes;
drop policy if exists routine_likes_delete_own on public.routine_likes;
drop policy if exists routine_saves_select_own on public.routine_saves;
drop policy if exists routine_saves_insert_own on public.routine_saves;
drop policy if exists routine_saves_delete_own on public.routine_saves;
create policy routine_likes_select_own on public.routine_likes for select using (auth.uid() = user_id);
create policy routine_likes_insert_own on public.routine_likes for insert with check (auth.uid() = user_id);
create policy routine_likes_delete_own on public.routine_likes for delete using (auth.uid() = user_id);
create policy routine_saves_select_own on public.routine_saves for select using (auth.uid() = user_id);
create policy routine_saves_insert_own on public.routine_saves for insert with check (auth.uid() = user_id);
create policy routine_saves_delete_own on public.routine_saves for delete using (auth.uid() = user_id);

-- The counts on each routine follow the likes and saves.
create or replace function public.routine_counts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid := coalesce(new.routine_id, old.routine_id);
begin
  perform set_config('snooker.counting', 'on', true);
  if tg_table_name = 'routine_likes' then
    update public.shared_routines
      set likes_count = (select count(*) from public.routine_likes where routine_id = target)
      where id = target;
  else
    update public.shared_routines
      set saves_count = (select count(*) from public.routine_saves where routine_id = target)
      where id = target;
  end if;
  perform set_config('snooker.counting', 'off', true);
  return null;
end;
$$;
drop trigger if exists routine_likes_count on public.routine_likes;
create trigger routine_likes_count after insert or delete on public.routine_likes
  for each row execute function public.routine_counts();
drop trigger if exists routine_saves_count on public.routine_saves;
create trigger routine_saves_count after insert or delete on public.routine_saves
  for each row execute function public.routine_counts();

-- ------------------------------------------------------------------ the player's own copies
-- A routine the player published, and a routine they saved from someone else, remember where
-- they came from, so scores on either count on the shared routine's leaderboard.
alter table public.custom_routines add column if not exists shared_id uuid references public.shared_routines(id) on delete set null;
alter table public.custom_routines add column if not exists source_shared_id uuid references public.shared_routines(id) on delete set null;

-- ------------------------------------------------------------------ routine leaderboards
-- Each player's best on each routine. routine_key is a library routine's id ("routine-line-up")
-- or "shared:" and a shared routine's id.
create table if not exists public.routine_bests (
  routine_key text not null check (char_length(routine_key) between 3 and 80),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  best numeric not null,
  best_raw text not null check (char_length(best_raw) <= 20),
  -- 'number', 'percent', or 'time' (seconds, less is better).
  kind text not null check (kind in ('number', 'percent', 'time')),
  scores integer not null default 1,
  updated_at timestamptz not null default now(),
  primary key (routine_key, user_id)
);
create index if not exists idx_routine_bests_board on public.routine_bests (routine_key, best desc);

alter table public.routine_bests enable row level security;
drop policy if exists routine_bests_select on public.routine_bests;
drop policy if exists routine_bests_write_own on public.routine_bests;
drop policy if exists routine_bests_update_own on public.routine_bests;
drop policy if exists routine_bests_delete_own on public.routine_bests;
-- Everyone's bests, except players who have left the leaderboards, are hidden, or are blocked.
create policy routine_bests_select on public.routine_bests for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = user_id and p.leaderboards and p.hidden_at is null and not public.is_blocked(auth.uid(), p.id)
  )
);
create policy routine_bests_write_own on public.routine_bests for insert with check (auth.uid() = user_id);
create policy routine_bests_update_own on public.routine_bests for update using (auth.uid() = user_id);
create policy routine_bests_delete_own on public.routine_bests for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------------ reports on routines
-- Three players reporting a shared routine hides it too.
create or replace function public.reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(distinct reporter) from public.reports
    where target_type = new.target_type and target_id = new.target_id and status = 'open'
  ) >= 3 then
    perform set_config('snooker.moderating', 'on', true);
    if new.target_type = 'profile' then
      update public.profiles set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    elsif new.target_type = 'routine' then
      update public.shared_routines set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ live updates
do $$
declare t text;
begin
  foreach t in array array['shared_routines'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
