import { Link } from "react-router";
import { Check } from "lucide-react";
import { Phone } from "../components/Phone";
import { Arrow, Cta, PageHero, Reveal } from "../components/Blocks";
import type { Screen } from "../site";

const WAYS: { kicker: string; title: string; body: string; points: string[]; screen: Screen; alt: string; to: string; label: string }[] = [
  {
    kicker: "Snookered Coach",
    title: "Feedback from a clip.",
    body: "Film a few shots and upload them. You get a report on your technique: what's working, the one thing to fix first, and the routines that train it.",
    points: ["Tonight, from your own phone", "Times in the clip for every point", "Reviews on every plan, more on the paid ones"],
    screen: "ai-coach",
    alt: "A coaching report: technique, what went well and what to work on",
    to: "/coach",
    label: "How the AI coach works",
  },
  {
    kicker: "Find a Coach",
    title: "A real coach, near you.",
    body: "Browse coaches, read their profile and qualifications, and book a session. Every coach is reviewed by hand before they can take a booking.",
    points: ["Book a time that suits you both", "Message your coach in the app", "Their notes and drills, kept with your practice"],
    screen: "coach-profile",
    alt: "A coach's profile in Snookered, with a Book a session button",
    to: "/find-a-coach",
    label: "Find a coach",
  },
];

export default function Coaching() {
  return (
    <>
      <PageHero
        eyebrow="Coaching"
        title="Get coached, two ways."
        lead="Get feedback on your technique from a clip of your own game, or book a real coach near you. Plenty of players do both: the clip between sessions, the coach for the big fixes."
      />

      <section className="section tight alt">
        <div className="wrap coaching-ways">
          {WAYS.map((way, index) => (
            <Reveal key={way.to} delay={index * 0.08} className="coaching-way">
              <div className="coaching-way-copy">
                <p className="eyebrow">{way.kicker}</p>
                <h2 className="display-m">{way.title}</h2>
                <p>{way.body}</p>
                <ul className="checks">
                  {way.points.map((point) => (
                    <li key={point}>
                      <Check aria-hidden="true" strokeWidth={2.25} />
                      {point}
                    </li>
                  ))}
                </ul>
                <Link className="btn btn-primary" to={way.to}>
                  {way.label} <Arrow />
                </Link>
              </div>
              <Phone screen={way.screen} alt={way.alt} sizes="(max-width: 900px) 60vw, 220px" />
            </Reveal>
          ))}
        </div>
      </section>

      <section className="section feature dark">
        <div className="wrap feature-grid flip">
          <Reveal className="feature-copy">
            <p className="eyebrow">For coaches</p>
            <h2 className="display-l">Run your coaching from your phone.</h2>
            <p className="lead">
              A booking diary, a client list that includes walk-ins with no account, broadcast groups for drills, and private notes
              on every session. In the same app your players already use.
            </p>
            <ul className="feature-points">
              <li>Set your hours and take bookings</li>
              <li>Book a walk-in by name, no account needed</li>
              <li>Post a drill to every client at once</li>
            </ul>
            <Link className="btn btn-primary" to="/coach-diary">
              See the Coach Diary <Arrow />
            </Link>
          </Reveal>
          <Reveal delay={0.1} className="feature-visual">
            <Phone
              screen="coach-dashboard"
              alt="A coach's dashboard in Snookered, showing the next session and sessions this month"
              sizes="(max-width: 900px) 74vw, 300px"
            />
          </Reveal>
        </div>
      </section>

      <Cta title="Get better, faster." body="Snookered is coming to iPhone. Coach and want to be listed at launch? Get in touch." />
    </>
  );
}
