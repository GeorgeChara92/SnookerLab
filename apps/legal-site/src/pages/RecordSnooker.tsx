import { Link } from "react-router";
import { Crosshair, Footprints, LayoutGrid, Undo2 } from "lucide-react";
import { ScanDemo } from "../components/Showcase";
import { Phone } from "../components/Phone";
import { Arrow, Cta, Faq, PageHero, Reveal, Strip } from "../components/Blocks";
import { RECORD_FAQ } from "../seo";

const STEPS = [
  {
    icon: Crosshair,
    title: "Aim at two spots",
    body: "Line the table up by aiming at two spots. The black and brown work best, as they're far apart.",
  },
  {
    icon: Footprints,
    title: "Walk round the table",
    body: "Phone at chest height, tilted down at the balls. Each ball gets a ring as it's found, and the count goes up.",
  },
  {
    icon: LayoutGrid,
    title: "Check the diagram",
    body: "Save the position and it's drawn on a table diagram, so you can see every ball was caught.",
  },
  {
    icon: Undo2,
    title: "Put them back",
    body: "After the miss, a ring on the cloth shows where each ball goes, and tells you when it's in place.",
  },
];

export default function RecordSnooker() {
  return (
    <>
      <PageHero
        eyebrow="Record a Snooker"
        title="Put the balls back properly."
        lead="With no referee, putting the balls back after a foul and a miss is guesswork, and it costs frames. Walk round the table before you play the snooker and Snookered remembers where everything was."
        strip={
          <Strip label="Record a snooker: five balls found" tag="Record">
            <span className="strip-num">5</span>
            <span className="strip-name">balls found</span>
          </Strip>
        }
        aside={
          <Phone
            screen="record-snooker"
            alt="Record a Snooker in the camera, with a ring on each ball as it's found"
            sizes="(max-width: 900px) 72vw, 300px"
            eager
          />
        }
      />

      <section className="section tight alt">
        <div className="wrap">
          <Reveal className="section-head split">
            <h2 className="display-l">How it works.</h2>
            <p className="lead">
              It's in live scoring, one tap from the frame you're playing. The camera does the finding; you just walk round.
            </p>
          </Reveal>
          <div className="steps">
            {STEPS.map((step, index) => (
              <Reveal key={step.title} delay={index * 0.06} className="step">
                <span className="step-number num">{index + 1}</span>
                <span className="extra-icon">
                  <step.icon aria-hidden="true" strokeWidth={1.75} />
                </span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="section feature dark">
        <div className="wrap feature-grid flip">
          <Reveal className="feature-copy">
            <p className="eyebrow">After the miss</p>
            <h2 className="display-l">Every ball, back where it was.</h2>
            <p className="lead">
              Hold the phone up and a ring sits on the cloth where each ball was. Move the ball into its ring and the app tells you
              when it's in place, so nobody argues over an inch.
            </p>
            <ul className="feature-points">
              <li>Three recorded snookers a month free, unlimited on Half-Century and Century</li>
              <li>Works on iPhones with ARKit; LiDAR is a little more precise</li>
              <li>Saved with the frame, so you can look back at the position</li>
            </ul>
            <Link className="btn btn-primary" to="/scoring">
              More on live scoring <Arrow />
            </Link>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <ScanDemo />
          </Reveal>
        </div>
      </section>

      <section className="section tight alt">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Questions.</h2>
          </Reveal>
          <Faq items={RECORD_FAQ.map(([q, a]) => ({ q, a: <p>{a}</p> }))} />
        </div>
      </section>

      <Cta title="No more guessing the replace." body="Snookered is coming to iPhone. Want to know when it lands? Get in touch." />
    </>
  );
}
