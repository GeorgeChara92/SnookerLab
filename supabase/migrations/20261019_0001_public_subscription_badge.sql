-- 2026-10-19  A subscriber's tier becomes visible to other players, for a status badge on their
-- avatar (Community, chat, leaderboards) - something to actually show for paying, not just raised
-- quotas nobody else can see. The real source of truth stays auth.users.app_metadata
-- (20260920_0001_subscription_tier_app_metadata.sql); this is a synced, public-readable copy,
-- written only by the same service-role calls that already set it there (sync-subscription,
-- revenuecat-webhook), and frozen against every other write the same way is_coach is.
--
-- Safe to run more than once.

begin;

alter table public.profiles add column if not exists subscription_tier text not null default 'free';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_subscription_tier_check') then
    alter table public.profiles
      add constraint profiles_subscription_tier_check check (subscription_tier in ('free', 'half_century', 'century'));
  end if;
end $$;

create or replace function public.trg_freeze_subscription_tier()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if auth.role() = 'authenticated' then
      new.subscription_tier := 'free';
    end if;
    return new;
  end if;
  if auth.role() = 'authenticated' then
    new.subscription_tier := old.subscription_tier;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_freeze_subscription_tier on public.profiles;
create trigger trg_profiles_freeze_subscription_tier
before insert or update on public.profiles
for each row execute function public.trg_freeze_subscription_tier();

commit;
