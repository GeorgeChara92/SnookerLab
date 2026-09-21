-- Each player's practice plan: the days they mean to practise (and the preset for each), how
-- many days a week they are aiming for, and their targets on routines.
--
-- One row per player, the plan held as it is in the app (see src/features/practice/plan.ts), so
-- the whole plan is saved at once and a change on one phone replaces it on the others.
--
-- Safe to run more than once.

create table if not exists public.practice_plans (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  plan jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.practice_plans enable row level security;

drop policy if exists practice_plans_select_own on public.practice_plans;
drop policy if exists practice_plans_insert_own on public.practice_plans;
drop policy if exists practice_plans_update_own on public.practice_plans;
drop policy if exists practice_plans_delete_own on public.practice_plans;
create policy practice_plans_select_own on public.practice_plans for select using (auth.uid() = user_id);
create policy practice_plans_insert_own on public.practice_plans for insert with check (auth.uid() = user_id);
create policy practice_plans_update_own on public.practice_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy practice_plans_delete_own on public.practice_plans for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'practice_plans'
  ) then
    alter publication supabase_realtime add table public.practice_plans;
  end if;
end
$$;
