-- Routines players build themselves, by placing balls on the table diagram.
--
-- Kept with the account so a routine built on one phone is there on every other. The ball
-- layout is stored as it is in the app: a list of balls in table millimetres (see
-- src/features/scanSnooker/table.ts), each { id, colour, x, y }.
--
-- Safe to run more than once.

create table if not exists public.custom_routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  description text check (description is null or char_length(description) <= 500),
  max_score integer check (max_score is null or (max_score between 1 and 999)),
  balls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_custom_routines_user on public.custom_routines(user_id, updated_at desc);

alter table public.custom_routines enable row level security;

drop policy if exists custom_routines_select_own on public.custom_routines;
drop policy if exists custom_routines_insert_own on public.custom_routines;
drop policy if exists custom_routines_update_own on public.custom_routines;
drop policy if exists custom_routines_delete_own on public.custom_routines;
create policy custom_routines_select_own on public.custom_routines for select using (auth.uid() = user_id);
create policy custom_routines_insert_own on public.custom_routines for insert with check (auth.uid() = user_id);
create policy custom_routines_update_own on public.custom_routines for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy custom_routines_delete_own on public.custom_routines for delete using (auth.uid() = user_id);

-- Changes show on the player's other devices straight away.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'custom_routines'
  ) then
    alter publication supabase_realtime add table public.custom_routines;
  end if;
end
$$;
