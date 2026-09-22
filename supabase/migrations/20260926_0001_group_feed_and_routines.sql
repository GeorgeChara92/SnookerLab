-- The group feed, and routines pinned to a group.
--
-- activity: what a player has done worth telling people about - a match result, a century, a
-- maximum, a new high break, a personal best on a routine, a new level. The app posts these as
-- they happen. Friends and players who share a group see them, unless the player has turned
-- "share my results" off, is hidden, or either has blocked the other. A group's feed is its
-- members' activity.
--
-- group_routines: routines a group's owner and admins pin for the group, each with a leaderboard
-- of the members' bests (read from routine_bests).
--
-- Safe to run more than once. Needs the community and chat migrations first.

alter table public.profiles add column if not exists share_activity boolean not null default true;

-- ------------------------------------------------------------------ activity
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('match', 'century', 'maximum', 'high_break', 'personal_best', 'level_up', 'achievement')),
  title text not null check (char_length(title) between 1 and 120),
  detail text check (detail is null or char_length(detail) <= 200),
  payload jsonb,
  -- The same moment is only ever posted once ("match:<id>", "level:12", ...).
  dedupe_key text not null check (char_length(dedupe_key) between 1 and 120),
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);
create index if not exists idx_activity_user on public.activity (user_id, created_at desc);

-- Whether two players are in a group together.
create or replace function public.shares_group(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.group_members x
    join public.group_members y on y.group_id = x.group_id
    where x.user_id = a and y.user_id = b
  );
$$;

alter table public.activity enable row level security;
drop policy if exists activity_select on public.activity;
drop policy if exists activity_insert_own on public.activity;
drop policy if exists activity_delete_own on public.activity;
create policy activity_select on public.activity for select using (
  auth.uid() = user_id
  or (
    exists (select 1 from public.profiles p where p.id = user_id and p.share_activity and p.hidden_at is null)
    and not public.is_blocked(auth.uid(), user_id)
    and (public.are_friends(auth.uid(), user_id) or public.shares_group(auth.uid(), user_id))
  )
);
create policy activity_insert_own on public.activity for insert with check (auth.uid() = user_id);
create policy activity_delete_own on public.activity for delete using (auth.uid() = user_id);

-- Titles can carry an opponent's name as typed, so they go through the word filter too.
create or replace function public.activity_check_words()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.title) or public.contains_blocked_word(new.detail) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists activity_check_words on public.activity;
create trigger activity_check_words before insert on public.activity
  for each row execute function public.activity_check_words();

-- ------------------------------------------------------------------ group routines
create table if not exists public.group_routines (
  group_id uuid not null references public.groups(id) on delete cascade,
  -- A library routine's id, or "shared:" and a shared routine's id, as in routine_bests.
  routine_key text not null check (char_length(routine_key) between 3 and 80),
  name text not null check (char_length(name) between 1 and 60),
  added_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, routine_key)
);

alter table public.group_routines enable row level security;
drop policy if exists group_routines_select on public.group_routines;
drop policy if exists group_routines_insert on public.group_routines;
drop policy if exists group_routines_delete on public.group_routines;
create policy group_routines_select on public.group_routines for select using (
  public.group_role(group_id, auth.uid()) is not null
  or exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public' and g.hidden_at is null)
);
create policy group_routines_insert on public.group_routines for insert with check (
  auth.uid() = added_by and public.group_role(group_id, auth.uid()) in ('owner', 'admin')
);
create policy group_routines_delete on public.group_routines for delete using (
  public.group_role(group_id, auth.uid()) in ('owner', 'admin')
);

-- Twelve pinned routines at most, and names through the word filter.
create or replace function public.group_routines_guard()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.group_routines where group_id = new.group_id) >= 12 then
    raise exception 'A group can pin up to 12 routines.';
  end if;
  if public.contains_blocked_word(new.name) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists group_routines_guard on public.group_routines;
create trigger group_routines_guard before insert on public.group_routines
  for each row execute function public.group_routines_guard();
