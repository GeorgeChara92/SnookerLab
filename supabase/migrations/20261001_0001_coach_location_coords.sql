-- 2026-10-01  Real coordinates for a coach's location, alongside the free-text place name added in
-- 20260930_0001. Lets "find a coach near me" eventually sort by real distance instead of just
-- text-matching a town name. Populated by the app's own reverse-geocode when a coach taps "Use my
-- current location" - a coach can still type a location by hand and leave these null.
--
-- Same trust level as coach_location itself: self-declared, editable by the coach via the normal
-- profiles_update_own policy, not frozen like is_coach.
--
-- Safe to run more than once.

begin;

alter table public.profiles add column if not exists coach_lat double precision;
alter table public.profiles add column if not exists coach_lng double precision;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_lat_range') then
    alter table public.profiles
      add constraint profiles_coach_lat_range check (coach_lat is null or coach_lat between -90 and 90);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_lng_range') then
    alter table public.profiles
      add constraint profiles_coach_lng_range check (coach_lng is null or coach_lng between -180 and 180);
  end if;
end $$;

commit;
