"""Builds the Snookered website (apps/legal-site) from the page content below.

    python scripts/build_site.py            # write the pages
    python scripts/build_site.py --images   # also remake the sized screenshots

Every page shares one header, footer and screenshot markup, so edit them here and re-run.
The privacy policy and terms live in scripts/site/*.body.html. email-confirmed.html and
reset.html are standalone (they use styles.css) and are not touched.
"""

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SITE = ROOT / "apps" / "legal-site"
SOURCE = Path(__file__).resolve().parent / "site"

SUPPORT = "support@snookeredapp.com"
WIDTHS = (360, 560, 820)

NAV = [
    ("/scoring", "Scoring"),
    ("/practice", "Practice"),
    ("/community", "Community"),
    ("/plans", "Plans"),
    ("/support", "Support"),
]

APPLE = (
    '<svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22"><path fill="currentColor" '
    'd="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 '
    "0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 "
    "1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 "
    "1.25-2.58-.03-.01-2.39-.92-2.41-3.64zM14.1 5.86c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 "
    '1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z"/></svg>'
)

STORE = f'<span class="store" aria-label="Coming soon to the App Store">{APPLE}<span><small>Coming soon to</small>the App Store</span></span>'


# ---------------------------------------------------------------- building blocks


def img(name, alt, sizes, eager=False):
    """A screenshot at the right size for where it sits, so it is never blown up or crushed."""
    srcset = ", ".join(f"/screens/sized/{name}-{w}.webp {w}w" for w in WIDTHS)
    loading = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return (
        f'<img src="/screens/sized/{name}-560.webp" srcset="{srcset}" sizes="{sizes}" '
        f'width="1206" height="2622" alt="{alt}" {loading} decoding="async" />'
    )


def phone(name, alt, sizes="(max-width: 960px) 78vw, 320px", cls="", eager=False):
    extra = f" {cls}" if cls else ""
    hidden = ' aria-hidden="true"' if not alt else ""
    return f'<div class="phone{extra}"{hidden}>{img(name, alt, sizes, eager)}</div>'


def figure(name, alt, caption):
    return f'<figure class="phone-fig rv" style="--d:1">{phone(name, alt)}<figcaption>{caption}</figcaption></figure>'


def ticks(items):
    return '<ul class="ticks">' + "".join(f"<li>{item}</li>" for item in items) + "</ul>"


def chapter(kicker, title, body, items, visual, alt=False, flip=False, anchor=None):
    classes = "chapter" + (" alt" if alt else "") + (" flip" if flip else "")
    id_attr = f' id="{anchor}"' if anchor else ""
    return f"""
      <section class="{classes}"{id_attr}>
        <div class="wrap chapter-grid">
          <div class="chapter-copy rv">
            <p class="kicker">{kicker}</p>
            <h2>{title}</h2>
            <p>{body}</p>
            {ticks(items)}
          </div>
          {visual}
        </div>
      </section>"""


def page_hero(kicker, title, lead, strip):
    return f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">{kicker}</p>
          <h1>{title}</h1>
          <p class="lead">{lead}</p>
          {strip}
        </div>
      </section>"""


def strip(label, parts, tag="", live=False):
    """The lower-third: parts are (kind, text) where kind is name, num, dim or sep."""
    tag_class = "strip-tag is-live" if live else "strip-tag"
    cells = [f'<span class="{tag_class}">{tag}</span>'] if tag else []
    for kind, text in parts:
        if kind.startswith("sep"):
            hide = " hide-xs" if kind.endswith("!") else ""
            cells.append(f'<i class="sep{hide}" aria-hidden="true"></i>')
        else:
            hide = " hide-xs" if kind.endswith("!") else ""
            cells.append(f'<span class="strip-{kind.rstrip("!")}{hide}">{text}</span>')
    return f'<div class="strip" role="img" aria-label="{label}">{"".join(cells)}</div>'


def close(title="See you at the table.", text="Snookered is coming to iPhone. Questions in the meantime? We read every message."):
    return f"""
      <section class="close">
        <div class="wrap close-inner rv">
          <img src="/icon-512.jpg" alt="" width="88" height="88" loading="lazy" />
          <h2>{title}</h2>
          <p>{text}</p>
          <a class="button" href="/support">Get in touch</a>
        </div>
      </section>"""


def facts(items):
    rows = "".join(f'<div class="rv" style="--d:{i % 3}"><dt>{t}</dt><dd>{d}</dd></div>' for i, (t, d) in enumerate(items))
    return f'<dl class="facts">{rows}</dl>'


# ---------------------------------------------------------------- the page shell


def layout(path, title, description, main, noindex=False):
    def links(css=""):
        out = []
        for href, label in NAV:
            current = ' aria-current="page"' if href == path else ""
            out.append(f'<a href="{href}"{current}>{label}</a>')
        return "".join(out)

    full_title = "Snookered · Your snooker, on the scoreboard" if path == "/" else f"{title} · Snookered"
    robots = '<meta name="robots" content="noindex" />' if noindex else ""
    canonical = "" if noindex else f'<link rel="canonical" href="https://snookeredapp.com{path if path != "/" else "/"}" />'
    return f"""<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{full_title}</title>
    <meta name="description" content="{description}" />
    {robots}{canonical}
    <meta name="theme-color" content="#07170f" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Snookered" />
    <meta property="og:title" content="{full_title}" />
    <meta property="og:description" content="{description}" />
    <meta property="og:image" content="https://snookeredapp.com/icon-512.jpg" />
    <link rel="icon" type="image/png" href="/favicon.png" />
    <link rel="apple-touch-icon" href="/icon-512.jpg" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700;800&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="/site.css" />
    <script src="/site.js" defer></script>
  </head>
  <body>
    <a class="skip" href="#main">Skip to content</a>
    <header class="bar">
      <div class="wrap bar-inner">
        <a class="brand" href="/" aria-label="Snookered home"><img src="/icon-512.jpg" alt="" width="32" height="32" /><span translate="no">Snookered</span></a>
        <nav class="nav" aria-label="Primary">{links()}</nav>
        <details class="menu">
          <summary aria-label="Menu"><span class="menu-icon" aria-hidden="true"></span>Menu</summary>
          <nav aria-label="Primary">{links()}</nav>
        </details>
      </div>
    </header>

    <main id="main">{main}
    </main>

    <footer class="foot">
      <div class="wrap foot-inner">
        <div>
          <a class="brand" href="/"><img src="/icon-512.jpg" alt="" width="32" height="32" loading="lazy" /><span translate="no">Snookered</span></a>
          <p class="foot-tag">The snooker app for scoring, practice and playing your friends.</p>
        </div>
        <div class="foot-cols">
          <div>
            <h2>The app</h2>
            <a href="/scoring">Scoring</a>
            <a href="/practice">Practice</a>
            <a href="/community">Community</a>
            <a href="/plans">Plans</a>
          </div>
          <div>
            <h2>Help</h2>
            <a href="/support">Support</a>
            <a href="mailto:{SUPPORT}">Email us</a>
            <a href="/privacy">Privacy</a>
            <a href="/terms">Terms</a>
          </div>
        </div>
        <p class="foot-legal">© <span id="year">2026</span> Snookered. News headlines in the app belong to their publishers.</p>
      </div>
    </footer>
  </body>
</html>
"""


# ---------------------------------------------------------------- pages


def home():
    return f"""
      <section class="hero">
        <div class="wrap hero-grid">
          <div>
            <p class="kicker">The all-in-one snooker app</p>
            <h1>Your snooker,<br />on the scoreboard.</h1>
            <p class="lead">Score every frame ball by ball, practise with a plan, play your friends for real and follow the pro tour. Everything you do at the table, in one place.</p>
            <div class="actions">
              {STORE}
              <a class="text-link" href="/scoring">See how it works <span aria-hidden="true">→</span></a>
            </div>
          </div>

          <div class="stage">
            {phone("live-match", "", "(max-width: 960px) 44vw, 272px", "back left")}
            {phone("stats", "", "(max-width: 960px) 44vw, 272px", "back right")}
            {phone("dashboard", "The Snookered home screen: the next session, your streak and form, and this week", "(max-width: 960px) 44vw, 272px", "front", eager=True)}
            <figure class="board-demo" aria-label="A live scoreboard: a break building, ball by ball">
              <div class="board">
                <div class="board-head">
                  <span class="live"><i></i>LIVE</span>
                  <span class="board-meta">FRAME <b>4</b> · BEST OF 7</span>
                </div>
                <div class="side">
                  <span class="at-table" id="at-you"></span>
                  <span class="name">You</span>
                  <span class="points" id="demo-you-points">0</span>
                  <span class="frames" id="demo-you-frames">2</span>
                </div>
                <div class="side">
                  <span class="at-table"></span>
                  <span class="name">Danny</span>
                  <span class="points" id="demo-them-points">38</span>
                  <span class="frames">1</span>
                </div>
                <div class="break-row">
                  <span class="break-label">BREAK <b id="demo-break">0</b></span>
                  <span class="balls" id="demo-balls" aria-hidden="true"></span>
                </div>
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head rv">
            <div>
              <p class="kicker">What it does</p>
              <h2>Three things you do at the table.</h2>
            </div>
            <p>Snookered is built around them: scoring the frame, getting better between matches, and playing the people you know.</p>
          </div>
          <div class="doors">
            {door("/scoring", "Score", "Every frame, ball by ball.", "Live scoring that knows the points left, the snookers needed and the break you are on.", "Scoring", "live-scoring", 0)}
            {door("/practice", "Practise", "Practice with a point to it.", "Proper routines with a personal best for each, and a plan for the week.", "Practice", "routine", 1)}
            {door("/community", "Play", "Your club, in your pocket.", "Matches that count for both players, friends followed live, and groups for your league.", "Community", "community", 2)}
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head rv">
            <h2>And the rest of it.</h2>
          </div>
          {facts([
            ("AI coach", "Film yourself at the table and the coach watches it, then tells you what to work on and which routines will help."),
            ("Pro tour news", "The latest from the World Snooker Tour and BBC Sport, right next to your own game."),
            ("Tournaments", "Run a knockout or a league for your club, with the draw, fixtures and results kept for you."),
            ("Achievements and levels", "Earn your way up for the things that matter: centuries, streaks, wins and practice."),
            ("Stats that mean something", "Form, high breaks, head-to-heads and your practice rhythm, without wading through charts."),
            ("Works without signal", "Club basements are not known for their Wi-Fi. Scores save on the phone and sync when you are back online."),
          ])}
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head rv">
            <div>
              <p class="kicker">Plans</p>
              <h2>Free to start.</h2>
            </div>
            <p>Score matches, run routines and play friends on the free plan. Go further with Half-Century or Century when you want more.</p>
          </div>
          <a class="text-link rv" href="/plans">Compare the plans <span aria-hidden="true">→</span></a>
        </div>
      </section>
{close()}"""


def door(href, kicker, title, text, go, shot, delay):
    return f"""<a class="door rv" style="--d:{delay}" href="{href}">
              <div class="door-copy">
                <p class="kicker">{kicker}</p>
                <h3>{title}</h3>
                <p>{text}</p>
                <span class="door-go">{go} <span aria-hidden="true">→</span></span>
              </div>
              <div class="door-shot" aria-hidden="true">{phone(shot, "", "(max-width: 560px) 70vw, 250px")}</div>
            </a>"""


def scoring():
    hero = page_hero(
        "Scoring",
        "Every frame, ball by ball.",
        "Tap the balls as they go down. Snookered keeps the score, the breaks and the fouls, knows when snookers are needed, and settles the frame when it is done.",
        strip(
            "Scoreboard: You 3, Danny 1, best of 7, current break 64",
            [("name", "You"), ("num", "3"), ("dim", "(7)"), ("num", "1"), ("name", "Danny"), ("sep!", ""), ("dim!", "Break"), ("num!", "64")],
            tag="Frame 5",
        ),
    )
    return (
        hero
        + chapter(
            "At the table",
            "Tap the ball. That is it.",
            "Scoring is built for a cue in one hand and a phone in the other. Big targets for every colour, the points on the table always in view, and fouls and re-racks one tap away.",
            [
                "Points remaining and snookers required, worked out as you go",
                "Fouls, misses and re-racks, without a rule book",
                "Just the result, if you only want the frame score",
                "Scores save without signal and sync later",
            ],
            figure("live-scoring", "Live scoring in Snookered, mid-frame", "Live scoring, mid-frame."),
            anchor="live",
        )
        + chapter(
            "After the match",
            "The match, told properly.",
            "The moment the last frame ends you get the whole story: the frame-by-frame scores, the high breaks, and the numbers that decided it.",
            [
                "Frame-by-frame scores and the high breaks",
                "Personal bests and centuries picked out automatically",
                "Head-to-head records against everyone you play",
            ],
            figure("match-overview", "A match overview: the scoreboard, high breaks and match statistics", "Every match, frame by frame."),
            alt=True,
            flip=True,
        )
        + chapter(
            "Share it",
            "Lead with the big moment.",
            "A result card worth posting. It leads with whatever mattered most, whether that was the century, the clearance or the comeback from two frames down.",
            [
                "One tap to share to your group, a chat or anywhere else",
                "Designed to look right in a feed or a message",
            ],
            figure("share-card", "The share card for a result, leading with a 77 break", "The share card, led by a 77."),
        )
        + chapter(
            "Stats",
            "Numbers that mean something.",
            "Your form, your practice rhythm and your high breaks, laid out so you can see in a glance whether you are playing better than last month.",
            [
                "Form over your recent matches",
                "Your week of practice, day by day",
                "High breaks and averages that update as you play",
            ],
            figure("stats", "The Stats screen: this week, form and practice rhythm", "Your week, at a glance."),
            alt=True,
            flip=True,
        )
        + close("Rack them up.", "Snookered is coming to iPhone. Want to know when it lands, or have a question about scoring? Get in touch.")
    )


def practice():
    hero = page_hero(
        "Practice",
        "Practice with a point to it.",
        "A library of proper routines, from the line-up to the colours, each with its own progress and personal best. Plan the week, keep a streak going, and see it pay off in your matches.",
        strip(
            "Routine: the line-up, personal best 54",
            [("name", "Line-up"), ("sep", ""), ("dim", "PB"), ("num", "54"), ("sep!", ""), ("dim!", "Streak"), ("num!", "6")],
            tag="Routine",
        ),
    )
    coach = """<div class="panel rv" style="--d:1">
            <p class="kicker">How the coach works</p>
            <div class="panel-row"><b>1</b><span><strong>Film a clip</strong>A few shots or a short break, on your phone.</span></div>
            <div class="panel-row"><b>2</b><span><strong>The coach watches it</strong>Stance, cue action, and what happened on the table.</span></div>
            <div class="panel-row"><b>3</b><span><strong>You get a plan</strong>What to work on first, and the routines that train it.</span></div>
            <p class="panel-note">Coaching is guidance, not a substitute for a qualified coach.</p>
          </div>"""
    return (
        hero
        + chapter(
            "Routines",
            "Every routine has a number to beat.",
            "Pick a routine and Snookered keeps the score for you: your best, your average and how it is trending. There is a leaderboard on every one, so you can see who has the best line-up in your group.",
            [
                "A library of routines for potting, safety, position and break-building",
                "Progress and a personal best for each routine",
                "A leaderboard on every routine",
                "Build your own on a table diagram and share it with a link or QR code",
            ],
            figure("routine", "A routine in Snookered, with progress and a leaderboard", "A routine and its progress."),
            anchor="routines",
        )
        + chapter(
            "Plans and streaks",
            "Know what to practise tonight.",
            "Set a goal and Snookered lays out your week: what to practise and for how long. Your home screen always shows the next session, and your streak keeps you coming back.",
            [
                "Weekly plans and goals",
                "The next session, ready to start in one tap",
                "Streaks and a week track of the days you played",
            ],
            figure("dashboard", "The home screen: the next session, the streak and this week", "The next session, one tap away."),
            alt=True,
            flip=True,
        )
        + chapter(
            "AI coach",
            "A coach that watches you play.",
            "Film yourself at the table and the AI coach watches the clip, then tells you what it saw, what to work on first, and which routines will help.",
            [
                "Feedback on the clip you filmed, not generic tips",
                "Routines picked for what it found",
                "Reviews included on every plan, more on paid plans",
            ],
            coach,
            anchor="coach",
        )
        + close("Chalk up.", "Snookered is coming to iPhone. Questions about routines or the coach? We read every message.")
    )


def community():
    hero = page_hero(
        "Community",
        "Your club, in your pocket.",
        "Play a friend and the match counts for both of you. Follow their matches live. Start a group for your league or your Tuesday night crowd.",
        strip(
            "Live now: You 2, Danny 1, best of 7",
            [("name", "You"), ("num", "2"), ("dim", "(7)"), ("num", "1"), ("name", "Danny")],
            tag="Live",
            live=True,
        ),
    )
    return (
        hero
        + chapter(
            "Friends",
            "Matches you both agree on.",
            "Add the friend you played and the match lands on both profiles once they confirm the score. No arguing about who won the last one: the head-to-head is right there.",
            [
                "Matches count for both players once confirmed",
                "Head-to-head records with everyone you play",
                "Message friends directly; others send a request first",
            ],
            figure("community", "Community in Snookered: friends, groups and the pro tour", "Friends, groups and the pro tour."),
            anchor="friends",
        )
        + chapter(
            "Live",
            "Follow the match from anywhere.",
            "When a friend scores a match live, you can follow it frame by frame: the score, the break they are on, and who is at the table.",
            [
                "Live scores from friends and your groups",
                "The current break and frame, as it happens",
                "Live sharing is off unless you turn it on",
            ],
            figure("live-match", "Following a friend's match live", "Following a match, live."),
            alt=True,
            flip=True,
        )
        + chapter(
            "Groups",
            "A home for your league.",
            "Start a group for your league, your club or the people you play every week. It gets its own chat, a feed of wins and centuries, leaderboards and pinned routines.",
            [
                "Group chat, and matches or routines sent straight into it",
                "A feed of results, personal bests and achievements",
                "Leaderboards and pinned routines for the whole group",
            ],
            figure("group", "A group in Snookered, with a member playing live and a feed of achievements", "Your league, with its own feed."),
            anchor="groups",
        )
        + f"""
      <section class="section alt">
        <div class="wrap">
          <div class="section-head rv"><h2>You stay in control.</h2></div>
          {facts([
            ("Who sees your stats", "Everyone, friends or nobody: you choose who sees your record, high break and centuries. You can stay out of search and leaderboards too."),
            ("Who can message you", "Friends can message you directly. Anyone else has to send a request you can accept or ignore."),
            ("Reporting", "Report a message, group or routine and it goes to a person for review."),
          ])}
        </div>
      </section>"""
        + close("Bring your club.", "Snookered is coming to iPhone. Want to set it up for your league? Tell us about it.")
    )


def plans():
    hero = page_hero(
        "Plans",
        "Start free. Go further when you want to.",
        "Every plan scores matches, runs routines and plays friends. The paid plans raise the limits and add the deeper tools.",
        strip("Three plans: Free, Half-Century and Century", [("name", "Free"), ("sep", ""), ("name", "50"), ("sep", ""), ("name", "100")], tag="Plans"),
    )
    rows = [
        ("Matches a month", "12", "40", "Unlimited"),
        ("Tournaments a month", "1", "4", "Unlimited"),
        ("AI coach reviews a month", "1", "8", "20"),
        ("Practice routines and sessions", "Yes", "Yes", "Yes"),
        ("The full routine library", "—", "Yes", "Yes"),
        ("Advanced tracking", "—", "Yes", "Yes"),
        ("Full analytics suite", "—", "—", "Yes"),
        ("Early access to new features", "—", "—", "Yes"),
    ]
    body = "".join(f'<tr><th scope="row">{r[0]}</th><td>{r[1]}</td><td>{r[2]}</td><td>{r[3]}</td></tr>' for r in rows)
    return (
        hero
        + f"""
      <section class="section">
        <div class="wrap">
          <div class="plan-grid">
            <article class="plan rv">
              <h3>Free</h3>
              <p class="plan-line">Track your practice and see where you stand.</p>
              <ul><li>12 matches a month</li><li>1 tournament a month</li><li>1 AI coach review a month</li><li>Practice routines and sessions</li></ul>
            </article>
            <article class="plan featured rv" style="--d:1">
              <p class="plan-tag">For weekly players</p>
              <h3>Half-Century</h3>
              <p class="plan-line">For players practising every week.</p>
              <ul><li>40 matches a month</li><li>4 tournaments a month</li><li>8 AI coach reviews a month</li><li>The full routine library and advanced tracking</li></ul>
            </article>
            <article class="plan rv" style="--d:2">
              <h3>Century</h3>
              <p class="plan-line">Everything, for players chasing centuries.</p>
              <ul><li>Unlimited matches</li><li>Unlimited tournaments</li><li>20 AI coach reviews a month</li><li>The full analytics suite and early access to new features</li></ul>
            </article>
          </div>
          <p class="note">Prices are shown in the App Store in your currency. Subscriptions are billed through your Apple account.</p>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head rv"><h2>Side by side.</h2></div>
          <div class="table-wrap rv">
            <table class="compare">
              <thead><tr><th scope="col"><span class="visually-hidden">Feature</span></th><th scope="col">Free</th><th scope="col" class="featured">Half-Century</th><th scope="col">Century</th></tr></thead>
              <tbody>{body}</tbody>
            </table>
          </div>
        </div>
      </section>

      <section class="section">
        <div class="wrap">
          <div class="section-head rv"><h2>Questions.</h2></div>
          <div class="faq">
            <details class="rv"><summary>How do I cancel?</summary><div><p>Any time, in your Apple account under Subscriptions. You keep your plan until the end of the period you paid for.</p></div></details>
            <details class="rv"><summary>When do the monthly limits reset?</summary><div><p>Once a month, on the same date each month.</p></div></details>
            <details class="rv"><summary>Can I change plan later?</summary><div><p>Yes. Upgrade or downgrade from the Plans screen in the app, or in your Apple account.</p></div></details>
            <details class="rv"><summary>Something wrong with a payment?</summary><div><p>Apple handles billing and refunds. For anything else, email <a href="mailto:{SUPPORT}">{SUPPORT}</a>.</p></div></details>
          </div>
        </div>
      </section>"""
        + close()
    )


def support():
    hero = page_hero(
        "Support",
        "Help is a message away.",
        "Questions about your account, a subscription, the AI coach or something not working? Email us and a person will reply.",
        strip("Support: email us", [("name", SUPPORT.split("@")[0]), ("dim!", "@snookeredapp.com")], tag="Email"),
    )
    return (
        hero
        + f"""
      <section class="section">
        <div class="wrap contact">
          <div class="contact-card main rv">
            <p class="kicker">Email</p>
            <h3>Get in touch</h3>
            <p>We aim to reply within two working days.</p>
            <a class="button" href="mailto:{SUPPORT}?subject=Snookered%20support">{SUPPORT}</a>
          </div>
          <div class="contact-card rv" style="--d:1">
            <p class="kicker">Helps us help you</p>
            <ul>
              <li>The email address on your account</li>
              <li>Your phone model and iOS version</li>
              <li>What happened, and what you expected</li>
              <li>A screenshot, if you can</li>
            </ul>
          </div>
        </div>
      </section>

      <section class="section alt">
        <div class="wrap">
          <div class="section-head rv"><h2>Common questions.</h2></div>
          <div class="faq">
            <details class="rv"><summary>I did not get my confirmation or reset email</summary><div><p>Check your spam or junk folder for an email from Snookered (hello@snookeredapp.com). Links work once and expire after an hour, so ask for a new one from the sign-in screen if it is old.</p></div></details>
            <details class="rv"><summary>How do I delete my account?</summary><div><p>In the app, go to Profile, then Settings, then Delete Account. It removes your account and its data. If you cannot sign in, email us from the address on the account.</p></div></details>
            <details class="rv"><summary>How do I cancel my subscription?</summary><div><p>Subscriptions are managed by Apple: open Settings on your iPhone, tap your name, then Subscriptions. See <a href="/plans">Plans</a> for more.</p></div></details>
            <details class="rv"><summary>A friend's match is not showing on my profile</summary><div><p>Matches with a friend count for both players once the other player confirms the score. Ask them to check their match requests.</p></div></details>
            <details class="rv"><summary>How do I report someone?</summary><div><p>Use Report on the message, group or routine. It goes to a person for review. For anything urgent, email us.</p></div></details>
            <details class="rv"><summary>Where is my data kept?</summary><div><p>See the <a href="/privacy">Privacy Policy</a> for what we collect, why, and the controls you have.</p></div></details>
          </div>
        </div>
      </section>"""
    )


def legal(name, title, intro):
    body = (SOURCE / f"{name}.body.html").read_text(encoding="utf8")
    body = "\n".join("        " + line if line.strip() else line for line in body.splitlines())
    return f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">Legal</p>
          <h1>{title}</h1>
          <p class="lead">{intro}</p>
          <p class="updated">Last updated: September 2026</p>
        </div>
      </section>
      <section class="section">
        <div class="wrap prose">
{body}
        </div>
      </section>"""


def not_found():
    return f"""
      <section class="page-hero">
        <div class="wrap">
          <p class="kicker">404</p>
          <h1>In off.</h1>
          <p class="lead">That page is not on the table. It may have moved, or the link may be wrong.</p>
          {strip("Foul: page not found", [("name", "Not found"), ("sep!", ""), ("dim!", "Foul"), ("num!", "4")], tag="404")}
          <div class="actions"><a class="button" href="/">Back to the home page</a></div>
        </div>
      </section>"""


PAGES = {
    "index.html": ("/", "Home", "Snookered is the all-in-one snooker app: score every frame live, practise with purpose, play your friends for real and follow the pro tour.", home),
    "scoring.html": ("/scoring", "Scoring", "Live snooker scoring ball by ball: points remaining, snookers required, fouls, breaks and a match overview you can share.", scoring),
    "practice.html": ("/practice", "Practice", "Snooker practice routines with personal bests and leaderboards, weekly plans and streaks, and an AI coach that watches you play.", practice),
    "community.html": ("/community", "Community", "Play friends in matches that count for both of you, follow their matches live, and run groups for your league or club.", community),
    "plans.html": ("/plans", "Plans", "Snookered plans: Free, Half-Century and Century. Compare matches, tournaments and AI coach reviews.", plans),
    "support.html": ("/support", "Support", "Get help with Snookered: your account, subscriptions, the AI coach and more.", support),
    "privacy.html": ("/privacy", "Privacy Policy", "What data Snookered collects, why, and the controls available to you.", lambda: legal("privacy", "Privacy Policy", "What data we collect, why we collect it, and the controls available to you.")),
    "terms.html": ("/terms", "Terms of Use", "The terms for using the Snookered app.", lambda: legal("terms", "Terms of Use", "The terms for using Snookered. Please read them before you use the app.")),
    "404.html": ("/404", "Page not found", "That page could not be found.", not_found),
}


def make_images():
    from PIL import Image, ImageFilter

    out = SITE / "screens" / "sized"
    out.mkdir(parents=True, exist_ok=True)
    for source in sorted((SITE / "screens").glob("*.png")):
        image = Image.open(source).convert("RGB")
        for width in WIDTHS:
            height = round(image.height * width / image.width)
            sized = image.resize((width, height), Image.LANCZOS).filter(ImageFilter.UnsharpMask(radius=0.6, percent=60, threshold=2))
            sized.save(out / f"{source.stem}-{width}.webp", "WEBP", quality=86, method=6)
        print("sized", source.stem)


def main():
    if "--images" in sys.argv:
        make_images()
    for filename, (path, title, description, build) in PAGES.items():
        html = layout(path, title, description, build(), noindex=filename == "404.html")
        (SITE / filename).write_text(html, encoding="utf8")
        print("wrote", filename)
    sitemap = "".join(
        f"<url><loc>https://snookeredapp.com{path if path != '/' else '/'}</loc></url>"
        for filename, (path, *_rest) in PAGES.items()
        if filename != "404.html"
    )
    (SITE / "sitemap.xml").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{sitemap}</urlset>\n',
        encoding="utf8",
    )
    (SITE / "robots.txt").write_text("User-agent: *\nAllow: /\nSitemap: https://snookeredapp.com/sitemap.xml\n", encoding="utf8")


if __name__ == "__main__":
    main()
