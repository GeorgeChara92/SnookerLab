import { useRef } from "react";
import { Link } from "react-router";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { Bot, Newspaper, Trophy, Medal, WifiOff, ChartNoAxesColumn } from "lucide-react";
import { Phone } from "../components/Phone";
import { LiveBoard } from "../components/Scoreboard";
import { Scorer } from "../components/Scorer";
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
              Score every frame ball by ball, practise with a plan, and play your friends in matches that count. Everything you
              do at the table, in one app.
            </p>
          </Reveal>
          <Reveal delay={0.16} className="hero-actions">
            <span className="store" aria-label="Coming soon to the App Store">
              <AppleLogo />
              <span>
                <small>Coming soon to</small>the App Store
              </span>
            </span>
            <a className="btn btn-ghost" href="#have-a-go">
              Try the scorer <Arrow />
            </a>
          </Reveal>
        </div>

        <div className="hero-stage">
          <div className="hero-panel dark">
            <div className="hero-cloth" aria-hidden="true" />
            <motion.div className="hero-phone back" style={{ y: sink }}>
              <Phone screen="stats" alt="" sizes="(max-width: 860px) 42vw, 250px" />
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

const PILLARS: { to: string; kicker: string; title: string; body: string; screen: Screen; wide?: boolean }[] = [
  {
    to: "/scoring",
    kicker: "Score",
    title: "Every frame, ball by ball.",
    body: "Live scoring that knows the points left, the snookers needed and the break you are on. The match overview is ready the moment the last ball drops.",
    screen: "live-scoring",
    wide: true,
  },
  {
    to: "/practice",
    kicker: "Practise",
    title: "Practice with a point to it.",
    body: "Proper routines, each with a personal best to beat.",
    screen: "routine",
  },
  {
    to: "/community",
    kicker: "Play",
    title: "Your club, in your pocket.",
    body: "Matches that count for both players, and friends followed live.",
    screen: "community",
  },
];

function Pillars() {
  return (
    <section className="section">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">One app for the whole game.</h2>
          <p className="lead">
            Built around the three things you do at the table: scoring the frame, getting better between matches, and playing
            the people you know.
          </p>
        </Reveal>
        <div className="bento">
          {PILLARS.map((pillar, index) => (
            <Reveal key={pillar.to} delay={index * 0.08} className={`bento-card ${pillar.wide ? "wide" : ""}`}>
              <Link to={pillar.to} className="bento-link">
                <div className="bento-copy">
                  <p className="eyebrow">{pillar.kicker}</p>
                  <h3 className="display-m">{pillar.title}</h3>
                  <p>{pillar.body}</p>
                  <span className="bento-go">
                    Explore {pillar.kicker.toLowerCase()} <Arrow />
                  </span>
                </div>
                <div className="bento-shot" aria-hidden="true">
                  <Phone screen={pillar.screen} alt="" sizes="(max-width: 860px) 60vw, 280px" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HaveAGo() {
  return (
    <section className="section dark have-a-go" id="have-a-go">
      <div className="wrap have-grid">
        <Reveal className="have-copy">
          <p className="eyebrow">Have a go</p>
          <h2 className="display-l">This is how scoring feels.</h2>
          <p className="lead">
            One tap per ball. Snookered knows what is on, keeps the break and works out what is left on the table, so you can
            keep your eyes on the next shot.
          </p>
          <p className="have-note">
            Try a break: a red, then any colour, and back to a red. When the reds are gone, the colours go down in order.
          </p>
        </Reveal>
        <Reveal delay={0.1}>
          <Scorer />
        </Reveal>
      </div>
    </section>
  );
}

const GALLERY: { screen: Screen; alt: string; caption: string }[] = [
  { screen: "match-overview", alt: "A match overview with the scoreboard, high breaks and match statistics", caption: "Every match, frame by frame." },
  { screen: "share-card", alt: "The share card for a result, leading with a 77 break", caption: "A result card led by the big moment." },
  { screen: "live-match", alt: "Following a friend's match live", caption: "Friends' matches, followed live." },
  { screen: "group", alt: "A group with a member playing live and a feed of achievements", caption: "Your league, with its own feed." },
  { screen: "stats", alt: "The Stats screen: this week, form and practice rhythm", caption: "Your week at a glance." },
];

function Gallery() {
  return (
    <section className="section alt gallery-section">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">A look inside.</h2>
          <p className="lead">Every screen is built for a cue in one hand and a phone in the other. Scroll along to see more.</p>
        </Reveal>
      </div>
      <div className="gallery" tabIndex={0} aria-label="Screens from the app">
        {GALLERY.map((item, index) => (
          <Reveal key={item.screen} delay={index * 0.06} className="gallery-item">
            <Phone screen={item.screen} alt={item.alt} sizes="(max-width: 860px) 62vw, 280px" />
            <p>{item.caption}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

const EXTRAS = [
  { icon: Bot, title: "AI coach", body: "Film yourself and the coach watches the clip, then tells you what to work on and which routines help." },
  { icon: Newspaper, title: "Pro tour news", body: "The latest from the World Snooker Tour and BBC Sport, next to your own game." },
  { icon: Trophy, title: "Tournaments", body: "Run a knockout or a league for your club, with the draw, fixtures and results kept for you." },
  { icon: Medal, title: "Achievements", body: "Level up for the things that matter: centuries, streaks, wins and practice." },
  { icon: ChartNoAxesColumn, title: "Stats that mean something", body: "Form, high breaks, head-to-heads and practice rhythm, without wading through charts." },
  { icon: WifiOff, title: "Works without signal", body: "Club basements are not known for their Wi-Fi. Scores save on the phone and sync later." },
];

function Extras() {
  return (
    <section className="section">
      <div className="wrap">
        <Reveal className="section-head">
          <h2 className="display-l">And the rest of it.</h2>
        </Reveal>
        <div className="extras">
          {EXTRAS.map((extra, index) => (
            <Reveal key={extra.title} delay={(index % 3) * 0.06} className="extra">
              <span className="extra-icon">
                <extra.icon aria-hidden="true" strokeWidth={1.75} />
              </span>
              <h3>{extra.title}</h3>
              <p>{extra.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function PlansTeaser() {
  return (
    <section className="section alt tight">
      <div className="wrap">
        <Reveal className="section-head split">
          <h2 className="display-l">Free to start.</h2>
          <p className="lead">Score matches, run routines and play friends on the free plan. Go further when you want more.</p>
        </Reveal>
        <div className="mini-plans">
          {PLANS.map((plan, index) => (
            <Reveal key={plan.name} delay={index * 0.06} className={`mini-plan ${plan.tag ? "featured" : ""}`}>
              <h3>{plan.name}</h3>
              <p>{plan.line}</p>
              <p className="mini-plan-key num">{plan.items[0]}</p>
            </Reveal>
          ))}
        </div>
        <Reveal className="center-link">
          <Link className="btn btn-primary" to="/plans">
            Compare the plans <Arrow />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <Hero />
      <Pillars />
      <HaveAGo />
      <Gallery />
      <Extras />
      <PlansTeaser />
      <Cta />
    </>
  );
}
