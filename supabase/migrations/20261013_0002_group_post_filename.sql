-- A group post's media_path is a randomised storage key ("<groupId>/<timestamp>-<random>.<ext>"),
-- so the original filename a coach picked (e.g. "Week 3 Safety Drills.pdf") was never kept - every
-- PDF post just showed the generic "Open document" with no way to tell them apart. Keeping the
-- original name lets a post fall back to something meaningful when the coach has not typed their
-- own caption.
--
-- Safe to run more than once.

begin;

alter table public.coach_group_posts add column if not exists file_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coach_group_posts_file_name_length') then
    alter table public.coach_group_posts
      add constraint coach_group_posts_file_name_length check (file_name is null or char_length(file_name) <= 150);
  end if;
end $$;

commit;
