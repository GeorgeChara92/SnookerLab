-- The apps no longer watch pro_tour_matches through Realtime's postgres_changes: poll-pro-tour sends
-- one broadcast on the "pro-tour" channel after a poll that changed anything, and the apps listen to
-- that (commit a14e3d3). Leaving the table in the publication would still make the database decode
-- every write of its busiest table for Realtime - load that, with the free tier's disk IO budget
-- spent, stalled the whole database for four hours on 23 Oct 2026.

alter publication supabase_realtime drop table public.pro_tour_matches;
