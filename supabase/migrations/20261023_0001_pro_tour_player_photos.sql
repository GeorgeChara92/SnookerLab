-- Player photos from Wikimedia Commons (via each player's Wikipedia page), fetched once per player
-- by poll-pro-tour's photo job and cached here - so the app shows a current, freely licensed photo
-- with the credit its licence requires, instead of snooker.org's older images (when it has one).
-- url is null when the player's page has no usable photo; checked_at stops it being re-asked daily.
--
-- Safe to run more than once.

begin;

create table if not exists public.pro_tour_player_photos (
  player_id bigint primary key,
  url text,
  credit text,
  license text,
  source_url text,
  checked_at timestamptz not null default now()
);

alter table public.pro_tour_player_photos enable row level security;

drop policy if exists "pro tour player photos are publicly readable" on public.pro_tour_player_photos;
create policy "pro tour player photos are publicly readable" on public.pro_tour_player_photos for select using (true);

commit;
