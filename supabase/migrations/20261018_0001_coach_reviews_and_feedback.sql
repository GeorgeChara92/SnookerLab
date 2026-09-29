-- 2026-10-18  Coach reviews (a player who actually had a session can rate and review that coach,
-- shown on the coach's profile) and general app feedback (anyone can send a note about the app
-- itself, read by an admin - not tied to a coach).
--
-- Safe to run more than once.

begin;

-- ------------------------------------------------------------------ coach reviews
-- One review per (coach, player) pair - editable afterwards rather than piling up one per session,
-- since it is a review of the coach, not a per-session log (coach_session_notes already covers
-- what was worked on in a given session, privately, from the coach's side).
create table if not exists public.coach_reviews (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references auth.users(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null,
  body text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_reviews_rating_range check (rating between 1 and 5),
  constraint coach_reviews_body_length check (body is null or char_length(body) <= 600),
  constraint coach_reviews_not_self check (coach_id <> player_id)
);
create unique index if not exists coach_reviews_one_per_player on public.coach_reviews (coach_id, player_id);
create index if not exists coach_reviews_coach_idx on public.coach_reviews (coach_id, created_at desc);

create or replace function public.trg_coach_reviews_touch()
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

drop trigger if exists trg_coach_reviews_touch on public.coach_reviews;
create trigger trg_coach_reviews_touch
before update on public.coach_reviews
for each row execute function public.trg_coach_reviews_touch();

alter table public.coach_reviews enable row level security;

-- Anyone signed in can read reviews - they are shown on a public-within-the-app coach profile.
drop policy if exists coach_reviews_select on public.coach_reviews;
create policy coach_reviews_select on public.coach_reviews for select
  using (auth.role() = 'authenticated');

-- Only a player who has actually had a completed (accepted, already finished) session with this
-- coach can review them - not just anyone who looked at the profile.
drop policy if exists coach_reviews_insert on public.coach_reviews;
create policy coach_reviews_insert on public.coach_reviews for insert
  with check (
    auth.uid() = player_id
    and exists (
      select 1 from public.coach_bookings b
      where b.coach_id = coach_reviews.coach_id
        and b.player_id = coach_reviews.player_id
        and b.status = 'accepted'
        and b.ends_at < now()
    )
  );

drop policy if exists coach_reviews_update on public.coach_reviews;
create policy coach_reviews_update on public.coach_reviews for update
  using (auth.uid() = player_id);

drop policy if exists coach_reviews_delete on public.coach_reviews;
create policy coach_reviews_delete on public.coach_reviews for delete
  using (auth.uid() = player_id);

-- ------------------------------------------------------------------ general app feedback
create table if not exists public.app_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  message text not null,
  created_at timestamptz not null default now(),
  constraint app_feedback_message_length check (char_length(message) between 1 and 2000)
);
create index if not exists app_feedback_created_idx on public.app_feedback (created_at desc);

alter table public.app_feedback enable row level security;

-- Any signed-in player can send feedback, only as themselves; only an admin can read it back.
drop policy if exists app_feedback_insert on public.app_feedback;
create policy app_feedback_insert on public.app_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists app_feedback_select on public.app_feedback;
create policy app_feedback_select on public.app_feedback for select
  using (public.is_admin());

commit;
