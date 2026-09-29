-- 2026-10-16  Coach applications: becoming a coach is no longer instant. Anyone could previously
-- pick "Coach" or "Both" at registration and get a bookable coach listing immediately (self-declared
-- qualifications and all) - fine while testing, not something to ship, since a player could be
-- paying a stranger for a real-life session on the strength of a claim nobody checked.
--
-- From here, `is_coach` is only ever set by an admin approving a row in this table (reviewed by
-- hand against whatever the applicant gave - socials, WPBSA number, experience). The registration
-- wizard and the in-app "Apply to coach" flow both just insert a pending application; the actual
-- account (`is_coach = true` plus the coaching profile fields) is created by the
-- approve-coach-application edge function once an admin says yes.
--
-- Safe to run more than once.

begin;

-- ------------------------------------------------------------------ the application itself
create table if not exists public.coach_applications (
  id uuid primary key default gen_random_uuid(),
  -- Set when the applicant already had a signed-in session at the moment they applied (the in-app
  -- "Apply to coach" flow). Null for a brand-new registration (no session yet, still unconfirmed)
  -- and for a website applicant with no account at all - both are matched back to an account by
  -- email when the application is approved, creating one if none exists.
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  full_name text not null,
  bio text,
  location text,
  lat double precision,
  lng double precision,
  experience text not null,
  qualifications text[] not null default '{}',
  wpbsa_accredited boolean not null default false,
  wpbsa_number text,
  -- Free text: links the applicant gave for the admin to actually check (Instagram, a club page,
  -- a coaching website...). Never shown to players - this is for verification, not the listing.
  social_links text,
  status text not null default 'pending',
  reviewer_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint coach_applications_status_check check (status in ('pending', 'approved', 'rejected')),
  constraint coach_applications_email_length check (char_length(email) <= 255),
  constraint coach_applications_full_name_length check (char_length(full_name) <= 120),
  constraint coach_applications_bio_length check (bio is null or char_length(bio) <= 160),
  constraint coach_applications_location_length check (location is null or char_length(location) <= 120),
  constraint coach_applications_experience_length check (char_length(experience) <= 1000),
  constraint coach_applications_social_links_length check (social_links is null or char_length(social_links) <= 500),
  constraint coach_applications_wpbsa_number_length check (wpbsa_number is null or char_length(wpbsa_number) <= 40),
  constraint coach_applications_qualifications_count check (array_length(qualifications, 1) is null or array_length(qualifications, 1) <= 6)
);
create index if not exists coach_applications_status_idx on public.coach_applications (status, created_at);
create index if not exists coach_applications_user_idx on public.coach_applications (user_id);

-- One live application per email at a time - resubmitting while already pending would just be
-- clutter in the review queue, not a second, separate request.
create unique index if not exists coach_applications_one_pending_per_email
  on public.coach_applications (lower(email))
  where status = 'pending';

alter table public.coach_applications enable row level security;

-- Anyone can apply - signed in (their own user_id) or not (user_id left null, matched by email
-- later). Either way the row must arrive as a fresh, untouched pending application: nothing about
-- its review (status, reviewer_note, reviewed_at) can be set by the applicant.
drop policy if exists coach_applications_insert on public.coach_applications;
create policy coach_applications_insert on public.coach_applications for insert
  with check (
    status = 'pending'
    and reviewed_at is null
    and reviewer_note is null
    and (user_id is null or user_id = auth.uid())
  );

-- An applicant can check their own application's status; an admin can see the whole queue.
drop policy if exists coach_applications_select on public.coach_applications;
create policy coach_applications_select on public.coach_applications for select
  using (auth.uid() = user_id or public.is_admin());

-- An admin can reject straight from the SQL editor or a future admin screen - no side effects to
-- run, so plain RLS is enough. Approving is different: it has to create or update an auth account,
-- which RLS cannot do, so that only ever happens through approve-coach-application (service role,
-- which bypasses RLS entirely and is not limited to this policy).
drop policy if exists coach_applications_admin_reject on public.coach_applications;
create policy coach_applications_admin_reject on public.coach_applications for update
  using (public.is_admin() and status = 'pending')
  with check (status = 'rejected');

-- ------------------------------------------------------------------ close the old self-serve gap
-- `trg_freeze_is_coach` (20260929_0001) only fired on update, on the theory that a brand new
-- profile row had no is_coach to protect yet - true until the registration wizard started seeding
-- is_coach straight onto that first insert from what the signup form collected. It now also fires
-- on insert, zeroing is_coach back to false whenever the write comes from an ordinary signed-in
-- client, so the only way it can ever end up true is a service-role write - i.e. approval.
create or replace function public.trg_freeze_is_coach()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'authenticated' then
      new.is_coach := false;
    end if;
    return new;
  end if;
  if auth.role() = 'authenticated' then
    new.is_coach := old.is_coach;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_freeze_is_coach on public.profiles;
create trigger trg_profiles_freeze_is_coach
before insert or update on public.profiles
for each row execute function public.trg_freeze_is_coach();

-- ------------------------------------------------------------------ shown on an approved coach's listing
-- What a player sees on Find a Coach, alongside the existing bio and coach_qualifications tags -
-- filled in from the approved application, then editable afterwards the same as a bio (normal
-- profiles_update_own policy: a coach editing what they say about themselves, not re-granting
-- coach status).
alter table public.profiles add column if not exists coach_experience text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_coach_experience_length') then
    alter table public.profiles
      add constraint profiles_coach_experience_length check (coach_experience is null or char_length(coach_experience) <= 1000);
  end if;
end $$;

commit;
