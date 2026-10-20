-- =====================================================================================================
-- Demo data for App Store / website screenshots, on g_charalambous@icloud.com.
--
-- Run in the Supabase SQL editor. It ADDS to the account - nothing already there is changed or
-- removed - and fills every screen a screenshot would show:
--
--   Player view   practice sessions and routine scores trending up (8 weeks), matches with frame-by-
--                 frame scoring and breaks (two centuries), a finished and a running tournament,
--                 friends, a league group with its chat and feed, direct messages, leaderboard rivals,
--                 followed pros, and a coach (Alex Marsh) with session recaps, homework and a next session.
--   Coach view    a booking diary (past, today, this week), requests waiting, a reschedule, clients with
--                 recaps, notes, homework and reviews, and a squad group.
--
-- Your own account shows as "You" (@you) everywhere - profile, header, leaderboards, chats - so no
-- real name is in a screenshot, and it gets a complimentary Century plan (app_metadata.comp_tier,
-- which sync-subscription and revenuecat-webhook honour), so it stays Century through every re-check.
--
-- Uses the existing demo accounts as the people around you: Alex Morgan (snookered_demo), Emma Clarke,
-- Ryan Foster, Priya Anand (coach_demo_client1-3) and Alex Marsh (alexmarsh, a coach).
--
-- Safe to run more than once: every row has a fixed id starting dec0de00, so a second run adds nothing.
-- Dates are relative to the day it runs. demo_screenshots_restore.sql undoes all of it.
-- =====================================================================================================

begin;

-- A fixed id per demo row: recognisable (dec0de00...) so the clean-up can find exactly these.
create or replace function pg_temp.demo_id(label text) returns uuid language sql immutable
as $$ select ('dec0de00' || substr(md5('snookered-demo:' || label), 9))::uuid $$;

-- A UK wall-clock time `days` from today (negative is the past).
create or replace function pg_temp.at(days int, hhmm text) returns timestamptz language sql stable
as $$ select ((current_date + days)::text || ' ' || hhmm)::timestamp at time zone 'Europe/London' $$;

-- Repeatable "randomness": 0 to 1 from a label, so every run produces the same numbers.
create or replace function pg_temp.noise(label text) returns numeric language sql immutable
as $$ select (abs(hashtext('snookered-demo:' || label)) % 1000) / 1000.0 $$;

-- A routine score as the app stores it, improving with progress p (0 = eight weeks ago, 1 = now).
create or replace function pg_temp.routine_score(routine text, p numeric, label text) returns text language plpgsql immutable
as $$
declare
  lo numeric; hi numeric; cap numeric; spread numeric; v numeric; kind text := 'number';
begin
  case routine
    when 'routine-line-up'              then lo := 22; hi := 66; cap := 147; spread := 18;
    when 'routine-t-routine'            then lo := 18; hi := 54; cap := 147; spread := 14;
    when 'routine-3-reds-colours'       then lo := 16; hi := 44; cap := 51;  spread := 10;
    when 'routine-pink-ball-routine'    then lo := 20; hi := 57; cap := 120; spread := 14;
    when 'routine-stun-run-through'     then lo := 9;  hi := 16; cap := 20;  spread := 3;
    when 'routine-screw-back'           then lo := 6;  hi := 12; cap := 15;  spread := 3;
    when 'routine-top-spin-control'     then lo := 7;  hi := 13; cap := 16;  spread := 3;
    when 'routine-side-spin-control'    then lo := 40; hi := 72; cap := 100; spread := 12; kind := 'percent';
    when 'routine-long-potting-classic' then lo := 9;  hi := 15; cap := 20;  spread := 3;  kind := 'fraction';
    when 'routine-black-off-spot'       then lo := 11; hi := 20; cap := 25;  spread := 4;
    when 'routine-baulk-safety'         then lo := 8;  hi := 14; cap := 18;  spread := 3;
    when 'routine-escape-science'       then lo := 9;  hi := 15; cap := 20;  spread := 3;
    when 'routine-around-colours'       then lo := 5;  hi := 9;  cap := 10;  spread := 2;
    else lo := 5; hi := 10; cap := 20; spread := 2;
  end case;
  v := round(lo + (hi - lo) * p + (pg_temp.noise(label) - 0.5) * spread);
  v := greatest(0, least(cap, v));
  if kind = 'percent' then return v::int || '%'; end if;
  if kind = 'fraction' then return v::int || '/20'; end if;
  return v::int::text;
end $$;

do $$
declare
  me uuid; alex uuid; emma uuid; ryan uuid; priya uuid; coach uuid;
  i int; d int; p numeric; r text; t int; n int;
  log_id uuid; match_id uuid; conv uuid; booking uuid;
  templates text[][] := array[
    array['break', 'Break building night', 'routine-line-up', 'routine-t-routine', 'routine-3-reds-colours', 'routine-pink-ball-routine'],
    array['control', 'Cue ball control circuit', 'routine-stun-run-through', 'routine-screw-back', 'routine-top-spin-control', 'routine-side-spin-control'],
    array['sharpener', 'Match sharpener', 'routine-long-potting-classic', 'routine-black-off-spot', 'routine-baulk-safety', 'routine-escape-science']
  ];
  m record; f record; fx record;
  winners text; frame_no int; us int; them int; hb int; hbo int;
begin
  -- ------------------------------------------------------------------ who's who
  select id into me from auth.users where lower(email) = 'g_charalambous@icloud.com';
  select id into alex from public.profiles where handle = 'snookered_demo';
  select id into emma from public.profiles where handle = 'coach_demo_client1';
  select id into ryan from public.profiles where handle = 'coach_demo_client2';
  select id into priya from public.profiles where handle = 'coach_demo_client3';
  select id into coach from public.profiles where handle = 'alexmarsh';
  if me is null then raise exception 'No account for g_charalambous@icloud.com'; end if;
  if alex is null or emma is null or ryan is null or priya is null or coach is null then
    raise exception 'A demo account is missing (snookered_demo, coach_demo_client1-3, alexmarsh)';
  end if;

  -- ------------------------------------------------------------------ you: "You", on Century
  update auth.users
  set raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('username', 'You', 'full_name', 'You'),
      raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('comp_tier', 'century', 'subscription_tier', 'century')
  where id = me;
  update public.profiles
  set display_name = 'You', handle = 'you', username = 'You', subscription_tier = 'century'
  where id = me;

  -- Matches linked to a friend keep their "confirmed" status (otherwise forced to pending), and the
  -- free-plan match cap is lifted for this transaction only - it comes back on before commit.
  perform set_config('snooker.linking', 'on', true);
  alter table public.matches disable trigger trg_matches_subscription_limit;

  -- ------------------------------------------------------------------ friends
  insert into public.friendships (id, requester, addressee, status, created_at, responded_at)
  select pg_temp.demo_id('friend:' || k), me, who, 'accepted', now() - interval '70 days', now() - interval '69 days'
  from (values ('alex', alex), ('emma', emma), ('ryan', ryan)) v(k, who)
  where not exists (
    select 1 from public.friendships x
    where (x.requester = me and x.addressee = who) or (x.requester = who and x.addressee = me)
  );
  -- A friend request waiting for you.
  insert into public.friendships (id, requester, addressee, status, created_at)
  select pg_temp.demo_id('friend:priya'), priya, me, 'pending', now() - interval '5 hours'
  where not exists (
    select 1 from public.friendships x
    where (x.requester = me and x.addressee = priya) or (x.requester = priya and x.addressee = me)
  );

  -- ------------------------------------------------------------------ practice: sessions
  for t in 1..3 loop
    insert into public.session_templates (id, user_id, name, notes, routine_ids, created_at, updated_at)
    values (
      pg_temp.demo_id('template:' || templates[t][1]), me, templates[t][2],
      case t when 1 then 'Long potting into the pack, then build.' when 2 then 'Every shot a positional target.' else 'Pressure shots before league night.' end,
      array[templates[t][3], templates[t][4], templates[t][5], templates[t][6]],
      now() - interval '60 days', now() - interval '60 days'
    )
    on conflict (id) do nothing;
  end loop;

  -- 24 sessions over eight weeks, rotating the three plans, scores improving.
  for i in 0..23 loop
    d := 58 - round(i * 2.45)::int;
    t := (i % 3) + 1;
    p := i / 23.0;
    log_id := pg_temp.demo_id('log:' || i);
    insert into public.session_logs (id, user_id, template_id, template_name, date, recorded_at, created_at, updated_at)
    values (log_id, me, pg_temp.demo_id('template:' || templates[t][1]), templates[t][2], current_date - d,
            pg_temp.at(-d, '19:40'), pg_temp.at(-d, '19:40'), pg_temp.at(-d, '19:40'))
    on conflict (id) do nothing;
    for n in 3..6 loop
      r := templates[t][n];
      insert into public.session_log_results (id, log_id, routine_id, score, notes, created_at)
      values (pg_temp.demo_id('log:' || i || ':' || r), log_id, r, pg_temp.routine_score(r, p, 'log' || i || r),
              case when i = 22 and r = 'routine-line-up' then 'Best run yet - cleared to the pink.' end, pg_temp.at(-d, '19:40'))
      on conflict (id) do nothing;
    end loop;
  end loop;

  -- Single routine scores between sessions.
  for i in 0..13 loop
    d := 30 - i * 2;
    r := (array['routine-line-up', 'routine-long-potting-classic', 'routine-around-colours'])[(i % 3) + 1];
    insert into public.routine_score_entries (id, user_id, routine_id, routine_name, score, notes, recorded_at, created_at)
    values (
      pg_temp.demo_id('entry:' || i), me, r,
      case r when 'routine-line-up' then 'The Snooker Line Up' when 'routine-long-potting-classic' then 'Potting Long Reds' else 'Mastering The Colours' end,
      pg_temp.routine_score(r, 0.55 + i * 0.033, 'entry' || i), null, pg_temp.at(-d, '12:15'), pg_temp.at(-d, '12:15')
    )
    on conflict (id) do nothing;
  end loop;

  -- ------------------------------------------------------------------ matches
  -- key, days ago, opponent, linked friend, type, best of, frames for, frames against, venue, scored live
  for m in
    select * from (values
      ('m01', 66, 'Tom Bradley',  null::uuid, 'league',     7, 4, 2, 'Q Club, Leeds',          false),
      ('m02', 61, 'Alex Morgan',  alex,       'casual',     5, 2, 3, 'The Cue Bar, Leeds',     false),
      ('m03', 55, 'Sean Murphy',  null,       'league',     7, 4, 1, 'Q Club, Leeds',          true),
      ('m04', 49, 'Darren Price', null,       'tournament', 5, 3, 2, 'Northern Snooker Centre', false),
      ('m05', 44, 'Mick Hayes',   null,       'league',     7, 3, 4, 'Riley''s, Bradford',      false),
      ('m06', 39, 'Ryan Foster',  ryan,       'casual',     5, 3, 1, 'The Cue Bar, Leeds',     true),
      ('m07', 33, 'Jordan Lee',   null,       'league',     7, 4, 3, 'Q Club, Leeds',          false),
      ('m08', 28, 'Tom Bradley',  null,       'tournament', 7, 4, 2, 'Northern Snooker Centre', true),
      ('m09', 23, 'Alex Morgan',  alex,       'league',     7, 4, 3, 'Q Club, Leeds',          true),
      ('m10', 18, 'Sean Murphy',  null,       'casual',     5, 1, 3, 'The Cue Bar, Leeds',     false),
      ('m11', 14, 'Darren Price', null,       'league',     7, 4, 0, 'Riley''s, Bradford',      true),
      ('m12', 10, 'Mick Hayes',   null,       'tournament', 9, 5, 3, 'Northern Snooker Centre', false),
      ('m13',  7, 'Ryan Foster',  ryan,       'league',     7, 4, 2, 'Q Club, Leeds',          true),
      ('m14',  4, 'Jordan Lee',   null,       'casual',     5, 3, 2, 'The Cue Bar, Leeds',     false),
      ('m15',  2, 'Tom Bradley',  null,       'league',     7, 4, 1, 'Q Club, Leeds',          true)
    ) v(k, days, opponent, friend, kind, best_of, fu, fo, venue, live)
  loop
    match_id := pg_temp.demo_id('match:' || m.k);
    insert into public.matches (id, user_id, opponent_name, opponent_id, opponent_status, date, location, match_type, format,
                                target_frames, frames_played, user_score, opponent_score, result, notes, recording_mode, created_at, updated_at)
    values (match_id, me, m.opponent, m.friend, case when m.friend is not null then 'confirmed' end, current_date - m.days, m.venue,
            m.kind, 'best_of', m.best_of, m.fu + m.fo, m.fu, m.fo, case when m.fu > m.fo then 'win' else 'loss' end,
            case m.k when 'm11' then 'Whitewash - safety was the difference.' when 'm09' then 'Decider on the colours.' end,
            case when m.live then 'live' else 'manual' end, pg_temp.at(-m.days, '21:30'), pg_temp.at(-m.days, '21:30'))
    on conflict (id) do nothing;

    -- Frame by frame, with breaks, for the matches scored live in the app.
    if m.live then
      -- Who won each frame: the loser's frames shuffled among the winner's, the winner taking the last.
      select coalesce(string_agg(c, '' order by pg_temp.noise(m.k || 'w' || g)), '') into winners
      from (
        select 'u' as c, g from generate_series(1, m.fu - (m.fu > m.fo)::int) g
        union all
        select 'o', 100 + g from generate_series(1, m.fo - (m.fo > m.fu)::int) g
      ) s;
      winners := winners || case when m.fu > m.fo then 'u' else 'o' end;

      for frame_no in 1..length(winners) loop
        hb := 18 + round(pg_temp.noise(m.k || 'hb' || frame_no) * 52)::int;
        hbo := 9 + round(pg_temp.noise(m.k || 'hbo' || frame_no) * 38)::int;
        -- The two centuries, and a couple of big breaks.
        if m.k = 'm08' and frame_no = 2 then hb := 104; end if;
        if m.k = 'm13' and frame_no = 4 then hb := 117; end if;
        if m.k = 'm03' and frame_no = 3 then hb := 82; end if;
        if m.k = 'm15' and frame_no = 1 then hb := 91; end if;
        if substr(winners, frame_no, 1) = 'u' then
          us := greatest(hb + 8 + round(pg_temp.noise(m.k || 'us' || frame_no) * 30)::int, 62);
          them := least(hbo + round(pg_temp.noise(m.k || 'th' || frame_no) * 20)::int, us - 9);
        else
          hb := least(hb, 45);
          them := 64 + round(pg_temp.noise(m.k || 'th' || frame_no) * 34)::int;
          hbo := greatest(hbo, 35);
          us := least(hb + round(pg_temp.noise(m.k || 'us' || frame_no) * 22)::int, them - 11);
        end if;
        insert into public.match_frames (id, user_id, match_id, frame_number, user_score, opponent_score, winner,
                                         highest_break_user, highest_break_opponent, breaks, events, abandoned, created_at, updated_at)
        values (
          pg_temp.demo_id('frame:' || m.k || ':' || frame_no), me, match_id, frame_no, us, them,
          case when substr(winners, frame_no, 1) = 'u' then 'user' else 'opponent' end, hb, hbo,
          jsonb_build_array(
            jsonb_build_object('player', 'user', 'points', hb, 'endedBy', 'visit_end',
                               'timestamp', pg_temp.at(-m.days, '19:00') + make_interval(mins => frame_no * 22 - 12)),
            jsonb_build_object('player', 'opponent', 'points', hbo, 'endedBy', 'visit_end',
                               'timestamp', pg_temp.at(-m.days, '19:00') + make_interval(mins => frame_no * 22 - 6))
          ),
          '[]'::jsonb, false,
          pg_temp.at(-m.days, '19:00') + make_interval(mins => frame_no * 22),
          pg_temp.at(-m.days, '19:00') + make_interval(mins => frame_no * 22)
        )
        on conflict (id) do nothing;
      end loop;
    end if;
  end loop;

  -- ------------------------------------------------------------------ tournaments
  insert into public.tournaments (id, user_id, name, tournament_type, entry_mode, pairing_mode, best_of_frames, participants,
                                  status, previous_champion, notes, created_at, updated_at)
  values
    (pg_temp.demo_id('tour:club'), me, 'Leeds Club Championship', 'knockout', 'singles', 'random', 5,
     array['You', 'Jordan Lee', 'Sean Murphy', 'Mick Hayes', 'Alex Morgan', 'Tom Bradley', 'Darren Price', 'Ryan Foster'],
     'completed', 'Darren Price', 'Annual club championship.', pg_temp.at(-36, '10:00'), pg_temp.at(-34, '22:00')),
    (pg_temp.demo_id('tour:friday'), me, 'Friday Night Knockout', 'knockout', 'singles', 'random', 3,
     array['You', 'Tom Bradley', 'Sean Murphy', 'Alex Morgan'],
     'active', null, 'Winner stays on the honours board.', pg_temp.at(-1, '19:00'), pg_temp.at(-1, '21:00'))
  on conflict (id) do nothing;

  for fx in
    select * from (values
      -- tournament, round, index, a, b, best of, frames a, frames b (null = not played yet)
      ('club',   1, 0, 'You',         'Jordan Lee',  5, 3, 1),
      ('club',   1, 1, 'Sean Murphy', 'Mick Hayes',  5, 3, 2),
      ('club',   1, 2, 'Alex Morgan', 'Tom Bradley', 5, 3, 0),
      ('club',   1, 3, 'Darren Price','Ryan Foster', 5, 2, 3),
      ('club',   2, 0, 'You',         'Sean Murphy', 5, 3, 2),
      ('club',   2, 1, 'Alex Morgan', 'Ryan Foster', 5, 3, 1),
      ('club',   3, 0, 'You',         'Alex Morgan', 5, 3, 2),
      ('friday', 1, 0, 'You',         'Tom Bradley', 3, 2, 0),
      ('friday', 1, 1, 'Sean Murphy', 'Alex Morgan', 3, 2, 1),
      ('friday', 2, 0, 'You',         'Sean Murphy', 3, null, null)
    ) v(tour, rnd, idx, a, b, best_of, sa, sb)
  loop
    insert into public.tournament_fixtures (id, tournament_id, round_number, fixture_index, participant_a, participant_b,
                                            best_of_frames, score_a, score_b, winner, status)
    values (pg_temp.demo_id('fixture:' || fx.tour || ':' || fx.rnd || ':' || fx.idx), pg_temp.demo_id('tour:' || fx.tour),
            fx.rnd, fx.idx, fx.a, fx.b, fx.best_of, fx.sa, fx.sb,
            case when fx.sa is null then null when fx.sa > fx.sb then fx.a else fx.b end,
            case when fx.sa is null then 'pending' else 'completed' end)
    on conflict (id) do nothing;
    if fx.sa is not null then
      select coalesce(string_agg(c, '' order by pg_temp.noise(fx.tour || fx.rnd || fx.idx || 'w' || g)), '') into winners
      from (
        select 'a' as c, g from generate_series(1, fx.sa - (fx.sa > fx.sb)::int) g
        union all
        select 'b', 100 + g from generate_series(1, fx.sb - (fx.sb > fx.sa)::int) g
      ) s;
      winners := winners || case when fx.sa > fx.sb then 'a' else 'b' end;
      for frame_no in 1..length(winners) loop
        us := 58 + round(pg_temp.noise(fx.tour || fx.rnd || fx.idx || frame_no) * 40)::int;
        them := 12 + round(pg_temp.noise(fx.tour || fx.rnd || fx.idx || frame_no || 'b') * 40)::int;
        insert into public.tournament_fixture_frames (id, fixture_id, frame_number, score_a, score_b, winner)
        values (pg_temp.demo_id('tframe:' || fx.tour || ':' || fx.rnd || ':' || fx.idx || ':' || frame_no),
                pg_temp.demo_id('fixture:' || fx.tour || ':' || fx.rnd || ':' || fx.idx), frame_no,
                case when substr(winners, frame_no, 1) = 'a' then us else them end,
                case when substr(winners, frame_no, 1) = 'a' then them else us end,
                substr(winners, frame_no, 1))
        on conflict (id) do nothing;
      end loop;
    end if;
  end loop;

  -- ------------------------------------------------------------------ community: rivals on the leaderboards
  insert into public.routine_bests (routine_key, user_id, best, best_raw, kind, scores, updated_at)
  values
    ('routine-line-up', alex, 72, '72', 'number', 31, now() - interval '3 days'),
    ('routine-line-up', ryan, 58, '58', 'number', 22, now() - interval '6 days'),
    ('routine-line-up', emma, 44, '44', 'number', 17, now() - interval '9 days'),
    ('routine-t-routine', alex, 61, '61', 'number', 19, now() - interval '4 days'),
    ('routine-t-routine', ryan, 47, '47', 'number', 14, now() - interval '8 days'),
    ('routine-long-potting-classic', alex, 80, '16/20', 'percent', 26, now() - interval '2 days'),
    ('routine-long-potting-classic', emma, 70, '14/20', 'percent', 12, now() - interval '5 days'),
    ('routine-long-potting-classic', ryan, 65, '13/20', 'percent', 15, now() - interval '7 days'),
    ('routine-black-off-spot', ryan, 21, '21', 'number', 11, now() - interval '3 days'),
    ('routine-black-off-spot', emma, 18, '18', 'number', 9, now() - interval '10 days')
  on conflict (routine_key, user_id) do nothing;

  -- ------------------------------------------------------------------ community: a league group, its chat and feed
  insert into public.groups (id, owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite, created_at)
  values (pg_temp.demo_id('group:league'), me, 'Leeds Thursday League', 'Thursday nights at Q Club - fixtures, results and banter.',
          '🎱', '#1E7A46', 'invite', 'everyone', 'everyone', now() - interval '50 days')
  on conflict (id) do nothing;
  insert into public.group_members (group_id, user_id, role, joined_at)
  values (pg_temp.demo_id('group:league'), me, 'owner', now() - interval '50 days'),
         (pg_temp.demo_id('group:league'), alex, 'admin', now() - interval '49 days'),
         (pg_temp.demo_id('group:league'), ryan, 'member', now() - interval '45 days'),
         (pg_temp.demo_id('group:league'), emma, 'member', now() - interval '30 days')
  on conflict (group_id, user_id) do nothing;
  insert into public.group_routines (group_id, routine_key, name, added_by, created_at)
  values (pg_temp.demo_id('group:league'), 'routine-line-up', 'The Snooker Line Up', me, now() - interval '40 days'),
         (pg_temp.demo_id('group:league'), 'routine-long-potting-classic', 'Potting Long Reds', alex, now() - interval '20 days')
  on conflict do nothing;

  insert into public.conversations (id, kind, group_id, created_at)
  values (pg_temp.demo_id('conv:league'), 'group', pg_temp.demo_id('group:league'), now() - interval '50 days')
  on conflict (id) do nothing;
  insert into public.conversation_members (conversation_id, user_id, status, last_read_at, created_at)
  values (pg_temp.demo_id('conv:league'), me, 'active', now() - interval '3 hours', now() - interval '50 days')
  on conflict (conversation_id, user_id) do nothing;
  insert into public.messages (id, conversation_id, sender, kind, body, created_at)
  select pg_temp.demo_id('msg:league:' || k), pg_temp.demo_id('conv:league'), who, 'text', body, now() - age
  from (values
    (1, alex, 'Fixtures are up for Thursday - @you v Tom on table 3, Ryan v Sean on 5.', interval '2 days 4 hours'),
    (2, ryan, 'Who''s bringing the rest? Mine snapped last week 😂', interval '2 days 3 hours'),
    (3, me,   'I''ll bring mine. Practising long reds all week for this one.', interval '2 days 1 hour'),
    (4, emma, 'Good luck all! Coach has me on the line-up every day now.', interval '1 day 6 hours'),
    (5, alex, 'Great night lads. @you with a 91 in the first frame 👏', interval '1 day 22 hours'),
    (6, ryan, 'Rematch next week, I want that table 3 cloth.', interval '2 hours')
  ) v(k, who, body, age)
  on conflict (id) do nothing;

  insert into public.activity (id, user_id, kind, title, detail, payload, dedupe_key, created_at)
  values
    (pg_temp.demo_id('act:alex:century'), alex, 'century', 'Made a 112 break', 'League night at Q Club', null, 'demo:century', now() - interval '20 hours'),
    (pg_temp.demo_id('act:ryan:match'), ryan, 'match', 'Beat Sean Murphy 4-2', 'Leeds Thursday League', null, 'demo:match', now() - interval '22 hours'),
    (pg_temp.demo_id('act:emma:pb'), emma, 'personal_best', 'New best on The Snooker Line Up: 44', null, null, 'demo:pb', now() - interval '1 day 8 hours'),
    (pg_temp.demo_id('act:alex:hb'), alex, 'high_break', 'Made a 68 break', 'Practice at The Cue Bar', null, 'demo:hb', now() - interval '3 days'),
    (pg_temp.demo_id('act:ryan:level'), ryan, 'level_up', 'Reached level 6', null, null, 'demo:level', now() - interval '4 days')
  on conflict (user_id, dedupe_key) do nothing;

  -- ------------------------------------------------------------------ community: direct messages
  for f in
    select * from (values ('alex', alex), ('ryan', ryan)) v(k, who)
  loop
    insert into public.conversations (id, kind, pair_low, pair_high, created_at)
    values (pg_temp.demo_id('conv:dm:' || f.k), 'direct', least(me, f.who), greatest(me, f.who), now() - interval '40 days')
    on conflict do nothing;
    -- If the two of you already had a conversation, carry on in that one.
    select id into conv from public.conversations
    where kind = 'direct' and pair_low = least(me, f.who) and pair_high = greatest(me, f.who);
    insert into public.conversation_members (conversation_id, user_id, status, last_read_at, created_at)
    values (conv, me, 'active', now() - interval '6 hours', now() - interval '40 days'),
           (conv, f.who, 'active', now(), now() - interval '40 days')
    on conflict (conversation_id, user_id) do nothing;
  end loop;
  select id into conv from public.conversations where kind = 'direct' and pair_low = least(me, alex) and pair_high = greatest(me, alex);
  insert into public.messages (id, conversation_id, sender, kind, body, created_at)
  select pg_temp.demo_id('msg:alex:' || k), conv, who, 'text', body, now() - age
  from (values
    (1, alex, 'Fancy a best of 7 Saturday? Loser buys the table.', interval '1 day 9 hours'),
    (2, me,   'Go on then. 11am at The Cue Bar?', interval '1 day 8 hours'),
    (3, alex, 'Done. I''ll put it in the app so it counts this time 😄', interval '1 day 8 hours'),
    (4, me,   'Ha. Been grinding the line-up - 66 yesterday.', interval '1 day 7 hours'),
    (5, alex, 'Sent you the routine I use for long reds, try it before Saturday.', interval '7 hours')
  ) v(k, who, body, age)
  on conflict (id) do nothing;
  select id into conv from public.conversations where kind = 'direct' and pair_low = least(me, ryan) and pair_high = greatest(me, ryan);
  insert into public.messages (id, conversation_id, sender, kind, body, created_at)
  select pg_temp.demo_id('msg:ryan:' || k), conv, who, 'text', body, now() - age
  from (values
    (1, ryan, 'Thanks for tonight''s session, the stun drill finally clicked.', interval '5 days'),
    (2, me,   'Brilliant. Keep doing it 3 times a week - it''s in your homework.', interval '5 days'),
    (3, ryan, 'Can I book in Thursday instead of Wednesday this week?', interval '40 minutes')
  ) v(k, who, body, age)
  on conflict (id) do nothing;

  -- ------------------------------------------------------------------ pro tour: players you follow
  insert into public.pro_tour_follows (user_id, player_id, created_at)
  select me, pro.id, now() - interval '10 days'
  from public.pro_tour_players pro
  where pro.display_name in ('Judd Trump', 'Ronnie O''Sullivan', 'Mark Selby', 'Kyren Wilson', 'Mark Allen')
  on conflict do nothing;

  -- =================================================================== coach view: you as a coach
  -- Open slots for the next fortnight: weekday evenings and Saturday mornings.
  for d in 0..13 loop
    if extract(isodow from current_date + d) between 1 and 5 then
      insert into public.coach_availability (id, coach_id, starts_at, ends_at, created_at)
      values (pg_temp.demo_id('avail:me:' || d), me, pg_temp.at(d, '17:00'), pg_temp.at(d, '21:00'), now() - interval '7 days')
      on conflict (id) do nothing;
    elsif extract(isodow from current_date + d) = 6 then
      insert into public.coach_availability (id, coach_id, starts_at, ends_at, created_at)
      values (pg_temp.demo_id('avail:me:' || d), me, pg_temp.at(d, '10:00'), pg_temp.at(d, '14:00'), now() - interval '7 days')
      on conflict (id) do nothing;
    end if;
  end loop;

  -- key, client (or guest), days from today, start, status, waiting on, note, reschedule reason
  for m in
    select * from (values
      ('b01', emma,  null,             -52, '18:00', 'accepted', null,    null::text, null::text),
      ('b02', ryan,  null,             -47, '19:00', 'accepted', null,    null, null),
      ('b03', emma,  null,             -45, '18:00', 'accepted', null,    null, null),
      ('b04', priya, null,             -40, '17:00', 'accepted', null,    null, null),
      ('b05', emma,  null,             -38, '18:00', 'accepted', null,    null, null),
      ('b06', ryan,  null,             -33, '19:00', 'accepted', null,    null, null),
      ('b07', null,  'Dan Whitaker',   -27, '10:00', 'accepted', null,    null, null),
      ('b08', emma,  null,             -24, '18:00', 'accepted', null,    null, null),
      ('b09', priya, null,             -19, '17:00', 'accepted', null,    null, null),
      ('b10', ryan,  null,             -12, '19:00', 'accepted', null,    null, null),
      ('b11', emma,  null,             -10, '18:00', 'accepted', null,    null, null),
      ('b12', priya, null,              -5, '17:00', 'accepted', null,    null, null),
      ('b13', null,  'Dan Whitaker',    -6, '10:00', 'accepted', null,    null, null),
      ('b14', ryan,  null,              -5, '19:30', 'accepted', null,    null, null),
      ('b15', emma,  null,              -3, '18:00', 'accepted', null,    null, null),
      ('b16', priya, null,               0, '17:00', 'accepted', null,    null, null),
      ('b17', emma,  null,               0, '19:00', 'accepted', null,    null, null),
      ('b18', ryan,  null,               1, '18:00', 'accepted', null,    null, null),
      ('b19', null,  'Liam O''Neill',    2, '19:00', 'accepted', null,    null, null),
      ('b20', emma,  null,               4, '18:00', 'accepted', null,    null, null),
      ('b21', ryan,  null,               3, '19:00', 'pending',  'coach', 'Can we work on safety play this week?', null),
      ('b22', priya, null,               6, '17:00', 'pending',  'coach', 'First session on long potting please.', null),
      ('b23', emma,  null,               8, '18:00', 'pending',  'player', null, 'Club''s closed for a match night - could we move to Thursday?')
    ) v(k, client, guest, days, hhmm, status, waiting, note, reason)
  loop
    insert into public.coach_bookings (id, coach_id, player_id, guest_name, starts_at, ends_at, status, note,
                                       awaiting_response_from, reschedule_reason, created_at, updated_at)
    values (pg_temp.demo_id('booking:' || m.k), me, m.client, m.guest, pg_temp.at(m.days, m.hhmm),
            pg_temp.at(m.days, m.hhmm) + interval '1 hour', m.status, m.note, m.waiting, m.reason,
            pg_temp.at(least(m.days, 0) - 4, '12:00'), pg_temp.at(least(m.days, 0) - 4, '12:00'))
    on conflict (id) do nothing;
  end loop;

  -- What each past session covered: the shared recap, the routines and scores, your private notes.
  for m in
    select * from (values
      ('b01', emma,  'First session. Solid stance; the bridge hand moves on contact. Worked on staying down.', array['Stance', 'Bridge'], 'routine-straight-cueing-line', 'Straight Potting Reds', 14, 'Bridge lifts on longer shots - watch the index finger.'),
      ('b03', emma,  'Bridge is steadier. Started on cue ball control - stun and screw on the blue.', array['Bridge', 'Positional play'], 'routine-stun-run-through', 'Stun Run Through', 11, 'Better. Tends to rush the pause.'),
      ('b05', emma,  'Long potting: lining up from behind the cue ball. Big improvement on the long reds.', array['Long potting', 'Sighting'], 'routine-long-potting-classic', 'Potting Long Reds', 12, 'Eyes on the object ball last - working.'),
      ('b08', emma,  'Break building around the pink. First 30+ breaks in the session.', array['Break building', 'Positional play'], 'routine-line-up', 'The Snooker Line Up', 34, 'Ready to start the T line up next.'),
      ('b11', emma,  'Shot selection when the reds are split. Fewer risky long ones.', array['Shot selection', 'Safety'], 'routine-baulk-safety', 'Snooker Safety Shots off Reds', 12, null),
      ('b15', emma,  'Pressure practice for league: one-visit challenges. Line up best of 44.', array['Mental game', 'Break building'], 'routine-line-up', 'The Snooker Line Up', 44, 'Confidence is up. Keep the pre-shot routine.'),
      ('b02', ryan,  'Cue action: the backswing is too long. Shortened it and the stun is cleaner.', array['Cue action'], 'routine-stun-run-through', 'Stun Run Through', 9, 'Grip tightens on power shots.'),
      ('b06', ryan,  'Screw shots: lower and through. 8 out of 15 on the drill.', array['Cue action', 'Positional play'], 'routine-screw-back', 'Screw Back Drill', 8, null),
      ('b10', ryan,  'Safety exchanges. Thinking two shots ahead.', array['Safety', 'Shot selection'], 'routine-escape-science', 'Escape Science Drill', 13, 'Much better at leaving the white on the baulk cushion.'),
      ('b14', ryan,  'The stun drill clicked - 16 out of 20. Moving on to side.', array['Positional play'], 'routine-stun-run-through', 'Stun Run Through', 16, 'Ready for side spin next session.'),
      ('b04', priya, 'Fundamentals: stance, grip and a pre-shot routine, then the colours off their spots.', array['Stance', 'Cue action'], 'routine-around-colours', 'Mastering The Colours', 6, 'Very coachable. Practises at home.'),
      ('b09', priya, 'Potting the black off its spot from different angles.', array['Sighting', 'Long potting'], 'routine-black-off-spot', 'Potting The Black Ball', 15, null),
      ('b12', priya, 'Rest play and top spin - set up, stay still, follow through. Much more confident.', array['Rest play', 'Positional play'], 'routine-top-spin-control', 'Top Spin Control', 9, 'Bring her own rest next time.')
    ) v(k, client, summary, focus, routine, routine_name, score, private_note)
  loop
    booking := pg_temp.demo_id('booking:' || m.k);
    insert into public.coach_session_recaps (booking_id, coach_id, player_id, summary, focus, updated_at)
    values (booking, me, m.client, m.summary, m.focus, now() - interval '1 day')
    on conflict (booking_id) do nothing;
    insert into public.coach_session_routines (id, booking_id, coach_id, routine_id, routine_name, score, notes, created_at)
    values (pg_temp.demo_id('sroutine:' || m.k), booking, me, m.routine, m.routine_name, m.score, null, now() - interval '1 day')
    on conflict (id) do nothing;
    if m.private_note is not null then
      insert into public.coach_session_notes (booking_id, coach_id, notes, updated_at)
      values (booking, me, m.private_note, now() - interval '1 day')
      on conflict (booking_id) do nothing;
    end if;
  end loop;

  -- Homework you've set your clients.
  insert into public.coach_homework (id, coach_id, player_id, booking_id, routine_id, routine_name, target_score, per_week, note, created_at)
  values
    (pg_temp.demo_id('hw:emma:lineup'), me, emma, pg_temp.demo_id('booking:b15'), 'routine-line-up', 'The Snooker Line Up', 50, 4, 'Aim for one 50+ run by next session.', pg_temp.at(-3, '19:10')),
    (pg_temp.demo_id('hw:emma:long'), me, emma, pg_temp.demo_id('booking:b15'), 'routine-long-potting-classic', 'Potting Long Reds', 75, 2, null, pg_temp.at(-3, '19:10')),
    (pg_temp.demo_id('hw:ryan:stun'), me, ryan, pg_temp.demo_id('booking:b14'), 'routine-stun-run-through', 'Stun Run Through', 17, 3, 'Keep the pause at the back.', pg_temp.at(-5, '20:40')),
    (pg_temp.demo_id('hw:ryan:side'), me, ryan, pg_temp.demo_id('booking:b14'), 'routine-side-spin-control', 'Side Spin Control', 60, 2, null, pg_temp.at(-5, '20:40')),
    (pg_temp.demo_id('hw:priya:black'), me, priya, pg_temp.demo_id('booking:b12'), 'routine-black-off-spot', 'Potting The Black Ball', 18, 3, null, pg_temp.at(-5, '18:10'))
  on conflict (id) do nothing;

  -- Reviews your clients left you.
  insert into public.coach_reviews (id, coach_id, player_id, rating, body, created_at, updated_at)
  values
    (pg_temp.demo_id('review:emma'), me, emma, 5, 'Patient, clear and every session has a plan. My break building has come on massively.', now() - interval '9 days', now() - interval '9 days'),
    (pg_temp.demo_id('review:ryan'), me, ryan, 5, 'Fixed my cue action in two sessions. The homework keeps me honest.', now() - interval '4 days', now() - interval '4 days'),
    (pg_temp.demo_id('review:priya'), me, priya, 4, 'Great with beginners - explains the why, not just the what.', now() - interval '6 days', now() - interval '6 days')
  on conflict (id) do nothing;

  -- A squad group for your juniors.
  insert into public.coach_groups (id, coach_id, name, created_at)
  values (pg_temp.demo_id('cgroup:juniors'), me, 'Tuesday Squad', now() - interval '30 days')
  on conflict (id) do nothing;
  insert into public.coach_group_members (group_id, player_id, added_at)
  values (pg_temp.demo_id('cgroup:juniors'), emma, now() - interval '30 days'),
         (pg_temp.demo_id('cgroup:juniors'), ryan, now() - interval '30 days'),
         (pg_temp.demo_id('cgroup:juniors'), priya, now() - interval '20 days')
  on conflict (group_id, player_id) do nothing;

  -- =================================================================== player view: your own coach
  for d in 2..12 loop
    if extract(isodow from current_date + d) in (2, 4, 6) then
      insert into public.coach_availability (id, coach_id, starts_at, ends_at, created_at)
      values (pg_temp.demo_id('avail:coach:' || d), coach, pg_temp.at(d, '10:00'), pg_temp.at(d, '13:00'), now() - interval '7 days')
      on conflict (id) do nothing;
    end if;
  end loop;

  for m in
    select * from (values
      ('c01', -42, 'accepted'), ('c02', -28, 'accepted'), ('c03', -14, 'accepted'), ('c04', -6, 'accepted'), ('c05', 3, 'accepted')
    ) v(k, days, status)
  loop
    insert into public.coach_bookings (id, coach_id, player_id, starts_at, ends_at, status, note, created_at, updated_at)
    values (pg_temp.demo_id('booking:' || m.k), coach, me, pg_temp.at(m.days, '11:00'), pg_temp.at(m.days, '12:00'), m.status,
            case m.k when 'c05' then 'Want to work on the long reds before the club final.' end,
            pg_temp.at(least(m.days, 0) - 5, '09:00'), pg_temp.at(least(m.days, 0) - 5, '09:00'))
    on conflict (id) do nothing;
  end loop;

  for m in
    select * from (values
      ('c01', 'Assessment session. Cue action is straight but the head lifts on long pots. Built a pre-shot routine to fix it.',
       array['Cue action', 'Sighting'], 'routine-long-potting-classic', 'Potting Long Reds', 10),
      ('c02', 'Positional play around the black: thinking about the angle for the next red before playing the colour.',
       array['Positional play', 'Break building'], 'routine-line-up', 'The Snooker Line Up', 38),
      ('c03', 'Safety: playing the percentage shot and leaving the white tight on the cushion. Huge improvement.',
       array['Safety', 'Shot selection'], 'routine-baulk-safety', 'Snooker Safety Shots off Reds', 13),
      ('c04', 'Break building under pressure - 60+ on the line up twice. Ready to push for the first century.',
       array['Break building', 'Mental game'], 'routine-line-up', 'The Snooker Line Up', 64)
    ) v(k, summary, focus, routine, routine_name, score)
  loop
    insert into public.coach_session_recaps (booking_id, coach_id, player_id, summary, focus, updated_at)
    values (pg_temp.demo_id('booking:' || m.k), coach, me, m.summary, m.focus, now() - interval '2 days')
    on conflict (booking_id) do nothing;
    insert into public.coach_session_routines (id, booking_id, coach_id, routine_id, routine_name, score, notes, created_at)
    values (pg_temp.demo_id('sroutine:' || m.k), pg_temp.demo_id('booking:' || m.k), coach, m.routine, m.routine_name, m.score, null, now() - interval '2 days')
    on conflict (id) do nothing;
  end loop;

  insert into public.coach_homework (id, coach_id, player_id, booking_id, routine_id, routine_name, target_score, per_week, note, created_at)
  values
    (pg_temp.demo_id('hw:me:lineup'), coach, me, pg_temp.demo_id('booking:c04'), 'routine-line-up', 'The Snooker Line Up', 70, 4, 'Go for 70. Same pre-shot routine on every ball.', pg_temp.at(-6, '12:10')),
    (pg_temp.demo_id('hw:me:long'), coach, me, pg_temp.demo_id('booking:c04'), 'routine-long-potting-classic', 'Potting Long Reds', 75, 3, 'Head still until the ball drops.', pg_temp.at(-6, '12:10')),
    (pg_temp.demo_id('hw:me:stun'), coach, me, pg_temp.demo_id('booking:c03'), 'routine-stun-run-through', 'Stun Run Through', 17, 2, null, pg_temp.at(-14, '12:10'))
  on conflict (id) do nothing;

  insert into public.coach_reviews (id, coach_id, player_id, rating, body, created_at, updated_at)
  values (pg_temp.demo_id('review:me'), coach, me, 5, 'Every session is planned around my game. Up 20 points on the line up in six weeks.',
          now() - interval '12 days', now() - interval '12 days')
  on conflict (id) do nothing;

  alter table public.matches enable trigger trg_matches_subscription_limit;
  raise notice 'Demo data in place for %', me;
end $$;

commit;

-- =====================================================================================================
-- To undo all of this - demo rows, your name and the complimentary plan - run demo_screenshots_restore.sql.
-- To refresh the dates for a later shoot: run the restore, then this script again.
-- =====================================================================================================
