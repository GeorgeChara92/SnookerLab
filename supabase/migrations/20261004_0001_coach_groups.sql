-- Coach client groups: a coach's own group made of their clients, for sharing practice content
-- (a routine video, an image, a PDF) they want everyone in it to see. Deliberately separate from
-- the general community groups feature (public.groups) - this is a broadcast channel from one
-- coach to their own clients, not a social group players run themselves.
--
-- Safe to run more than once.

begin;

create table if not exists public.coach_groups (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  constraint coach_groups_name_length check (char_length(name) between 1 and 60)
);
create index if not exists coach_groups_coach_idx on public.coach_groups (coach_id);
alter table public.coach_groups enable row level security;

drop policy if exists coach_groups_owner_all on public.coach_groups;
create policy coach_groups_owner_all on public.coach_groups for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

create table if not exists public.coach_group_members (
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
alter table public.coach_group_members enable row level security;

drop policy if exists coach_group_members_coach_all on public.coach_group_members;
create policy coach_group_members_coach_all on public.coach_group_members for all
  using (exists (select 1 from public.coach_groups g where g.id = group_id and g.coach_id = auth.uid()))
  with check (exists (select 1 from public.coach_groups g where g.id = group_id and g.coach_id = auth.uid()));

drop policy if exists coach_group_members_self_select on public.coach_group_members;
create policy coach_group_members_self_select on public.coach_group_members for select
  using (player_id = auth.uid());

-- Added now that coach_group_members exists: lets a member (not just the coach) see the group's
-- own row - its name, for instance - not only their membership row.
drop policy if exists coach_groups_member_select on public.coach_groups;
create policy coach_groups_member_select on public.coach_groups for select
  using (exists (
    select 1 from public.coach_group_members m where m.group_id = id and m.player_id = auth.uid()
  ));

create table if not exists public.coach_group_posts (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.coach_groups(id) on delete cascade,
  coach_id uuid not null references auth.users(id) on delete cascade,
  caption text,
  media_path text not null,
  media_type text not null check (media_type in ('image', 'video', 'pdf')),
  created_at timestamptz not null default now(),
  constraint coach_group_posts_caption_length check (caption is null or char_length(caption) <= 500)
);
create index if not exists coach_group_posts_group_idx on public.coach_group_posts (group_id, created_at desc);
alter table public.coach_group_posts enable row level security;

drop policy if exists coach_group_posts_coach_all on public.coach_group_posts;
create policy coach_group_posts_coach_all on public.coach_group_posts for all
  using (auth.uid() = coach_id)
  with check (auth.uid() = coach_id);

drop policy if exists coach_group_posts_member_select on public.coach_group_posts;
create policy coach_group_posts_member_select on public.coach_group_posts for select
  using (exists (
    select 1 from public.coach_group_members m where m.group_id = coach_group_posts.group_id and m.player_id = auth.uid()
  ));

-- A private bucket for the media itself, one folder per group (path: "<group_id>/<file>"), so
-- storage RLS can check group ownership/membership straight from the path.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'coach-group-media',
  'coach-group-media',
  false,
  104857600,
  array['image/jpeg', 'image/png', 'image/heic', 'video/mp4', 'video/quicktime', 'video/x-m4v', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists coach_group_media_insert on storage.objects;
create policy coach_group_media_insert on storage.objects for insert
  with check (
    bucket_id = 'coach-group-media'
    and exists (
      select 1 from public.coach_groups g
      where g.id::text = (storage.foldername(name))[1] and g.coach_id = auth.uid()
    )
  );

drop policy if exists coach_group_media_select on storage.objects;
create policy coach_group_media_select on storage.objects for select
  using (
    bucket_id = 'coach-group-media'
    and (
      exists (
        select 1 from public.coach_groups g
        where g.id::text = (storage.foldername(name))[1] and g.coach_id = auth.uid()
      )
      or exists (
        select 1 from public.coach_group_members m
        where m.group_id::text = (storage.foldername(name))[1] and m.player_id = auth.uid()
      )
    )
  );

drop policy if exists coach_group_media_delete on storage.objects;
create policy coach_group_media_delete on storage.objects for delete
  using (
    bucket_id = 'coach-group-media'
    and exists (
      select 1 from public.coach_groups g
      where g.id::text = (storage.foldername(name))[1] and g.coach_id = auth.uid()
    )
  );

commit;
