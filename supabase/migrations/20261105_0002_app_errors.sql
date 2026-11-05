-- Crashes from players' phones, so problems are seen without anyone having to report them.
--
-- The app writes a row when a screen fails to draw (the error screen in App.tsx) or an error
-- escapes everything else (src/features/errors/errorLog.ts), at most five a launch. A signed-in
-- player can only add rows as themselves; only an admin can read them. Rows older than 90 days
-- are cleared daily.
--
-- To look at recent ones in the SQL editor:
--   select created_at, screen, message, app_version, platform from public.app_errors
--   order by created_at desc limit 50;
--
-- Safe to run more than once.

begin;

create table if not exists public.app_errors (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  -- 'render': a screen failed to draw; 'global': thrown anywhere else.
  source text not null check (source in ('render', 'global')),
  fatal boolean not null default false,
  message text not null check (char_length(message) between 1 and 1000),
  stack text check (stack is null or char_length(stack) <= 8000),
  screen text check (screen is null or char_length(screen) <= 100),
  app_version text check (app_version is null or char_length(app_version) <= 40),
  update_id text check (update_id is null or char_length(update_id) <= 64),
  platform text check (platform is null or char_length(platform) <= 40)
);
create index if not exists app_errors_created_idx on public.app_errors (created_at desc);
create index if not exists app_errors_user_idx on public.app_errors (user_id);

alter table public.app_errors enable row level security;

drop policy if exists app_errors_insert on public.app_errors;
create policy app_errors_insert on public.app_errors for insert
  with check (auth.uid() = user_id);

drop policy if exists app_errors_select on public.app_errors;
create policy app_errors_select on public.app_errors for select
  using (public.is_admin());

-- Keep the table small.
select cron.unschedule('purge-app-errors') where exists (select 1 from cron.job where jobname = 'purge-app-errors');
select cron.schedule(
  'purge-app-errors',
  '17 4 * * *',
  $job$ delete from public.app_errors where created_at < now() - interval '90 days' $job$
);

commit;
