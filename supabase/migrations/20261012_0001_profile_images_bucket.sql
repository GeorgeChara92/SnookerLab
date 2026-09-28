-- profile-images was documented as a manual setup step (see README.md's "Database Setup") but was
-- never actually finished with the RLS policies a real upload needs - unlike coach-group-media,
-- which has always had its bucket and policies in a migration. authStore.uploadProfilePhoto called
-- this bucket from day one, but nothing in the app actually called that function until
-- AvatarPickerScreen's "Add a photo" was wired up, so the gap went unnoticed: every upload was
-- rejected by storage RLS with no policy to allow it, which surfaced to the player as a generic
-- "check your connection" error instead of the real cause.
--
-- Public, like coach-gallery-photos: a profile photo needs to be visible to anyone viewing that
-- player's profile (CommunityAvatar, headers, coach profiles), with no separate signing step.
--
-- Safe to run more than once.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'profile-images',
  'profile-images',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

-- Path is "<user_id>/avatar-<timestamp>.<ext>" (see authStore.uploadProfilePhoto), so folder name
-- is the same ownership check coach-gallery-photos and coach-group-media already use.
drop policy if exists profile_images_insert on storage.objects;
create policy profile_images_insert on storage.objects for insert
  with check (
    bucket_id = 'profile-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists profile_images_select on storage.objects;
create policy profile_images_select on storage.objects for select
  using (bucket_id = 'profile-images');

-- uploadProfilePhoto passes upsert: true, which needs an update policy for the case where it
-- overwrites an existing object rather than inserting a new one.
drop policy if exists profile_images_update on storage.objects;
create policy profile_images_update on storage.objects for update
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists profile_images_delete on storage.objects;
create policy profile_images_delete on storage.objects for delete
  using (bucket_id = 'profile-images' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
