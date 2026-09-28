-- 2026-10-02  A coach's own notes on a session: what was covered, and what to focus on next time.
--
-- A separate table, not a column on coach_bookings, because these are private to the coach - the
-- player that booking is with should never be able to read them. coach_bookings itself is
-- selectable by both parties (they both need to see the booking), so a column there would leak
-- through that same policy; a table of its own can be locked to the coach alone.
--
-- Safe to run more than once.

begin;

create table if not exists public.coach_session_notes (
  booking_id uuid primary key references public.coach_bookings(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  notes text not null,
  updated_at timestamptz not null default now(),
  constraint coach_session_notes_length check (char_length(notes) <= 2000)
);
create index if not exists coach_session_notes_coach_idx on public.coach_session_notes (coach_id);

alter table public.coach_session_notes enable row level security;

drop policy if exists coach_session_notes_all on public.coach_session_notes;
create policy coach_session_notes_all on public.coach_session_notes for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

commit;
