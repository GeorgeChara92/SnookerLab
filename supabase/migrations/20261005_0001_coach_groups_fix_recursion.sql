-- Fixes "infinite recursion detected in policy for relation coach_groups" from the previous
-- migration: coach_groups' member-select policy queried coach_group_members, whose owner-all
-- policy queried coach_groups back again, and Postgres re-evaluates each table's RLS on every
-- subquery against it - so the two policies looped forever.
--
-- Fix: two security-definer helper functions do the cross-table checks. Owned by the migration
-- role (which owns both tables), so they run against the tables directly rather than re-entering
-- RLS - the standard way to break this kind of two-table policy cycle.
--
-- Safe to run more than once.

begin;

create or replace function public.is_coach_group_owner(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.coach_groups g where g.id = target_group_id and g.coach_id = auth.uid()
  );
$$;

create or replace function public.is_coach_group_member(target_group_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.coach_group_members m where m.group_id = target_group_id and m.player_id = auth.uid()
  );
$$;

revoke all on function public.is_coach_group_owner(uuid) from public, anon;
revoke all on function public.is_coach_group_member(uuid) from public, anon;
grant execute on function public.is_coach_group_owner(uuid) to authenticated;
grant execute on function public.is_coach_group_member(uuid) to authenticated;

drop policy if exists coach_groups_member_select on public.coach_groups;
create policy coach_groups_member_select on public.coach_groups for select
  using (public.is_coach_group_member(id));

drop policy if exists coach_group_members_coach_all on public.coach_group_members;
create policy coach_group_members_coach_all on public.coach_group_members for all
  using (public.is_coach_group_owner(group_id))
  with check (public.is_coach_group_owner(group_id));

drop policy if exists coach_group_posts_member_select on public.coach_group_posts;
create policy coach_group_posts_member_select on public.coach_group_posts for select
  using (public.is_coach_group_member(group_id));

drop policy if exists coach_group_media_insert on storage.objects;
create policy coach_group_media_insert on storage.objects for insert
  with check (bucket_id = 'coach-group-media' and public.is_coach_group_owner(((storage.foldername(name))[1])::uuid));

drop policy if exists coach_group_media_select on storage.objects;
create policy coach_group_media_select on storage.objects for select
  using (
    bucket_id = 'coach-group-media'
    and (
      public.is_coach_group_owner(((storage.foldername(name))[1])::uuid)
      or public.is_coach_group_member(((storage.foldername(name))[1])::uuid)
    )
  );

drop policy if exists coach_group_media_delete on storage.objects;
create policy coach_group_media_delete on storage.objects for delete
  using (bucket_id = 'coach-group-media' and public.is_coach_group_owner(((storage.foldername(name))[1])::uuid));

commit;
