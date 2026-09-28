-- 2026-09-30  Coach qualifications: what a coach adds to their own listing, so players can see
-- what they are qualified in before booking, and whether they are WPBSA accredited.
--
-- Self-declared, like a bio - not verified against the WPBSA's own records, which is why the app
-- always labels it "self-declared" rather than presenting it as a checked fact. Because of that,
-- these columns follow the normal profiles_update_own policy rather than is_coach's frozen one:
-- a coach editing what they say about themselves is the same trust level as editing their bio.
--
-- Safe to run more than once.

begin;

alter table public.profiles add column if not exists coach_qualifications text[] not null default '{}';
alter table public.profiles add column if not exists wpbsa_accredited boolean not null default false;
alter table public.profiles add column if not exists coach_location text;

-- A CHECK constraint cannot itself contain a subquery, even one that only unnests the row's own
-- array column - so the per-tag length rule below lives in this small immutable function instead.
create or replace function public.qualifications_length_ok(tags text[])
returns boolean
language sql
immutable
as $$
  select coalesce(bool_and(char_length(tag) <= 40), true) from unnest(tags) as tag;
$$;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_location_length') then
    alter table public.profiles
      add constraint profiles_coach_location_length check (coach_location is null or char_length(coach_location) <= 120);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_qualifications_count') then
    alter table public.profiles
      add constraint profiles_coach_qualifications_count check (array_length(coach_qualifications, 1) is null or array_length(coach_qualifications, 1) <= 6);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_qualifications_length') then
    alter table public.profiles
      add constraint profiles_coach_qualifications_length check (public.qualifications_length_ok(coach_qualifications));
  end if;
end $$;

commit;
