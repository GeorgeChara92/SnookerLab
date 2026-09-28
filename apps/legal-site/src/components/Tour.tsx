import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Mail } from "lucide-react";
import { Phone } from "./Phone";
import { Reveal } from "./Blocks";
import { SUPPORT_EMAIL, type Screen } from "../site";

type Stop = { screen: Screen; label: string; caption: string; alt: string };

/** The five screens that explain the app, in the order a player meets them. */
const STOPS: Stop[] = [
  {
    screen: "dashboard",
    label: "Dashboard",
    caption: "Know where your game stands, and what to do tonight.",
    alt: "The Snookered dashboard: the next session, a day streak, this week's practice and your last match",
  },
  {
    screen: "live-scoring",
    label: "Live scoring",
    caption: "Fast scoring built for the table.",
    alt: "Live scoring mid-frame: the break, points on the table and the ball on",
  },
  {
    screen: "routine",
    label: "Practice",
    caption: "Practice with a point to it.",
    alt: "A routine with its progress chart, personal best and leaderboard",
  },
  {
    screen: "ai-coach",
    label: "Snookered Coach",
    caption: "Your game, turned into feedback you can act on.",
    alt: "A coaching report: technique, what went well and what to work on",
  },
  {
    screen: "coach-profile",
    label: "Find a Coach",
    caption: "Or book a real coach near you - or list yourself as one.",
    alt: "A coach's profile, with bio, gallery and a Book a session button",
  },
  {
    screen: "stats",
    label: "Stats",
    caption: "The numbers that actually matter.",
    alt: "The stats screen: this week, form and practice rhythm",
  },
];

/** Inside the app: one big screen at a time, picked from the labels beside it. */
export function AppTour() {
  const [active, setActive] = useState(0);
  const stop = STOPS[active];

  return (
    <section className="section tour dark" id="inside">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">Inside the app</p>
            <h2 className="display-l">Built for the table, not a spreadsheet.</h2>
          </div>
          <p className="lead">Every screen is one-handed, dark, and quick enough to use between shots.</p>
        </Reveal>

        <div className="tour-grid">
          <div className="tour-stage">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={stop.screen}
                initial={{ opacity: 0, y: 18, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -14, scale: 0.985, transition: { duration: 0.18 } }}
                transition={{ type: "spring", duration: 0.5, bounce: 0 }}
              >
                <Phone screen={stop.screen} alt={stop.alt} sizes="(max-width: 900px) 72vw, 300px" eager={active === 0} />
              </motion.div>
            </AnimatePresence>
            <AnimatePresence mode="wait" initial={false}>
              <motion.p
                key={stop.caption}
                className="tour-caption"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ duration: 0.3 }}
              >
                {stop.caption}
              </motion.p>
            </AnimatePresence>
          </div>

          <div className="tour-steps" role="tablist" aria-label="Screens from the app">
            {STOPS.map((item, index) => (
              <button
                key={item.screen}
                type="button"
                role="tab"
                id={`tour-tab-${index}`}
                aria-selected={index === active}
                className={`tour-step ${index === active ? "on" : ""}`}
                onClick={() => setActive(index)}
              >
                <span className="tour-step-label">{item.label}</span>
                <span className="tour-step-caption">{item.caption}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const LOOP = [
  { step: "Play", body: "Score your matches and track every frame." },
  { step: "Analyse", body: "See the numbers behind your game." },
  { step: "Practise", body: "Build routines around what you need to improve." },
  { step: "Improve", body: "Use Coach to turn your own game into feedback you can act on." },
  { step: "Play again", body: "See whether the work is actually paying off." },
];

/** The loop the whole app runs on: what happens in matches feeds what you do in practice. */
export function CoreLoop() {
  return (
    <section className="section tight loop-section">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="display-l">Play. Practise. Improve. Repeat.</h2>
          </div>
          <p className="lead">Snookered joins up what happens in your matches with what you do in practice.</p>
        </Reveal>
        <ol className="loop">
          {LOOP.map((item, index) => (
            <Reveal key={item.step} delay={index * 0.05} className="loop-step">
              <span className="loop-number num">{index + 1}</span>
              <h3>{item.step}</h3>
              <p>{item.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * The launch list. There is no sign-up service yet, so the form opens the player's own
 * email app with the message ready: a real action rather than a pretend confirmation.
 */
export function LaunchList() {
  const [email, setEmail] = useState("");

  const send = (event: FormEvent) => {
    event.preventDefault();
    const body = `Add me to the Snookered launch list.${email ? `\n\nMy email: ${email}` : ""}`;
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Launch list")}&body=${encodeURIComponent(body)}`;
  };

  return (
    <section className="section launch-section" id="launch">
      <div className="wrap">
        <Reveal className="launch dark">
          <div className="launch-copy">
            <p className="eyebrow">Coming soon to iPhone</p>
            <h2 className="display-l">See you at the table.</h2>
            <p className="lead">
              Snookered is finishing up for the App Store. Be first on the table: ask for a nudge and we will tell you the day
              it lands.
            </p>
          </div>
          <form className="launch-form" onSubmit={send}>
            <label htmlFor="launch-email">Your email</label>
            <div className="launch-row">
              <input
                id="launch-email"
                type="email"
                name="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <button type="submit" className="btn btn-primary">
                Get notified at launch <ArrowRight aria-hidden="true" strokeWidth={2} className="arrow" />
              </button>
            </div>
            <p className="launch-note">
              <Mail aria-hidden="true" strokeWidth={1.75} />
              This opens your email app with the message ready. We add you by hand, and use it only to tell you about the
              launch.
            </p>
          </form>
        </Reveal>
      </div>
    </section>
  );
}
