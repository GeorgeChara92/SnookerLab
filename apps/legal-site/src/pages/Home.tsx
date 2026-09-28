import { useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Medal, Newspaper, ScanLine, Trophy, Users, WifiOff } from "lucide-react";
import { Phone } from "../components/Phone";
import { LiveBoard } from "../components/Scoreboard";
import { Scorer } from "../components/Scorer";
import { ScanDemo } from "../components/Showcase";
import { AppTour, CoreLoop, LaunchList } from "../components/Tour";
import { AppleLogo, Arrow, Reveal } from "../components/Blocks";
import { PLANS, type Screen } from "../site";

function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const lift = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : -60]);
  const sink = useTransform(scrollYProgress, [0, 1], [0, reduced ? 0 : 40]);

  return (
    <section className="hero" ref={ref}>
      <div className="wrap hero-grid">
        <div className="hero-copy">
          <Reveal>
            <p className="eyebrow">The snooker app</p>
            <h1 className="display-xl">
              Your snooker, <span className="hero-accent">from your first cue to your best break.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Practise with a point to it, get coaching from your own game or book a real coach, score the matches once
              you're playing them, and play the people you know. Wherever you are with the game, Snookered is built to help
              you get better at it.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="hero-actions">
            <a className="btn btn-primary hero-cta" href="#launch">
              <AppleLogo />
              Coming soon to iPhone
            </a>
            <a className="btn btn-ghost" href="#inside">
              Explore the app <Arrow />
            </a>
          </Reveal>
        </div>

        <div className="hero-stage">
          <div className="hero-panel dark">
            <div className="hero-cloth" aria-hidden="true" />
            <motion.div className="hero-phone back" style={{ y: sink }}>
              <Phone screen="routine" alt="" sizes="(max-width: 860px) 42vw, 250px" />
            </motion.div>
            <motion.div className="hero-phone front" style={{ y: lift }}>
              <motion.div
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ type: "spring", duration: 0.9, bounce: 0, delay: 0.1 }}
              >
                <Phone
                  screen="dashboard"
                  alt="The Snookered home screen: the next session, your streak and form, and this week"
                  sizes="(max-width: 860px) 52vw, 290px"
                  eager
                />
              </motion.div>
            </motion.div>
          </div>
          <motion.div
            className="hero-board"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", duration: 0.8, bounce: 0, delay: 0.35 }}
          >
            <LiveBoard />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function Feature({
  id,
  eyebrow,
  title,
  body,
  points,
  visual,
  link,
  tone = "",
  flip,
  soon,
  extra,
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points?: string[];
  visual: ReactNode;
  link: { to: string; label: string };
  tone?: "" | "alt" | "dark";
  flip?: boolean;
  soon?: boolean;
  extra?: ReactNode;
}) {
  return (
    <section className={`section feature ${tone}`} id={id}>
      <div className={`wrap feature-grid ${flip ? "flip" : ""}`}>
        <Reveal className="feature-copy">
          <p className="eyebrow">
            {eyebrow}
            {soon && <span className="soon">In development</span>}
          </p>
          <h2 className="display-l">{title}</h2>
          <p className="lead">{body}</p>
          {points && (
            <ul className="feature-points">
              {points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          )}
          {extra}
          <Link className="btn btn-primary" to={link.to}>
            {link.label} <Arrow />
          </Link>
        </Reveal>
        <Reveal delay={0.1} className="feature-visual">
          {visual}
        </Reveal>
      </div>
    </section>
  );
}

function Scoring() {
  return (
    <section className="section dark have-a-go" id="scoring">
      <div className="wrap have-grid">
        <Reveal className="have-copy">
          <p className="eyebrow">Live scoring · have a go</p>
          <h2 className="display-l">Tap the ball. That is it.</h2>
          <p className="lead">
            Snookered keeps the score, the break and the points left on the table, knows when snookers are needed, and settles
            the frame when it is done. Have a go yourself.
          </p>
          <div className="offline-note">
            <WifiOff aria-hidden="true" strokeWidth={1.75} />
            <p>
              <strong>Works where your Wi-Fi doesn't.</strong> Club basements are not known for their signal. Scores save on
              your phone and sync when you are back online.
            </p>
          </div>
          <Link className="btn btn-ghost" to="/scoring">
            More on scoring <Arrow />
          </Link>
        </Reveal>
        <Reveal delay={0.1}>
          <Scorer />
        </Reveal>
      </div>
    </section>
  );
}

const SECONDARY: { icon: typeof Trophy; title: string; body: string; to?: string; soon?: boolean }[] = [
  { icon: Trophy, title: "Tournaments", body: "Knockouts and leagues for your club, with the draw, fixtures and results kept for you." },
  { icon: ScanLine, title: "Scan a Snooker", body: "Scan the table before a snooker, then put every ball back in AR after a miss.", to: "/scan-snooker", soon: true },
  { icon: Users, title: "Groups and boards", body: "A group for your league, with chat, a feed of results and pinned routines.", to: "/community" },
  { icon: Newspaper, title: "Pro tour news", body: "The latest from the World Snooker Tour and BBC Sport, next to your own game." },
  { icon: Medal, title: "Achievements", body: "Level up for the things that matter: centuries, streaks, wins and practice." },
  { icon: WifiOff, title: "Offline scoring", body: "Frames save on the phone and sync later, so a dead signal never stops a match." },
];

function Secondary() {
  return (
    <section className="section tight alt">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">More for your game</p>
            <h2 className="display-l">And there’s more.</h2>
          </div>
          <p className="lead">The parts you meet once you are in: club nights, your league, and the bits that make a season.</p>
        </Reveal>
        <div className="extras">
          {SECONDARY.map((item, index) => {
            const inner = (
              <>
                <span className="extra-icon">
                  <item.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3>
                  {item.title}
                  {item.soon && <span className="soon">In development</span>}
                </h3>
                <p>{item.body}</p>
                {item.to && (
                  <span className="bento-go">
                    Read more <Arrow />
                  </span>
                )}
              </>
            );
            return (
              <Reveal key={item.title} delay={(index % 3) * 0.05} className="extra">
                {item.to ? (
                  <Link to={item.to} className="extra-link">
                    {inner}
                  </Link>
                ) : (
                  inner
                )}
              </Reveal>
            );
          })}
        </div>
        <div className="plan-strip">
          {PLANS.map((plan) => (
            <Link key={plan.name} to="/plans" className={plan.tag ? "featured" : ""}>
              <b>{plan.name}</b>
              <span>{plan.items[0]}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

const GALLERY: { screen: Screen; alt: string; caption: string }[] = [
  { screen: "match-overview", alt: "A match overview with the scoreboard, high breaks and match statistics", caption: "Every match, frame by frame." },
  { screen: "routine-builder", alt: "The routine builder, with balls placed on a table diagram", caption: "Build the routine you need." },
  { screen: "share-card", alt: "The share card for a result, leading with a 77 break", caption: "A result card led by the big moment." },
  { screen: "tournament", alt: "A tournament bracket: quarter-finals and semi-finals", caption: "Club knockouts, drawn for you." },
  { screen: "chat", alt: "A group chat, sorting out who's playing when", caption: "Your club, in one thread." },
  { screen: "live-match", alt: "Following a friend's match live", caption: "Friends' matches, followed live." },
];

function Gallery() {
  return (
    <section className="section tight gallery-section">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">A look around.</h2>
          <p className="lead">Scroll along for the screens you meet once you are playing.</p>
        </Reveal>
      </div>
      <div className="gallery" tabIndex={0} aria-label="More screens from the app">
        {GALLERY.map((item) => (
          <div key={item.screen} className="gallery-item">
            <Phone screen={item.screen} alt={item.alt} sizes="(max-width: 860px) 62vw, 250px" />
            <p>{item.caption}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <AppTour />
      <CoreLoop />
      <Feature
        id="practice"
        tone="alt"
        flip
        eyebrow="Practice"
        title="Practice with a point to it."
        body="Build a routine around the part of your game that needs it, or run one from the library. Each has a score to beat, your progress over time, and a leaderboard."
        points={[
          "Place the balls yourself and set the target",
          "A personal best and progress on every routine",
          "A weekly plan and a streak, so you know what tonight is for",
        ]}
        visual={
          <Phone
            screen="routine-builder"
            alt="The routine builder: balls placed on a table diagram, with the ball palette below"
            sizes="(max-width: 900px) 74vw, 300px"
          />
        }
        link={{ to: "/practice", label: "Explore practice" }}
      />
      <Feature
        id="coach"
        eyebrow="AI Coach"
        title="Turn your game into feedback."
        body="Film a few shots, upload the clip, and get a report on your technique: what is working, the one thing to fix first, and the routines that train it."
        points={[
          "Feedback on your own clip, with the moments it means",
          "One clear thing to work on, not a list of twenty",
          "Reports kept, so you can watch the fix stick",
        ]}
        visual={
          <Phone
            screen="ai-coach"
            alt="A coaching report: technique, what went well and what to work on"
            sizes="(max-width: 900px) 74vw, 300px"
          />
        }
        link={{ to: "/coach", label: "See how the coach works" }}
      />
      <Feature
        id="find-a-coach"
        tone="dark"
        flip
        eyebrow="Find a Coach"
        title="Or learn from someone who's been there."
        body="Search for a coach near you and book a session in a couple of taps. Ready to start coaching yourself? List your own hours and run your own diary - even a client with no account goes straight on the calendar."
        points={[
          "A coach's bio, gallery and qualifications, shown before you book",
          "WPBSA accreditation shown too, for coaches who have it",
          "Walk-ins welcome: no account needed for a one-off booking",
        ]}
        visual={
          <Phone
            screen="coach-profile"
            alt="A coach's profile, with bio, gallery and a Book a session button"
            sizes="(max-width: 900px) 74vw, 300px"
          />
        }
        link={{ to: "/find-a-coach", label: "Find a coach" }}
      />
      <Scoring />
      <Feature
        id="community"
        tone="alt"
        eyebrow="Community"
        title="Play the people you know."
        body="Add the friend you played and the match counts for both of you once they confirm it. Follow their frames live, and run a group for your league with its own chat, feed and leaderboards."
        points={[
          "Matches that count for both players",
          "Live scores from friends and your groups",
          "Messages and group feeds stay inside that chat or group",
        ]}
        visual={
          <div className="phones-duo">
            <Phone screen="community" alt="The Community tab, with a friend's match live and the latest pro tour news" sizes="(max-width: 860px) 42vw, 250px" />
            <Phone screen="group" alt="A club group's feed, with a personal best and a win" sizes="(max-width: 860px) 42vw, 250px" />
          </div>
        }
        link={{ to: "/community", label: "Explore community" }}
      />
      <Feature
        id="stats"
        flip
        eyebrow="Stats"
        title="The numbers that actually matter."
        body="Form over your recent matches, your practice week by week, high breaks and head-to-heads. Enough to tell whether you are playing better than last month, without wading through charts."
        visual={
          <Phone screen="stats" alt="The stats screen: this week, form and practice rhythm" sizes="(max-width: 900px) 74vw, 300px" />
        }
        link={{ to: "/scoring", label: "More on matches and stats" }}
      />
      <Feature
        id="scan"
        tone="dark"
        eyebrow="Scan a Snooker · AR"
        soon
        title="Put the balls back, like the referees on TV."
        body="Scan the table before you play the snooker. If the escape misses, a ghost of every ball appears on the real table, so everything goes back exactly where it was."
        points={[
          "Calibrates from any two spots or pockets",
          "A table diagram to check and tweak the scan",
          "The same camera sets a routine up, ball by ball",
        ]}
        visual={<ScanDemo />}
        link={{ to: "/scan-snooker", label: "How it works" }}
      />
      <Gallery />
      <Secondary />
      <LaunchList />
    </>
  );
}
