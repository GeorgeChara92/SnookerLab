-- Push notifications for the things another player does that need you: friend requests (and
-- their acceptance), a friend logging a match against you (and your answer reaching them), a group
-- invite, and coach bookings (requested, confirmed, declined, moved, cancelled).
--
-- Until now only chat messages, reports and followed pro matches were pushed
-- (20261105_0001_chat_push.sql, poll-pro-tour), so a friend request arrived silently. Everything
-- here goes through one helper, push_to(), which sends to every phone the person has registered in
-- push_tokens, through Expo's push service with pg_net, after the change commits. A failure is
-- logged and never stops the change itself. Nobody is notified about someone they have blocked, or
-- who has blocked them. Each notification carries a `kind` (and an id), which the app uses to open
-- the right screen when it is tapped.
--
-- Safe to run more than once.

begin;

-- ------------------------------------------------------------------ the helper
create or replace function public.push_to(recipient uuid, title text, body text, data jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  batch jsonb;
begin
  if recipient is null then
    return;
  end if;
  select jsonb_agg(jsonb_build_object('to', t.token, 'sound', 'default', 'title', title, 'body', body, 'data', data))
    into batch
    from public.push_tokens t
    where t.user_id = recipient;
  if batch is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://exp.host/--/api/v2/push/send',
    body := batch,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'push_to: %', sqlerrm;
end;
$$;
revoke all on function public.push_to(uuid, text, text, jsonb) from public, anon, authenticated;

-- How a player is named in a notification: their display name, else their @handle.
create or replace function public.push_name(person uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select coalesce(nullif(trim(p.display_name), ''), '@' || nullif(p.handle, '')) from public.profiles p where p.id = person),
    'A player');
$$;
revoke all on function public.push_name(uuid) from public, anon, authenticated;

-- A session time as players read it: "Tue 18 Nov, 18:30" (UK time, where the coaches are).
create or replace function public.push_when(at timestamptz)
returns text
language sql
immutable
as $$
  select trim(to_char(at at time zone 'Europe/London', 'Dy FMDD Mon, HH24:MI'));
$$;

-- ------------------------------------------------------------------ friends
create or replace function public.friendships_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_blocked(new.requester, new.addressee) then
    return null;
  end if;
  if tg_op = 'INSERT' and new.status = 'pending' then
    perform public.push_to(new.addressee, 'Friend request',
      public.push_name(new.requester) || ' wants to be friends on Snookered.',
      jsonb_build_object('kind', 'friendRequest', 'userId', new.requester));
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    perform public.push_to(new.requester, 'Friend request accepted',
      public.push_name(new.addressee) || ' is now your friend. Your matches together can count for you both.',
      jsonb_build_object('kind', 'friendAccepted', 'userId', new.addressee));
  end if;
  return null;
exception when others then
  raise warning 'friendships_push: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.friendships_push() from public, anon, authenticated;
drop trigger if exists friendships_push on public.friendships;
create trigger friendships_push after insert or update on public.friendships
  for each row execute function public.friendships_push();

-- ------------------------------------------------------------------ matches against a friend
-- Mirrors the app's matchFinished(): a manual result is finished as entered; a live one once a
-- player has reached the frames needed to win.
create or replace function public.push_match_finished(m public.matches)
returns boolean
language sql
immutable
as $$
  select coalesce(m.recording_mode, 'manual') <> 'live'
    or (m.target_frames is not null and m.target_frames > 0
        and greatest(m.user_score, m.opponent_score) >= floor(m.target_frames / 2) + 1);
$$;

create or replace function public.matches_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  waiting_now boolean;
  waiting_before boolean;
begin
  if new.opponent_id is null or public.is_blocked(new.user_id, new.opponent_id) then
    return null;
  end if;

  -- The friend is asked once, when a match against them is finished and waiting for their answer.
  waiting_now := new.opponent_status = 'pending' and public.push_match_finished(new);
  waiting_before := tg_op = 'UPDATE' and old.opponent_status = 'pending' and old.opponent_id = new.opponent_id
    and public.push_match_finished(old);
  if waiting_now and not waiting_before then
    perform public.push_to(new.opponent_id, 'Confirm your match',
      public.push_name(new.user_id) || ' logged a ' || new.opponent_score || '–' || new.user_score
        || ' result against you. Confirm it so it counts for you both.',
      jsonb_build_object('kind', 'matchConfirm', 'matchId', new.id));
  end if;

  -- And the scorer hears the answer.
  if tg_op = 'UPDATE' and old.opponent_status = 'pending' and new.opponent_status in ('confirmed', 'disputed') then
    perform public.push_to(new.user_id,
      case when new.opponent_status = 'confirmed' then 'Match confirmed' else 'Match disputed' end,
      public.push_name(new.opponent_id) || case when new.opponent_status = 'confirmed'
        then ' confirmed your ' || new.user_score || '–' || new.opponent_score || ' match. It counts for you both now.'
        else ' disputed your ' || new.user_score || '–' || new.opponent_score || ' match. Check the score with them.' end,
      jsonb_build_object('kind', 'matchAnswered', 'matchId', new.id));
  end if;
  return null;
exception when others then
  raise warning 'matches_push: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.matches_push() from public, anon, authenticated;
drop trigger if exists matches_push on public.matches;
create trigger matches_push after insert or update on public.matches
  for each row execute function public.matches_push();

-- ------------------------------------------------------------------ group invites
create or replace function public.group_invites_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  group_name text;
begin
  if public.is_blocked(new.invited_by, new.user_id) then
    return null;
  end if;
  select name into group_name from public.groups where id = new.group_id and hidden_at is null;
  if group_name is null then
    return null;
  end if;
  perform public.push_to(new.user_id, 'Group invite',
    public.push_name(new.invited_by) || ' invited you to join ' || group_name || '.',
    jsonb_build_object('kind', 'groupInvite', 'groupId', new.group_id));
  return null;
exception when others then
  raise warning 'group_invites_push: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.group_invites_push() from public, anon, authenticated;
drop trigger if exists group_invites_push on public.group_invites;
create trigger group_invites_push after insert on public.group_invites
  for each row execute function public.group_invites_push();

-- ------------------------------------------------------------------ coach bookings
-- Walk-in bookings (no player account) only ever concern the coach, who made them, so they send
-- nothing. `awaiting_response_from` says whose answer a pending booking needs.
create or replace function public.coach_bookings_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  coach_name text := public.push_name(new.coach_id);
  player_name text;
  at_text text := public.push_when(new.starts_at);
  moved boolean;
begin
  if new.player_id is null then
    return null;
  end if;
  player_name := public.push_name(new.player_id);

  if tg_op = 'INSERT' then
    if new.status = 'pending' and new.awaiting_response_from = 'coach' then
      perform public.push_to(new.coach_id, 'New booking request',
        player_name || ' asked for a session on ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'coach', 'bookingId', new.id));
    elsif new.status = 'pending' and new.awaiting_response_from = 'player' then
      perform public.push_to(new.player_id, 'Session offered',
        coach_name || ' offered you a session on ' || at_text || '. Accept it to confirm.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'player', 'bookingId', new.id));
    elsif new.status = 'accepted' then
      perform public.push_to(new.player_id, 'Session booked',
        coach_name || ' booked you in for ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'player', 'bookingId', new.id));
    end if;
    return null;
  end if;

  moved := new.starts_at is distinct from old.starts_at;

  if moved and new.status = 'pending' then
    -- A new time was proposed; the side now being asked hears about it.
    if new.awaiting_response_from = 'player' then
      perform public.push_to(new.player_id, 'New time proposed',
        coach_name || ' asked to move your session to ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'player', 'bookingId', new.id));
    elsif new.awaiting_response_from = 'coach' then
      perform public.push_to(new.coach_id, 'New time proposed',
        player_name || ' asked to move their session to ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'coach', 'bookingId', new.id));
    end if;
  elsif old.status = 'pending' and new.status in ('accepted', 'declined') then
    -- The answer goes to whoever was waiting for it.
    if old.awaiting_response_from = 'player' then
      perform public.push_to(new.coach_id,
        case when new.status = 'accepted' then 'Session confirmed' else 'Session declined' end,
        player_name || case when new.status = 'accepted' then ' confirmed ' else ' declined ' end || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'coach', 'bookingId', new.id));
    else
      perform public.push_to(new.player_id,
        case when new.status = 'accepted' then 'Session confirmed' else 'Session declined' end,
        coach_name || case when new.status = 'accepted' then ' confirmed your session on ' else ' can''t do ' end || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'player', 'bookingId', new.id));
    end if;
  elsif old.status <> 'cancelled' and new.status = 'cancelled' then
    -- The other side from whoever cancelled.
    if auth.uid() = new.coach_id then
      perform public.push_to(new.player_id, 'Session cancelled',
        coach_name || ' cancelled your session on ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'player', 'bookingId', new.id));
    else
      perform public.push_to(new.coach_id, 'Session cancelled',
        player_name || ' cancelled their session on ' || at_text || '.',
        jsonb_build_object('kind', 'coachBooking', 'side', 'coach', 'bookingId', new.id));
    end if;
  end if;
  return null;
exception when others then
  raise warning 'coach_bookings_push: %', sqlerrm;
  return null;
end;
$$;
revoke all on function public.coach_bookings_push() from public, anon, authenticated;
drop trigger if exists coach_bookings_push on public.coach_bookings;
create trigger coach_bookings_push after insert or update on public.coach_bookings
  for each row execute function public.coach_bookings_push();

commit;
