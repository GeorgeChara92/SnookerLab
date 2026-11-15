import { useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { WifiOff } from "lucide-react";
import { Phone } from "../components/Phone";
import { LiveBoard } from "../components/Scoreboard";
import { Scorer } from "../components/Scorer";
import { AppTour, LaunchList } from "../components/Tour";
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
            <p className="eyebrow">Your whole snooker game</p>
            <h1 className="display-xl">
              Your game. <span className="hero-accent">All in one place.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Score your matches, and put the balls back properly after a miss. Practise with a plan and track how you're
              improving. When you want more, get feedback on your own game, book a coach, or take on your mates.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="hero-actions">
            <a className="btn btn-primary hero-cta" href="#launch">
              <AppleLogo />
              Coming soon to iPhone
            </a>
            <a className="btn btn-ghost" href="#film">
              Watch the film <Arrow />
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

function More() {
  return (
    <section className="section tight alt">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">Plans</p>
            <h2 className="display-l">Free to start.</h2>
          </div>
          <p className="lead">
            Every routine, guide and video, the Pro Tour and the community are free for everyone. Pay only if you want more
            matches, coach reviews and recorded snookers.
          </p>
        </Reveal>
        <div className="plan-strip">
          {PLANS.map((plan) => (
            <Link key={plan.name} to="/plans" className={plan.tag ? "featured" : ""}>
              <b>{plan.name}</b>
              <span>{plan.items[0]}</span>
            </Link>
          ))}
        </div>
        <p className="all-features">
          <Link className="btn btn-ghost" to="/features">
            See every feature <Arrow />
          </Link>
        </p>
      </div>
    </section>
  );
}

const GALLERY: { screen: Screen; alt: string; caption: string }[] = [
  { screen: "match-overview", alt: "A match overview with the scoreboard, high breaks and match statistics", caption: "Every match, frame by frame." },
  { screen: "routine-builder", alt: "The routine builder, with balls placed on a table diagram", caption: "Build the routine you need." },
  { screen: "share-card", alt: "The share card for a win with three 50+ breaks, on the gold Century background", caption: "A result card led by the big moment." },
  { screen: "rules", alt: "The rules of snooker in the app: ball values and what a foul costs", caption: "The rules, in plain English." },
  { screen: "guide", alt: "A guide to stance and balance, with a photo and the write-up", caption: "Guides to the fundamentals." },
  { screen: "tournament", alt: "A tournament bracket: quarter-finals and semi-finals", caption: "Club knockouts, drawn for you." },
  { screen: "chat", alt: "A group chat, sorting out who's playing when", caption: "Your club, in one thread." },
  { screen: "live-match", alt: "Following a friend's match live", caption: "Friends' matches, followed live." },
  { screen: "player-season", alt: "A pro player's season: won-lost, form, coming up and recent results", caption: "Every pro's season so far." },
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

/** The 25-second film: a poster and a play button until it's wanted, so it costs nothing to load. */
function Film() {
  const [playing, setPlaying] = useState(false);
  return (
    <section className="section tight" id="film">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">See it in action</p>
            <h2 className="display-l">Snookered in 25 seconds.</h2>
          </div>
          <p className="lead">Live scoring, practice, AR at the table and the coaching side, in one short film.</p>
        </Reveal>
        <Reveal delay={0.08}>
          <div className="film">
            {playing ? (
              <video controls autoPlay playsInline poster="/media/snookered-film-poster.webp" preload="auto">
                <source src="/media/snookered-film-720.mp4" type="video/mp4" media="(max-width: 860px)" />
                <source src="/media/snookered-film.mp4" type="video/mp4" />
              </video>
            ) : (
              <>
                <img src="/media/snookered-film-poster.webp" alt="" width={1280} height={720} loading="lazy" decoding="async" />
                <button type="button" className="film-play" onClick={() => setPlaying(true)} aria-label="Play the Snookered film, 25 seconds, with sound">
                  <span>
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.6-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
                    </svg>
                    Watch the film
                  </span>
                </button>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Film />
      <AppTour />
      <Scoring />
      <Feature
        id="record"
        tone="alt"
        eyebrow="Record a Snooker · new to club snooker"
        title="Put the balls back. Exactly."
        body="With no referee, replacing the balls after a foul and a miss is guesswork, and it decides frames. Walk round the table before you play the snooker and the camera finds every ball. After the miss, a ring on the cloth shows where each one goes back, and tells you when it's right."
        points={[
          "One tap from live scoring",
          "Each ball gets a ring as it's found",
          "Tells you when every ball is back in place",
        ]}
        visual={
          <Phone
            screen="record-snooker"
            alt="Record a Snooker in the camera, with a ring on each ball as it's found and the count of balls found"
            sizes="(max-width: 900px) 74vw, 300px"
          />
        }
        link={{ to: "/record-snooker", label: "How Record a Snooker works" }}
      />
      <Feature
        id="practice"
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
        tone="dark"
        eyebrow="Snookered Coach"
        title="Turn your game into feedback."
        body="Film a few shots, upload the clip, and get a report on your technique: what is working, the one thing to fix first, and the routines that train it."
        points={[
          "Feedback on your own clip, not a chat about snooker in general",
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
        extra={
          <p className="note">
            Prefer a real person? <Link to="/find-a-coach">Find a coach</Link> near you.
          </p>
        }
      />
      <Feature
        id="stats"
        tone="alt"
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
        id="community"
        eyebrow="Community & Competition"
        title="Play the people you know."
        body="Add the friend you played and the match counts for both of you once they confirm it. Follow their frames live, enter a knockout, or run a group for your league with its own chat, feed and leaderboards."
        points={[
          "Matches that count for both players",
          "Live scores from friends and your groups",
          "Tournaments and leagues, drawn and run for you",
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
        id="pro-tour"
        tone="dark"
        flip
        eyebrow="Pro Tour"
        title="The pro tour, live in your pocket."
        body="Live scores, fixtures and results from every professional tournament, in your own time zone. The full draw and bracket, money rankings, a profile for every player, and a notification when the players you follow start and finish."
        points={[
          "Every session time shown in your local time",
          "A link to watch, where the match is streamed",
          "Follow players and get notified when they're on",
        ]}
        visual={
          <div className="phones-duo">
            <Phone screen="pro-tour-bracket" alt="A live tournament: the final's score and the bracket from the quarter-finals" sizes="(max-width: 860px) 42vw, 250px" />
            <Phone screen="rankings" alt="The money rankings, with the top three on a podium" sizes="(max-width: 860px) 42vw, 250px" />
          </div>
        }
        link={{ to: "/pro-tour", label: "Explore the pro tour" }}
      />
      <Feature
        id="for-coaches"
        tone="alt"
        eyebrow="Coaching"
        title="A better way to coach."
        body="Run your coaching like a proper diary, not just a booking inbox: manage every client, keep private notes on each session, and post drills to everyone at once."
        points={[
          "Every coach reviewed by hand before they can take a booking",
          "Book a slot for a walk-in - no account needed",
          "One post reaches the whole group, not one at a time",
        ]}
        visual={
          <Phone
            screen="coach-dashboard"
            alt="A coach's dashboard in Snookered, showing the next session and sessions this month"
            sizes="(max-width: 900px) 74vw, 300px"
          />
        }
        link={{ to: "/coaching", label: "Find a coach, or coach yourself" }}
      />
      <Gallery />
      <More />
      <LaunchList />
    </>
  );
}
