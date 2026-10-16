-- Coaching, shared with the player: what a session covered and what to practise before the next.
--
--   coach_session_recaps   the coach's write-up of a session FOR the player (focus areas and a
--                          summary). Separate from coach_session_notes, which stays private: RLS
--                          works on rows, so one row can't be half private.
--   coach_session_routines readable by the session's player too (routines covered and scores).
--   coach_homework         routines a coach sets a client, with an optional target and how many
--                          times a week. The coach writes; the player reads.
--   coach_homework_progress(player)  how the player is getting on with each piece of homework,
--                          from their own routine scores - for the coach, without opening the
--                          rest of the player's practice to them.
--
-- Safe to run more than once.

begin;

-- ------------------------------------------------------------------ session recaps
create table if not exists public.coach_session_recaps (
  booking_id uuid primary key references public.coach_bookings(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid references auth.users(id) on delete cascade,
  summary text,
  focus text[] not null default '{}',
  updated_at timestamptz not null default now(),
  constraint coach_session_recaps_summary_length check (summary is null or char_length(summary) <= 2000),
  constraint coach_session_recaps_focus_count check (cardinality(focus) <= 8)
);
create index if not exists coach_session_recaps_player_idx on public.coach_session_recaps (player_id);
alter table public.coach_session_recaps enable row level security;

drop policy if exists coach_session_recaps_coach on public.coach_session_recaps;
create policy coach_session_recaps_coach on public.coach_session_recaps for all
  using (auth.uid() = coach_id)
  with check (
    auth.uid() = coach_id
    and exists (select 1 from public.coach_bookings b where b.id = booking_id and b.coach_id = auth.uid())
  );

drop policy if exists coach_session_recaps_player on public.coach_session_recaps;
create policy coach_session_recaps_player on public.coach_session_recaps for select
  using (exists (select 1 from public.coach_bookings b where b.id = booking_id and b.player_id = auth.uid()));

-- ------------------------------------------------------------------ routines covered: the player can see them
drop policy if exists coach_session_routines_player on public.coach_session_routines;
create policy coach_session_routines_player on public.coach_session_routines for select
  using (exists (select 1 from public.coach_bookings b where b.id = booking_id and b.player_id = auth.uid()));

-- ------------------------------------------------------------------ homework
create table if not exists public.coach_homework (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  booking_id uuid references public.coach_bookings(id) on delete set null,
  routine_id text not null,
  routine_name text not null,
  target_score integer,
  per_week smallint,
  note text,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint coach_homework_note_length check (note is null or char_length(note) <= 500),
  constraint coach_homework_per_week check (per_week is null or per_week between 1 and 14),
  constraint coach_homework_not_self check (coach_id <> player_id)
);
create index if not exists coach_homework_player_idx on public.coach_homework (player_id, created_at desc);
create index if not exists coach_homework_coach_idx on public.coach_homework (coach_id, player_id);
alter table public.coach_homework enable row level security;

-- A coach can only set homework for someone they've actually had a booking with.
drop policy if exists coach_homework_coach on public.coach_homework;
create policy coach_homework_coach on public.coach_homework for all
  using (auth.uid() = coach_id)
  with check (
    auth.uid() = coach_id
    and exists (
      select 1 from public.coach_bookings b
      where b.coach_id = auth.uid() and b.player_id = coach_homework.player_id and b.status in ('accepted', 'pending')
    )
  );

drop policy if exists coach_homework_player on public.coach_homework;
create policy coach_homework_player on public.coach_homework for select
  using (auth.uid() = player_id);

-- ------------------------------------------------------------------ homework progress
-- The best score and attempts on each homework routine since it was set, from the player's own
-- routine scores. Callable by the player, or by the coach who set the homework - and it only
-- returns homework rows, never the player's other practice. Scores are stored as text ("42",
-- "7/10"): the leading number is what counts.
create or replace function public.coach_homework_progress(p_player uuid)
returns table (homework_id uuid, best numeric, attempts integer, this_week integer, last_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select
    h.id,
    max(nullif(substring(e.score from '^\s*(\d+(?:\.\d+)?)'), '')::numeric),
    count(e.id)::integer,
    count(e.id) filter (where e.recorded_at >= date_trunc('week', now()))::integer,
    max(e.recorded_at)
  from public.coach_homework h
  left join public.routine_score_entries e
    on e.user_id = h.player_id and e.routine_id = h.routine_id and e.recorded_at >= h.created_at
  where h.player_id = p_player
    and h.archived_at is null
    and (auth.uid() = h.player_id or auth.uid() = h.coach_id)
  group by h.id;
$$;
revoke all on function public.coach_homework_progress(uuid) from public;
grant execute on function public.coach_homework_progress(uuid) to authenticated;

-- ------------------------------------------------------------------ live updates
do $$
declare t text;
begin
  foreach t in array array['coach_session_recaps', 'coach_homework'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;

commit;
