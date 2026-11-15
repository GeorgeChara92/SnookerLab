-- The plans now cover features Snookered built itself, not just how many matches, tournaments
-- and AI Coach reviews a month (agreed 2026-11-15). Free keeps a taste of each; Half-Century and
-- Century have no limit on them:
--
--   own routines built          Free 3 in all          (saved community routines don't count)
--   practice sessions saved     Free 1 in all
--   Record a Snooker positions  Free 3 a month         (putting the balls back is always free)
--
-- The stats history (30 days on Free) and the result card backgrounds are about what the app
-- shows, not what is stored, so they are kept to in the app (src/constants/subscription.ts).
--
-- Coaches on the Coach plan have no limit on routines or saved sessions: they build them for
-- clients.
--
-- Nothing here takes anything away: a player already over a limit keeps everything they have,
-- and can still edit it; they just can't add more until they upgrade. Limits are checked only
-- on adding a new row, and a re-sync of a row that already exists is let through.
--
-- Safe to run more than once.

begin;

-- 1. A row for each Record a Snooker position saved, so the monthly allowance holds on any phone.
create table if not exists public.record_snooker_uses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists idx_record_snooker_uses_user on public.record_snooker_uses(user_id, created_at desc);
alter table public.record_snooker_uses enable row level security;
drop policy if exists record_snooker_uses_select_own on public.record_snooker_uses;
create policy record_snooker_uses_select_own on public.record_snooker_uses for select using (auth.uid() = user_id);
drop policy if exists record_snooker_uses_insert_own on public.record_snooker_uses;
create policy record_snooker_uses_insert_own on public.record_snooker_uses for insert with check (auth.uid() = user_id);

-- 2. The one place limits are decided, now with the new features.
create or replace function public.enforce_subscription_limit(
  p_entity text,
  p_user_id uuid,
  p_created_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_tier text;
  v_coach boolean;
  v_limit int;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used int;
begin
  v_tier := public.get_subscription_tier(p_user_id);
  -- A coach on the Coach plan builds routines and sessions for clients; the player limits on
  -- those two don't apply to them.
  select coalesce((raw_app_meta_data->>'coach_subscription_active')::boolean, false)
  into v_coach
  from auth.users
  where id = p_user_id;
  v_period_start := public.get_subscription_anchor(p_user_id, coalesce(p_created_at, now()));
  v_period_end := v_period_start + interval '1 month';

  if p_entity = 'matches' then
    if v_tier = 'free' then v_limit := 12;
    elsif v_tier = 'half_century' then v_limit := 40;
    else v_limit := null;
    end if;
    if v_limit is null then return; end if;
    select count(*) into v_used from public.matches
    where user_id = p_user_id and created_at >= v_period_start and created_at < v_period_end;

  elsif p_entity = 'tournaments' then
    if v_tier = 'free' then v_limit := 1;
    elsif v_tier = 'half_century' then v_limit := 4;
    else v_limit := null;
    end if;
    if v_limit is null then return; end if;
    select count(*) into v_used from public.tournaments
    where user_id = p_user_id and created_at >= v_period_start and created_at < v_period_end;

  elsif p_entity = 'ai_analyses' then
    if v_tier = 'free' then v_limit := 1;
    elsif v_tier = 'half_century' then v_limit := 8;
    else v_limit := 20;
    end if;
    select count(*) into v_used from public.ai_analyses
    where user_id = p_user_id and created_at >= v_period_start and created_at < v_period_end;

  elsif p_entity = 'custom_routines' then
    if v_tier <> 'free' or v_coach then return; end if;
    v_limit := 3;
    select count(*) into v_used from public.custom_routines
    where user_id = p_user_id and source_shared_id is null;

  elsif p_entity = 'session_templates' then
    if v_tier <> 'free' or v_coach then return; end if;
    v_limit := 1;
    select count(*) into v_used from public.session_templates
    where user_id = p_user_id;

  elsif p_entity = 'record_snooker' then
    if v_tier <> 'free' then return; end if;
    v_limit := 3;
    select count(*) into v_used from public.record_snooker_uses
    where user_id = p_user_id and created_at >= v_period_start and created_at < v_period_end;

  else
    return;
  end if;

  if v_used >= v_limit then
    raise exception
      using
        message = format('subscription_limit_exceeded:%s', p_entity),
        detail = format('tier=%s used=%s limit=%s period_start=%s period_end=%s', v_tier, v_used, v_limit, v_period_start, v_period_end);
  end if;
end;
$$;
revoke execute on function public.enforce_subscription_limit(text, uuid, timestamptz) from public, anon, authenticated;

-- 3. Checked when a new one is added. The app syncs by upsert, which runs insert triggers even
--    for a row that's already there, so a row that already exists is always let through.
create or replace function public.trg_enforce_custom_routines_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.source_shared_id is not null then return new; end if;
  if exists (select 1 from public.custom_routines where id = new.id) then return new; end if;
  perform public.enforce_subscription_limit('custom_routines', new.user_id, now());
  return new;
end;
$$;

create or replace function public.trg_enforce_session_templates_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if exists (select 1 from public.session_templates where id = new.id) then return new; end if;
  perform public.enforce_subscription_limit('session_templates', new.user_id, now());
  return new;
end;
$$;

create or replace function public.trg_enforce_record_snooker_limit()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  new.created_at := now();
  perform public.enforce_subscription_limit('record_snooker', new.user_id, new.created_at);
  return new;
end;
$$;

revoke execute on function public.trg_enforce_custom_routines_limit() from public, anon, authenticated;
revoke execute on function public.trg_enforce_session_templates_limit() from public, anon, authenticated;
revoke execute on function public.trg_enforce_record_snooker_limit() from public, anon, authenticated;

drop trigger if exists trg_custom_routines_limit on public.custom_routines;
create trigger trg_custom_routines_limit
before insert on public.custom_routines
for each row execute function public.trg_enforce_custom_routines_limit();

drop trigger if exists trg_session_templates_limit on public.session_templates;
create trigger trg_session_templates_limit
before insert on public.session_templates
for each row execute function public.trg_enforce_session_templates_limit();

drop trigger if exists trg_record_snooker_uses_limit on public.record_snooker_uses;
create trigger trg_record_snooker_uses_limit
before insert on public.record_snooker_uses
for each row execute function public.trg_enforce_record_snooker_limit();

commit;
