import { Link } from "react-router";
import { Check, LineChart, Target, Upload, Video, Wand2 } from "lucide-react";
import { Phone } from "../components/Phone";
import { CoachReport } from "../components/Showcase";
import { Arrow, Faq, PageHero, Reveal, Strip } from "../components/Blocks";
import { LaunchList } from "../components/Tour";

const STEPS = [
  { icon: Video, title: "Record a clip", body: "Prop your phone up and play. A few shots or a short break is plenty." },
  { icon: Upload, title: "Upload it", body: "Pick the clip in the app. It is yours: nobody else sees it." },
  { icon: Wand2, title: "It watches the video", body: "The coach reads your stance, cue action and what happened on the table." },
  { icon: LineChart, title: "Get the feedback", body: "What went well, what to fix first, and why it matters on the table." },
  { icon: Target, title: "Practise it", body: "It picks the routines that train the fix, ready to run in your next session." },
];

/** Straight from a real report, so the page shows the output rather than describing it. */
const REPORT = [
  {
    heading: "Technique",
    body: "You have a very composed setup with your chin low to the cue and exceptional stillness through the strike. Working on shortening your bridge length slightly and adding a distinct rear pause will give you even greater cue control.",
  },
  {
    heading: "What went well",
    body: "Your head and chest remain completely rock-solid through impact without any lifting or flinching, and you hold your finish cleanly after striking the cue ball.",
  },
  {
    heading: "What to improve",
    body: "Shorten the bridge slightly and add a pause at the back of the final backswing, then practise it on straight pots before taking it into a frame.",
  },
];

export default function Coach() {
  return (
    <>
      <PageHero
        eyebrow="AI Coach"
        title="A coach that watches you play."
        lead="Record a clip of your game and get AI-powered feedback on your technique, the moments that matter, and what to work on next."
        strip={
          <Strip label="Coach report: technique, reviewed" tag="Report">
            <span className="strip-name">Technique</span>
            <i className="strip-sep hide-sm" aria-hidden="true" />
            <span className="strip-dim hide-sm">Reviewed</span>
          </Strip>
        }
        aside={<Phone screen="ai-coach" alt="A coaching report in Snookered: technique, what went well and what to work on" sizes="(max-width: 900px) 72vw, 300px" eager />}
      />

      <section className="section tight alt">
        <div className="wrap">
          <Reveal className="section-head split">
            <h2 className="display-l">Five steps, one evening.</h2>
            <p className="lead">No sensors, no marker dots on the cue, no special table. Just your phone propped on a chair.</p>
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

      <section className="section feature">
        <div className="wrap feature-grid">
          <Reveal className="feature-copy">
            <p className="eyebrow">What you get back</p>
            <h2 className="display-l">Feedback you could act on tonight.</h2>
            <p className="lead">
              Every report picks out the moments it is talking about, so you can see the shot it means. This is from a real
              report on a real clip.
            </p>
            <div className="report-quotes">
              {REPORT.map((part) => (
                <div key={part.heading}>
                  <h3>{part.heading}</h3>
                  <p>{part.body}</p>
                </div>
              ))}
            </div>
            <p className="note">Coaching is guidance, not a substitute for a qualified coach.</p>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <CoachReport />
          </Reveal>
        </div>
      </section>

      <section className="section tight alt">
        <div className="wrap feature-grid flip">
          <Reveal className="feature-copy">
            <p className="eyebrow">Over time</p>
            <h2 className="display-l">Watch the fix stick.</h2>
            <p className="lead">
              Reports are kept, so you can look back at what you were working on last month and see whether it has held up in
              your matches and your routine scores.
            </p>
            <ul className="checks">
              {[
                "Every report saved, with the clip it came from",
                "Routines suggested for what it found, ready to run",
                "Your high breaks and form sit alongside it in Stats",
              ].map((item) => (
                <li key={item}>
                  <Check aria-hidden="true" strokeWidth={2.25} />
                  {item}
                </li>
              ))}
            </ul>
            <Link className="btn btn-primary" to="/practice">
              See how practice works <Arrow />
            </Link>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <Phone screen="stats" alt="The stats screen, showing form and practice over the week" sizes="(max-width: 900px) 72vw, 300px" />
          </Reveal>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Questions.</h2>
          </Reveal>
          <Faq
            items={[
              { q: "How long should the clip be?", a: <p>A few shots or a short break. Longer clips take longer to come back and rarely tell you more.</p> },
              {
                q: "Where should I put the phone?",
                a: <p>Anywhere it can see you and the table. The report says which angle it had, and what that angle stopped it seeing.</p>,
              },
              {
                q: "How many reviews do I get?",
                a: (
                  <p>
                    One a month on the free plan, eight on Half-Century and twenty on Century. See <Link to="/plans">Plans</Link>.
                  </p>
                ),
              },
              { q: "Who can see my clips?", a: <p>Only you. Clips are tied to your account and are not shared with other players.</p> },
            ]}
          />
          <p className="note">
            Looking for a real person instead? See <Link to="/find-a-coach">Find a Coach</Link>.
          </p>
        </div>
      </section>

      <LaunchList />
    </>
  );
}
