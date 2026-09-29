import { Link } from "react-router";
import { Phone } from "../components/Phone";
import { Arrow, Cta, FeatureStory, Faq, PageHero, Reveal, Strip } from "../components/Blocks";
import { LaunchList } from "../components/Tour";
import { APPLY_MAILTO, COACH_STORY } from "./FindACoach";

const Sep = () => <i className="strip-sep" aria-hidden="true" />;

export default function CoachDiary() {
  return (
    <>
      <PageHero
        eyebrow="Coach Diary"
        title="Your coaching diary. Not a spreadsheet."
        lead="Take bookings, message clients, post drills to a group and log what you covered - all in the app your players are already on, including the ones who aren't."
        strip={
          <Strip label="Coach dashboard: 6 sessions this week, 2 new clients" tag="This week">
            <span className="strip-name">6 sessions</span>
            <Sep />
            <span className="strip-dim hide-sm">2 new clients</span>
          </Strip>
        }
        aside={<Phone screen="coach-dashboard" alt="A coach's dashboard in Snookered, showing the next session and sessions this month" sizes="(max-width: 900px) 72vw, 300px" eager />}
      />

      <FeatureStory stories={COACH_STORY} />

      <section className="section tight alt">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <p className="eyebrow">Pricing</p>
            <h2 className="display-l">£4.99 a month.</h2>
            <p className="lead">
              Or £39.99 a year. Applying is free - we review every application by hand before you can list yourself or take
              a booking, and the subscription only starts once you're approved.
            </p>
          </Reveal>
          <div className="cta-actions">
            <a className="btn btn-primary" href={APPLY_MAILTO}>
              Apply to coach <Arrow />
            </a>
            <Link className="btn btn-ghost" to="/plans">
              See the full plan <Arrow />
            </Link>
          </div>
          <p className="note">Already have the app? Apply from Profile instead - it's quicker, and you can track your application there.</p>
        </div>
      </section>

      <section className="section tight">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <h2 className="display-l">Questions.</h2>
          </Reveal>
          <Faq
            items={[
              {
                q: "What do I actually get for the subscription?",
                a: (
                  <p>
                    Your own booking calendar, a client list (including walk-ins with no account), broadcast groups for
                    drills and videos, and private session notes with a score per routine covered.
                  </p>
                ),
              },
              {
                q: "Can I book someone who doesn't use Snookered?",
                a: <p>Yes. Book a walk-in or phone booking by name alone - it goes straight on the calendar and the client list, no account needed for them.</p>,
              },
              {
                q: "Does a client have to accept a time I propose?",
                a: <p>Yes, unless they have no account - a booking made for someone with no Snookered account is confirmed straight away, since there's no one else to ask.</p>,
              },
              {
                q: "How is this different from just using WhatsApp and a paper diary?",
                a: <p>One place instead of three: the booking, the message thread and the session notes all sit against the same client, so nothing gets lost between apps.</p>,
              },
              {
                q: "How do I apply?",
                a: (
                  <p>
                    Choose Coach (or Both) when you register, or apply from Profile if you already play. Tell us about your
                    experience and give us a way to check you - socials, a WPBSA number, whatever you have.
                  </p>
                ),
              },
              {
                q: "What if I'm not approved?",
                a: <p>Applying is free either way. You'll get a reason, and you're welcome to apply again once you can address it.</p>,
              },
            ]}
          />
          <p className="note">
            Looking to book a coach instead of becoming one? See <Link to="/find-a-coach">Find a Coach</Link>.
          </p>
        </div>
      </section>

      <LaunchList />
      <Cta title="Run your diary on Snookered." body="Applying is free. Questions in the meantime? We read every message." />
    </>
  );
}
