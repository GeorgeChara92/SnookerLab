-- A player's progress, kept with their account rather than only on the phone.
--
-- Achievements were remembered in the phone's storage, which signing out clears, so signing
-- back in (or picking up a new phone) started the player at level 1 again. Each unlock is now a
-- row here, and the running XP and level are copied onto the profile, ready for anything that
-- shows players to each other later (leaderboards, a global chat, shared routines).
--
-- Safe to run more than once.

create table if not exists public.user_achievements (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  primary key (user_id, achievement_id)
);

alter table public.user_achievements enable row level security;

drop policy if exists user_achievements_select_own on public.user_achievements;
drop policy if exists user_achievements_insert_own on public.user_achievements;
create policy user_achievements_select_own on public.user_achievements
  for select using (auth.uid() = user_id);
create policy user_achievements_insert_own on public.user_achievements
  for insert with check (auth.uid() = user_id);

-- The XP and level as the app last worked them out. Written by the player's own app, so treat
-- them as a display value; anything competitive should recompute from the achievements above.
alter table public.profiles add column if not exists xp integer not null default 0;
alter table public.profiles add column if not exists level integer not null default 1;
alter table public.profiles add column if not exists progress_updated_at timestamptz;

-- Unlocks appear on the player's other devices straight away.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'user_achievements'
  ) then
    alter publication supabase_realtime add table public.user_achievements;
  end if;
end
$$;
