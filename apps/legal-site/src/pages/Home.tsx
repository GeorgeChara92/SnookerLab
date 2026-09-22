import { useRef, type ReactNode } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Bot, ChartNoAxesColumn, Lock, Newspaper, PencilRuler, ScanLine, Trophy, Users, View, WifiOff } from "lucide-react";
import { Phone } from "../components/Phone";
import { LiveBoard } from "../components/Scoreboard";
import { Scorer } from "../components/Scorer";
import { ScanDemo } from "../components/Showcase";
import { AppleLogo, Arrow, Cta, Reveal } from "../components/Blocks";
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
            <p className="hero-badge">
              <span className="dot" />
              Coming soon to iPhone
            </p>
            <h1 className="display-xl">
              Your snooker, <span className="hero-accent">on the scoreboard.</span>
            </h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead">
              Build the routines you need, get coached from a clip of your own game, and put the balls back after a miss with
              AR. Plus ball-by-ball scoring and matches with your friends that count for both of you.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="hero-actions">
            <span className="store" aria-label="Coming soon to the App Store">
              <AppleLogo />
              <span>
                <small>Coming soon to</small>the App Store
              </span>
            </span>
            <a className="btn btn-ghost" href="#standouts">
              What makes it different <Arrow />
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

const STANDOUTS = [
  { href: "#builder", icon: PencilRuler, title: "Routine builder", body: "Place the balls, set a target, share it with a QR code." },
  { href: "#scan", icon: ScanLine, title: "Scan Snooker", body: "Record a snooker, then put every ball back in AR after a miss.", soon: true },
  { href: "#scan", icon: View, title: "AR set-up", body: "Ghosts on the real table show where each ball of a routine goes.", soon: true },
  { href: "#coach", icon: Bot, title: "AI coach", body: "It watches a clip of you playing and says what to fix first." },
  { href: "#community", icon: Users, title: "Your club", body: "Matches that count for both players, groups and live scores." },
];

function Standouts() {
  return (
    <section className="standouts dark" id="standouts">
      <div className="wrap">
        <Reveal className="standouts-head">
          <p className="eyebrow">What sets it apart</p>
          <h2 className="display-l">More than a scoreboard.</h2>
        </Reveal>
        <div className="standout-grid">
          {STANDOUTS.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.05}>
              <a className="standout" href={item.href}>
                <span className="standout-icon">
                  <item.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3>
                  {item.title}
                  {item.soon && <span className="soon">In development</span>}
                </h3>
                <p>{item.body}</p>
              </a>
            </Reveal>
          ))}
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
}: {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  points: string[];
  visual: ReactNode;
  link: { to: string; label: string };
  tone?: "" | "alt" | "dark";
  flip?: boolean;
  soon?: boolean;
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
          <ul className="feature-points">
            {points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
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

function Community() {
  return (
    <section className="section feature alt" id="community">
      <div className="wrap feature-grid flip">
        <Reveal className="feature-copy">
          <p className="eyebrow">Your club, in your pocket</p>
          <h2 className="display-l">Play the people you know.</h2>
          <p className="lead">
            Add the friend you played and the match counts for both of you once they confirm it. Follow their matches live, and
            start a group for your league with its own chat, feed and leaderboards.
          </p>
          <div className="private-note">
            <Lock aria-hidden="true" strokeWidth={2} />
            <p>
              <strong>Your chats stay in your chats.</strong> Messages and group feeds are only seen by the people in that chat
              or group, and you choose who sees your stats.
            </p>
          </div>
          <Link className="btn btn-primary" to="/community">
            Explore community <Arrow />
          </Link>
        </Reveal>
        <Reveal delay={0.1} className="feature-visual phones-duo">
          <Phone screen="group" alt="A group with a member playing live and a feed of achievements" sizes="(max-width: 860px) 42vw, 230px" />
          <Phone screen="chat" alt="A group chat, with the league sorting out fixtures" sizes="(max-width: 860px) 42vw, 230px" />
        </Reveal>
      </div>
    </section>
  );
}

function HaveAGo() {
  return (
    <section className="section dark have-a-go" id="have-a-go">
      <div className="wrap have-grid">
        <Reveal className="have-copy">
          <p className="eyebrow">Live scoring · have a go</p>
          <h2 className="display-l">This is how scoring feels.</h2>
          <p className="lead">
            One tap per ball. Snookered knows what is on, keeps the break and works out what is left on the table, so you can
            keep your eyes on the next shot.
          </p>
          <p className="have-note">
            Try a break: a red, then any colour, and back to a red. When the reds are gone, the colours go down in order.
          </p>
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

const GALLERY: { screen: Screen; alt: string; caption: string }[] = [
  { screen: "live-scoring", alt: "Live scoring, mid-frame", caption: "Live scoring, mid-frame." },
  { screen: "match-overview", alt: "A match overview with the scoreboard, high breaks and match statistics", caption: "Every match, frame by frame." },
  { screen: "routine", alt: "A routine with its progress and leaderboard", caption: "Every routine, with a best to beat." },
  { screen: "share-card", alt: "The share card for a result, leading with a 77 break", caption: "A result card led by the big moment." },
  { screen: "tournament", alt: "A tournament bracket: quarter-finals and semi-finals", caption: "Club knockouts, drawn for you." },
  { screen: "live-match", alt: "Following a friend's match live", caption: "Friends' matches, followed live." },
  { screen: "community", alt: "Community: friends, groups and the pro tour", caption: "Friends, groups and the pro tour." },
  { screen: "stats", alt: "The Stats screen: this week, form and practice rhythm", caption: "Your week at a glance." },
];

function Gallery() {
  return (
    <section className="section tight gallery-section">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">A look inside.</h2>
          <p className="lead">Every screen is built for a cue in one hand and a phone in the other. Scroll along to see more.</p>
        </Reveal>
      </div>
      <div className="gallery" tabIndex={0} aria-label="Screens from the app">
        {GALLERY.map((item, index) => (
          <Reveal key={item.screen} delay={index * 0.05} className="gallery-item">
            <Phone screen={item.screen} alt={item.alt} sizes="(max-width: 860px) 62vw, 250px" />
            <p>{item.caption}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const EXTRAS = [
  { icon: Trophy, title: "Tournaments", body: "Knockouts and leagues for your club, with the draw, fixtures and results kept for you." },
  { icon: ChartNoAxesColumn, title: "Stats that mean something", body: "Form, high breaks, head-to-heads and practice rhythm, without wading through charts." },
  { icon: Newspaper, title: "Pro tour news", body: "The latest from the World Snooker Tour and BBC Sport, next to your own game." },
  { icon: WifiOff, title: "Works without signal", body: "Club basements are not known for their Wi-Fi. Scores save on the phone and sync later." },
];

function Extras() {
  return (
    <section className="section tight">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">And everything else.</h2>
          <p className="lead">
            Free to start: 12 matches and a coach review every month.{" "}
            <Link to="/plans">Compare the plans</Link> for more.
          </p>
        </Reveal>
        <div className="extras four">
          {EXTRAS.map((extra, index) => (
            <Reveal key={extra.title} delay={index * 0.05} className="extra">
              <span className="extra-icon">
                <extra.icon aria-hidden="true" strokeWidth={1.75} />
              </span>
              <h3>{extra.title}</h3>
              <p>{extra.body}</p>
            </Reveal>
          ))}
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

export default function Home() {
  return (
    <>
      <Hero />
      <Standouts />
      <Feature
        id="builder"
        eyebrow="Routine builder"
        title="Make the routine you actually need."
        body="Place the balls exactly where you want them, zoom in to get them precise, then give the routine a name and a score to aim for. Every change can be undone."
        points={[
          "Share it with a link or a QR code, or pin it to your group",
          "A leaderboard on every routine, so your mates can take you on",
          "Browse the routines other players have built",
        ]}
        visual={<Phone screen="routine-builder" alt="The routine builder: balls placed on a table diagram, with the ball palette below" sizes="(max-width: 900px) 74vw, 300px" />}
        link={{ to: "/practice", label: "Explore practice" }}
      />
      <Feature
        id="scan"
        eyebrow="Scan Snooker · AR"
        soon
        tone="dark"
        flip
        title="Put the balls back, like the referees on TV."
        body="Scan the table before you play the snooker. If the escape misses, Snookered shows a ghost of every ball on the real table, so the balls go back exactly where they were. The same camera sets a routine up for you, ball by ball."
        points={[
          "Calibrates from any two spots or pockets, even with balls in the way",
          "A table diagram to check and tweak the scan",
          "AR routine set-up: ghosts show where every ball goes",
        ]}
        visual={<ScanDemo />}
        link={{ to: "/scan-snooker", label: "How Scan Snooker works" }}
      />
      <Feature
        id="coach"
        eyebrow="AI coach"
        tone="alt"
        title="A coach that watches you play."
        body="Film a few shots or a short break and upload the clip. The coach watches it, points to the moments that matter, tells you what to work on first, and picks the routines that train it."
        points={[
          "Feedback on your own clip, with the times it happened",
          "One clear thing to fix first, not a list of twenty",
          "Routines chosen for what it found",
        ]}
        visual={<Phone screen="ai-coach" alt="An AI coach report: technique, what went well and what to work on" sizes="(max-width: 900px) 74vw, 300px" />}
        link={{ to: "/practice#coach", label: "More on the coach" }}
      />
      <Community />
      <HaveAGo />
      <Gallery />
      <Extras />
      <Cta />
    </>
  );
}
