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
