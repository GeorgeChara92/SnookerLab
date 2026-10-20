-- pg_cron logs every run of every job in cron.job_run_details and never clears it. poll-pro-tour
-- runs every 30 seconds, so that's ~2,900 rows a day on a small (free-tier) database for nothing:
-- only the last day or two is ever worth reading. Clears anything older than two days, now and
-- then every night at 03:15 UTC.

delete from cron.job_run_details where end_time < now() - interval '2 days';

select cron.schedule(
  'purge-cron-history',
  '15 3 * * *',
  $$delete from cron.job_run_details where end_time < now() - interval '2 days'$$
);
