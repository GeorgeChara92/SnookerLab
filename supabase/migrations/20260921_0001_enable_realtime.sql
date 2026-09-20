-- Live sync between a player's devices.
--
-- The app subscribes to changes on its own rows so a result entered on the tablet at the table
-- appears on the phone in your pocket. Postgres only publishes changes for tables that are in
-- the supabase_realtime publication, so add them here.
--
-- Row level security still decides what each connection is sent: a subscriber receives inserts
-- and updates only for rows its policies allow. The app ignores the contents of these messages
-- entirely and re-reads from the database, so nothing here widens what anyone can see.

do $$
declare
  target text;
begin
  foreach target in array array[
    'matches',
    'match_frames',
    'tournaments',
    'tournament_fixtures',
    'tournament_fixture_frames',
    'session_templates',
    'session_logs',
    'session_log_results',
    'routine_score_entries',
    'ai_analyses'
  ]
  loop
    -- Skip anything already published, so this file is safe to run more than once.
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = target
    ) then
      execute format('alter publication supabase_realtime add table public.%I', target);
    end if;
  end loop;
end
$$;
