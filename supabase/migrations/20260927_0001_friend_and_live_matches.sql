-- Matches against friends, and matches others can follow live.
--
-- A match can be linked to a friend (matches.opponent_id). The friend sees it and is asked to
-- confirm the result; once they do, it counts in their record too - the app shows it from
-- their side. They can also say it is not right, or take it off their record. Changing the
-- score of a confirmed match asks them again.
--
-- live_scores: while a match is scored live, the frame in progress is posted here - points,
-- the break, who is at the table - so friends, group-mates and the opponent can follow it.
-- Players who turned "share my results" off are not shown to anyone but their opponent.
--
-- Safe to run more than once. Needs the community, chat and feed migrations first.

-- ------------------------------------------------------------------ friend matches
-- opponent_id was created as text in the live database, though it holds a player's id; make it
-- one (it was unused, so nothing is lost; anything not shaped like an id is cleared).
alter table public.matches alter column opponent_id type uuid
  using (case when opponent_id::text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then opponent_id::text::uuid else null end);
alter table public.matches add column if not exists opponent_status text;
alter table public.matches drop constraint if exists matches_opponent_status_check;
alter table public.matches add constraint matches_opponent_status_check
  check (opponent_status is null or opponent_status in ('pending', 'confirmed', 'disputed', 'removed'));
create index if not exists idx_matches_opponent on public.matches (opponent_id, date desc) where opponent_id is not null;

-- Only a friend can be linked, and the link's status is the opponent's to set (through
-- respond_to_match), apart from going back to pending when the result changes.
create or replace function public.matches_link_guard()
returns trigger
language plpgsql
as $$
begin
  if new.opponent_id is not null then
    if new.opponent_id = new.user_id then
      raise exception 'You cannot play yourself.';
    end if;
    if (tg_op = 'INSERT' or new.opponent_id is distinct from old.opponent_id)
       and not public.are_friends(new.user_id, new.opponent_id) then
      raise exception 'You can only link a match to a friend.';
    end if;
  end if;

  if current_setting('snooker.linking', true) is distinct from 'on' then
    if new.opponent_id is null then
      new.opponent_status := null;
    elsif tg_op = 'INSERT' or new.opponent_id is distinct from old.opponent_id then
      new.opponent_status := 'pending';
    elsif (new.user_score, new.opponent_score, new.result) is distinct from (old.user_score, old.opponent_score, old.result)
          and old.opponent_status in ('confirmed', 'disputed') then
      new.opponent_status := 'pending';
    else
      new.opponent_status := old.opponent_status;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists matches_link_guard on public.matches;
create trigger matches_link_guard before insert or update on public.matches
  for each row execute function public.matches_link_guard();

-- The opponent can read the match and its frames (the scorer's own policy stays as it is).
drop policy if exists matches_opponent_read on public.matches;
drop policy if exists match_frames_opponent_read on public.match_frames;
create policy matches_opponent_read on public.matches for select
  using (opponent_id = auth.uid() and not public.is_blocked(auth.uid(), user_id));
create policy match_frames_opponent_read on public.match_frames for select
  using (exists (select 1 from public.matches m where m.id = match_id and m.opponent_id = auth.uid()));

-- The opponent's answer: 'confirmed', 'disputed', or 'removed' from their record.
create or replace function public.respond_to_match(target uuid, answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if answer not in ('confirmed', 'disputed', 'removed') then
    raise exception 'Unknown answer.';
  end if;
  perform set_config('snooker.linking', 'on', true);
  update public.matches set opponent_status = answer where id = target and opponent_id = auth.uid();
  if not found then
    raise exception 'That match is not yours to answer.';
  end if;
end;
$$;
grant execute on function public.respond_to_match(uuid, text) to authenticated;

-- ------------------------------------------------------------------ live scores
create table if not exists public.live_scores (
  match_id uuid primary key references public.matches(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  opponent_id uuid references auth.users(id) on delete set null,
  opponent_name text not null check (char_length(opponent_name) between 1 and 60),
  best_of integer check (best_of is null or best_of between 1 and 99),
  frames_user integer not null default 0,
  frames_opponent integer not null default 0,
  frame_number integer not null default 1,
  points_user integer not null default 0,
  points_opponent integer not null default 0,
  current_break integer not null default 0,
  at_table text check (at_table is null or at_table in ('user', 'opponent')),
  remaining integer,
  high_break_user integer not null default 0,
  high_break_opponent integer not null default 0,
  -- Finished frames: [{ "n": 1, "u": 72, "o": 31, "w": "user" }, ...]
  frames jsonb not null default '[]'::jsonb,
  status text not null default 'live' check (status in ('live', 'finished')),
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_live_scores_user on public.live_scores (user_id);
create index if not exists idx_live_scores_recent on public.live_scores (updated_at desc);

alter table public.live_scores enable row level security;
drop policy if exists live_scores_select on public.live_scores;
drop policy if exists live_scores_insert_own on public.live_scores;
drop policy if exists live_scores_update_own on public.live_scores;
drop policy if exists live_scores_delete_own on public.live_scores;
create policy live_scores_select on public.live_scores for select using (
  auth.uid() = user_id
  or auth.uid() = opponent_id
  or (
    exists (select 1 from public.profiles p where p.id = user_id and p.share_activity and p.hidden_at is null)
    and not public.is_blocked(auth.uid(), user_id)
    and (public.are_friends(auth.uid(), user_id) or public.shares_group(auth.uid(), user_id))
  )
);
create policy live_scores_insert_own on public.live_scores for insert with check (
  auth.uid() = user_id and exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid())
);
create policy live_scores_update_own on public.live_scores for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy live_scores_delete_own on public.live_scores for delete using (auth.uid() = user_id);

-- The opponent's name is typed by the scorer and shown to others, so it is word-filtered.
create or replace function public.live_scores_check_words()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.opponent_name) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists live_scores_check_words on public.live_scores;
create trigger live_scores_check_words before insert or update on public.live_scores
  for each row execute function public.live_scores_check_words();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'live_scores'
  ) then
    alter publication supabase_realtime add table public.live_scores;
  end if;
end
$$;
