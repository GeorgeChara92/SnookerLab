-- Sending an image, video or PDF in a chat - direct or group, same as coach group posts, but from
-- either side of a conversation rather than only a coach broadcasting to a group. Reuses the
-- existing 'media' pattern from coach group posts (a new message kind, payload holds the path and
-- type) and the same can_read_conversation()/can_post_conversation() functions chat already uses,
-- so a media message follows exactly the same visibility and posting rules as a text one.
--
-- Safe to run more than once.

begin;

-- Finds the existing check constraint on kind by what it actually checks rather than guessing the
-- name Postgres auto-generated for it, so this doesn't silently no-op if that guess were wrong.
do $$
declare rec record;
begin
  for rec in
    select conname from pg_constraint
    where conrelid = 'public.messages'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%kind%'
  loop
    execute format('alter table public.messages drop constraint %I', rec.conname);
  end loop;
end $$;

alter table public.messages add constraint messages_kind_check check (kind in ('text', 'routine', 'match', 'media'));

-- A private bucket, one folder per conversation (path "<conversation_id>/<file>"), so storage RLS
-- can check conversation access straight from the path the same way coach-group-media does.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp', 'video/mp4', 'video/quicktime', 'video/x-m4v', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists chat_media_insert on storage.objects;
create policy chat_media_insert on storage.objects for insert
  with check (
    bucket_id = 'chat-media'
    and public.can_post_conversation((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy if exists chat_media_select on storage.objects;
create policy chat_media_select on storage.objects for select
  using (
    bucket_id = 'chat-media'
    and public.can_read_conversation((storage.foldername(name))[1]::uuid, auth.uid())
  );

commit;
