-- Coach mode tables were never added to the realtime publication, so a booking's status changing
-- (accepted, declined, cancelled, rescheduled) never reached the other person's phone until they
-- next opened the app. Live sync (src/sync/realtime.ts) already listens for these tables; this is
-- what actually makes Postgres tell it when a row changes.
--
-- Safe to run more than once.

begin;

do $$
declare t text;
begin
  foreach t in array array['coach_bookings', 'coach_availability', 'coach_session_notes', 'coach_session_routines'] loop
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
