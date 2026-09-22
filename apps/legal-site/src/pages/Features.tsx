import { Eye, Flag, MessageCircle, Search } from "lucide-react";
import { Phone } from "../components/Phone";
import { LiveBoard } from "../components/Scoreboard";
import { ArRoutineDemo, RoutineBuilderDemo } from "../components/Showcase";
import { Cta, FeatureStory, PageHero, Reveal, Strip, type Story } from "../components/Blocks";

const Sep = ({ hide }: { hide?: boolean }) => <i className={`strip-sep ${hide ? "hide-sm" : ""}`} aria-hidden="true" />;

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
            <Sep hide />
            <span className="strip-dim hide-sm">Break</span>
            <span className="strip-num hide-sm">64</span>
          </Strip>
        }
        aside={<LiveBoard />}
      />
      <FeatureStory stories={stories} />
      <Cta title="Rack them up." body="Snookered is coming to iPhone. Want to know when it lands, or have a question about scoring? Get in touch." />
    </>
  );
}

export function Practice() {
  const stories: Story[] = [
    {
      id: "builder",
      kicker: "Routine builder",
      title: "Build the routine you need.",
      body: "Place the balls where you want them on a full-size table, zoom in to get them exact, then name the routine and set a score to aim for. Every change can be undone, and nothing is lost if you step back to the table.",
      points: [
        "Place any ball anywhere, with the app keeping the layout legal",
        "Set a target score so there is always a number to beat",
        "Share it with a link or a QR code, or pin it to your group",
        "Set it up on the real table with AR",
      ],
      screen: "routine-builder",
      alt: "The routine builder: balls placed on a table diagram, with the ball palette below",
    },
    {
      id: "routines",
      kicker: "Routines",
      title: "Every routine has a number to beat.",
      body: "A library of proper routines, from the line-up to the colours. Snookered keeps your best, your average and how it is trending, and there is a leaderboard on every one.",
      points: [
        "Routines for potting, safety, position and break-building",
        "Progress and a personal best for each",
        "A leaderboard on every routine",
        "Browse what other players have built and shared",
      ],
      screen: "routine",
      alt: "A routine in Snookered, with progress and a leaderboard",
    },
    {
      id: "ar",
      kicker: "AR set-up",
      title: "Laid out on the real table.",
      body: "Point the camera at the table and every ball of the routine gets a ghost on the cloth, so a fifteen-ball layout takes seconds. This part is still in development.",
      points: ["Ghosts show where each ball goes", "Works with the routines you build", "The table diagram works without the camera"],
      visual: <ArRoutineDemo />,
    },
    {
      id: "coach",
      kicker: "AI coach",
      title: "A coach that watches you play.",
      body: "Film a few shots or a short break and upload it. The coach watches the clip, points to the moments that matter, tells you what to work on first, and picks the routines that train it.",
      points: [
        "Feedback on your own clip, with the times it happened",
        "One clear thing to fix first, not a list of twenty",
        "Routines chosen for what it found",
        "Reviews on every plan, more on the paid ones",
      ],
      screen: "ai-coach",
      alt: "An AI coach report: technique, what went well and what to work on",
    },
    {
      id: "plans",
      kicker: "Plans and streaks",
      title: "Know what to practise tonight.",
      body: "Set a goal and Snookered lays out your week: what to practise and for how long. Your home screen shows the next session, and the streak keeps you honest.",
      points: ["Weekly plans and goals", "The next session, ready to start in one tap", "A week track of the days you played"],
      screen: "dashboard",
      alt: "The home screen: the next session, the streak and this week",
    },
  ];
  return (
    <>
      <PageHero
        eyebrow="Practice"
        title="Practice with a point to it."
        lead="Build your own routines, run the ones that suit your game, and get a coach to watch you play. Every session counts towards a number you can see."
        strip={
          <Strip label="Routine: the line-up, personal best 54" tag="Routine">
            <span className="strip-name">Line-up</span>
            <Sep />
            <span className="strip-dim">PB</span>
            <span className="strip-num">54</span>
            <Sep hide />
            <span className="strip-dim hide-sm">Streak</span>
            <span className="strip-num hide-sm">6</span>
          </Strip>
        }
        aside={<RoutineBuilderDemo />}
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
        aside={
          <div className="phones-duo">
            <Phone screen="community" alt="Community: friends, groups and the pro tour" sizes="(max-width: 900px) 42vw, 220px" />
            <Phone screen="chat" alt="A group chat, with the league sorting out fixtures" sizes="(max-width: 900px) 42vw, 220px" />
          </div>
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
