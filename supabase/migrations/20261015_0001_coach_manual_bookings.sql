-- A coach's calendar works like a diary, not just an inbox of requests: they can book a slot
-- straight into their own calendar for an existing client, or for someone with no Snookered
-- account at all - a guest_name stands in for player_id in that case.
--
-- Safe to run more than once.

begin;

alter table public.coach_bookings alter column player_id drop not null;
alter table public.coach_bookings add column if not exists guest_name text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coach_bookings_guest_name_length') then
    alter table public.coach_bookings add constraint coach_bookings_guest_name_length
      check (guest_name is null or char_length(guest_name) <= 80);
  end if;
end
$$;

-- Exactly one of a real player or a named guest - never both, never neither.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coach_bookings_player_xor_guest') then
    alter table public.coach_bookings add constraint coach_bookings_player_xor_guest
      check ((player_id is not null) <> (guest_name is not null));
  end if;
end
$$;

-- A coach can now create the row themselves too - for a guest, or for an existing client they are
-- booking straight into their diary - not just a player booking themselves in.
drop policy if exists coach_bookings_insert on public.coach_bookings;
create policy coach_bookings_insert on public.coach_bookings for insert
  with check (
    exists (select 1 from public.profiles p where p.id = coach_id and p.is_coach)
    and (auth.uid() = player_id or auth.uid() = coach_id)
  );

commit;
