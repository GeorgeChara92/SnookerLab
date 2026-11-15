import { Link } from "react-router";
import { Check } from "lucide-react";
import { Arrow, Cta, PageHero, Reveal } from "../components/Blocks";

const GROUPS: { title: string; to: string; items: string[] }[] = [
  { title: "Scoring", to: "/scoring", items: ["Live scoring, ball by ball", "Points remaining and snookers required", "Fouls, a Miss button and free balls", "Works offline and syncs later", "Match overview and a share card"] },
  { title: "Record a Snooker", to: "/record-snooker", items: ["Walk round the table and the balls are found", "Saved on a table diagram", "Rings on the cloth to put every ball back"] },
  { title: "Practice", to: "/practice", items: ["A library of routines, drawn on the table", "Guides with photos and write-ups", "Build your own routines", "Personal bests, progress and leaderboards", "Session builder, weekly plan and a streak"] },
  { title: "Snookered Coach", to: "/coach", items: ["Feedback from a clip of your own game", "The one thing to fix first", "Routines picked for what it found"] },
  { title: "The rules", to: "/scoring", items: ["The rules of snooker in plain English", "Fouls, the miss rule and free balls", "The odd situations, like a ball falling in by itself"] },
  { title: "Stats", to: "/scoring", items: ["Form over your recent matches", "Practice week by week", "High breaks and head-to-heads"] },
  { title: "Community", to: "/community", items: ["Friend matches that count for both players", "Follow friends' matches live", "Groups with chat, a feed and leaderboards", "Club tournaments and leagues"] },
  { title: "Pro Tour", to: "/pro-tour", items: ["Live scores in your time zone", "The draw and the bracket", "Money rankings and player profiles", "Follow players and get notified"] },
  { title: "Coaching", to: "/find-a-coach", items: ["Find and book a verified coach", "A coach diary with walk-in clients", "Broadcast groups and session notes"] },
];

export default function AllFeatures() {
  return (
    <>
      <PageHero eyebrow="All features" title="Everything Snookered does." lead="The whole app on one page. Tap a heading for the full story." />
      <section className="section tight alt">
        <div className="wrap">
          <div className="extras">
            {GROUPS.map((group, index) => (
              <Reveal key={group.title} delay={(index % 3) * 0.05} className="extra">
                <Link to={group.to} className="extra-link">
                  <h3>{group.title}</h3>
                  <ul className="checks">
                    {group.items.map((item) => (
                      <li key={item}>
                        <Check aria-hidden="true" strokeWidth={2.25} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <span className="bento-go">
                    Read more <Arrow />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>
      <Cta title="See it for yourself." body="Snookered is coming to iPhone. Want to know when it lands? Get in touch." />
    </>
  );
}
