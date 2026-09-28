-- An optional note on why a session was moved, shown to whichever side did not make the change -
-- not mandatory, since the actual reason is often just discussed directly between coach and
-- player, but useful when it isn't.
--
-- Safe to run more than once.

begin;

alter table public.coach_bookings add column if not exists reschedule_reason text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'coach_bookings_reschedule_reason_length') then
    alter table public.coach_bookings add constraint coach_bookings_reschedule_reason_length
      check (reschedule_reason is null or char_length(reschedule_reason) <= 200);
  end if;
end
$$;

commit;
