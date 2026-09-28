-- Two fixes to rescheduling, found after 20261007 shipped:
--
-- 1. trg_freeze_booking_parties (from 20260929) froze availability_id, starts_at and ends_at on
--    every update, not just coach_id/player_id. That was meant to stop either side tampering with
--    who a booking is between, but it also silently discarded every reschedule: the UPDATE
--    returned success, the trigger just reset the row back to its old time before it was written,
--    so nothing ever appeared to move. Only coach_id/player_id need to stay frozen.
--
-- 2. A reschedule was applied immediately with no confirmation from the other side. Now it puts
--    the booking back to 'pending' and records which side still needs to answer, the same way a
--    fresh request does - the other person has to accept the new time before it is confirmed.
--
-- Safe to run more than once.

begin;

create or replace function public.trg_freeze_booking_parties()
returns trigger
language plpgsql
as $$
begin
  new.coach_id := old.coach_id;
  new.player_id := old.player_id;
  new.updated_at := now();
  return new;
end;
$$;

alter table public.coach_bookings add column if not exists awaiting_response_from text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coach_bookings_awaiting_response_check') then
    alter table public.coach_bookings add constraint coach_bookings_awaiting_response_check
      check (awaiting_response_from is null or awaiting_response_from in ('coach', 'player'));
  end if;
end
$$;

-- Existing pending rows predate this column: they are all fresh requests, so the coach is the one
-- who owes an answer.
update public.coach_bookings set awaiting_response_from = 'coach' where status = 'pending' and awaiting_response_from is null;

-- Only the side actually being asked can turn a pending booking into accepted/declined - otherwise
-- the person who proposed a new time could just approve their own proposal. Cancelling (withdrawing
-- or calling off an already-confirmed session) is untouched: either side can always do that.
create or replace function public.trg_guard_booking_response()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('accepted', 'declined')
     and new.status is distinct from old.status
     and old.status = 'pending'
     and old.awaiting_response_from is not null then
    if old.awaiting_response_from = 'coach' and auth.uid() <> old.coach_id then
      raise exception 'Only the coach can respond to this request.';
    elsif old.awaiting_response_from = 'player' and auth.uid() <> old.player_id then
      raise exception 'Only the player can respond to this request.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coach_bookings_guard_response on public.coach_bookings;
create trigger trg_coach_bookings_guard_response
before update on public.coach_bookings
for each row execute function public.trg_guard_booking_response();

commit;
