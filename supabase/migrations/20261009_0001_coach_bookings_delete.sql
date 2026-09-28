-- coach_bookings had select/insert/update policies but no delete policy, so a client-side delete
-- was silently blocked by RLS (no matching policy = no rows affected). This adds the ability to
-- clear old history - a declined or cancelled request, or an accepted session that has already
-- ended - for whichever side of it is doing the tidying. A booking still pending or still to come
-- can never be deleted this way, only cancelled.
--
-- Safe to run more than once.

begin;

drop policy if exists coach_bookings_delete on public.coach_bookings;
create policy coach_bookings_delete on public.coach_bookings for delete
  using (
    (auth.uid() = coach_id or auth.uid() = player_id)
    and (status <> 'accepted' or ends_at < now())
  );

commit;
