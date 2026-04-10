-- Run in Supabase SQL editor (staging first, then production)
-- Private-by-default data model for cross-device sync.

create extension if not exists pgcrypto;

-- Storage bucket for AI uploads
insert into storage.buckets (id, name, public)
values ('ai-videos', 'ai-videos', false)
on conflict (id) do nothing;

-- Public profile table (future-ready for unique usernames / social features)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  avatar_url text,
  country_code text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  notes text,
  routine_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  template_id uuid,
  template_name text not null,
  date date not null,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_log_results (
  id uuid primary key default gen_random_uuid(),
  log_id uuid not null references public.session_logs(id) on delete cascade,
  routine_id text not null,
  score text not null,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.routine_score_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  routine_name text not null,
  score text not null,
  notes text,
  recorded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  opponent_name text not null,
  date date not null,
  match_type text,
  format text,
  recording_mode text,
  user_score int not null,
  opponent_score int not null,
  result text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.match_frames (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  frame_number int not null,
  user_score int not null,
  opponent_score int not null,
  winner text not null,
  highest_break_user int not null default 0,
  highest_break_opponent int not null default 0,
  breaks jsonb not null default '[]'::jsonb,
  events jsonb not null default '[]'::jsonb,
  abandoned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (match_id, frame_number)
);

alter table if exists public.matches add column if not exists recording_mode text;

create table if not exists public.tournaments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  tournament_type text not null,
  entry_mode text not null,
  pairing_mode text not null,
  best_of_frames int not null,
  participants text[] not null default '{}',
  status text not null default 'active',
  previous_champion text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tournament_fixtures (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  round_number int not null,
  fixture_index int not null,
  participant_a text not null,
  participant_b text not null,
  best_of_frames int not null,
  score_a int,
  score_b int,
  winner text,
  status text not null default 'pending'
);

create table if not exists public.tournament_fixture_frames (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.tournament_fixtures(id) on delete cascade,
  frame_number int not null,
  score_a int not null,
  score_b int not null,
  winner text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  video_path text not null,
  thumbnail_path text,
  analysis_type text not null,
  status text not null default 'pending',
  context_tags text[] not null default '{}',
  user_notes text,
  feedback text,
  recommendations text[] not null default '{}',
  error_message text,
  report_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.ai_analyses add column if not exists error_message text;
alter table public.ai_analyses add column if not exists report_json jsonb;

create index if not exists idx_ai_analyses_user on public.ai_analyses(user_id, created_at desc);

create index if not exists idx_session_templates_user on public.session_templates(user_id);
create index if not exists idx_session_logs_user on public.session_logs(user_id, recorded_at desc);
create index if not exists idx_routine_score_entries_user on public.routine_score_entries(user_id, recorded_at desc);
create index if not exists idx_matches_user on public.matches(user_id, date desc);
create index if not exists idx_match_frames_user_match on public.match_frames(user_id, match_id, frame_number);
create index if not exists idx_tournaments_user on public.tournaments(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.session_templates enable row level security;
alter table public.session_logs enable row level security;
alter table public.session_log_results enable row level security;
alter table public.routine_score_entries enable row level security;
alter table public.matches enable row level security;
alter table public.match_frames enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_fixtures enable row level security;
alter table public.tournament_fixture_frames enable row level security;
alter table public.ai_analyses enable row level security;

drop policy if exists profiles_select_own on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
drop policy if exists session_templates_own on public.session_templates;
drop policy if exists session_logs_own on public.session_logs;
drop policy if exists session_log_results_own on public.session_log_results;
drop policy if exists routine_score_entries_own on public.routine_score_entries;
drop policy if exists matches_own on public.matches;
drop policy if exists match_frames_own on public.match_frames;
drop policy if exists tournaments_own on public.tournaments;
drop policy if exists tournament_fixtures_own on public.tournament_fixtures;
drop policy if exists tournament_fixture_frames_own on public.tournament_fixture_frames;
drop policy if exists ai_analyses_own on public.ai_analyses;

create policy profiles_select_own on public.profiles for select using (auth.uid() = id);
create policy profiles_insert_own on public.profiles for insert with check (auth.uid() = id);
create policy profiles_update_own on public.profiles for update using (auth.uid() = id);

create policy session_templates_own on public.session_templates
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy session_logs_own on public.session_logs
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy session_log_results_own on public.session_log_results
for all using (
  exists (
    select 1 from public.session_logs l
    where l.id = session_log_results.log_id and l.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.session_logs l
    where l.id = session_log_results.log_id and l.user_id = auth.uid()
  )
);

create policy routine_score_entries_own on public.routine_score_entries
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy matches_own on public.matches
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy match_frames_own on public.match_frames
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tournaments_own on public.tournaments
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy tournament_fixtures_own on public.tournament_fixtures
for all using (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_fixtures.tournament_id and t.user_id = auth.uid()
  )
) with check (
  exists (
    select 1 from public.tournaments t
    where t.id = tournament_fixtures.tournament_id and t.user_id = auth.uid()
  )
);

create policy tournament_fixture_frames_own on public.tournament_fixture_frames
for all using (
  exists (
    select 1
    from public.tournament_fixtures f
    join public.tournaments t on t.id = f.tournament_id
    where f.id = tournament_fixture_frames.fixture_id and t.user_id = auth.uid()
  )
) with check (
  exists (
    select 1
    from public.tournament_fixtures f
    join public.tournaments t on t.id = f.tournament_id
    where f.id = tournament_fixture_frames.fixture_id and t.user_id = auth.uid()
  )
);

create policy ai_analyses_own on public.ai_analyses
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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
  select coalesce(nullif(raw_user_meta_data->>'subscription_tier', ''), 'free')
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
  select raw_user_meta_data->>'subscription_anchor_date'
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
  v_limit int;
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_used int;
begin
  v_tier := public.get_subscription_tier(p_user_id);
  v_period_start := public.get_subscription_anchor(p_user_id, coalesce(p_created_at, now()));
  v_period_end := v_period_start + interval '1 month';

  if p_entity = 'matches' then
    if v_tier = 'free' then v_limit := 12;
    elsif v_tier = 'half_century' then v_limit := 40;
    else v_limit := null;
    end if;

    if v_limit is null then return; end if;

    select count(*) into v_used
    from public.matches
    where user_id = p_user_id
      and created_at >= v_period_start
      and created_at < v_period_end;

  elsif p_entity = 'tournaments' then
    if v_tier = 'free' then v_limit := 1;
    elsif v_tier = 'half_century' then v_limit := 4;
    else v_limit := null;
    end if;

    if v_limit is null then return; end if;

    select count(*) into v_used
    from public.tournaments
    where user_id = p_user_id
      and created_at >= v_period_start
      and created_at < v_period_end;

  elsif p_entity = 'ai_analyses' then
    if v_tier = 'free' then v_limit := 1;
    elsif v_tier = 'half_century' then v_limit := 8;
    else v_limit := 20;
    end if;

    select count(*) into v_used
    from public.ai_analyses
    where user_id = p_user_id
      and created_at >= v_period_start
      and created_at < v_period_end;

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

create or replace function public.trg_enforce_matches_limit()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_subscription_limit('matches', new.user_id, new.created_at);
  return new;
end;
$$;

create or replace function public.trg_enforce_tournaments_limit()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_subscription_limit('tournaments', new.user_id, new.created_at);
  return new;
end;
$$;

create or replace function public.trg_enforce_ai_limit()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_subscription_limit('ai_analyses', new.user_id, new.created_at);
  return new;
end;
$$;

drop trigger if exists trg_matches_subscription_limit on public.matches;
create trigger trg_matches_subscription_limit
before insert on public.matches
for each row execute function public.trg_enforce_matches_limit();

drop trigger if exists trg_tournaments_subscription_limit on public.tournaments;
create trigger trg_tournaments_subscription_limit
before insert on public.tournaments
for each row execute function public.trg_enforce_tournaments_limit();

drop trigger if exists trg_ai_subscription_limit on public.ai_analyses;
drop trigger if exists trg_ai_daily_limit on public.ai_analyses;
create trigger trg_ai_subscription_limit
before insert on public.ai_analyses
for each row execute function public.trg_enforce_ai_limit();

-- Storage RLS policies (user can only access their own folder: <user_id>/...)
drop policy if exists ai_videos_read_own on storage.objects;
drop policy if exists ai_videos_insert_own on storage.objects;
drop policy if exists ai_videos_update_own on storage.objects;
drop policy if exists ai_videos_delete_own on storage.objects;

create policy ai_videos_read_own on storage.objects
for select
using (
  bucket_id = 'ai-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy ai_videos_insert_own on storage.objects
for insert
with check (
  bucket_id = 'ai-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy ai_videos_update_own on storage.objects
for update
using (
  bucket_id = 'ai-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'ai-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy ai_videos_delete_own on storage.objects
for delete
using (
  bucket_id = 'ai-videos'
  and (storage.foldername(name))[1] = auth.uid()::text
);
