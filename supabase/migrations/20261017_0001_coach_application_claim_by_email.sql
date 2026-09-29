-- 2026-10-17  Fixes a real bug: a "Coach"/"Both" registration submits its application with
-- user_id left null (no session exists yet at that point - see 20261016_0001), matched back to an
-- account by email only at approval time. But the player-facing "have I already applied?" check
-- looks the application up by user_id, so once they confirm their email and log in as a normal
-- player, it never finds that row and shows the apply form again instead of "pending".
--
-- Fix: a signed-in player can also see (and claim) a pending application that matches their own
-- verified email, not just one already carrying their user_id.
--
-- Safe to run more than once.

begin;

drop policy if exists coach_applications_select on public.coach_applications;
create policy coach_applications_select on public.coach_applications for select
  using (
    auth.uid() = user_id
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_admin()
  );

-- Lets a freshly-confirmed player attach their own id to an application that was submitted before
-- they had a session - tidies the data up the first time they're seen, nothing about the
-- application's review changes. Only moves user_id from null to their own id on a still-pending row.
drop policy if exists coach_applications_claim on public.coach_applications;
create policy coach_applications_claim on public.coach_applications for update
  using (
    user_id is null
    and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    and status = 'pending'
  )
  with check (user_id = auth.uid() and status = 'pending' and reviewed_at is null and reviewer_note is null);

commit;
