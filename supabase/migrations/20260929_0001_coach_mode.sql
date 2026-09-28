-- 2026-09-29  Coach mode: a WST-certified coach can be booked for a session instead of the
-- back-and-forth of a WhatsApp thread.
--
-- `is_coach` sits on the public profile (not app_metadata) because it has to be readable by
-- other players browsing a profile, not just by the coach's own session. It cannot be granted by
-- the player themselves: a before-update trigger freezes it back to its old value whenever the
-- write comes from an ordinary signed-in client (auth.role() = 'authenticated'), the same way
-- created_at is frozen for matches in 20260920_0001. Granting coach status is a plain
-- `update public.profiles set is_coach = true where id = '...'` run as the project owner (in the
-- SQL editor, or any service-role connection), which is not the 'authenticated' role and so is
-- not frozen - there is no self-serve "become a coach" toggle in the app, on purpose.
--
-- Safe to run more than once.

begin;

alter table public.profiles add column if not exists is_coach boolean not null default false;

create or replace function public.trg_freeze_is_coach()
returns trigger
language plpgsql
as $$
begin
  if auth.role() = 'authenticated' then
    new.is_coach := old.is_coach;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_freeze_is_coach on public.profiles;
create trigger trg_profiles_freeze_is_coach
before update on public.profiles
for each row execute function public.trg_freeze_is_coach();

-- A window of time a coach has said they can take a session. Open until a booking is made
-- against it; the coach removes it themselves if they no longer want it shown.
create table if not exists public.coach_availability (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint coach_availability_time_order check (ends_at > starts_at)
);
create index if not exists coach_availability_coach_idx on public.coach_availability (coach_id, starts_at);

-- A player's request for one of those windows, and how the coach answered it.
create table if not exists public.coach_bookings (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  availability_id uuid references public.coach_availability(id) on delete set null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  status text not null default 'pending',
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_bookings_status_check check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  constraint coach_bookings_time_order check (ends_at > starts_at),
  constraint coach_bookings_note_length check (note is null or char_length(note) <= 300)
);
create index if not exists coach_bookings_coach_idx on public.coach_bookings (coach_id, starts_at);
create index if not exists coach_bookings_player_idx on public.coach_bookings (player_id, starts_at);

-- Only one live request per slot at a time, so two players cannot both book the same hour.
create unique index if not exists coach_bookings_one_active_per_slot
  on public.coach_bookings (availability_id)
  where status in ('pending', 'accepted');

create or replace function public.trg_freeze_booking_parties()
returns trigger
language plpgsql
as $$
begin
  new.coach_id := old.coach_id;
  new.player_id := old.player_id;
  new.availability_id := old.availability_id;
  new.starts_at := old.starts_at;
  new.ends_at := old.ends_at;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_coach_bookings_freeze_parties on public.coach_bookings;
create trigger trg_coach_bookings_freeze_parties
before update on public.coach_bookings
for each row execute function public.trg_freeze_booking_parties();

alter table public.coach_availability enable row level security;
alter table public.coach_bookings enable row level security;

-- Availability: any signed-in player can see a coach's open slots, to book one. Only the coach
-- themselves - and only while flagged as a coach - can create or remove their own.
-- Each is dropped first so this file is actually safe to run more than once, as its header claims -
-- `create policy` has no `if not exists` form, so without the drop a rerun would fail here.
drop policy if exists coach_availability_select on public.coach_availability;
create policy coach_availability_select on public.coach_availability for select
  using (auth.role() = 'authenticated');

drop policy if exists coach_availability_insert on public.coach_availability;
create policy coach_availability_insert on public.coach_availability for insert
  with check (
    auth.uid() = coach_id
    and exists (select 1 from public.profiles p where p.id = coach_id and p.is_coach)
  );

drop policy if exists coach_availability_delete on public.coach_availability;
create policy coach_availability_delete on public.coach_availability for delete
  using (auth.uid() = coach_id);

-- Bookings: the coach and the player involved can both see and update their own booking (the
-- app's own UI is what limits a player to cancelling and a coach to accepting or declining -
-- see trg_freeze_booking_parties above for what a write can never change regardless of the UI).
drop policy if exists coach_bookings_select on public.coach_bookings;
create policy coach_bookings_select on public.coach_bookings for select
  using (auth.uid() = coach_id or auth.uid() = player_id);

-- Superseded by 20261015_0001_coach_manual_bookings.sql, which drops and recreates this same
-- policy to also let a coach insert a booking themselves - left here so this file still leaves a
-- correct (if narrower) policy in place if 20261015 has not run yet.
drop policy if exists coach_bookings_insert on public.coach_bookings;
create policy coach_bookings_insert on public.coach_bookings for insert
  with check (
    auth.uid() = player_id
    and exists (select 1 from public.profiles p where p.id = coach_id and p.is_coach)
  );

drop policy if exists coach_bookings_update on public.coach_bookings;
create policy coach_bookings_update on public.coach_bookings for update
  using (auth.uid() = coach_id or auth.uid() = player_id);

commit;
