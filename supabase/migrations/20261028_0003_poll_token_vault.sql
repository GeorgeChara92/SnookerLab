-- The poll-pro-tour cron job had the project's secret key written into its command, and the
-- database's slow-query log prints a slow statement's text - so on 23 Oct 2026 the key appeared in
-- plain text in the Postgres logs. Now:
--
--  - the job sends a token of its own, made here from random bytes and kept in Vault; it never
--    leaves the database, and the job reads it from Vault each run, so a logged command shows only
--    the lookup, never the value;
--  - poll-pro-tour checks it with poll_pro_tour_token_ok(), which only the service role may call.
--
-- After this, rotate the old secret key (Project Settings > API Keys): nothing here uses it any more.

do $$
begin
  if not exists (select 1 from vault.secrets where name = 'poll_pro_tour_token') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'poll_pro_tour_token',
      'Sent by the poll-pro-tour cron job; checked by poll_pro_tour_token_ok()'
    );
  end if;
end $$;

create or replace function public.poll_pro_tour_token_ok(token text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from vault.decrypted_secrets where name = 'poll_pro_tour_token' and decrypted_secret = token
  );
$$;

revoke all on function public.poll_pro_tour_token_ok(text) from public, anon, authenticated;
grant execute on function public.poll_pro_tour_token_ok(text) to service_role;

-- Same job, same schedule: only the header changes, read from Vault when it runs.
select cron.schedule(
  'poll-pro-tour-30s',
  '30 seconds',
  $job$
  select net.http_post(
    url := 'https://hqwmnzrksivkervvnmwa.supabase.co/functions/v1/poll-pro-tour',
    headers := jsonb_build_object(
      'Authorization',
      'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'poll_pro_tour_token')
    ),
    timeout_milliseconds := 5000
  );
  $job$
);
