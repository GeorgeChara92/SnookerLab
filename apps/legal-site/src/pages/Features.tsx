import { Eye, Flag, MessageCircle, Search } from "lucide-react";
import { Cta, FeatureStory, PageHero, Reveal, Strip, type Story } from "../components/Blocks";

const Sep = () => <i className="strip-sep" aria-hidden="true" />;

export function Scoring() {
  const stories: Story[] = [
    {
      id: "live",
      kicker: "At the table",
      title: "Tap the ball. That is it.",
      body: "Scoring is built for a cue in one hand and a phone in the other. Big targets for every colour, the points on the table always in view, and fouls and re-racks one tap away.",
      points: [
        "Points remaining and snookers required, worked out as you go",
        "Fouls, misses and re-racks, without a rule book",
        "Just the result, if you only want the frame score",
        "Scores save without signal and sync later",
      ],
      screen: "live-scoring",
      alt: "Live scoring in Snookered, mid-frame",
    },
    {
      id: "overview",
      kicker: "After the match",
      title: "The match, told properly.",
      body: "The moment the last frame ends you get the whole story: the frame-by-frame scores, the high breaks and the numbers that decided it.",
      points: [
        "Frame-by-frame scores and the high breaks",
        "Personal bests and centuries picked out automatically",
        "Head-to-head records against everyone you play",
      ],
      screen: "match-overview",
      alt: "A match overview: the scoreboard, high breaks and match statistics",
    },
    {
      id: "share",
      kicker: "Share it",
      title: "Lead with the big moment.",
      body: "A result card worth posting. It leads with whatever mattered most, whether that was the century, the clearance or the comeback from two frames down.",
      points: ["One tap to share to your group, a chat or anywhere else", "Designed to look right in a feed or a message"],
      screen: "share-card",
      alt: "The share card for a result, leading with a 77 break",
    },
    {
      id: "stats",
      kicker: "Stats",
      title: "Numbers that mean something.",
      body: "Your form, your practice rhythm and your high breaks, laid out so you can see at a glance whether you are playing better than last month.",
      points: ["Form over your recent matches", "Your week of practice, day by day", "High breaks and averages that update as you play"],
      screen: "stats",
      alt: "The Stats screen: this week, form and practice rhythm",
    },
  ];
  return (
    <>
      <PageHero
        eyebrow="Scoring"
        title="Every frame, ball by ball."
        lead="Tap the balls as they go down. Snookered keeps the score, the breaks and the fouls, knows when snookers are needed, and settles the frame when it is done."
        strip={
          <Strip label="Scoreboard: You 3, Danny 1, best of 7, current break 64" tag="Frame 5">
            <span className="strip-name">You</span>
            <span className="strip-num">3</span>
            <span className="strip-dim">(7)</span>
            <span className="strip-num">1</span>
            <span className="strip-name">Danny</span>
            <Sep />
            <span className="strip-dim hide-sm">Break</span>
            <span className="strip-num hide-sm">64</span>
          </Strip>
        }
      />
      <FeatureStory stories={stories} />
      <Cta title="Rack them up." body="Snookered is coming to iPhone. Want to know when it lands, or have a question about scoring? Get in touch." />
    </>
  );
}

function CoachSteps() {
  const steps = [
    ["Film a clip", "A few shots or a short break, on your phone."],
    ["The coach watches it", "Stance, cue action, and what happened on the table."],
    ["You get a plan", "What to work on first, and the routines that train it."],
  ];
  return (
    <div className="coach">
      <p className="coach-title">How the coach works</p>
      <ol>
        {steps.map(([title, body], index) => (
          <li key={title}>
            <span className="coach-step num">{index + 1}</span>
            <span>
              <strong>{title}</strong>
              {body}
            </span>
          </li>
        ))}
      </ol>
      <p className="coach-note">Coaching is guidance, not a substitute for a qualified coach.</p>
    </div>
  );
}

export function Practice() {
  const stories: Story[] = [
    {
      id: "routines",
      kicker: "Routines",
      title: "Every routine has a number to beat.",
      body: "Pick a routine and Snookered keeps the score for you: your best, your average and how it is trending. There is a leaderboard on every one, so you can see who has the best line-up in your group.",
      points: [
        "Routines for potting, safety, position and break-building",
        "Progress and a personal best for each routine",
        "A leaderboard on every routine",
        "Build your own on a table diagram and share it with a link or QR code",
      ],
      screen: "routine",
      alt: "A routine in Snookered, with progress and a leaderboard",
    },
    {
      id: "plans",
      kicker: "Plans and streaks",
      title: "Know what to practise tonight.",
      body: "Set a goal and Snookered lays out your week: what to practise and for how long. Your home screen always shows the next session, and your streak keeps you coming back.",
      points: ["Weekly plans and goals", "The next session, ready to start in one tap", "Streaks and a week track of the days you played"],
      screen: "dashboard",
      alt: "The home screen: the next session, the streak and this week",
    },
    {
      id: "coach",
      kicker: "AI coach",
      title: "A coach that watches you play.",
      body: "Film yourself at the table and the AI coach watches the clip, then tells you what it saw, what to work on first, and which routines will help.",
      points: ["Feedback on the clip you filmed, not generic tips", "Routines picked for what it found", "Reviews on every plan, more on paid plans"],
      visual: <CoachSteps />,
    },
  ];
  return (
    <>
      <PageHero
        eyebrow="Practice"
        title="Practice with a point to it."
        lead="A library of proper routines, from the line-up to the colours, each with its own progress and personal best. Plan the week, keep a streak going, and see it pay off in your matches."
        strip={
          <Strip label="Routine: the line-up, personal best 54" tag="Routine">
            <span className="strip-name">Line-up</span>
            <Sep />
            <span className="strip-dim">PB</span>
            <span className="strip-num">54</span>
            <Sep />
            <span className="strip-dim hide-sm">Streak</span>
            <span className="strip-num hide-sm">6</span>
          </Strip>
        }
      />
      <FeatureStory stories={stories} />
      <Cta title="Chalk up." body="Snookered is coming to iPhone. Questions about routines or the coach? We read every message." />
    </>
  );
}

const CONTROLS = [
  {
    icon: Eye,
    title: "Who sees your stats",
    body: "Everyone, friends or nobody: you choose who sees your record, high break and centuries.",
  },
  {
    icon: Search,
    title: "Search and leaderboards",
    body: "Stay out of search so only people you add can find you, and choose whether you appear on leaderboards.",
  },
  {
    icon: MessageCircle,
    title: "Who can message you",
    body: "Friends message you directly. Anyone else sends a request you can accept or ignore.",
  },
  { icon: Flag, title: "Reporting", body: "Report a message, group or routine and it goes to a person for review." },
];

export function Community() {
  const stories: Story[] = [
    {
      id: "friends",
      kicker: "Friends",
      title: "Matches you both agree on.",
      body: "Add the friend you played and the match lands on both profiles once they confirm the score. No more arguing about who won the last one: the head-to-head is right there.",
      points: [
        "Matches count for both players once confirmed",
        "Head-to-head records with everyone you play",
        "Pro tour news from the WST and BBC Sport",
      ],
      screen: "community",
      alt: "Community in Snookered: friends, groups and the pro tour",
    },
    {
      id: "live",
      kicker: "Live",
      title: "Follow the match from anywhere.",
      body: "When a friend scores a match live, you can follow it frame by frame: the score, the break they are on, and who is at the table.",
      points: ["Live scores from friends and your groups", "The current break and frame, as it happens", "Live sharing is off unless you turn it on"],
      screen: "live-match",
      alt: "Following a friend's match live",
    },
    {
      id: "groups",
      kicker: "Groups",
      title: "A home for your league.",
      body: "Start a group for your league, your club or the people you play every week. It gets its own chat, a feed of wins and centuries, leaderboards and pinned routines.",
      points: [
        "Group chat, with matches and routines sent straight into it",
        "A feed of results, personal bests and achievements",
        "Leaderboards and pinned routines for the whole group",
      ],
      screen: "group",
      alt: "A group with a member playing live and a feed of achievements",
    },
  ];
  return (
    <>
      <PageHero
        eyebrow="Community"
        title="Your club, in your pocket."
        lead="Play a friend and the match counts for both of you. Follow their matches live. Start a group for your league or your Tuesday night crowd."
        strip={
          <Strip label="Live now: You 2, Danny 1, best of 7" tag="Live" live>
            <span className="strip-name">You</span>
            <span className="strip-num">2</span>
            <span className="strip-dim">(7)</span>
            <span className="strip-num">1</span>
            <span className="strip-name">Danny</span>
          </Strip>
        }
      />
      <FeatureStory stories={stories} />
      <section className="section alt">
        <div className="wrap">
          <Reveal className="section-head">
            <h2 className="display-l">You stay in control.</h2>
            <p className="lead">Privacy settings live in the app, and they are yours to change at any time.</p>
          </Reveal>
          <div className="controls">
            {CONTROLS.map((control, index) => (
              <Reveal key={control.title} delay={index * 0.06} className="control">
                <span className="extra-icon">
                  <control.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3>{control.title}</h3>
                <p>{control.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <Cta title="Bring your club." body="Snookered is coming to iPhone. Want to set it up for your league? Tell us about it." />
    </>
  );
}
