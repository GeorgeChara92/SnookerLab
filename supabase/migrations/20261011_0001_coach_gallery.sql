-- A coach's own photo gallery - work with professionals, at events, whatever they want a
-- prospective client to see before booking. Shown on the coach profile a player reaches from Find
-- a Coach, so it is readable by anyone signed in, the same visibility as the rest of a coach's
-- public listing (coach_availability, coach_groups). Capped at 6 photos - a gallery, not a feed.
--
-- Safe to run more than once.

begin;

create table if not exists public.coach_gallery_photos (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  created_at timestamptz not null default now()
);
create index if not exists coach_gallery_photos_coach_idx on public.coach_gallery_photos (coach_id, created_at);
alter table public.coach_gallery_photos enable row level security;

drop policy if exists coach_gallery_photos_select on public.coach_gallery_photos;
create policy coach_gallery_photos_select on public.coach_gallery_photos for select
  using (auth.role() = 'authenticated');

drop policy if exists coach_gallery_photos_coach_all on public.coach_gallery_photos;
create policy coach_gallery_photos_coach_all on public.coach_gallery_photos for all
  using (
    auth.uid() = coach_id
    and exists (select 1 from public.profiles p where p.id = coach_id and p.is_coach)
  )
  with check (
    auth.uid() = coach_id
    and exists (select 1 from public.profiles p where p.id = coach_id and p.is_coach)
  );

create or replace function public.trg_coach_gallery_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from public.coach_gallery_photos where coach_id = new.coach_id) >= 6 then
    raise exception 'A coach gallery can hold at most 6 photos.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_coach_gallery_photos_limit on public.coach_gallery_photos;
create trigger trg_coach_gallery_photos_limit
before insert on public.coach_gallery_photos
for each row execute function public.trg_coach_gallery_limit();

-- A public bucket, one folder per coach (path "<coach_id>/<file>") - a player browsing coaches
-- needs to see these without signing anything, unlike the private coach-group-media bucket.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-gallery-photos',
  'coach-gallery-photos',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/heic', 'image/webp']
)
on conflict (id) do nothing;

drop policy if exists coach_gallery_media_insert on storage.objects;
create policy coach_gallery_media_insert on storage.objects for insert
  with check (
    bucket_id = 'coach-gallery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists coach_gallery_media_select on storage.objects;
create policy coach_gallery_media_select on storage.objects for select
  using (bucket_id = 'coach-gallery-photos');

drop policy if exists coach_gallery_media_delete on storage.objects;
create policy coach_gallery_media_delete on storage.objects for delete
  using (
    bucket_id = 'coach-gallery-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

commit;
