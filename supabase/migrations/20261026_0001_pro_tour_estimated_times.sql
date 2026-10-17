-- Estimated match times, corrected to true UTC.
--
-- snooker.org's ScheduledDate is UTC for a session's fixed start, but an ESTIMATED start (a
-- follow-on match) is the venue's own clock time with a "Z" on the end - a 2pm follow-on in
-- Belfast arrived as 14:00Z and showed as 3pm in the UK. poll-pro-tour now converts these as it
-- writes them; this fixes the rows already stored.
--
-- Recomputed from raw->>'ScheduledDate' (snooker.org's original value), so running it again
-- changes nothing. The zone list matches venueZone() in poll-pro-tour.

update public.pro_tour_matches m
set scheduled_at = ((m.raw->>'ScheduledDate')::timestamp at time zone z.tz)
from (
  select
    e.id,
    case
      when e.raw->>'City' = 'Perth' then 'Australia/Perth'
      when e.raw->>'City' = 'Adelaide' then 'Australia/Adelaide'
      when e.raw->>'City' = 'Brisbane' then 'Australia/Brisbane'
      when e.raw->>'City' = 'Darwin' then 'Australia/Darwin'
      when e.raw->>'City' = 'Kuala Lumpur' then 'Asia/Kuala_Lumpur'
      when e.raw->>'Country' in ('England', 'Scotland', 'Wales', 'Northern Ireland', 'United Kingdom') then 'Europe/London'
      when e.raw->>'Country' = 'Ireland' then 'Europe/Dublin'
      when e.raw->>'Country' = 'China' then 'Asia/Shanghai'
      when e.raw->>'Country' = 'Hong Kong' then 'Asia/Hong_Kong'
      when e.raw->>'Country' = 'Macau' then 'Asia/Macau'
      when e.raw->>'Country' = 'Thailand' then 'Asia/Bangkok'
      when e.raw->>'Country' = 'Malaysia' then 'Asia/Kuala_Lumpur'
      when e.raw->>'Country' = 'Singapore' then 'Asia/Singapore'
      when e.raw->>'Country' = 'India' then 'Asia/Kolkata'
      when e.raw->>'Country' = 'Saudi Arabia' then 'Asia/Riyadh'
      when e.raw->>'Country' = 'Qatar' then 'Asia/Qatar'
      when e.raw->>'Country' = 'United Arab Emirates' then 'Asia/Dubai'
      when e.raw->>'Country' = 'Bahrain' then 'Asia/Bahrain'
      when e.raw->>'Country' = 'Turkey' then 'Europe/Istanbul'
      when e.raw->>'Country' = 'Cyprus' then 'Asia/Nicosia'
      when e.raw->>'Country' = 'Belgium' then 'Europe/Brussels'
      when e.raw->>'Country' = 'Netherlands' then 'Europe/Amsterdam'
      when e.raw->>'Country' = 'Germany' then 'Europe/Berlin'
      when e.raw->>'Country' = 'Austria' then 'Europe/Vienna'
      when e.raw->>'Country' = 'Switzerland' then 'Europe/Zurich'
      when e.raw->>'Country' = 'France' then 'Europe/Paris'
      when e.raw->>'Country' = 'Poland' then 'Europe/Warsaw'
      when e.raw->>'Country' = 'Latvia' then 'Europe/Riga'
      when e.raw->>'Country' = 'Bulgaria' then 'Europe/Sofia'
      when e.raw->>'Country' = 'Malta' then 'Europe/Malta'
      when e.raw->>'Country' = 'Gibraltar' then 'Europe/Gibraltar'
      when e.raw->>'Country' = 'Canada' then 'America/Toronto'
      when e.raw->>'Country' = 'Australia' then 'Australia/Sydney'
    end as tz
  from public.pro_tour_events e
) z
where m.event_id = z.id
  and z.tz is not null
  and m.raw->>'Estimated' = 'true'
  and m.raw->>'ScheduledDate' is not null
  and m.raw->>'ScheduledDate' not like '%T00:00:00%';
