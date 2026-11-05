-- Chat messages arrive as push notifications.
--
-- When a message is sent, everyone else in the conversation who has a phone registered in
-- push_tokens gets a notification through Expo's push service:
--   direct chat      title = the sender's name, body = the message
--   message request  "<name> wants to message you", without the message itself, so someone who
--                    has not been accepted can't put words on another player's lock screen
--   group chat       title = the group's name, body = "<name>: <message>"
-- Nobody is sent a notification for a conversation they muted or declined, a group that is hidden,
-- or a sender either of them has blocked. The notification carries the conversation id, which the
-- app opens when it is tapped.
--
-- Sent from the database with pg_net (already used by the poll-pro-tour cron job), so there is
-- no function to deploy. pg_net sends after the insert commits and never holds the message up;
-- any failure here is logged and the message is still saved.
--
-- Safe to run more than once.

begin;

create or replace function public.messages_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.conversations%rowtype;
  sender_name text;
  group_name text;
  preview text;
  batch jsonb;
begin
  if new.hidden_at is not null then
    return null;
  end if;

  select * into conv from public.conversations where id = new.conversation_id;
  if not found then
    return null;
  end if;

  if conv.kind = 'group' then
    select name into group_name from public.groups where id = conv.group_id and hidden_at is null;
    if group_name is null then
      return null;
    end if;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), '@' || nullif(p.handle, ''), 'A player')
    into sender_name
    from public.profiles p where p.id = new.sender;
  sender_name := coalesce(sender_name, 'A player');
  preview := left(regexp_replace(new.body, '\s+', ' ', 'g'), 140);

  -- Expo takes up to 100 notifications a request.
  for batch in
    with recipients as (
      select cm.user_id, cm.status
      from public.conversation_members cm
      where conv.kind = 'direct'
        and cm.conversation_id = conv.id
        and cm.user_id <> new.sender
        and cm.status <> 'declined'
        and not cm.muted
      union all
      select gm.user_id, 'active'
      from public.group_members gm
      where conv.kind = 'group'
        and gm.group_id = conv.group_id
        and gm.user_id <> new.sender
        and not exists (
          select 1 from public.conversation_members cm
          where cm.conversation_id = conv.id and cm.user_id = gm.user_id and cm.muted
        )
    ),
    notes as (
      select
        jsonb_build_object(
          'to', t.token,
          'sound', 'default',
          'title', case
            when conv.kind = 'group' then group_name
            when r.status = 'request' then 'Message request'
            else sender_name
          end,
          'body', case
            when conv.kind = 'group' then sender_name || ': ' || preview
            when r.status = 'request' then sender_name || ' wants to message you'
            else preview
          end,
          'data', jsonb_build_object('conversationId', conv.id)
        ) as note,
        (row_number() over (order by t.token) - 1) / 100 as chunk
      from recipients r
      join public.push_tokens t on t.user_id = r.user_id
      where not public.is_blocked(new.sender, r.user_id)
    )
    select jsonb_agg(note) from notes group by chunk
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := batch,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      timeout_milliseconds := 5000
    );
  end loop;

  return null;
exception when others then
  raise warning 'messages_push: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.messages_push() from public, anon, authenticated;

drop trigger if exists messages_push on public.messages;
create trigger messages_push after insert on public.messages
  for each row execute function public.messages_push();

-- ------------------------------------------------------------------ reports reach the admins
-- Each new report sends every app admin a notification, so reports are looked at the same day
-- rather than when someone happens to open the Reports screen. It says only what kind of thing
-- was reported and why; the details stay in the app. Tapping it opens Reports.
create or replace function public.reports_push()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  batch jsonb;
begin
  for batch in
    with notes as (
      select
        jsonb_build_object(
          'to', t.token,
          'sound', 'default',
          'title', 'New report',
          'body', initcap(new.target_type) || ' reported for ' || replace(new.reason, '_', ' '),
          'data', jsonb_build_object('adminReports', true)
        ) as note,
        (row_number() over (order by t.token) - 1) / 100 as chunk
      from public.app_admins a
      join public.push_tokens t on t.user_id = a.user_id
      where a.user_id <> new.reporter
    )
    select jsonb_agg(note) from notes group by chunk
  loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      body := batch,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      timeout_milliseconds := 5000
    );
  end loop;
  return null;
exception when others then
  raise warning 'reports_push: %', sqlerrm;
  return null;
end;
$$;

revoke all on function public.reports_push() from public, anon, authenticated;

drop trigger if exists reports_push on public.reports;
create trigger reports_push after insert on public.reports
  for each row execute function public.reports_push();

commit;
