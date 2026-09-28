-- Coach group posts were never added to the realtime publication, the same gap 20261006 fixed for
-- bookings and availability - a player never found out a coach had posted something new until they
-- next opened the app and happened to check that group.
--
-- Safe to run more than once.

begin;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'coach_group_posts'
  ) then
    execute 'alter publication supabase_realtime add table public.coach_group_posts';
  end if;
end
$$;

commit;
