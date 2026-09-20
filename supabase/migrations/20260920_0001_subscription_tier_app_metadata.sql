-- 2026-09-20  Make the subscription tier server-controlled.
--
-- Before this migration the tier lived in auth.users.raw_user_meta_data, which any signed-in
-- user can rewrite with supabase.auth.updateUser({ data: ... }). That meant a user could grant
-- themselves the Century tier and bypass every server-side limit. The tier now lives in
-- raw_app_meta_data, which only the service role can write, and the helper functions are no
-- longer executable by the anon/authenticated roles.
--
-- Safe to run more than once.

begin;

-- 1. Carry existing tiers over to app_metadata.
update auth.users u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'subscription_tier', coalesce(nullif(u.raw_user_meta_data->>'subscription_tier', ''), 'free'),
      'subscription_anchor_date', nullif(u.raw_user_meta_data->>'subscription_anchor_date', '')
    ))
where not (coalesce(u.raw_app_meta_data, '{}'::jsonb) ? 'subscription_tier');

-- 2. Drop the user-writable copies so there is a single source of truth.
update auth.users
set raw_user_meta_data = raw_user_meta_data - 'subscription_tier' - 'subscription_anchor_date'
where raw_user_meta_data ?| array['subscription_tier', 'subscription_anchor_date'];

-- 3. Read the tier and the billing anchor from app_metadata.
create or replace function public.get_subscription_tier(p_user_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_tier text;
begin
  select coalesce(nullif(raw_app_meta_data->>'subscription_tier', ''), 'free')
  into v_tier
  from auth.users
  where id = p_user_id;

  if v_tier not in ('free', 'half_century', 'century') then
    return 'free';
  end if;

  return v_tier;
end;
$$;

create or replace function public.get_subscription_anchor(p_user_id uuid, p_now timestamptz)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_anchor_raw text;
  v_anchor timestamptz;
  v_now_date date := (p_now at time zone 'utc')::date;
  v_anchor_day int;
  v_start_current date;
  v_prev_month_start date;
  v_prev_month_end date;
begin
  select raw_app_meta_data->>'subscription_anchor_date'
  into v_anchor_raw
  from auth.users
  where id = p_user_id;

  if v_anchor_raw is null or btrim(v_anchor_raw) = '' then
    v_anchor := p_now;
  else
    begin
      v_anchor := v_anchor_raw::timestamptz;
    exception
      when others then
        v_anchor := p_now;
    end;
  end if;

  v_anchor_day := extract(day from v_anchor at time zone 'utc');

  v_start_current := date_trunc('month', v_now_date)::date
    + (least(v_anchor_day, extract(day from ((date_trunc('month', v_now_date)::date + interval '1 month - 1 day')))::int) - 1);

  if v_now_date >= v_start_current then
    return v_start_current::timestamptz;
  end if;

  v_prev_month_start := (date_trunc('month', v_now_date)::date - interval '1 month')::date;
  v_prev_month_end := (date_trunc('month', v_now_date)::date - interval '1 day')::date;

  return (v_prev_month_start + (least(v_anchor_day, extract(day from v_prev_month_end)::int) - 1))::timestamptz;
end;
$$;

-- 4. Stamp created_at from the server clock, so rows cannot be backdated into an
--    earlier billing period to dodge the monthly limit. security definer lets these
--    call enforce_subscription_limit after its EXECUTE grant is revoked below.
create or replace function public.trg_enforce_matches_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.created_at := now();
  perform public.enforce_subscription_limit('matches', new.user_id, new.created_at);
  return new;
end;
$$;

create or replace function public.trg_enforce_tournaments_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.created_at := now();
  perform public.enforce_subscription_limit('tournaments', new.user_id, new.created_at);
  return new;
end;
$$;

create or replace function public.trg_enforce_ai_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.created_at := now();
  perform public.enforce_subscription_limit('ai_analyses', new.user_id, new.created_at);
  return new;
end;
$$;

-- 5. created_at is immutable after insert (it drives the usage window).
create or replace function public.trg_freeze_created_at()
returns trigger
language plpgsql
as $$
begin
  new.created_at := old.created_at;
  return new;
end;
$$;

drop trigger if exists trg_matches_freeze_created_at on public.matches;
create trigger trg_matches_freeze_created_at
before update on public.matches
for each row execute function public.trg_freeze_created_at();

drop trigger if exists trg_tournaments_freeze_created_at on public.tournaments;
create trigger trg_tournaments_freeze_created_at
before update on public.tournaments
for each row execute function public.trg_freeze_created_at();

drop trigger if exists trg_ai_analyses_freeze_created_at on public.ai_analyses;
create trigger trg_ai_analyses_freeze_created_at
before update on public.ai_analyses
for each row execute function public.trg_freeze_created_at();

-- 6. Keep the subscription helpers private. Triggers keep working: PostgreSQL checks
--    EXECUTE on a trigger function when the trigger is created, not when it fires.
revoke execute on function public.get_subscription_tier(uuid) from public, anon, authenticated;
revoke execute on function public.get_subscription_anchor(uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.enforce_subscription_limit(text, uuid, timestamptz) from public, anon, authenticated;
revoke execute on function public.trg_enforce_matches_limit() from public, anon, authenticated;
revoke execute on function public.trg_enforce_tournaments_limit() from public, anon, authenticated;
revoke execute on function public.trg_enforce_ai_limit() from public, anon, authenticated;
revoke execute on function public.trg_freeze_created_at() from public, anon, authenticated;

-- 7. Bound what can land in the private clip bucket: 100 MB, video only.
update storage.buckets
set file_size_limit = 104857600,
    allowed_mime_types = array['video/mp4', 'video/quicktime', 'video/x-m4v']
where id = 'ai-videos';

commit;
