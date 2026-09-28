-- Foreign key columns with no index of their own. Postgres only indexes the referenced side of a
-- foreign key automatically (the parent's primary key) - never the child column that points at it.
-- Without one, two things both cost disk IO: fetching a parent's children by that column (e.g.
-- every fixture in a tournament), and Postgres's own cascade delete, which has to find every
-- matching child row to remove it and does that with a full table scan when there is no index to
-- use instead. As these tables grow with more users, that scan gets slower and heavier every time.
--
-- Purely additive - no behaviour changes, safe to run anytime, safe to run more than once.

begin;

-- listMemberCoachGroups() (now called on every sign-in via coachStore.hydrate, not just when the
-- Coaching tab is opened) queries this by player_id alone. The table's only index is the
-- (group_id, player_id) primary key, which cannot serve a player_id-only lookup - this was a full
-- table scan on every single hydrate, for every player, coach or not.
create index if not exists coach_group_members_player_idx on public.coach_group_members (player_id);

create index if not exists tournament_fixtures_tournament_idx on public.tournament_fixtures (tournament_id);
create index if not exists tournament_fixture_frames_fixture_idx on public.tournament_fixture_frames (fixture_id);
create index if not exists session_log_results_log_idx on public.session_log_results (log_id);

-- The existing (user_id, match_id, frame_number) index has match_id in the middle, not leading, so
-- it cannot serve a match_id-only lookup either - exactly what deleting a match needs to find its
-- frames to cascade to.
create index if not exists match_frames_match_idx on public.match_frames (match_id);

commit;
