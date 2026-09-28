-- Puts both accounts back after the screenshots. Before them:
--   main account 355adffa…: handle georgechara, display name "Georgechara", username "Georgechara"
--   test account d3e42198…: handle georgechara_test, no display name, no username
update public.profiles set handle = 'georgechara', display_name = 'Georgechara'
  where id = '355adffa-5ea3-49d7-803e-4c7cca778233';
update public.profiles set handle = 'georgechara_test', display_name = null
  where id = 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e';
update auth.users set raw_user_meta_data = raw_user_meta_data || jsonb_build_object('username', 'Georgechara')
  where id = '355adffa-5ea3-49d7-803e-4c7cca778233';
update auth.users set raw_user_meta_data = raw_user_meta_data - 'username'
  where id = 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e';
-- The live match made for the "Live now" screenshot.
delete from public.matches where notes = 'seed:live';

-- Coach mode, seeded on both accounts by make_demo_seed.py for the coaching screenshots.
-- coach_qualifications/coach_location/coach_lat/coach_lng/wpbsa_accredited did not exist on either
-- account before that (a fresh coach never sets them until they fill their profile in), so clearing
-- them back to null/empty/false is safe here. bio was only touched if it was already empty, so
-- clearing it back to null is safe too - if either account had a real bio before, it was left alone
-- and this line does not affect it.
delete from public.coach_bookings where coach_id in ('355adffa-5ea3-49d7-803e-4c7cca778233', 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e')
  or player_id in ('355adffa-5ea3-49d7-803e-4c7cca778233', 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e');
delete from public.coach_availability where coach_id in ('355adffa-5ea3-49d7-803e-4c7cca778233', 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e');
delete from public.coach_group_members where group_id in (select id from public.coach_groups where coach_id = 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e');
delete from public.coach_groups where coach_id = 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e';
update public.profiles set is_coach = false, coach_location = null, coach_lat = null, coach_lng = null,
    wpbsa_accredited = false, coach_qualifications = '{}',
    bio = case when bio = 'WPBSA-accredited coach, 12 years at The Cue Club. I focus on cue action and safety play.' then null else bio end
  where id = '355adffa-5ea3-49d7-803e-4c7cca778233';
update public.profiles set is_coach = false, coach_location = null, coach_lat = null, coach_lng = null,
    bio = case when bio = 'Club coach at The Cue Club. Cue action, safety and match temperament.' then null else bio end
  where id = 'd3e42198-08d2-40f6-8d83-b5d8a71c5c3e';
