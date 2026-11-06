-- Player tools for the admin dashboard (apps/admin): filters on the Players list, a full summary
-- of one player, and the things an admin may need to do to an account.
--
--   admin_players(...)          the list, now filtered by plan, coach or player, when they were last
--                               seen and account state, and sorted; replaces the two-argument one
--   admin_player(id)            everything about one player: account, profile, what they've
--                               used, reports by and about them, feedback, crashes, coach applications
--   admin_set_hidden(id, bool)  hide or show their profile to other players
--   admin_remove_coach(id)      take them out of Find a coach (is_coach is otherwise frozen)
--   admin_sign_out(id)          end every session, so each phone has to sign in again
--   admin_reset_player(id)      clear their matches, practice, tournaments and AI videos, the same as
--                               Reset profile in the app, then sign them out so the phone reloads
--   admin_delete_player(id)     delete the account and, through the existing cascades, its data
--
-- Every function refuses anyone not in app_admins, and none of them can be pointed at an admin
-- account, so one admin can't lock out another (or themselves). A password reset email needs no
-- function: the dashboard sends it the same way the app's Forgot password does. Uploaded clips and
-- profile photos aren't table rows, so the dashboard removes them through the storage API before
-- deleting; the two storage policies at the end let an admin do that.
--
-- Safe to run more than once.

begin;

-- ------------------------------------------------------------------ the list, with filters
drop function if exists public.admin_players(text, integer);

create or replace function public.admin_players(
  search text default null,
  plan text default null,      -- 'free' | 'paying' | 'half_century' | 'century'
  kind text default null,      -- 'coach' | 'player'
  activity text default null,  -- 'today' | 'week' | 'month' | 'quiet' (not in 30 days) | 'never'
  account text default null,   -- 'hidden' | 'unconfirmed'
  sort text default 'newest',  -- 'newest' | 'oldest' | 'last_seen' | 'name'
  lim integer default 100,
  skip integer default 0
)
returns table (
  id uuid,
  email text,
  display_name text,
  handle text,
  subscription_tier text,
  is_coach boolean,
  hidden boolean,
  confirmed boolean,
  joined timestamptz,
  last_seen timestamptz,
  total bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  pattern text := '%' || coalesce(nullif(trim(search), ''), '') || '%';
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  return query
  with base as (
    select
      u.id as uid,
      u.email::text as mail,
      p.display_name as dname,
      p.handle as hdl,
      coalesce(p.subscription_tier, 'free') as tier,
      coalesce(p.is_coach, false) as coach,
      p.hidden_at is not null as is_hidden,
      u.email_confirmed_at is not null as is_confirmed,
      u.created_at as created,
      greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id)) as seen
    from auth.users u
    left join public.profiles p on p.id = u.id
  )
  select b.uid, b.mail, b.dname, b.hdl, b.tier, b.coach, b.is_hidden, b.is_confirmed, b.created, b.seen,
         count(*) over ()
  from base b
  where (nullif(trim(search), '') is null or b.mail ilike pattern or b.dname ilike pattern or b.hdl ilike pattern)
    and (plan is null
      or (plan = 'paying' and b.tier <> 'free')
      or b.tier = plan)
    and (kind is null or (kind = 'coach') = b.coach)
    and (activity is null
      or (activity = 'today' and b.seen >= now() - interval '1 day')
      or (activity = 'week' and b.seen >= now() - interval '7 days')
      or (activity = 'month' and b.seen >= now() - interval '30 days')
      or (activity = 'quiet' and b.seen < now() - interval '30 days')
      or (activity = 'never' and b.seen is null))
    and (account is null
      or (account = 'hidden' and b.is_hidden)
      or (account = 'unconfirmed' and not b.is_confirmed))
  order by
    case when sort = 'oldest' then b.created end asc,
    case when sort = 'last_seen' then b.seen end desc nulls last,
    case when sort = 'name' then lower(coalesce(nullif(trim(b.dname), ''), b.hdl, b.mail)) end asc,
    b.created desc
  limit least(greatest(coalesce(lim, 100), 1), 500)
  offset greatest(coalesce(skip, 0), 0);
end;
$$;

revoke all on function public.admin_players(text, text, text, text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_players(text, text, text, text, text, text, integer, integer) to authenticated;

-- ------------------------------------------------------------------ one player, in full
create or replace function public.admin_player(target uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u auth.users%rowtype;
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  select * into u from auth.users where auth.users.id = target;
  if not found then
    return null;
  end if;

  select jsonb_build_object(
    'account', jsonb_build_object(
      'id', u.id,
      'email', u.email,
      'confirmed_at', u.email_confirmed_at,
      'created_at', u.created_at,
      'last_sign_in_at', u.last_sign_in_at,
      'last_seen', greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id)),
      'sessions', (select count(*) from auth.sessions s where s.user_id = u.id),
      'providers', coalesce(u.raw_app_meta_data -> 'providers', '[]'::jsonb),
      'is_admin', exists (select 1 from public.app_admins a where a.user_id = u.id)
    ),
    'profile', (
      select jsonb_build_object(
        'display_name', p.display_name,
        'handle', p.handle,
        'skill_level', p.skill_level,
        'level', p.level,
        'xp', p.xp,
        'best_break', p.best_break,
        'centuries', p.centuries,
        'matches_won', p.matches_won,
        'subscription_tier', p.subscription_tier,
        'is_coach', p.is_coach,
        'coach_location', p.coach_location,
        'hidden_at', p.hidden_at,
        'discoverable', p.discoverable,
        'message_privacy', p.message_privacy,
        'stats_privacy', p.stats_privacy
      ) from public.profiles p where p.id = u.id
    ),
    'counts', jsonb_build_object(
      'matches', (select count(*) from public.matches where user_id = u.id),
      'practice', (select count(*) from public.session_logs where user_id = u.id),
      'analyses', (select count(*) from public.ai_analyses where user_id = u.id),
      'messages', (select count(*) from public.messages where sender = u.id),
      'friends', (select count(*) from public.friendships where status = 'accepted' and (requester = u.id or addressee = u.id)),
      'groups', (select count(*) from public.group_members where user_id = u.id),
      'shared_routines', (select count(*) from public.shared_routines where owner = u.id),
      'devices', (select count(*) from public.push_tokens where user_id = u.id),
      'following_pros', (select count(*) from public.pro_tour_follows where user_id = u.id),
      'bookings_made', (select count(*) from public.coach_bookings where player_id = u.id),
      'bookings_taken', (select count(*) from public.coach_bookings where coach_id = u.id),
      'blocked_by', (select count(*) from public.blocks where blocked = u.id)
    ),
    'reports_about', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'reason', r.reason, 'details', r.details,
        'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
      from public.reports r where r.reported_user = u.id
    ), '[]'::jsonb),
    'reports_made', coalesce((
      select jsonb_agg(jsonb_build_object('id', r.id, 'target_type', r.target_type, 'reason', r.reason, 'details', r.details,
        'status', r.status, 'created_at', r.created_at) order by r.created_at desc)
      from public.reports r where r.reporter = u.id
    ), '[]'::jsonb),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object('id', f.id, 'message', f.message, 'created_at', f.created_at) order by f.created_at desc)
      from public.app_feedback f where f.user_id = u.id
    ), '[]'::jsonb),
    'errors', coalesce((
      select jsonb_agg(e order by e.created_at desc) from (
        select ae.id, ae.created_at, ae.message, ae.screen, ae.app_version, ae.platform, ae.fatal
        from public.app_errors ae where ae.user_id = u.id order by ae.created_at desc limit 20
      ) e
    ), '[]'::jsonb),
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object('id', ca.id, 'status', ca.status, 'created_at', ca.created_at,
        'reviewed_at', ca.reviewed_at, 'reviewer_note', ca.reviewer_note) order by ca.created_at desc)
      from public.coach_applications ca where ca.user_id = u.id or lower(ca.email) = lower(u.email)
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_player(uuid) from public, anon;
grant execute on function public.admin_player(uuid) to authenticated;

-- ------------------------------------------------------------------ shared guard for the actions
-- Raises unless the caller is an admin and the target is a real account that isn't an admin.
create or replace function public.admin_guard_target(target uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = target) then
    raise exception 'no such player' using errcode = 'P0002';
  end if;
  if exists (select 1 from public.app_admins where user_id = target) then
    raise exception 'admin accounts can''t be changed from the dashboard' using errcode = '42501';
  end if;
end;
$$;

revoke all on function public.admin_guard_target(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ hide / show
create or replace function public.admin_set_hidden(target uuid, hide boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_guard_target(target);
  update public.profiles set hidden_at = case when hide then coalesce(hidden_at, now()) else null end where id = target;
end;
$$;

-- ------------------------------------------------------------------ remove from Find a coach
-- is_coach is frozen against every signed-in write (trg_freeze_is_coach). This lets only these
-- admin functions through, by setting a flag for the rest of the transaction.
create or replace function public.trg_freeze_is_coach()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' and coalesce(current_setting('snookered.admin_action', true), '') <> 'on' then
    new.is_coach := old.is_coach;
  end if;
  return new;
end;
$$;

create or replace function public.admin_remove_coach(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_guard_target(target);
  perform set_config('snookered.admin_action', 'on', true);
  update public.profiles set is_coach = false where id = target;
  perform set_config('snookered.admin_action', '', true);
end;
$$;

-- ------------------------------------------------------------------ sign out everywhere
-- Deleting the sessions (their refresh tokens go with them) means each phone is signed out the
-- next time it refreshes, within the hour.
create or replace function public.admin_sign_out(target uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  removed integer;
begin
  perform public.admin_guard_target(target);
  delete from auth.sessions where user_id = target;
  get diagnostics removed = row_count;
  return removed;
end;
$$;

-- ------------------------------------------------------------------ reset
-- The same tables the app's Reset profile clears (reset-profile function), skipping any that
-- don't exist, and the same profile details in their account metadata, keeping the plan.
create or replace function public.admin_reset_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tbl text;
begin
  perform public.admin_guard_target(target);
  foreach tbl in array array[
    'match_frames', 'matches', 'session_log_results', 'session_logs', 'session_templates', 'routine_score_entries',
    'tournament_fixtures', 'tournament_participants', 'tournaments', 'ai_analyses'
  ] loop
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = tbl and column_name = 'user_id'
    ) then
      execute format('delete from public.%I where user_id = $1', tbl) using target;
    end if;
  end loop;

  update auth.users
  set raw_user_meta_data = jsonb_strip_nulls(jsonb_build_object(
    'subscription_tier', raw_user_meta_data -> 'subscription_tier',
    'subscription_anchor_date', raw_user_meta_data -> 'subscription_anchor_date'
  ))
  where id = target;

  delete from auth.sessions where user_id = target;
end;
$$;

-- ------------------------------------------------------------------ delete
create or replace function public.admin_delete_player(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_guard_target(target);
  delete from auth.users where id = target;
end;
$$;

revoke all on function public.admin_set_hidden(uuid, boolean) from public, anon;
revoke all on function public.admin_remove_coach(uuid) from public, anon;
revoke all on function public.admin_sign_out(uuid) from public, anon;
revoke all on function public.admin_reset_player(uuid) from public, anon;
revoke all on function public.admin_delete_player(uuid) from public, anon;
grant execute on function public.admin_set_hidden(uuid, boolean) to authenticated;
grant execute on function public.admin_remove_coach(uuid) to authenticated;
grant execute on function public.admin_sign_out(uuid) to authenticated;
grant execute on function public.admin_reset_player(uuid) to authenticated;
grant execute on function public.admin_delete_player(uuid) to authenticated;

-- ------------------------------------------------------------------ uploaded files
-- Lets an admin list and remove a player's clips and profile photos before deleting the account,
-- the same clean-up the delete-account function does for a player deleting themselves.
drop policy if exists admin_select_player_files on storage.objects;
create policy admin_select_player_files on storage.objects for select to authenticated
  using (bucket_id in ('ai-videos', 'profile-images') and public.is_admin());

drop policy if exists admin_delete_player_files on storage.objects;
create policy admin_delete_player_files on storage.objects for delete to authenticated
  using (bucket_id in ('ai-videos', 'profile-images') and public.is_admin());

commit;
