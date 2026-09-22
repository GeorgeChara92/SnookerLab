import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useInView, type HTMLMotionProps } from "motion/react";
import { ArrowRight, Check, Minus, Plus } from "lucide-react";
import { Phone } from "./Phone";
import type { Screen } from "../site";

const EASE = [0.2, 0, 0, 1] as const;

/** Fades content up once as it comes on screen. */
export function Reveal({ delay = 0, children, ...rest }: HTMLMotionProps<"div"> & { delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -10% 0px" }}
      transition={{ duration: 0.6, ease: EASE, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Arrow() {
  return <ArrowRight className="arrow" aria-hidden="true" strokeWidth={2} />;
}

/** The lower-third: a one-line broadcast strip. */
export function Strip({ label, tag, live, children }: { label: string; tag: string; live?: boolean; children: ReactNode }) {
  return (
    <div className="strip" role="img" aria-label={label}>
      <span className={`strip-tag ${live ? "is-live" : ""}`}>{tag}</span>
      {children}
    </div>
  );
}

/** A slot for a screenshot we have not taken yet, so the layout is final before the image lands. */
export function Placeholder({ label, note }: { label: string; note?: string }) {
  return (
    <div className="placeholder" role="img" aria-label={`${label} (screenshot coming soon)`}>
      <span className="placeholder-ball ball red" aria-hidden="true" />
      <b>{label}</b>
      {note && <span>{note}</span>}
      <em>Screenshot coming soon</em>
    </div>
  );
}

export function PageHero({
  eyebrow,
  title,
  lead,
  strip,
  aside,
  soon,
}: {
  eyebrow: string;
  title: ReactNode;
  lead: ReactNode;
  strip?: ReactNode;
  aside?: ReactNode;
  soon?: boolean;
}) {
  return (
    <section className={`page-hero ${aside ? "with-aside" : ""}`}>
      <div className="wrap page-hero-grid">
        <div>
          <Reveal>
            <p className="eyebrow">
              {eyebrow}
              {soon && <span className="soon">In development</span>}
            </p>
            <h1 className="display-xl">{title}</h1>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="lead page-hero-lead">{lead}</p>
          </Reveal>
          {strip && <Reveal delay={0.16}>{strip}</Reveal>}
        </div>
        {aside && (
          <Reveal delay={0.12} className="page-hero-aside">
            {aside}
          </Reveal>
        )}
      </div>
    </section>
  );
}

export type Story = {
  id: string;
  kicker: string;
  title: string;
  body: string;
  points: string[];
  screen?: Screen;
  alt?: string;
  visual?: ReactNode;
};

function StoryStep({ story, onActive }: { story: Story; onActive: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-45% 0px -45% 0px" });
  useEffect(() => {
    if (inView) onActive();
  }, [inView, onActive]);
  return (
    <article ref={ref} className="story-step" id={story.id}>
      <p className="eyebrow">{story.kicker}</p>
      <h2 className="display-l">{story.title}</h2>
      <p className="story-body">{story.body}</p>
      <ul className="checks">
        {story.points.map((point) => (
          <li key={point}>
            <Check aria-hidden="true" strokeWidth={2.25} />
            {point}
          </li>
        ))}
      </ul>
      <div className="story-inline">
        {story.visual ?? (story.screen && <Phone screen={story.screen} alt={story.alt ?? ""} />)}
      </div>
    </article>
  );
}

/** Feature story: the copy scrolls while the phone beside it stays put and changes screen. */
export function FeatureStory({ stories }: { stories: Story[] }) {
  const [active, setActive] = useState(0);
  const current = stories[active];
  return (
    <section className="section story">
      <div className="wrap story-grid">
        <div className="story-steps">
          {stories.map((story, index) => (
            <StoryStep key={story.id} story={story} onActive={() => setActive(index)} />
          ))}
        </div>
        <div className="story-stage" aria-hidden="true">
          <div className="story-sticky">
            <div className="story-panel">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={current.id}
                  className="story-visual"
                  initial={{ opacity: 0, y: 24, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -16, scale: 0.98, transition: { duration: 0.2 } }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0 }}
                >
                  {current.visual ?? (current.screen && <Phone screen={current.screen} alt="" sizes="340px" />)}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="story-dots">
              {stories.map((story, index) => (
                <span key={story.id} className={index === active ? "on" : ""} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function Faq({ items }: { items: { q: string; a: ReactNode }[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="faq">
      {items.map((item, index) => {
        const isOpen = open === index;
        return (
          <div key={item.q} className={`faq-item ${isOpen ? "open" : ""}`}>
            <h3>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`faq-${index}`}
                onClick={() => setOpen(isOpen ? null : index)}
              >
                <span>{item.q}</span>
                <span className="faq-icon" aria-hidden="true">
                  {isOpen ? <Minus strokeWidth={2} /> : <Plus strokeWidth={2} />}
                </span>
              </button>
            </h3>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  id={`faq-${index}`}
                  className="faq-answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ type: "spring", duration: 0.35, bounce: 0 }}
                >
                  <div>{item.a}</div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

export function Cta({
  title = "See you at the table.",
  body = "Snookered is coming to iPhone. Questions in the meantime? We read every message.",
}: {
  title?: string;
  body?: string;
}) {
  return (
    <section className="section cta-section">
      <div className="wrap">
        <Reveal className="cta dark">
          <div className="cta-copy">
            <h2 className="display-l">{title}</h2>
            <p className="lead">{body}</p>
            <div className="cta-actions">
              <span className="store on-dark" aria-label="Coming soon to the App Store">
                <AppleLogo />
                <span>
                  <small>Coming soon to</small>the App Store
                </span>
              </span>
              <Link className="btn btn-ghost" to="/support">
                Get in touch <Arrow />
              </Link>
            </div>
          </div>
          <div className="cta-art" aria-hidden="true">
            <span className="ball red" />
            <span className="ball yellow" />
            <span className="ball green" />
            <span className="ball brown" />
            <span className="ball blue" />
            <span className="ball pink" />
            <span className="ball black" />
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function AppleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="22" height="22">
      <path
        fill="currentColor"
        d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.14-2.77.83-3.49.83-.72 0-1.83-.81-3-.79-1.55.02-2.97.9-3.77 2.28-1.6 2.78-.41 6.9 1.15 9.16.76 1.1 1.67 2.34 2.86 2.3 1.15-.05 1.58-.74 2.97-.74 1.38 0 1.77.74 2.98.72 1.23-.02 2.01-1.12 2.76-2.23.87-1.28 1.23-2.52 1.25-2.58-.03-.01-2.39-.92-2.41-3.64zM14.1 5.86c.63-.77 1.06-1.83.94-2.9-.91.04-2.02.61-2.67 1.37-.58.67-1.1 1.76-.96 2.8 1.02.08 2.06-.52 2.69-1.27z"
      />
    </svg>
  );
}
