-- Realtime decodes every write to every table in this publication, whether or not anything listens.
-- These three are in it but no app screen subscribes to them (the live sync in src/sync/realtime.ts,
-- chat, live matches and coach group posts cover everything else), so their writes were decoded for
-- nothing - load the free-tier database can't spare (see 20261028_0001_pro_tour_broadcast.sql).

alter publication supabase_realtime drop table public.groups, public.shared_routines, public.user_achievements;
