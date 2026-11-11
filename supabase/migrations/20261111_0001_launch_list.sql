-- The launch list: people who asked on snookeredapp.com to be told the day the app is out.
--
--   launch_signups              one row per email. Nobody can read or write it directly - not the
--                               website, not a signed-in player. Row level security is on with no
--                               policies, and the table's privileges are revoked.
--   join_launch_list(...)       the only way in, callable by the website with the public key. It
--                               checks the email looks like one, stores it lower-cased, and answers
--                               the same whether the email was new or already there, so the form
--                               can't be used to find out who has signed up. A burst of more than
--                               30 sign-ups in a minute is refused, to blunt a bot filling it.
--   admin_launch_signups()      the list, for the admin dashboard. Admins only (is_admin()).
--
-- The email is used only to tell that person about the launch (see the privacy policy). Deleting a
-- row is how someone is taken off the list.
--
-- Safe to run more than once.

begin;

create table if not exists public.launch_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  platform text check (platform in ('iphone', 'android')),
  source text,
  created_at timestamptz not null default now()
);

alter table public.launch_signups enable row level security;
revoke all on table public.launch_signups from anon, authenticated;

create or replace function public.join_launch_list(p_email text, p_platform text default null, p_source text default null)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  cleaned text := lower(btrim(coalesce(p_email, '')));
  device text := case when p_platform in ('iphone', 'android') then p_platform end;
begin
  if length(cleaned) < 6 or length(cleaned) > 254 or cleaned !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]{2,}$' then
    raise exception 'That email address doesn''t look right.' using errcode = '22023';
  end if;

  if (select count(*) from public.launch_signups where created_at > now() - interval '1 minute') >= 30 then
    raise exception 'Too many sign-ups just now. Try again in a minute.' using errcode = '53400';
  end if;

  insert into public.launch_signups (email, platform, source)
  values (cleaned, device, left(nullif(btrim(coalesce(p_source, '')), ''), 60))
  on conflict (email) do update
    set platform = coalesce(excluded.platform, public.launch_signups.platform);

  return 'ok';
end;
$$;

revoke all on function public.join_launch_list(text, text, text) from public;
grant execute on function public.join_launch_list(text, text, text) to anon, authenticated;

create or replace function public.admin_launch_signups()
returns table (email text, platform text, source text, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.email, s.platform, s.source, s.created_at
    from public.launch_signups s
    order by s.created_at desc;
end;
$$;

revoke all on function public.admin_launch_signups() from public, anon;
grant execute on function public.admin_launch_signups() to authenticated;

commit;
