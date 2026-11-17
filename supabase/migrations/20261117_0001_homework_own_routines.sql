-- Homework on a coach's own routines.
--
-- A coach's own routine is set as homework by its shared copy, "shared:<shared_routines.id>" (the
-- same key its leaderboard uses), shared link-only so the client can open it. The client practises
-- their saved copy of it (custom_routines.source_shared_id), and scores are recorded against that
-- copy's id - so progress also counts scores on the player's copies of the shared routine.

begin;

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
    on e.user_id = h.player_id
    and e.recorded_at >= h.created_at
    and (
      e.routine_id = h.routine_id
      or (
        h.routine_id like 'shared:%'
        and e.routine_id in (
          select c.id::text
          from public.custom_routines c
          where c.user_id = h.player_id
            and c.source_shared_id::text = substring(h.routine_id from 8)
        )
      )
    )
  where h.player_id = p_player
    and h.archived_at is null
    and (auth.uid() = h.player_id or auth.uid() = h.coach_id)
  group by h.id;
$$;

revoke all on function public.coach_homework_progress(uuid) from public;
grant execute on function public.coach_homework_progress(uuid) to authenticated;

commit;
