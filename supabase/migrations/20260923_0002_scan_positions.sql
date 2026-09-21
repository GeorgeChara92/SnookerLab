-- Positions recorded with Scan Snooker: where every ball was when a snooker was laid, one per
-- frame, so the balls can be put back after a miss - on any of the player's devices.
--
-- The balls are stored as they are in the app: a list of { id, colour, x, y } in table
-- millimetres (see src/features/scanSnooker/table.ts). A position goes with its match.
--
-- Safe to run more than once.

create table if not exists public.scan_positions (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  frame_number integer not null check (frame_number between 1 and 99),
  balls jsonb not null default '[]'::jsonb,
  recorded_at timestamptz not null default now(),
  primary key (user_id, match_id, frame_number)
);

create index if not exists idx_scan_positions_match on public.scan_positions(match_id);

alter table public.scan_positions enable row level security;

drop policy if exists scan_positions_select_own on public.scan_positions;
drop policy if exists scan_positions_insert_own on public.scan_positions;
drop policy if exists scan_positions_update_own on public.scan_positions;
drop policy if exists scan_positions_delete_own on public.scan_positions;
create policy scan_positions_select_own on public.scan_positions for select using (auth.uid() = user_id);
-- A position can only be saved against one of the player's own matches.
create policy scan_positions_insert_own on public.scan_positions for insert with check (
  auth.uid() = user_id and exists (select 1 from public.matches m where m.id = match_id and m.user_id = auth.uid())
);
create policy scan_positions_update_own on public.scan_positions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy scan_positions_delete_own on public.scan_positions for delete using (auth.uid() = user_id);

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scan_positions'
  ) then
    alter publication supabase_realtime add table public.scan_positions;
  end if;
end
$$;
