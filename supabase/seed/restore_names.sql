-- Puts the display names back after the screenshots (they were "Georgechara" and none).
update public.profiles set display_name = 'Georgechara' where handle = 'georgechara';
update public.profiles set display_name = null where handle = 'georgechara_test';
