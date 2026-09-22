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
# Names shown while screenshots are taken. Put back afterwards with restore_names.sql.
DEMO_NAME = "You"
FRIEND_NAME = "Danny Hale"

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
w(f"  demo uuid := (select id from public.profiles where handle = {q(DEMO)});")
w(f"  pal uuid := (select id from public.profiles where handle = {q(FRIENDS[0])});")
w(f"  pal2 uuid := (select id from public.profiles where handle = {q(FRIENDS[1])});")
w("  m uuid;")
w("  g uuid;")
w("  c uuid;")
w("  l uuid;")
w("begin")
w(f"  if demo is null then raise exception 'No profile with the handle {DEMO}. Create the account in the app and pick that handle first.'; end if;")
w("")
w("  -- Screenshot names.")
w(f"  update public.profiles set display_name = {q(DEMO_NAME)} where id = demo;")
w(f"  if pal is not null then update public.profiles set display_name = {q(FRIEND_NAME)} where id = pal; end if;")
w("")
w("  -- A clean slate for the demo account only.")
w("  delete from public.live_scores where user_id = demo;")
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
w("end")
w("$$;")

Path(__file__).with_name("demo_account.sql").write_text("\n".join(out) + "\n", encoding="utf-8")
print(f"wrote {len(out)} lines")
