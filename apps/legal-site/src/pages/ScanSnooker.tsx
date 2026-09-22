import { Link } from "react-router";
import { Camera, Crosshair, Ruler, TabletSmartphone } from "lucide-react";
import { ArRoutineDemo, ScanDemo } from "../components/Showcase";
import { Arrow, Cta, Faq, PageHero, Placeholder, Reveal, Strip } from "../components/Blocks";

const STEPS = [
  {
    icon: Crosshair,
    title: "Point at the table",
    body: "Tap any two landmarks you can see, spots or pockets. Two is enough, so it still works when balls are covering the rest.",
  },
  {
    icon: Camera,
    title: "Scan the balls",
    body: "Snookered records where every ball is, in table millimetres rather than anything to do with where you were standing.",
  },
  {
    icon: TabletSmartphone,
    title: "Check on the diagram",
    body: "The scan appears on a table diagram. Nudge anything that landed in the wrong place, or use the diagram on its own.",
  },
  {
    icon: Ruler,
    title: "Put them back",
    body: "After the miss, hold the phone up and a ghost sits where each ball was. Match them up and play on.",
  },
];

export default function ScanSnooker() {
  return (
    <>
      <PageHero
        eyebrow="Scan a Snooker"
        soon
        title="Replace the balls properly."
        lead="In a club with no referee, putting the balls back after a foul and a miss is guesswork, and it costs frames. Scan the table first and Snookered shows you exactly where everything was."
        strip={
          <Strip label="Scan a snooker: six balls recorded, ready to replace" tag="Scan">
            <span className="strip-name">6 balls</span>
            <i className="strip-sep" aria-hidden="true" />
            <span className="strip-dim hide-sm">Recorded</span>
          </Strip>
        }
        aside={<ScanDemo />}
      />

      <section className="section tight alt">
        <div className="wrap">
          <Reveal className="section-head split">
            <h2 className="display-l">How it works.</h2>
            <p className="lead">
              The camera does the work, and a table diagram is always there as a second pair of eyes, or as the whole thing if
              you would rather place the balls by hand.
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
            <p className="eyebrow">AR routine set-up</p>
            <h2 className="display-l">Your routine, laid out on the real table.</h2>
            <p className="lead">
              The same camera sets a routine up for you. Every ball gets a ghost on the cloth, so a fifteen-ball layout takes
              seconds instead of a guess and a squint at a diagram.
            </p>
            <ul className="feature-points">
              <li>Works with the routines you build yourself</li>
              <li>Balls in table millimetres, so the layout is the same on any table</li>
              <li>The diagram stays available if you would rather not use the camera</li>
            </ul>
            <Link className="btn btn-primary" to="/practice">
              See the routine builder <Arrow />
            </Link>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <ArRoutineDemo />
          </Reveal>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap feature-grid">
          <Reveal className="feature-copy">
            <p className="eyebrow">Straight with you</p>
            <h2 className="display-l">What to expect.</h2>
            <p className="lead">
              AR is the part of Snookered still being built, and we would rather say so than pretend. Here is where it stands.
            </p>
            <ul className="feature-points">
              <li>An iPhone with LiDAR places balls to roughly a centimetre; other iPhones are more like two to five</li>
              <li>That is close enough to replace balls fairly, and you can nudge anything on the diagram</li>
              <li>It needs a build on a real table to tune, which is happening now</li>
            </ul>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <Placeholder label="Scan a Snooker on an iPhone" note="Ghost balls on the real table, after a miss" />
          </Reveal>
        </div>
      </section>

      <section className="section tight alt">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Questions.</h2>
          </Reveal>
          <Faq
            items={[
              {
                q: "Do I need the newest iPhone?",
                a: <p>No. Any iPhone that runs the app can scan. Phones with LiDAR are more accurate, and every phone can use the diagram.</p>,
              },
              {
                q: "What if the balls hide the spots?",
                a: <p>Calibration only needs two landmarks, and pockets count, so there is almost always a pair you can see.</p>,
              },
              {
                q: "Can I use it without the camera?",
                a: <p>Yes. Place the balls on the table diagram instead: same positions, same replace step, no AR.</p>,
              },
              {
                q: "When will it be ready?",
                a: (
                  <p>
                    It is in testing now and will arrive in an update. <Link to="/support">Ask us</Link> and we will tell you when
                    it lands.
                  </p>
                ),
              },
            ]}
          />
        </div>
      </section>

      <Cta title="Fancy testing it?" body="If you have a table and an iPhone, we would love your help testing it on a real table." />
    </>
  );
}
