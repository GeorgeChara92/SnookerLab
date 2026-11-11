import { useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Link } from "react-router";
import { joinLaunchList, looksLikeEmail, type Platform } from "../launchList";
import { Phone } from "./Phone";
import { Reveal } from "./Blocks";
import { type Screen } from "../site";

type Stop = { screen: Screen; label: string; caption: string; alt: string };

/** The four pillars of the core player experience, in the order they build on each other. */
const STOPS: Stop[] = [
  {
    screen: "live-scoring",
    label: "Score",
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
    screen: "stats",
    label: "Stats",
    caption: "The numbers that actually matter.",
    alt: "The stats screen: this week, form and practice rhythm",
  },
  {
    screen: "ai-coach",
    label: "Snookered Coach",
    caption: "Your game, turned into feedback you can act on.",
    alt: "A coaching report: technique, what went well and what to work on",
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
            <p className="eyebrow">Core player experience</p>
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
  { step: "Analyse", body: "See what the numbers say about your game." },
  { step: "Practise", body: "Build routines around what you need to improve." },
  { step: "Improve", body: "Get feedback from your own game with Snookered Coach." },
  { step: "Play again", body: "See whether the work is actually paying off." },
];

/** The loop the whole app runs on: what happens in matches feeds what you do in practice. */
export function CoreLoop() {
  return (
    <section className="section tight loop-section">
      <div className="wrap">
        <Reveal className="section-head split">
          <div>
            <p className="eyebrow">The Snookered approach</p>
            <h2 className="display-l">Play. Analyse. Practise. Improve.</h2>
          </div>
          <p className="lead">Everything in Snookered feeds the same loop: what happens in your matches shapes your practice, and practice changes your next match.</p>
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
 * The launch list: an email, and optionally which phone, saved straight to the list we email on
 * launch day (see launchList.ts). A hidden field catches form-filling bots, which get the same
 * "you're on the list" without anything being saved.
 */
export function LaunchList() {
  const [email, setEmail] = useState("");
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [trap, setTrap] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (state === "sending") return;
    if (!looksLikeEmail(email)) {
      setError("That email address doesn't look right.");
      return;
    }
    setError(null);
    setState("sending");
    if (trap) {
      setState("done");
      return;
    }
    try {
      await joinLaunchList(email, platform, window.location.pathname);
      setState("done");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Please try again.");
      setState("idle");
    }
  };

  return (
    <section className="section launch-section" id="launch">
      <div className="wrap">
        <Reveal className="launch dark">
          <div className="launch-copy">
            <p className="eyebrow">Coming soon to iPhone</p>
            <h2 className="display-l">Your next session starts here.</h2>
            <p className="lead">
              Matches, practice, coaching, your club - Snookered brings it all together. Be first on the table: leave
              your email and we will tell you the day it lands.
            </p>
          </div>
          {state === "done" ? (
            <div className="launch-done" role="status">
              <span className="launch-done-mark" aria-hidden="true">
                <Check strokeWidth={2.5} />
              </span>
              <div>
                <p className="launch-done-title">You're on the list.</p>
                <p className="launch-note-text">
                  We'll email {email.trim()} the day Snookered is out. Nothing else.
                </p>
              </div>
            </div>
          ) : (
            <form className="launch-form" onSubmit={send} noValidate>
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
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? "launch-error" : undefined}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    if (error) setError(null);
                  }}
                />
                <button type="submit" className="btn btn-primary" disabled={state === "sending"}>
                  {state === "sending" ? "Adding you..." : "Get notified at launch"}
                  {state === "sending" ? null : <ArrowRight aria-hidden="true" strokeWidth={2} className="arrow" />}
                </button>
              </div>
              {/* Hidden from people; a bot that fills every field fills this one too. */}
              <div className="launch-trap" aria-hidden="true">
                <label htmlFor="launch-website">Website</label>
                <input
                  id="launch-website"
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={trap}
                  onChange={(event) => setTrap(event.target.value)}
                />
              </div>
              <fieldset className="launch-phone">
                <legend>Your phone (optional)</legend>
                {(["iphone", "android"] as const).map((value) => (
                  <label key={value} className={platform === value ? "on" : undefined}>
                    <input
                      type="radio"
                      name="platform"
                      value={value}
                      checked={platform === value}
                      onChange={() => setPlatform(value)}
                      onClick={() => platform === value && setPlatform(null)}
                    />
                    {value === "iphone" ? "iPhone" : "Android"}
                  </label>
                ))}
              </fieldset>
              {error ? (
                <p className="launch-error" id="launch-error" role="alert">
                  {error}
                </p>
              ) : null}
              <p className="launch-note">
                <Mail aria-hidden="true" strokeWidth={1.75} />
                <span>
                  We'll only use your email to tell you about the launch, and you can ask us to remove it at any
                  time. See our <Link to="/privacy">Privacy Policy</Link>.
                </span>
              </p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
