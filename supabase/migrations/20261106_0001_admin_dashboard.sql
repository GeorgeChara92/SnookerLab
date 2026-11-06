-- Numbers for the admin dashboard (apps/admin, which runs only on the admin's own computer).
--
-- Two functions, both refusing anyone who isn't in app_admins:
--   admin_overview()             everything on the Overview page in one call: players, plans,
--                                coaches, what's being used, and what's waiting on a decision
--   admin_players(search, lim)   the Players list, with each account's email and when they
--                                last had the app open
-- They are security definer because they read auth.users (emails, sign-up and last-seen times),
-- which no signed-in player can read directly. Nothing here changes any data.
--
-- "Last seen" is the later of the last sign-in and the last time the app refreshed its session
-- (about hourly while it's open), so a player who stays signed in for months still counts as
-- active when they use the app.
--
-- Safe to run more than once.

begin;

create or replace function public.admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;

  with seen as (
    select
      u.id,
      u.created_at,
      greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id)) as last_seen
    from auth.users u
  ),
  days as (
    select generate_series((current_date - 29)::timestamp, current_date::timestamp, interval '1 day')::date as day
  )
  select jsonb_build_object(
    'generated_at', now(),
    'players', (
      select jsonb_build_object(
        'total', count(*),
        'new_today', count(*) filter (where created_at >= date_trunc('day', now())),
        'new_7d', count(*) filter (where created_at >= now() - interval '7 days'),
        'new_30d', count(*) filter (where created_at >= now() - interval '30 days'),
        'active_1d', count(*) filter (where last_seen >= now() - interval '1 day'),
        'active_7d', count(*) filter (where last_seen >= now() - interval '7 days'),
        'active_30d', count(*) filter (where last_seen >= now() - interval '30 days')
      ) from seen
    ),
    'signups', (
      select jsonb_agg(jsonb_build_object('day', d.day, 'count', (
        select count(*) from seen where seen.created_at::date = d.day
      ), 'active', (
        select count(*) from seen where seen.last_seen::date = d.day
      )) order by d.day)
      from days d
    ),
    'plans', (
      select jsonb_build_object(
        'free', count(*) filter (where subscription_tier = 'free'),
        'half_century', count(*) filter (where subscription_tier = 'half_century'),
        'century', count(*) filter (where subscription_tier = 'century')
      ) from public.profiles
    ),
    'coaches', jsonb_build_object(
      'listed', (select count(*) from public.profiles where is_coach and hidden_at is null),
      'pending_applications', (select count(*) from public.coach_applications where status = 'pending'),
      'approved_30d', (select count(*) from public.coach_applications where status = 'approved' and reviewed_at >= now() - interval '30 days'),
      'bookings_30d', (select count(*) from public.coach_bookings where created_at >= now() - interval '30 days'),
      'bookings_waiting', (select count(*) from public.coach_bookings where status = 'pending' and starts_at > now())
    ),
    'usage', jsonb_build_object(
      'matches_7d', (select count(*) from public.matches where created_at >= now() - interval '7 days'),
      'matches_30d', (select count(*) from public.matches where created_at >= now() - interval '30 days'),
      'practice_7d', (select count(*) from public.session_logs where created_at >= now() - interval '7 days'),
      'practice_30d', (select count(*) from public.session_logs where created_at >= now() - interval '30 days'),
      'analyses_7d', (select count(*) from public.ai_analyses where created_at >= now() - interval '7 days'),
      'analyses_30d', (select count(*) from public.ai_analyses where created_at >= now() - interval '30 days'),
      'analyses_failed_30d', (select count(*) from public.ai_analyses where status = 'failed' and created_at >= now() - interval '30 days'),
      'messages_7d', (select count(*) from public.messages where created_at >= now() - interval '7 days'),
      'messages_30d', (select count(*) from public.messages where created_at >= now() - interval '30 days'),
      'shared_routines', (select count(*) from public.shared_routines where hidden_at is null),
      'groups', (select count(*) from public.groups where hidden_at is null),
      'pro_tour_followers', (select count(distinct user_id) from public.pro_tour_follows),
      'push_players', (select count(distinct user_id) from public.push_tokens)
    ),
    'attention', jsonb_build_object(
      'applications', (select count(*) from public.coach_applications where status = 'pending'),
      'reports', (select count(*) from public.reports where status = 'open'),
      'feedback_7d', (select count(*) from public.app_feedback where created_at >= now() - interval '7 days'),
      'errors_24h', (select count(*) from public.app_errors where created_at >= now() - interval '1 day'),
      'errors_7d', (select count(*) from public.app_errors where created_at >= now() - interval '7 days')
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

create or replace function public.admin_players(search text default null, lim integer default 100)
returns table (
  id uuid,
  email text,
  display_name text,
  handle text,
  subscription_tier text,
  is_coach boolean,
  hidden boolean,
  joined timestamptz,
  last_seen timestamptz
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
  select
    u.id,
    u.email::text,
    p.display_name,
    p.handle,
    coalesce(p.subscription_tier, 'free'),
    coalesce(p.is_coach, false),
    p.hidden_at is not null,
    u.created_at,
    greatest(u.last_sign_in_at, (select max(s.updated_at) from auth.sessions s where s.user_id = u.id))
  from auth.users u
  left join public.profiles p on p.id = u.id
  where nullif(trim(search), '') is null
     or u.email ilike pattern or p.display_name ilike pattern or p.handle ilike pattern
  order by u.created_at desc
  limit least(greatest(coalesce(lim, 100), 1), 500);
end;
$$;

revoke all on function public.admin_players(text, integer) from public, anon;
grant execute on function public.admin_players(text, integer) to authenticated;

commit;
