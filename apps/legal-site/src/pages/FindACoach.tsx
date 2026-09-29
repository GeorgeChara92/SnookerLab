import { Link } from "react-router";
import { Phone } from "../components/Phone";
import { Arrow, FeatureStory, Faq, PageHero, Reveal, Strip, type Story } from "../components/Blocks";
import { LaunchList } from "../components/Tour";
import { SUPPORT_EMAIL } from "../site";

const APPLY_TEMPLATE = [
  "Name: ",
  "Email: ",
  "Where you coach: ",
  "Coaching experience: ",
  "Qualifications / WPBSA number: ",
  "Social media or links (for us to check you by): ",
].join("\n");

export const APPLY_MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent("Coach application")}&body=${encodeURIComponent(APPLY_TEMPLATE)}`;

const PLAYER_STORY: Story[] = [
  {
    id: "find",
    kicker: "As a player",
    title: "Find a verified coach near you.",
    body: "Every coach is reviewed by hand before they can list themselves. See their bio, experience and qualifications before you book - or message them if you want to ask something first.",
    points: ["Reviewed before they can take a booking", "A gallery of their coaching photos", "WPBSA accreditation shown, if they have it"],
    screen: "find-coach",
    alt: "Browsing coaches in Snookered, by name or location",
  },
  {
    id: "profile",
    kicker: "As a player",
    title: "See exactly who you would be booking.",
    body: "A coach's profile is built for hiring them, not just following them: what they teach, where, and an open slot away from a session.",
    points: ["Open slots shown right on their profile", "Book straight from the profile", "Message before you commit, if you want to"],
    screen: "coach-profile",
    alt: "A coach's profile in Snookered, with bio, gallery and a Book a session button",
  },
  {
    id: "message",
    kicker: "As a player",
    title: "Ask before you commit, if you want to.",
    body: "Not sure a coach is the right fit, or just need to check a time works? Message them straight from their profile - no booking required first.",
    points: ["A normal chat thread, the same as with a friend", "No pressure to book before you've asked", "The coach answers when they can"],
    screen: "coach-message",
    alt: "Messaging a coach in Snookered before booking a session",
  },
  {
    id: "my-coaching",
    kicker: "As a player",
    title: "Every session, in one place.",
    body: "What's confirmed, what still needs your answer, and the coach groups you're in - all together, whichever coach it's with.",
    points: ["Accept or decline a proposed time", "Session notes and routines the coach left you", "Reschedule without a back-and-forth"],
    screen: "my-coaching",
    alt: "My Coaching in Snookered, showing upcoming and past sessions with a coach",
  },
];

export const COACH_STORY: Story[] = [
  {
    id: "dashboard",
    kicker: "As a coach",
    title: "Your coaching, at a glance.",
    body: "What's next, how many sessions this week and this month, and who you've been seeing most - the moment you open coach view.",
    points: ["Next session, front and centre", "Sessions this week and this month", "A running client count"],
    screen: "coach-dashboard",
    alt: "A coach's dashboard in Snookered, showing the next session and sessions this month",
  },
  {
    id: "calendar",
    kicker: "As a coach",
    title: "Run it like a diary, not just an inbox.",
    body: "Set your hours, then book a slot yourself for anyone - including someone who has never opened the app. It goes straight on the calendar as confirmed.",
    points: ["Book a walk-in or phone booking by name alone", "No account needed for a one-off client", "Still ask an existing client to confirm a new time"],
    screen: "coach-calendar",
    alt: "A coach's calendar in Snookered, with confirmed sessions and open slots",
  },
  {
    id: "clients",
    kicker: "As a coach",
    title: "Every client, on the books or not.",
    body: "A running list of everyone you've coached, how many sessions, and when you last saw them - a client with no account shows just the same, clearly marked.",
    points: ["Session notes and routines per client, private to you", "Message anyone with a real account", "Delete old history without losing an upcoming session"],
    screen: "coach-clients",
    alt: "A coach's client list in Snookered, including a client with no Snookered account",
  },
  {
    id: "group",
    kicker: "As a coach",
    title: "Post once, reach everyone.",
    body: "A broadcast group for your clients: drills, videos and PDFs posted straight to their feed, instead of sending the same thing one by one.",
    points: ["Photos, videos and PDFs, not just text", "Only clients with an account can be added", "Separate from your one-to-one chats"],
    screen: "coach-group",
    alt: "A coach's broadcast group in Snookered, with a posted drill",
  },
  {
    id: "notes",
    kicker: "As a coach",
    title: "Track exactly what you covered.",
    body: "Log the routines from the session with a score each, and a note on what to pick up next time - private to you, never shown to the client.",
    points: ["A score per routine covered", "Notes only you can see", "Everything sits against that one session, ready next time"],
    screen: "session-notes",
    alt: "A coach logging session notes and routine scores after a session in Snookered",
  },
];

export default function FindACoach() {
  return (
    <>
      <PageHero
        eyebrow="Find a Coach"
        title="Book a real coach. Or run your own diary."
        lead="Search coaches near you and book a session in a couple of taps - or apply to coach yourself and take bookings, even from someone who has never opened the app."
        strip={
          <Strip label="Coach calendar: Tuesday, 6pm, confirmed" tag="Diary">
            <span className="strip-name">Tuesday · 6:00pm</span>
            <i className="strip-sep hide-sm" aria-hidden="true" />
            <span className="strip-dim hide-sm">Confirmed</span>
          </Strip>
        }
        aside={<Phone screen="coach-profile" alt="A coach's profile in Snookered, with a Book a session button" sizes="(max-width: 900px) 72vw, 300px" eager />}
      />

      <FeatureStory stories={PLAYER_STORY} />
      <FeatureStory stories={COACH_STORY} />

      <section className="section tight alt">
        <div className="wrap narrow-grid">
          <Reveal className="section-head">
            <p className="eyebrow">Want to coach?</p>
            <h2 className="display-l">Apply to coach.</h2>
            <p className="lead">
              We check every coach by hand - your experience, qualifications and who you say you are - before you can list
              yourself or take a booking. It's free to apply. An approved coach pays a small subscription, monthly or a
              discounted annual rate, to take bookings through Snookered.
            </p>
          </Reveal>
          <a className="btn btn-primary" href={APPLY_MAILTO}>
            Apply to coach <Arrow />
          </a>
          <p className="note">
            Already have the app? Apply from Profile instead - it's quicker, and you can track your application there. Want
            the full pitch first? See <Link to="/coach-diary">Coach Diary</Link>.
          </p>
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
                q: "How do I become a coach in the app?",
                a: (
                  <p>
                    Choose Coach (or Both) when you register, or apply from Profile if you already play. Tell us about your
                    experience and give us a way to check you - socials, a WPBSA number, whatever you have. We review every
                    application by hand before approving it.
                  </p>
                ),
              },
              {
                q: "Is there a fee to become a coach?",
                a: <p>Applying is free. Once approved, listing yourself is £4.99 a month, or £39.99 a year - to take bookings through Snookered.</p>,
              },
              {
                q: "Can a coach book someone who does not use Snookered?",
                a: <p>Yes. A coach can book a slot for a walk-in or phone booking by name alone - it goes straight on the calendar and the client list, no account needed.</p>,
              },
              {
                q: "Does a player have to accept a proposed time?",
                a: <p>Yes, unless they have no account - a booking made for someone with no Snookered account is confirmed straight away, since there is no one else to ask.</p>,
              },
              {
                q: "Can a coach message a client?",
                a: <p>Yes, from their client list, for anyone with a real account. There is no messaging for a client with no account - message them the normal way instead.</p>,
              },
              {
                q: "What is a coach group for?",
                a: <p>A coach can post drills, videos and PDFs to their clients at once, instead of sending the same thing one by one in chat.</p>,
              },
            ]}
          />
          <p className="note">
            Looking for AI feedback on your own game instead? See <Link to="/coach">Snookered Coach</Link>.
          </p>
        </div>
      </section>

      <LaunchList />
    </>
  );
}
