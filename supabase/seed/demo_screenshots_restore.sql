-- =====================================================================================================
-- Restore g_charalambous@icloud.com after the screenshots: undoes demo_screenshots.sql exactly.
--
-- Deletes only the rows that script added (every one has an id starting dec0de00), puts your name back
-- (handle dannyhale, display name Georgechara) and takes the complimentary Century plan off - the next
-- app launch then re-checks your plan with RevenueCat. Anything that was in the account before the demo
-- stays. Run it in the Supabase SQL editor.
--
-- For a completely empty account (none of your earlier test matches or sessions either), run this and
-- then use Settings > Reset profile in the app.
-- =====================================================================================================

begin;
delete from public.messages                   where id::text like 'dec0de00%';
delete from public.conversation_members       where conversation_id::text like 'dec0de00%';
delete from public.conversations              where id::text like 'dec0de00%';
delete from public.activity                   where id::text like 'dec0de00%';
delete from public.group_routines             where group_id::text like 'dec0de00%';
delete from public.group_members              where group_id::text like 'dec0de00%';
delete from public.groups                     where id::text like 'dec0de00%';
delete from public.coach_group_members        where group_id::text like 'dec0de00%';
delete from public.coach_groups               where id::text like 'dec0de00%';
delete from public.coach_reviews              where id::text like 'dec0de00%';
delete from public.coach_homework             where id::text like 'dec0de00%';
delete from public.coach_session_routines     where id::text like 'dec0de00%';
delete from public.coach_session_recaps       where booking_id::text like 'dec0de00%';
delete from public.coach_session_notes        where booking_id::text like 'dec0de00%';
delete from public.coach_bookings             where id::text like 'dec0de00%';
delete from public.coach_availability         where id::text like 'dec0de00%';
delete from public.tournament_fixture_frames  where id::text like 'dec0de00%';
delete from public.tournament_fixtures        where id::text like 'dec0de00%';
delete from public.tournaments                where id::text like 'dec0de00%';
delete from public.match_frames               where id::text like 'dec0de00%';
delete from public.matches                    where id::text like 'dec0de00%';
delete from public.routine_score_entries      where id::text like 'dec0de00%';
delete from public.session_log_results        where id::text like 'dec0de00%';
delete from public.session_logs               where id::text like 'dec0de00%';
delete from public.session_templates          where id::text like 'dec0de00%';
delete from public.friendships                where id::text like 'dec0de00%';
-- The five pros the demo followed for you (you followed none before it).
delete from public.pro_tour_follows
where user_id = (select id from auth.users where lower(email) = 'g_charalambous@icloud.com')
  and player_id in (select id from public.pro_tour_players
                    where display_name in ('Judd Trump', 'Ronnie O''Sullivan', 'Mark Selby', 'Kyren Wilson', 'Mark Allen'));
-- Your own name back, and the complimentary plan off (what it was before the demo):
update auth.users set raw_user_meta_data = (raw_user_meta_data - 'full_name') || '{"username": "Georgechara"}'::jsonb,
  raw_app_meta_data = raw_app_meta_data - 'comp_tier'
  where lower(email) = 'g_charalambous@icloud.com';
update public.profiles set display_name = 'Georgechara', handle = 'dannyhale', username = null
  where id = (select id from auth.users where lower(email) = 'g_charalambous@icloud.com');
commit;
