-- A coach's record of which routines were covered in a session: the routine, the client's score
-- or practice result, and any notes specific to that routine (separate from the general session
-- notes, so several routines in one session can each have their own comment).
--
-- Same privacy shape as coach_session_notes: a separate table, coach-only RLS, because
-- coach_bookings itself is readable by both parties.
--
-- Safe to run more than once.

begin;

create table if not exists public.coach_session_routines (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.coach_bookings(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  routine_id text not null,
  routine_name text not null,
  score integer,
  notes text,
  created_at timestamptz not null default now(),
  constraint coach_session_routines_notes_length check (notes is null or char_length(notes) <= 1000)
);
create index if not exists coach_session_routines_booking_idx on public.coach_session_routines (booking_id);
create index if not exists coach_session_routines_coach_idx on public.coach_session_routines (coach_id);

alter table public.coach_session_routines enable row level security;

drop policy if exists coach_session_routines_all on public.coach_session_routines;
create policy coach_session_routines_all on public.coach_session_routines for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

commit;
