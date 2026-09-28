"""
Writes supabase/seed/demo_account.sql: a season of realistic data for one demo account, for
screenshots of the app. Run the SQL in the Supabase SQL editor after setting the handles at
the top. It clears the demo account's own data first, so it can be run again.

    python supabase/seed/make_demo_seed.py

Dates are relative to the day the SQL runs (current_date - n), so the data always looks fresh.
Achievements, XP, leaderboards and the feed's own posts are worked out by the app from this
data the first time the demo account signs in.
"""
import json
import random
from pathlib import Path

random.seed(147)

DEMO = "georgechara_test"
FRIENDS = ["georgechara", "__no_second_friend__"]
# Shown while screenshots are taken. Put back afterwards with restore_names.sql, which already
# restores the demo account's handle to DEMO above regardless of what this is set to.
DEMO_NAME = "You"
DEMO_HANDLE = "alexmarsh"
FRIEND_NAME = "Danny Hale"
FRIEND_HANDLE = "dannyhale"

OPPONENTS = ["Dave Wilson", "Mark Ellis", "Ryan Cole", "Jamie Barker", "Chris Hale", "Tom Price"]


def q(text):
    return "'" + str(text).replace("'", "''") + "'"


def break_list(total, player, big=None):
    """Split a frame's points into a few breaks, most of them modest."""
    breaks = []
    left = total
    if big and big <= left:
        breaks.append(big)
        left -= big
    while left > 12:
        piece = min(left, random.choice([12, 16, 21, 24, 28, 33, 38, 45]))
        breaks.append(piece)
        left -= piece
    return [
        {"player": player, "points": points, "endedBy": "visit_end", "timestamp": ""}
        for points in breaks
    ]


def frame(user_wins, big_user=None, big_opp=None):
    win_score = random.randint(62, 96)
    lose_score = random.randint(8, 52)
    user_score, opp_score = (win_score, lose_score) if user_wins else (lose_score, win_score)
    if big_user and big_user > user_score:
        user_score = big_user + random.randint(0, 12)
    user_breaks = break_list(user_score, "user", big_user)
    opp_breaks = break_list(opp_score, "opponent", big_opp)
    return {
        "user_score": user_score,
        "opponent_score": opp_score,
        "winner": "user" if user_wins else "opponent",
        "highest_break_user": max([b["points"] for b in user_breaks] or [0]),
        "highest_break_opponent": max([b["points"] for b in opp_breaks] or [0]),
        "breaks": user_breaks + opp_breaks,
    }


# (days ago, opponent, best of, frames the player won, frames lost, live?, big break in the match)
MATCHES = [
    (68, "Dave Wilson", 5, 3, 1, True, None),
    (64, "Mark Ellis", 7, 2, 4, True, None),
    (61, "Ryan Cole", 5, 3, 2, True, 41),
    (57, "Jamie Barker", 3, 2, 0, False, None),
    (53, "Dave Wilson", 5, 1, 3, True, None),
    (50, "Chris Hale", 5, 3, 0, True, 48),
    (46, "Mark Ellis", 7, 4, 2, True, 57),
    (43, "Tom Price", 5, 3, 1, True, None),
    (39, "Ryan Cole", 5, 2, 3, True, None),
    (36, "Dave Wilson", 7, 4, 3, True, 62),
    (32, "Jamie Barker", 5, 3, 1, False, None),
    (29, "Mark Ellis", 5, 3, 2, True, 68),
    (25, "Chris Hale", 7, 4, 1, True, None),
    (22, "Dave Wilson", 5, 2, 3, True, 55),
    (18, "Tom Price", 5, 3, 0, True, 71),
    (15, "Ryan Cole", 7, 4, 2, True, 104),  # the century
    (12, "Mark Ellis", 5, 3, 1, True, None),
    (9, "Jamie Barker", 5, 3, 2, True, 59),
    (6, "Dave Wilson", 7, 4, 3, True, 83),
    (4, "Chris Hale", 5, 1, 3, True, None),
    (2, "Tom Price", 5, 3, 1, True, 66),
    (0, "Mark Ellis", 7, 4, 2, True, 77),
]

# Matches against the demo's friend account, confirmed on both sides.
LINKED = [(20, FRIENDS[0], 5, 3, 2, 52), (8, FRIENDS[0], 5, 2, 3, None)]

ROUTINE_SCORES = {
    # routine id: (name, scores oldest first, format)
    "routine-line-up": ("The Snooker Line Up", [18, 22, 25, 24, 31, 35, 33, 41, 46, 52, 57], "{}"),
    "routine-t-routine": ("The Snooker T Line Up", [12, 15, 19, 18, 24, 27, 31, 34, 38], "{}"),
    "routine-around-colours": ("Mastering The Colours", [4, 5, 5, 6, 7, 6, 8, 8, 9], "{}"),
    "routine-3-reds-colours": ("3 Reds + Colours Clearance", [16, 19, 24, 22, 29, 33, 36, 41, 44], "{}"),
    "routine-long-potting-classic": ("Potting Long Reds", [36, 40, 44, 42, 48, 52, 56, 60, 64, 68], "{}%"),
    "routine-black-off-spot": ("Potting The Black Ball", [9, 11, 12, 11, 14, 15, 17, 16, 19], "{}"),
    "routine-blue-ball-control": ("Reds and the Blue", [20, 26, 31, 29, 37, 42, 47, 51, 58], "{}"),
    "routine-stun-run-through": ("Stun Run Through", [8, 9, 11, 10, 12, 13, 14, 16], "{}"),
}

TEMPLATES = [
    ("Position · Quick", ["routine-cue-ball-control", "routine-stun-run-through"], "10000000-0000-4000-8000-000000000001"),
    ("Break building night", ["routine-line-up", "routine-3-reds-colours", "routine-around-colours"],
     "10000000-0000-4000-8000-000000000002"),
]

# Sessions: (days ago, template index, scores in the template's routine order)
SESSIONS = [
    (40, 1, ["31", "29", "7"]), (33, 0, ["14", "11"]), (26, 1, ["41", "36", "8"]), (19, 0, ["17", "13"]),
    (11, 1, ["46", "41", "8"]), (4, 0, ["19", "14"]), (3, 1, ["52", "44", "9"]), (1, 0, ["21", "16"]),
    (0, 1, ["57", "44", "9"]),
]

out = []
w = out.append
w("-- Demo account for screenshots. Generated by supabase/seed/make_demo_seed.py; edit that, not this.")
w(f"-- Set the demo account's handle below (and the friends', if different), then run it all.")
w("do $$")
w("declare")
w("  -- Looks up by the real handle or the screenshot one, so this still finds the account on a")
w("  -- rerun even if restore_names.sql has not put the handle back yet.")
w(f"  demo uuid := (select id from public.profiles where handle in ({q(DEMO)}, {q(DEMO_HANDLE)}));")
w(f"  pal uuid := (select id from public.profiles where handle in ({q(FRIENDS[0])}, {q(FRIEND_HANDLE)}));")
w(f"  pal2 uuid := (select id from public.profiles where handle = {q(FRIENDS[1])});")
w("  m uuid;")
w("  g uuid;")
w("  c uuid;")
w("  l uuid;")
w("  t uuid;")
w("  fx uuid;")
w("  bk uuid;")
w("begin")
w(f"  if demo is null then raise exception 'No profile with the handle {DEMO} or {DEMO_HANDLE}. Create the account in the app and pick that handle first.'; end if;")
w("")
w("  -- Screenshot names. Both handles are changed too - georgechara_test showing up in its own")
w("  -- Find a Coach search looked like a test artifact, and 'Danny Hale' next to handle")
w("  -- @georgechara on Community looked like two different things happened to line up.")
w(f"  update public.profiles set display_name = {q(DEMO_NAME)}, handle = {q(DEMO_HANDLE)} where id = demo;")
w(f"  if pal is not null then update public.profiles set display_name = {q(FRIEND_NAME)}, handle = {q(FRIEND_HANDLE)} where id = pal; end if;")
w("")
w("  -- A clean slate for the demo account only.")
w("  delete from public.live_scores where user_id in (demo, pal);")
w("  delete from public.matches where notes = 'seed:live';")
w("  delete from public.tournament_fixture_frames where fixture_id in (")
w("    select id from public.tournament_fixtures where tournament_id in (select id from public.tournaments where user_id = demo));")
w("  delete from public.tournament_fixtures where tournament_id in (select id from public.tournaments where user_id = demo);")
w("  delete from public.tournaments where user_id = demo;")
w("  delete from public.activity where user_id = demo or dedupe_key like 'seed:%';")
w("  delete from public.groups where owner = demo;")
w("  delete from public.conversations where kind = 'direct' and (pair_low = demo or pair_high = demo);")
w("  delete from public.matches where user_id = demo or (opponent_id = demo and user_id in (pal, pal2));")
w("  delete from public.routine_score_entries where user_id = demo;")
w("  delete from public.session_logs where user_id = demo;")
w("  delete from public.session_templates where user_id = demo;")
w("  delete from public.practice_plans where user_id = demo;")
w("  delete from public.routine_bests where user_id = demo;")
w("  delete from public.friendships where requester = demo or addressee = demo;")
w("")

# friends
w("  -- Friends with the other accounts.")
w("  if pal is not null then")
w("    insert into public.friendships (requester, addressee, status, created_at, responded_at)")
w("      values (demo, pal, 'accepted', now() - interval '60 days', now() - interval '60 days');")
w("  end if;")
w("  if pal2 is not null then")
w("    insert into public.friendships (requester, addressee, status, created_at, responded_at)")
w("      values (pal2, demo, 'accepted', now() - interval '40 days', now() - interval '40 days');")
w("  end if;")
w("")


def write_match(days, opponent_sql, best_of, won, lost, live, big, linked=False):
    order = ["user"] * won + ["opponent"] * lost
    random.shuffle(order)
    # the winner takes the last frame
    winner = "user" if won > lost else "opponent"
    if order and order[-1] != winner:
        i = max(idx for idx, side in enumerate(order) if side == winner)
        order[i], order[-1] = order[-1], order[i]
    frames = []
    big_placed = False
    for side in order:
        use_big = big if (big and not big_placed and side == "user") else None
        if use_big:
            big_placed = True
        frames.append(frame(side == "user", big_user=use_big, big_opp=random.choice([None, None, None, 34, 42])))
    result = "win" if won > lost else "loss" if won < lost else "draw"
    mode = "live" if live else "manual"
    at = (f"now() - interval '{random.randint(2, 4)} hours'" if days == 0
          else f"(current_date - {days}) + time '19:30' + interval '{random.randint(0, 50)} minutes'")
    status = "'confirmed'" if linked else "null"
    w(f"  insert into public.matches (user_id, opponent_name, opponent_id, opponent_status, date, location, match_type, format,")
    w(f"      target_frames, frames_played, recording_mode, user_score, opponent_score, result, created_at, updated_at)")
    w(f"    values (demo, {opponent_sql}, {'pal' if linked else 'null'}, {status}, current_date - {days}, 'The Cue Club',")
    w(f"      {q('league' if best_of == 7 else 'casual')}, 'best_of', {best_of}, {won + lost}, {q(mode)}, {won}, {lost}, {q(result)}, {at}, {at})")
    w("    returning id into m;")
    if live:
        for n, f in enumerate(frames, start=1):
            w(f"  insert into public.match_frames (user_id, match_id, frame_number, user_score, opponent_score, winner,")
            w(f"      highest_break_user, highest_break_opponent, breaks, events, created_at, updated_at)")
            w(f"    values (demo, m, {n}, {f['user_score']}, {f['opponent_score']}, {q(f['winner'])}, {f['highest_break_user']},")
            w(f"      {f['highest_break_opponent']}, {q(json.dumps(f['breaks'], separators=(',', ':')))}::jsonb, '[]'::jsonb, {at}, {at});")


w("  -- The monthly match limit stamps every new match with now() and would stop a free account at 12;")
w("  -- it is off only while these go in, so they keep their real dates. It is back on at the end.")
w("  alter table public.matches disable trigger trg_matches_subscription_limit;")
w("  -- Matches over the last ten weeks, most scored live frame by frame.")
for days, opponent, best_of, won, lost, live, big in MATCHES:
    write_match(days, q(opponent), best_of, won, lost, live, big)
w("")
w("  -- Two against the friend account, confirmed by them.")
w("  if pal is not null then")
w("    perform set_config('snooker.linking', 'on', true);")
for days, _, best_of, won, lost, big in LINKED:
    write_match(days, "(select coalesce(display_name, handle) from public.profiles where id = pal)", best_of, won, lost, True, big, linked=True)
w("    perform set_config('snooker.linking', 'off', true);")
w("  end if;")
w("  alter table public.matches enable trigger trg_matches_subscription_limit;")
w("")

# routine scores spread over eight weeks, the last few this week
w("  -- Routine scores, getting better week by week.")
for routine_id, (name, scores, fmt) in ROUTINE_SCORES.items():
    count = len(scores)
    for i, score in enumerate(scores):
        days = round(56 - i * (54 / max(1, count - 1)))
        days = max(0, days - random.randint(0, 2))
        w(f"  insert into public.routine_score_entries (user_id, routine_id, routine_name, score, recorded_at, created_at)")
        w(f"    values (demo, {q(routine_id)}, {q(name)}, {q(fmt.format(score))}, (current_date - {days}) + time '{'07' if days == 0 else '18'}:{10 + i:02d}', now());")
w("")

w("  -- Session presets and the sessions played from them.")
for name, routine_ids, template_id in TEMPLATES:
    arr = "array[" + ", ".join(q(r) for r in routine_ids) + "]"
    w(f"  insert into public.session_templates (id, user_id, name, routine_ids, created_at, updated_at)")
    w(f"    values ({q(template_id)}, demo, {q(name)}, {arr}, now() - interval '50 days', now() - interval '{len(name)} minutes');")
for days, t, scores in SESSIONS:
    name, routine_ids, template_id = TEMPLATES[t]
    w(f"  insert into public.session_logs (user_id, template_id, template_name, date, recorded_at)")
    w(f"    values (demo, {q(template_id)}, {q(name)}, current_date - {days}, (current_date - {days}) + time '{'08:30' if days == 0 else '12:30'}') returning id into l;")
    for routine_id, score in zip(routine_ids, scores):
        w(f"  insert into public.session_log_results (log_id, routine_id, score) values (l, {q(routine_id)}, {q(score)});")
w("")

plan = {
    "days": [
        {"day": 0, "templateId": TEMPLATES[1][2]},
        {"day": 2, "templateId": TEMPLATES[0][2]},
        {"day": 4, "templateId": TEMPLATES[1][2]},
        {"day": 5, "templateId": None},
    ],
    "weeklyTarget": 4,
    "goals": [
        {"id": "goal-line-up", "routineId": "routine-line-up", "routineName": "The Snooker Line Up", "target": 70,
         "kind": "number", "deadline": None, "createdAt": "2026-08-01T12:00:00.000Z"},
        {"id": "goal-long-reds", "routineId": "routine-long-potting-classic", "routineName": "Potting Long Reds",
         "target": 75, "kind": "percent", "deadline": None, "createdAt": "2026-08-01T12:00:00.000Z"},
    ],
    "updatedAt": "2026-09-01T12:00:00.000Z",
}
w("  -- The weekly plan, with two goals.")
w(f"  insert into public.practice_plans (user_id, plan, updated_at) values (demo, {q(json.dumps(plan))}::jsonb, now());")
w("")

# community
w("  -- A group with the friends in it, its chat, and pinned routines.")
w("  insert into public.groups (owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite, created_at)")
w("    values (demo, 'Tuesday Night League', 'Division two at The Cue Club. Fixtures, results and the odd century.', '🎱',")
w("      '#1E7A46', 'public', 'everyone', 'everyone', now() - interval '45 days') returning id into g;")
w("  insert into public.group_members (group_id, user_id, role, joined_at) values (g, demo, 'owner', now() - interval '45 days');")
w("  if pal is not null then insert into public.group_members (group_id, user_id, role, joined_at) values (g, pal, 'admin', now() - interval '44 days'); end if;")
w("  if pal2 is not null then insert into public.group_members (group_id, user_id, role, joined_at) values (g, pal2, 'member', now() - interval '30 days'); end if;")
w("  insert into public.conversations (kind, group_id, created_at) values ('group', g, now() - interval '45 days') returning id into c;")
chat = [
    ("demo", 50, "Fixtures are up for next month. We're home to the Crucible lot first."),
    ("pal", 49, "Nice one. I'll book table 4."),
    ("pal2", 30, "Count me in for the Tuesday after, working late this week."),
    ("pal", 15, "Did you really make a 104 last night?!"),
    ("demo", 15, "Ha, finally. Took me long enough."),
    ("pal2", 3, "Anyone fancy a practice frame Thursday?"),
    ("demo", 1, "Yes, 7pm? I've pinned the line-up, let's see who's top by the weekend."),
]
for who, hours, body in chat:
    guard = "" if who == "demo" else f"if {who} is not null then "
    end = "" if who == "demo" else " end if;"
    w(f"  {guard}insert into public.messages (conversation_id, sender, body, created_at) values (c, {who}, {q(body)}, now() - interval '{hours} hours');{end}")
w("  insert into public.group_routines (group_id, routine_key, name, added_by) values (g, 'routine-line-up', 'The Snooker Line Up', demo);")
w("  insert into public.group_routines (group_id, routine_key, name, added_by) values (g, 'routine-black-off-spot', 'Potting The Black Ball', demo);")
w("  insert into public.group_routines (group_id, routine_key, name, added_by) values (g, 'routine-long-potting-classic', 'Potting Long Reds', demo);")
w("")

# More groups, so the Community list is not just one - a second the friend is in, and a third
# neither is (a solo group still looks normal, and not every group has to be chatty).
EXTRA_GROUPS = [
    {
        "name": "Cue Club Socials",
        "description": "Whoever's about on a Friday. No table booking needed, just turn up.",
        "emoji": "🍻",
        "colour": "#B5762A",
        "days_old": 30,
        "with_pal": True,
        "chat": [
            ("demo", 72, "Table's free from 8 if anyone fancies it."),
            ("pal", 70, "In. Bringing Jamie too if that's alright."),
            ("demo", 20, "Good session last week, same again Friday?"),
        ],
    },
    {
        "name": "Break-Building Crew",
        "description": "Sharing what's working on the long game - drills, not just scores.",
        "emoji": "🎯",
        "colour": "#2C6E8C",
        "days_old": 18,
        "with_pal": True,
        "chat": [
            ("pal", 40, "That colours drill you posted is brutal."),
            ("demo", 39, "Right? Stick with it, it's worth it."),
        ],
    },
    {
        "name": "Solo Practice Log",
        "description": "Just for me - somewhere to pin routines I'm focusing on this month.",
        "emoji": "📋",
        "colour": "#5B4B8A",
        "days_old": 10,
        "with_pal": False,
        "chat": [],
    },
]
for group in EXTRA_GROUPS:
    w("  insert into public.groups (owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite, created_at)")
    w(f"    values (demo, {q(group['name'])}, {q(group['description'])}, {q(group['emoji'])},")
    w(f"      {q(group['colour'])}, 'public', 'everyone', 'everyone', now() - interval '{group['days_old']} days') returning id into g;")
    w(f"  insert into public.group_members (group_id, user_id, role, joined_at) values (g, demo, 'owner', now() - interval '{group['days_old']} days');")
    if group["with_pal"]:
        w(f"  if pal is not null then insert into public.group_members (group_id, user_id, role, joined_at) values (g, pal, 'member', now() - interval '{group['days_old'] - 1} days'); end if;")
    if group["chat"]:
        w("  insert into public.conversations (kind, group_id, created_at) values ('group', g, now() - interval '%d days') returning id into c;" % group["days_old"])
        for who, hours, body in group["chat"]:
            guard = "" if who == "demo" else f"if {who} is not null then "
            end = "" if who == "demo" else " end if;"
            w(f"  {guard}insert into public.messages (conversation_id, sender, body, created_at) values (c, {who}, {q(body)}, now() - interval '{hours} hours');{end}")
    w("")
w("  -- A chat with the friend.")
w("  if pal is not null then")
w("    insert into public.conversations (kind, pair_low, pair_high, created_at)")
w("      values ('direct', least(demo, pal), greatest(demo, pal), now() - interval '20 days') returning id into c;")
w("    insert into public.conversation_members (conversation_id, user_id, status, last_read_at) values")
w("      (c, demo, 'active', now()), (c, pal, 'active', now());")
direct = [
    ("pal", 30, "Rematch Saturday? I want that frame back."),
    ("demo", 29, "Go on then. Best of five, winner buys."),
    ("pal", 5, "Good game last night. That black to win it was brutal."),
    ("demo", 4, "Pure luck, I'll take it."),
]
for who, hours, body in direct:
    w(f"    insert into public.messages (conversation_id, sender, body, created_at) values (c, {who}, {q(body)}, now() - interval '{hours} hours');")
w("  end if;")
w("")
w("  -- What the group's feed shows.")
feed = [
    ("demo", "century", "Made a 104 break against Ryan Cole", "Beat Ryan Cole 4–2", 15 * 24),
    ("demo", "personal_best", "New best on The Snooker Line Up", "57", 2),
    ("demo", "match", "Beat Mark Ellis 4–2", None, 5),
    ("demo", "level_up", "Reached level 6", None, 9 * 24),
    ("demo", "high_break", "New high break: 83", "Beat Dave Wilson 4–3", 6 * 24),
    ("pal", "match", "Beat Tom Price 3–1", None, 28),
    ("pal", "personal_best", "New best on Potting The Black Ball", "21", 50),
    ("pal2", "achievement", "Unlocked Dedicated Player", "Practise on 20 different days", 70),
]
for n, (who, kind, title, detail, hours) in enumerate(feed):
    guard = "" if who == "demo" else f"if {who} is not null then "
    end = "" if who == "demo" else " end if;"
    w(f"  {guard}insert into public.activity (user_id, kind, title, detail, dedupe_key, created_at) values ({who}, {q(kind)}, {q(title)}, "
      f"{q(detail) if detail else 'null'}, 'seed:{n}', now() - interval '{hours} hours');{end}")
w("")

# Coach mode: the demo runs both sides - a client who has booked a real coach, and a coach with
# their own diary, mixing a real client with a walk-in who has no account at all. The friend
# account plays the coach the demo books; it is a real account (see the top of this file), so
# these fields are only set if they still look untouched, and restore_names.sql clears them back.
w("  -- Coach mode. The friend becomes a bookable coach; the demo becomes one too, so flipping to")
w("  -- coach view on the same login shows a populated diary. restore_names.sql undoes all of it.")
w("  delete from public.coach_bookings where coach_id in (demo, pal) or player_id in (demo, pal);")
w("  delete from public.coach_availability where coach_id in (demo, pal);")
w("  delete from public.coach_group_members where group_id in (select id from public.coach_groups where coach_id = demo);")
w("  delete from public.coach_groups where coach_id = demo;")
w("")
w("  if pal is not null then")
w("    update public.profiles set is_coach = true,")
w(f"        bio = coalesce(nullif(bio, ''), {q('WPBSA-accredited coach, 12 years at The Cue Club. I focus on cue action and safety play.')}),")
w(f"        coach_location = coalesce(coach_location, {q('The Cue Club, Manchester')}),")
w("        coach_lat = coalesce(coach_lat, 53.4808), coach_lng = coalesce(coach_lng, -2.2426),")
w("        wpbsa_accredited = true,")
QUALS = "array[" + ", ".join(q(tag) for tag in ["WPBSA Level 3", "Safeguarding certified", "Break-building specialist"]) + "]"
w(f"        coach_qualifications = case when array_length(coach_qualifications, 1) is null then {QUALS} else coach_qualifications end")
w("      where id = pal;")
w("")
w("    -- The demo books the friend - shows on My Coaching (demo) and Clients (the friend).")
w("    insert into public.coach_availability (coach_id, starts_at, ends_at)")
w("      values (pal, (current_date + 3) + time '17:00', (current_date + 3) + time '18:00') returning id into c;")
w("    insert into public.coach_bookings (coach_id, player_id, availability_id, starts_at, ends_at, status, note)")
w(f"      values (pal, demo, c, (current_date + 3) + time '17:00', (current_date + 3) + time '18:00', 'accepted', {q('Working on the cue action, per last session.')});")
w("    -- A couple more open slots on the friend's side, for the booking screen to show choice.")
w("    insert into public.coach_availability (coach_id, starts_at, ends_at) values")
w("      (pal, (current_date + 6) + time '19:00', (current_date + 6) + time '20:00'),")
w("      (pal, (current_date + 9) + time '10:00', (current_date + 9) + time '11:00');")
w("  end if;")
w("")
w("  -- The demo's own diary: the friend as a returning real client, and a walk-in with no account.")
w(f"  update public.profiles set is_coach = true, bio = coalesce(nullif(bio, ''), {q('Club coach at The Cue Club. Cue action, safety and match temperament.')}),")
w(f"      coach_location = coalesce(coach_location, {q('The Cue Club, Manchester')}), coach_lat = coalesce(coach_lat, 53.4808), coach_lng = coalesce(coach_lng, -2.2426)")
w("    where id = demo;")
w("  if pal is not null then")
w("    insert into public.coach_availability (coach_id, starts_at, ends_at)")
w("      values (demo, current_date - 6 + time '18:00', current_date - 6 + time '19:00') returning id into c;")
w("    insert into public.coach_bookings (coach_id, player_id, availability_id, starts_at, ends_at, status)")
w("      values (demo, pal, c, current_date - 6 + time '18:00', current_date - 6 + time '19:00', 'accepted') returning id into bk;")
w("    -- Notes and routines on that past session, so a coach opening it sees what tracking one looks like.")
w(f"    insert into public.coach_session_notes (booking_id, coach_id, notes) values (bk, demo, {q('Good tempo through the line-up drill, breaking down consistently to the pink. Worked on cue action - keeping the elbow still through the strike. Ready to bring this into safety play next session.')});")
w(f"    insert into public.coach_session_routines (booking_id, coach_id, routine_id, routine_name, score, notes)")
w(f"      values (bk, demo, {q('routine-line-up')}, {q('The Snooker Line Up')}, 41, {q('Best of the night - clean through reds and colours.')});")
w(f"    insert into public.coach_session_routines (booking_id, coach_id, routine_id, routine_name, score, notes)")
w(f"      values (bk, demo, {q('routine-black-off-spot')}, {q('Potting The Black Ball')}, 14, {q('Still rushing the pot slightly, worth revisiting.')});")
w("    insert into public.coach_availability (coach_id, starts_at, ends_at)")
w("      values (demo, (current_date + 1) + time '18:30', (current_date + 1) + time '19:30') returning id into c;")
w("    insert into public.coach_bookings (coach_id, player_id, availability_id, starts_at, ends_at, status, note)")
w(f"      values (demo, pal, c, (current_date + 1) + time '18:30', (current_date + 1) + time '19:30', 'accepted', {q('Same time as last week.')});")
w("  end if;")
w("")

# A working diary, not two isolated entries: several walk-ins with no account, spread across past
# and upcoming days, reusing names already established as league mates in the match data above -
# a club coach seeing his own clubmates for lessons is exactly what would really happen.
GUEST_CLIENTS = [
    ("Steve Carter", [-9, -2, 5, 12]),
    ("Dave Wilson", [-13, -6, 3, 10]),
    ("Mark Ellis", [-11, 4, 14]),
    ("Ryan Cole", [-16, -4, 8]),
]
GUEST_TIMES = ["09:00", "10:30", "14:00", "16:00", "17:30", "18:30", "19:30"]
GUEST_NOTES = [None, "Working on safety play.", "Cue action tune-up.", None, "First session in a while.", None]

w("  -- A working diary: several walk-ins with no account, spread across the last few weeks and")
w("  -- the next couple - not just one isolated guest.")
slot_n = 0
for name, days_list in GUEST_CLIENTS:
    for day in days_list:
        time_str = GUEST_TIMES[slot_n % len(GUEST_TIMES)]
        hour = int(time_str.split(":")[0])
        end_time = f"{(hour + 1) % 24:02d}:{time_str.split(':')[1]}"
        note = GUEST_NOTES[slot_n % len(GUEST_NOTES)]
        day_expr = f"(current_date + {day})" if day >= 0 else f"(current_date - {-day})"
        w(f"  insert into public.coach_availability (coach_id, starts_at, ends_at)")
        w(f"    values (demo, {day_expr} + time '{time_str}', {day_expr} + time '{end_time}') returning id into c;")
        cols = "coach_id, guest_name, availability_id, starts_at, ends_at, status" + (", note" if note else "")
        vals = f"demo, {q(name)}, c, {day_expr} + time '{time_str}', {day_expr} + time '{end_time}', 'accepted'" + (f", {q(note)}" if note else "")
        w(f"  insert into public.coach_bookings ({cols}) values ({vals});")
        slot_n += 1
w("")

w("  -- Open slots still waiting to be booked, so the calendar shows both kinds of day too.")
OPEN_SLOT_DAYS = [1, 2, 6, 7, 9, 15, 18]
open_values = ", ".join(
    f"(demo, (current_date + {day}) + time '{GUEST_TIMES[(slot_n + i) % len(GUEST_TIMES)]}', "
    f"(current_date + {day}) + time '{(int(GUEST_TIMES[(slot_n + i) % len(GUEST_TIMES)].split(':')[0]) + 1) % 24:02d}:"
    f"{GUEST_TIMES[(slot_n + i) % len(GUEST_TIMES)].split(':')[1]}')"
    for i, day in enumerate(OPEN_SLOT_DAYS)
)
w(f"  insert into public.coach_availability (coach_id, starts_at, ends_at) values {open_values};")
w("")
w("  -- A broadcast group with the friend in it - add one real post from the app before that screenshot.")
w(f"  insert into public.coach_groups (coach_id, name) values (demo, {q('Saturday Regulars')}) returning id into g;")
w("  if pal is not null then insert into public.coach_group_members (group_id, player_id) values (g, pal); end if;")
w("")

# A friend's match in progress right now, for the "following a friend live" screenshot. Played by
# the friend (pal), against someone unlinked, so it reads as a match happening elsewhere rather
# than one demo is themselves part of - marked with notes='seed:live' so restore_names.sql (and a
# rerun of this script) can find and remove just this one row.
w("  -- A friend's match live right now, for the 'follow a friend live' screenshot.")
w("  if pal is not null then")
w("    insert into public.matches (user_id, opponent_name, opponent_id, date, location, match_type, format,")
w("        target_frames, frames_played, recording_mode, user_score, opponent_score, result, notes, created_at, updated_at)")
w("    -- result is not nullable even mid-match - the app itself keeps it as a running 'so far'")
w("    -- standing computed from frames won, recomputed every save; 1-1 is a draw so far.")
w(f"      values (pal, {q('Ryan Cole')}, null, current_date, {q('The Cue Club')}, {q('league')}, 'best_of', 7, 2, {q('live')}, 1, 1, {q('draw')}, {q('seed:live')}, now() - interval '18 minutes', now() - interval '18 minutes')")
w("      returning id into m;")
w("    insert into public.match_frames (user_id, match_id, frame_number, user_score, opponent_score, winner,")
w("        highest_break_user, highest_break_opponent, breaks, events, created_at, updated_at) values")
w("      (pal, m, 1, 68, 22, 'user', 68, 22, '[]'::jsonb, '[]'::jsonb, now() - interval '17 minutes', now() - interval '17 minutes'),")
w("      (pal, m, 2, 19, 64, 'opponent', 19, 41, '[]'::jsonb, '[]'::jsonb, now() - interval '9 minutes', now() - interval '9 minutes');")
w("    insert into public.live_scores (match_id, user_id, opponent_id, opponent_name, best_of, frames_user, frames_opponent,")
w("        frame_number, points_user, points_opponent, current_break, at_table, remaining, high_break_user, high_break_opponent,")
w("        frames, status, started_at, updated_at)")
w(f"      values (m, pal, null, {q('Ryan Cole')}, 7, 1, 1, 3, 45, 28, 18, {q('user')}, 59, 68, 41,")
w("        '[{\"n\":1,\"u\":68,\"o\":22,\"w\":\"user\"},{\"n\":2,\"u\":19,\"o\":64,\"w\":\"opponent\"}]'::jsonb,")
w(f"        {q('live')}, now() - interval '18 minutes', now() - interval '20 seconds');")
w("  end if;")
w("")

# A knockout tournament, quarter-finals played and semi-finals drawn, for the bracket screenshot.
# Fixtures are written directly rather than through buildKnockoutFixtures (that only runs in the
# app), so the semi-final and final rows are filled in by hand exactly as recomputeKnockoutTree
# would leave them: semis carry the real quarter-final winners, the final still says TBD.
w("  -- A knockout tournament: quarter-finals played, semi-finals drawn, for the bracket screenshot.")
TOURNAMENT_PARTICIPANTS = ["You", "Danny Hale", "Dave Wilson", "Mark Ellis", "Ryan Cole", "Jamie Barker", "Chris Hale", "Tom Price"]
QUARTERS = [
    ("You", "Dave Wilson", 3, 1, [(68, 45, "a"), (30, 72, "b"), (81, 19, "a"), (55, 38, "a")]),
    ("Danny Hale", "Mark Ellis", 3, 2, [(70, 12, "a"), (28, 66, "b"), (64, 51, "a"), (19, 77, "b"), (73, 40, "a")]),
    ("Ryan Cole", "Jamie Barker", 3, 0, [(66, 20, "a"), (58, 44, "a"), (71, 15, "a")]),
    ("Chris Hale", "Tom Price", 3, 2, [(52, 61, "b"), (74, 22, "a"), (33, 69, "b"), (60, 48, "a"), (77, 31, "a")]),
]
SEMIS = [("You", "Danny Hale"), ("Ryan Cole", "Chris Hale")]
participants_array = "array[" + ", ".join(q(name) for name in TOURNAMENT_PARTICIPANTS) + "]"
w("  insert into public.tournaments (user_id, name, tournament_type, entry_mode, pairing_mode, best_of_frames,")
w("      participants, status, created_at, updated_at)")
w(f"    values (demo, {q('The Cue Club Knockout')}, 'knockout', 'singles', 'manual', 5,")
w(f"      {participants_array}, 'active', now() - interval '5 days', now() - interval '2 hours') returning id into t;")
for index, (a, b, score_a, score_b, frames) in enumerate(QUARTERS):
    winner = q(a) if score_a > score_b else q(b)
    w("  insert into public.tournament_fixtures (tournament_id, round_number, fixture_index, participant_a, participant_b,")
    w("      best_of_frames, score_a, score_b, winner, status)")
    w(f"    values (t, 1, {index}, {q(a)}, {q(b)}, 5, {score_a}, {score_b}, {winner}, 'completed') returning id into fx;")
    for frame_number, (fa, fb, fwinner) in enumerate(frames, start=1):
        w(f"  insert into public.tournament_fixture_frames (fixture_id, frame_number, score_a, score_b, winner)")
        w(f"    values (fx, {frame_number}, {fa}, {fb}, {q(fwinner)});")
for index, (a, b) in enumerate(SEMIS):
    w("  insert into public.tournament_fixtures (tournament_id, round_number, fixture_index, participant_a, participant_b,")
    w("      best_of_frames, status)")
    w(f"    values (t, 2, {index}, {q(a)}, {q(b)}, 5, 'pending');")
w("  insert into public.tournament_fixtures (tournament_id, round_number, fixture_index, participant_a, participant_b,")
w("      best_of_frames, status)")
w(f"    values (t, 3, 0, {q('TBD')}, {q('TBD')}, 5, 'pending');")
w("")

w("end")
w("$$;")

Path(__file__).with_name("demo_account.sql").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"wrote {len(out)} lines")
