-- Community foundations: public profiles, friends, blocking, reporting and privacy.
--
-- Every player has a row in `profiles`. Until now only its owner could read it. From here a
-- player's public face - their @handle, name, avatar, level and the stats they choose to show -
-- can be read by other signed-in players, unless either has blocked the other or the profile
-- has been hidden for moderation.
--
-- Moderation (Apple guideline 1.2 for user-generated content):
--   * words that are not allowed are refused in handles and bios by the database itself;
--   * anyone can report a profile; three reports from different players hide it until an
--     admin reviews it;
--   * anyone can block anyone: it ends a friendship and stops requests both ways;
--   * admins (the app_admins table) see and resolve reports.
--
-- Safe to run more than once.

-- ------------------------------------------------------------------ the public profile
alter table public.profiles add column if not exists handle text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists avatar_preset text;
alter table public.profiles add column if not exists skill_level text;
-- Who can find this player in search: 'everyone' or 'nobody' (friends can always see them).
alter table public.profiles add column if not exists discoverable boolean not null default true;
-- Who can message them, for chat: 'everyone' (as a request), 'friends' or 'nobody'.
alter table public.profiles add column if not exists message_privacy text not null default 'everyone';
-- Whether their stats are shown to others: 'everyone', 'friends' or 'nobody'.
alter table public.profiles add column if not exists stats_privacy text not null default 'friends';
-- Set when enough players report the profile; hidden from everyone else until reviewed.
alter table public.profiles add column if not exists hidden_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_handle_format') then
    alter table public.profiles add constraint profiles_handle_format
      check (handle is null or handle ~ '^[a-z0-9_.]{3,20}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_message_privacy') then
    alter table public.profiles add constraint profiles_message_privacy
      check (message_privacy in ('everyone', 'friends', 'nobody'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_stats_privacy') then
    alter table public.profiles add constraint profiles_stats_privacy
      check (stats_privacy in ('everyone', 'friends', 'nobody'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_bio_length') then
    alter table public.profiles add constraint profiles_bio_length check (bio is null or char_length(bio) <= 160);
  end if;
end
$$;

create unique index if not exists idx_profiles_handle on public.profiles (handle) where handle is not null;
create index if not exists idx_profiles_display_name on public.profiles (lower(display_name));

-- ------------------------------------------------------------------ words not allowed
create table if not exists public.blocked_words (
  word text primary key
);
alter table public.blocked_words enable row level security;
drop policy if exists blocked_words_read on public.blocked_words;
create policy blocked_words_read on public.blocked_words for select using (auth.role() = 'authenticated');

-- A starting list; admins add to it in the table editor. Matched as whole words, ignoring case,
-- with common letter swaps (0 for o, 1 for i and so on) undone first.
insert into public.blocked_words (word) values
  ('fuck'), ('fucker'), ('fucking'), ('motherfucker'), ('shit'), ('shite'), ('bullshit'), ('cunt'),
  ('twat'), ('wanker'), ('bitch'), ('bastard'), ('dickhead'), ('prick'), ('pussy'), ('cock'),
  ('slut'), ('whore'), ('nazi'), ('rape'), ('rapist'), ('retard'), ('paedo'), ('pedo')
on conflict do nothing;

create or replace function public.contains_blocked_word(input text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocked_words w
    where translate(lower(coalesce(input, '')), '0134@$57', 'oieaasst') ~ ('(^|[^a-z])' || w.word || '($|[^a-z])')
  );
$$;

create or replace function public.profiles_check_words()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.handle) or public.contains_blocked_word(new.display_name)
     or public.contains_blocked_word(new.bio) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_check_words on public.profiles;
create trigger profiles_check_words before insert or update of handle, display_name, bio on public.profiles
  for each row execute function public.profiles_check_words();

-- ------------------------------------------------------------------ blocking
create table if not exists public.blocks (
  blocker uuid not null default auth.uid() references auth.users(id) on delete cascade,
  blocked uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists blocks_select_own on public.blocks;
drop policy if exists blocks_insert_own on public.blocks;
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_select_own on public.blocks for select using (auth.uid() = blocker);
create policy blocks_insert_own on public.blocks for insert with check (auth.uid() = blocker);
create policy blocks_delete_own on public.blocks for delete using (auth.uid() = blocker);

-- Either player blocking the other. Security definer so it can see blocks made by the other side.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks
    where (blocker = a and blocked = b) or (blocker = b and blocked = a)
  );
$$;

-- ------------------------------------------------------------------ friends
create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester uuid not null default auth.uid() references auth.users(id) on delete cascade,
  addressee uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  check (requester <> addressee)
);
-- One friendship per pair, whoever asked.
create unique index if not exists idx_friendships_pair
  on public.friendships (least(requester, addressee), greatest(requester, addressee));
create index if not exists idx_friendships_addressee on public.friendships (addressee, status);
create index if not exists idx_friendships_requester on public.friendships (requester, status);

alter table public.friendships enable row level security;
drop policy if exists friendships_select_own on public.friendships;
drop policy if exists friendships_insert_own on public.friendships;
drop policy if exists friendships_accept on public.friendships;
drop policy if exists friendships_delete_own on public.friendships;
create policy friendships_select_own on public.friendships
  for select using (auth.uid() in (requester, addressee));
-- A request can only be sent as pending, and not between players where either has blocked the other.
create policy friendships_insert_own on public.friendships
  for insert with check (auth.uid() = requester and status = 'pending' and not public.is_blocked(requester, addressee));
-- Only the player asked can accept.
create policy friendships_accept on public.friendships
  for update using (auth.uid() = addressee) with check (auth.uid() = addressee and status = 'accepted');
-- Either player can cancel, decline or unfriend.
create policy friendships_delete_own on public.friendships
  for delete using (auth.uid() in (requester, addressee));

create or replace function public.are_friends(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
    where status = 'accepted'
      and ((requester = a and addressee = b) or (requester = b and addressee = a))
  );
$$;

-- Blocking someone ends any friendship or request between the two.
create or replace function public.blocks_end_friendship()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.friendships
  where (requester = new.blocker and addressee = new.blocked) or (requester = new.blocked and addressee = new.blocker);
  return new;
end;
$$;
drop trigger if exists blocks_end_friendship on public.blocks;
create trigger blocks_end_friendship after insert on public.blocks
  for each row execute function public.blocks_end_friendship();

-- The two players in a friendship never change once it exists; only its status does.
create or replace function public.friendships_freeze()
returns trigger
language plpgsql
as $$
begin
  if new.requester <> old.requester or new.addressee <> old.addressee then
    raise exception 'A friendship cannot be moved to other players.';
  end if;
  new.responded_at := now();
  return new;
end;
$$;
drop trigger if exists friendships_freeze on public.friendships;
create trigger friendships_freeze before update on public.friendships
  for each row execute function public.friendships_freeze();

-- ------------------------------------------------------------------ admins
create table if not exists public.app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.app_admins enable row level security;
drop policy if exists app_admins_select_self on public.app_admins;
create policy app_admins_select_self on public.app_admins for select using (auth.uid() = user_id);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins where user_id = auth.uid());
$$;

-- ------------------------------------------------------------------ who can see a profile
drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_select_visible on public.profiles;
create policy profiles_select_visible on public.profiles for select using (
  auth.uid() = id
  or public.is_admin()
  or (
    auth.role() = 'authenticated'
    and hidden_at is null
    and not public.is_blocked(auth.uid(), id)
  )
);
-- A player cannot unhide themselves: hidden_at is only changed by the moderation trigger and admins.
create or replace function public.profiles_protect_hidden()
returns trigger
language plpgsql
as $$
begin
  if new.hidden_at is distinct from old.hidden_at and not public.is_admin()
     and current_setting('snooker.moderating', true) is distinct from 'on' then
    new.hidden_at := old.hidden_at;
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_protect_hidden on public.profiles;
create trigger profiles_protect_hidden before update on public.profiles
  for each row execute function public.profiles_protect_hidden();

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update using (public.is_admin());

-- ------------------------------------------------------------------ stats others may see
-- A summary of the player's record (wins, high break, centuries, level...), written by their own
-- app. In its own table so the database, not the app, decides who can read it.
create table if not exists public.profile_stats (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  stats jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.profile_stats enable row level security;
drop policy if exists profile_stats_write_own on public.profile_stats;
drop policy if exists profile_stats_update_own on public.profile_stats;
drop policy if exists profile_stats_select on public.profile_stats;
create policy profile_stats_write_own on public.profile_stats for insert with check (auth.uid() = user_id);
create policy profile_stats_update_own on public.profile_stats for update using (auth.uid() = user_id);
create policy profile_stats_select on public.profile_stats for select using (
  auth.uid() = user_id
  or exists (
    select 1 from public.profiles p
    where p.id = user_id
      and p.hidden_at is null
      and not public.is_blocked(auth.uid(), p.id)
      and (p.stats_privacy = 'everyone' or (p.stats_privacy = 'friends' and public.are_friends(auth.uid(), p.id)))
  )
);

-- ------------------------------------------------------------------ reports
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null default auth.uid() references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('profile', 'message', 'routine', 'group')),
  target_id text not null,
  reported_user uuid references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'harassment', 'hate', 'inappropriate', 'impersonation', 'other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id)
);
-- One report per player per thing.
create unique index if not exists idx_reports_once on public.reports (reporter, target_type, target_id);
create index if not exists idx_reports_open on public.reports (status, created_at desc);

alter table public.reports enable row level security;
drop policy if exists reports_insert_own on public.reports;
drop policy if exists reports_select_own on public.reports;
drop policy if exists reports_admin_update on public.reports;
create policy reports_insert_own on public.reports for insert with check (auth.uid() = reporter and status = 'open');
create policy reports_select_own on public.reports for select using (auth.uid() = reporter or public.is_admin());
create policy reports_admin_update on public.reports for update using (public.is_admin());

-- Three players reporting the same profile hides it until an admin looks.
create or replace function public.reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.target_type = 'profile' and (
    select count(distinct reporter) from public.reports
    where target_type = 'profile' and target_id = new.target_id and status = 'open'
  ) >= 3 then
    perform set_config('snooker.moderating', 'on', true);
    update public.profiles set hidden_at = now() where id::text = new.target_id and hidden_at is null;
  end if;
  return new;
end;
$$;
drop trigger if exists reports_auto_hide on public.reports;
create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.reports_auto_hide();

-- ------------------------------------------------------------------ live updates
do $$
declare t text;
begin
  foreach t in array array['friendships', 'blocks'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
