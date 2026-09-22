-- Groups and chat.
--
-- Conversations are either direct (two players) or a group's chat. Direct messages follow the
-- recipient's "who can message me" setting:
--   * friends message each other straight into their chats;
--   * with 'everyone', anyone else's first message arrives as a request the recipient can
--     accept (it moves to their chats) or decline (it goes, and the sender cannot try again
--     while it stands);
--   * with 'friends', only friends can start one; with 'nobody', no one can.
-- Blocking either way stops a conversation being started, and hides messages already sent.
--
-- Groups are public (anyone can find and join them) or invite-only. Their settings say who can
-- post (everyone or admins) and who can invite (everyone or admins). The owner and admins run
-- the group; the owner can hand it on.
--
-- Messages use the word filter, can be reported, and three reports hide one until reviewed.
-- The complicated steps - starting a conversation, answering a request, creating and joining
-- groups - are functions the app calls, so the rules live here and cannot be skipped.
--
-- Safe to run more than once. Needs the community migrations first.

-- ------------------------------------------------------------------ groups
create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 3 and 40),
  description text check (description is null or char_length(description) <= 300),
  -- An emoji and a colour to show for the group.
  emoji text not null default '🎱' check (char_length(emoji) <= 8),
  colour text not null default '#1E7A46' check (colour ~ '^#[0-9A-Fa-f]{6}$'),
  visibility text not null default 'public' check (visibility in ('public', 'invite')),
  who_can_post text not null default 'everyone' check (who_can_post in ('everyone', 'admins')),
  who_can_invite text not null default 'everyone' check (who_can_invite in ('everyone', 'admins')),
  member_count integer not null default 0,
  hidden_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_groups_public on public.groups (member_count desc) where visibility = 'public' and hidden_at is null;

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_group_members_user on public.group_members (user_id);

create table if not exists public.group_invites (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists idx_group_invites_user on public.group_invites (user_id);

create or replace function public.group_role(g uuid, u uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.group_members where group_id = g and user_id = u;
$$;

-- ------------------------------------------------------------------ conversations
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('direct', 'group')),
  group_id uuid unique references public.groups(id) on delete cascade,
  -- For a direct conversation, the pair in a fixed order, so there is only ever one.
  pair_low uuid references auth.users(id) on delete cascade,
  pair_high uuid references auth.users(id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender uuid,
  created_at timestamptz not null default now(),
  check ((kind = 'group' and group_id is not null) or (kind = 'direct' and pair_low is not null and pair_high is not null))
);
create unique index if not exists idx_conversations_pair on public.conversations (pair_low, pair_high) where kind = 'direct';

-- Each player's place in a direct conversation: in their chats ('active'), waiting as a request
-- ('request'), or turned down ('declined'). Group conversations use group membership instead,
-- with a row here only to remember when each member last read it.
create table if not exists public.conversation_members (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'request', 'declined')),
  last_read_at timestamptz,
  muted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index if not exists idx_conversation_members_user on public.conversation_members (user_id, status);

create or replace function public.can_read_conversation(c uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations conv
    where conv.id = c and (
      (conv.kind = 'group' and exists (select 1 from public.group_members gm where gm.group_id = conv.group_id and gm.user_id = u))
      or (conv.kind = 'direct' and exists (
        select 1 from public.conversation_members cm
        where cm.conversation_id = c and cm.user_id = u and cm.status <> 'declined'
      ))
    )
  );
$$;

create or replace function public.can_post_conversation(c uuid, u uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.conversations conv
    where conv.id = c and (
      (conv.kind = 'group' and exists (
        select 1 from public.groups g join public.group_members gm on gm.group_id = g.id and gm.user_id = u
        where g.id = conv.group_id and g.hidden_at is null
          and (g.who_can_post = 'everyone' or gm.role in ('owner', 'admin'))
      ))
      or (conv.kind = 'direct'
        and exists (select 1 from public.conversation_members cm where cm.conversation_id = c and cm.user_id = u and cm.status = 'active')
        and not public.is_blocked(conv.pair_low, conv.pair_high)
        -- Until a request is accepted, the sender can send, the recipient answers first.
        and not exists (select 1 from public.conversation_members cm where cm.conversation_id = c and cm.status = 'declined'))
    )
  );
$$;

-- ------------------------------------------------------------------ messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender uuid not null default auth.uid() references auth.users(id) on delete cascade,
  -- 'text', or a shared routine or match result with its details in payload.
  kind text not null default 'text' check (kind in ('text', 'routine', 'match')),
  body text not null check (char_length(body) between 1 and 2000),
  payload jsonb,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_messages_conversation on public.messages (conversation_id, created_at desc);

-- ------------------------------------------------------------------ row level security
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;

drop policy if exists groups_select on public.groups;
drop policy if exists groups_update_admins on public.groups;
drop policy if exists groups_delete_owner on public.groups;
create policy groups_select on public.groups for select using (
  public.is_admin()
  or public.group_role(id, auth.uid()) is not null
  or exists (select 1 from public.group_invites i where i.group_id = id and i.user_id = auth.uid())
  or (visibility = 'public' and hidden_at is null and auth.role() = 'authenticated')
);
create policy groups_update_admins on public.groups for update
  using (public.group_role(id, auth.uid()) in ('owner', 'admin') or public.is_admin());
create policy groups_delete_owner on public.groups for delete
  using (public.group_role(id, auth.uid()) = 'owner' or public.is_admin());

drop policy if exists group_members_select on public.group_members;
drop policy if exists group_members_leave on public.group_members;
create policy group_members_select on public.group_members for select using (
  public.group_role(group_id, auth.uid()) is not null
  or exists (select 1 from public.groups g where g.id = group_id and g.visibility = 'public' and g.hidden_at is null)
);
-- Leaving is a delete of one's own row (joining and roles go through functions).
create policy group_members_leave on public.group_members for delete using (
  (auth.uid() = user_id and role <> 'owner')
  or (public.group_role(group_id, auth.uid()) in ('owner', 'admin') and role = 'member')
  or (public.group_role(group_id, auth.uid()) = 'owner' and user_id <> auth.uid())
);

drop policy if exists group_invites_select on public.group_invites;
drop policy if exists group_invites_decline on public.group_invites;
create policy group_invites_select on public.group_invites for select
  using (auth.uid() = user_id or public.group_role(group_id, auth.uid()) is not null);
create policy group_invites_decline on public.group_invites for delete
  using (auth.uid() = user_id or public.group_role(group_id, auth.uid()) in ('owner', 'admin'));

drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations for select using (public.can_read_conversation(id, auth.uid()));

drop policy if exists conversation_members_select on public.conversation_members;
drop policy if exists conversation_members_update_own on public.conversation_members;
create policy conversation_members_select on public.conversation_members for select
  using (auth.uid() = user_id or public.can_read_conversation(conversation_id, auth.uid()));
-- A player may mark their own conversation read or muted; status changes go through functions.
create policy conversation_members_update_own on public.conversation_members for update
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists messages_select on public.messages;
drop policy if exists messages_insert on public.messages;
drop policy if exists messages_admin on public.messages;
create policy messages_select on public.messages for select using (
  public.is_admin()
  or (
    public.can_read_conversation(conversation_id, auth.uid())
    and (hidden_at is null or sender = auth.uid())
    and not public.is_blocked(auth.uid(), sender)
  )
);
create policy messages_insert on public.messages for insert
  with check (auth.uid() = sender and public.can_post_conversation(conversation_id, auth.uid()));
create policy messages_admin on public.messages for update using (public.is_admin());

-- A player's own status column cannot be changed by the update policy above.
create or replace function public.conversation_members_guard()
returns trigger
language plpgsql
as $$
begin
  if new.status is distinct from old.status and current_setting('snooker.chat', true) is distinct from 'on' then
    new.status := old.status;
  end if;
  return new;
end;
$$;
drop trigger if exists conversation_members_guard on public.conversation_members;
create trigger conversation_members_guard before update on public.conversation_members
  for each row execute function public.conversation_members_guard();

-- ------------------------------------------------------------------ words, previews, counts
create or replace function public.messages_before()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.body) then
    raise exception 'That message contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  new.hidden_at := null;
  return new;
end;
$$;
drop trigger if exists messages_before on public.messages;
create trigger messages_before before insert on public.messages
  for each row execute function public.messages_before();

create or replace function public.messages_after()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
    set last_message_at = new.created_at, last_message_preview = left(new.body, 120), last_sender = new.sender
    where id = new.conversation_id;
  -- Sending marks the conversation read for the sender.
  insert into public.conversation_members (conversation_id, user_id, status, last_read_at)
    select new.conversation_id, new.sender, 'active', new.created_at
    where exists (select 1 from public.conversations where id = new.conversation_id and kind = 'group')
  on conflict (conversation_id, user_id) do update set last_read_at = excluded.last_read_at;
  update public.conversation_members set last_read_at = new.created_at
    where conversation_id = new.conversation_id and user_id = new.sender;
  return null;
end;
$$;
drop trigger if exists messages_after on public.messages;
create trigger messages_after after insert on public.messages
  for each row execute function public.messages_after();

create or replace function public.groups_guard()
returns trigger
language plpgsql
as $$
begin
  if public.contains_blocked_word(new.name) or public.contains_blocked_word(new.description) then
    raise exception 'That contains a word that is not allowed.' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if current_setting('snooker.chat', true) is distinct from 'on' then
      new.member_count := old.member_count;
      new.owner := old.owner;
    end if;
    if not public.is_admin() and current_setting('snooker.moderating', true) is distinct from 'on' then
      new.hidden_at := old.hidden_at;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists groups_guard on public.groups;
create trigger groups_guard before insert or update on public.groups
  for each row execute function public.groups_guard();

create or replace function public.group_members_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare target uuid := coalesce(new.group_id, old.group_id);
begin
  perform set_config('snooker.chat', 'on', true);
  update public.groups set member_count = (select count(*) from public.group_members where group_id = target) where id = target;
  perform set_config('snooker.chat', 'off', true);
  return null;
end;
$$;
drop trigger if exists group_members_count on public.group_members;
create trigger group_members_count after insert or delete on public.group_members
  for each row execute function public.group_members_count();

-- ------------------------------------------------------------------ functions the app calls

-- Opens the direct conversation with another player, starting it if need be. Returns its id,
-- or raises a readable reason when the other player cannot be messaged.
create or replace function public.start_direct(other uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  low uuid := least(me, other);
  high uuid := greatest(me, other);
  existing uuid;
  their_status text;
  privacy text;
  friends boolean;
begin
  if me is null then raise exception 'Sign in first.'; end if;
  if other = me then raise exception 'You cannot message yourself.'; end if;
  if public.is_blocked(me, other) then raise exception 'You cannot message this player.'; end if;

  select id into existing from public.conversations where kind = 'direct' and pair_low = low and pair_high = high;
  if existing is not null then
    select status into their_status from public.conversation_members where conversation_id = existing and user_id = other;
    if their_status = 'declined' then raise exception 'This player is not taking messages from you.'; end if;
    perform set_config('snooker.chat', 'on', true);
    update public.conversation_members set status = 'active' where conversation_id = existing and user_id = me and status = 'request';
    return existing;
  end if;

  select coalesce(message_privacy, 'everyone') into privacy from public.profiles where id = other;
  friends := public.are_friends(me, other);
  if privacy = 'nobody' then raise exception 'This player is not taking messages.'; end if;
  if privacy = 'friends' and not friends then raise exception 'This player only takes messages from friends.'; end if;

  insert into public.conversations (kind, pair_low, pair_high) values ('direct', low, high) returning id into existing;
  insert into public.conversation_members (conversation_id, user_id, status, last_read_at) values
    (existing, me, 'active', now()),
    (existing, other, case when friends then 'active' else 'request' end, null);
  return existing;
end;
$$;

-- Accepts or declines a message request.
create or replace function public.answer_request(conversation uuid, accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('snooker.chat', 'on', true);
  update public.conversation_members
    set status = case when accept then 'active' else 'declined' end, last_read_at = now()
    where conversation_id = conversation and user_id = auth.uid() and status = 'request';
  if not found then raise exception 'There is no request to answer.'; end if;
end;
$$;

-- Creates a group with the caller as owner, and its chat.
create or replace function public.create_group(
  group_name text, group_description text, group_emoji text, group_colour text,
  group_visibility text, posting text, inviting text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare created uuid;
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  insert into public.groups (owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite)
    values (auth.uid(), trim(group_name), nullif(trim(group_description), ''), group_emoji, group_colour,
            group_visibility, posting, inviting)
    returning id into created;
  insert into public.group_members (group_id, user_id, role) values (created, auth.uid(), 'owner');
  insert into public.conversations (kind, group_id) values ('group', created);
  return created;
end;
$$;

-- Joins a public group, or one the caller has been invited to.
create or replace function public.join_group(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare g public.groups%rowtype;
begin
  select * into g from public.groups where id = target;
  if not found or g.hidden_at is not null then raise exception 'This group is not available.'; end if;
  if g.visibility = 'invite' and not exists (select 1 from public.group_invites where group_id = target and user_id = auth.uid()) then
    raise exception 'This group is invite only.';
  end if;
  if exists (select 1 from public.group_members m where m.group_id = target and public.is_blocked(auth.uid(), m.user_id) and m.role = 'owner') then
    raise exception 'This group is not available.';
  end if;
  insert into public.group_members (group_id, user_id, role) values (target, auth.uid(), 'member') on conflict do nothing;
  delete from public.group_invites where group_id = target and user_id = auth.uid();
end;
$$;

-- Invites a player to a group, when the caller is allowed to.
create or replace function public.invite_to_group(target uuid, player uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups%rowtype;
  my_role text := public.group_role(target, auth.uid());
begin
  select * into g from public.groups where id = target;
  if my_role is null then raise exception 'Join the group first.'; end if;
  if g.who_can_invite = 'admins' and my_role not in ('owner', 'admin') then raise exception 'Only admins can invite to this group.'; end if;
  if public.is_blocked(auth.uid(), player) then raise exception 'You cannot invite this player.'; end if;
  if exists (select 1 from public.group_members where group_id = target and user_id = player) then return; end if;
  insert into public.group_invites (group_id, user_id, invited_by) values (target, player, auth.uid()) on conflict do nothing;
end;
$$;

-- Makes a member an admin or a member again (owner only), or hands the group on.
create or replace function public.set_group_role(target uuid, player uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.group_role(target, auth.uid()) <> 'owner' then raise exception 'Only the owner can change roles.'; end if;
  if new_role not in ('admin', 'member', 'owner') then raise exception 'Unknown role.'; end if;
  if not exists (select 1 from public.group_members where group_id = target and user_id = player) then raise exception 'Not a member.'; end if;
  if new_role = 'owner' then
    update public.group_members set role = 'admin' where group_id = target and user_id = auth.uid();
    update public.group_members set role = 'owner' where group_id = target and user_id = player;
    perform set_config('snooker.chat', 'on', true);
    update public.groups set owner = player where id = target;
  else
    update public.group_members set role = new_role where group_id = target and user_id = player and role <> 'owner';
  end if;
end;
$$;

-- Marks a conversation read up to now (and makes the row for a group member who has not posted).
create or replace function public.mark_read(conversation uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_read_conversation(conversation, auth.uid()) then return; end if;
  insert into public.conversation_members (conversation_id, user_id, status, last_read_at)
    values (conversation, auth.uid(), 'active', now())
  on conflict (conversation_id, user_id) do update set last_read_at = now();
end;
$$;

-- The player's inbox in one go: every direct conversation and group chat they are in, the
-- other player for a direct one, where it stands, the last message and how many are unread.
create or replace function public.inbox()
returns table (
  conversation_id uuid,
  kind text,
  group_id uuid,
  other_user uuid,
  status text,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender uuid,
  unread integer,
  muted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select c.id, c.kind, c.group_id,
      case when c.kind = 'direct' then (case when c.pair_low = auth.uid() then c.pair_high else c.pair_low end) end as other_user,
      coalesce(cm.status, 'active') as status,
      c.last_message_at, c.last_message_preview, c.last_sender,
      cm.last_read_at, coalesce(cm.muted, false) as muted
    from public.conversations c
    left join public.conversation_members cm on cm.conversation_id = c.id and cm.user_id = auth.uid()
    where (c.kind = 'direct' and cm.user_id is not null and cm.status <> 'declined')
       or (c.kind = 'group' and exists (select 1 from public.group_members gm where gm.group_id = c.group_id and gm.user_id = auth.uid()))
  )
  select m.id, m.kind, m.group_id, m.other_user, m.status, m.last_message_at, m.last_message_preview, m.last_sender,
    (select count(*)::int from public.messages msg
       where msg.conversation_id = m.id and msg.sender <> auth.uid() and msg.hidden_at is null
         and not public.is_blocked(auth.uid(), msg.sender)
         and (m.last_read_at is null or msg.created_at > m.last_read_at)) as unread,
    m.muted
  from mine m
  where m.other_user is null or not public.is_blocked(auth.uid(), m.other_user)
  order by coalesce(m.last_message_at, now()) desc;
$$;

grant execute on function public.mark_read(uuid) to authenticated;
grant execute on function public.inbox() to authenticated;
grant execute on function public.start_direct(uuid) to authenticated;
grant execute on function public.answer_request(uuid, boolean) to authenticated;
grant execute on function public.create_group(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.join_group(uuid) to authenticated;
grant execute on function public.invite_to_group(uuid, uuid) to authenticated;
grant execute on function public.set_group_role(uuid, uuid, text) to authenticated;

-- ------------------------------------------------------------------ reports on messages and groups
create or replace function public.reports_auto_hide()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (
    select count(distinct reporter) from public.reports
    where target_type = new.target_type and target_id = new.target_id and status = 'open'
  ) >= 3 then
    perform set_config('snooker.moderating', 'on', true);
    if new.target_type = 'profile' then
      update public.profiles set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    elsif new.target_type = 'routine' then
      update public.shared_routines set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    elsif new.target_type = 'message' then
      update public.messages set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    elsif new.target_type = 'group' then
      update public.groups set hidden_at = now() where id::text = new.target_id and hidden_at is null;
    end if;
  end if;
  return new;
end;
$$;

-- ------------------------------------------------------------------ live updates
do $$
declare t text;
begin
  foreach t in array array['messages', 'conversations', 'conversation_members', 'group_members', 'group_invites', 'groups'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
