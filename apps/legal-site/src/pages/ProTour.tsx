import { Cta, Faq, FeatureStory, PageHero, Strip, type Story } from "../components/Blocks";
import { TourBracket, TourFollow, TourLiveCard, TourMatchCentre, TourRankings } from "../components/ProTour";

export default function ProTour() {
  const stories: Story[] = [
    {
      id: "live",
      kicker: "Live & results",
      title: "Every match, in your own time zone.",
      body: "Live scores from the whole professional tour, with every session time shown in your local time - not UK time you have to work out. Where a match is being streamed, the stream is one tap away.",
      points: [
        "Live frame scores as they happen",
        "Every session of a long match, afternoon and evening",
        "A link to watch, where the match is streamed",
        "Coming up and results, tournament by tournament",
      ],
      visual: <TourLiveCard />,
    },
    {
      id: "draw",
      kicker: "The draw",
      title: "The whole draw, round by round.",
      body: "Each tournament in the order it is played, from the qualifiers and group stages through to the final, with no rounds missing. Switch to the bracket to see the tree, and who could meet whom.",
      points: [
        "Fixtures by day and session, in your time zone",
        "A bracket view from any round to the final",
        "Slots still to fill read “Winner of” - not just “TBD”",
        "The prize fund, round by round",
      ],
      visual: (
        <div className="board-panel">
          <TourBracket />
        </div>
      ),
    },
    {
      id: "match",
      kicker: "Match centre",
      title: "More than the score.",
      body: "Open any match for the frame-by-frame scores and the breaks that won them, the two players' head-to-head and every past meeting, and how each of them has played this season.",
      points: ["Frame scores and breaks, session by session", "Head-to-head record and past meetings", "Each player's season: won-lost and recent form"],
      visual: <TourMatchCentre />,
    },
    {
      id: "follow",
      kicker: "Follow players",
      title: "Never miss your player.",
      body: "Follow the players you care about. Their matches are pinned to the top of Live & results, and you get a notification when their match starts and when it finishes.",
      points: ["A notification when their match starts and ends", "Their next match or live score, pinned at the top", "A live scores strip on your home screen"],
      visual: <TourFollow />,
    },
    {
      id: "rankings",
      kicker: "Rankings & news",
      title: "Know the tour inside out.",
      body: "The money rankings for this season and last, a profile for every player with their story, titles and season so far, and the latest news from the World Snooker Tour and BBC Sport.",
      points: ["Money rankings, searchable, with player photos", "Player profiles: ranking, titles, 147s and biography", "News from WST and BBC Sport in one feed"],
      visual: <TourRankings />,
    },
  ];
  return (
    <>
      <PageHero
        eyebrow="Pro Tour"
        title="The pro tour, live in your pocket."
        lead="Live scores, fixtures and results from every professional tournament - in your own time zone - with the draw, the bracket, head-to-heads and notifications for the players you follow."
        strip={
          <Strip label="Live: Ashworth 3, Chen 2, best of 9, quarter-final" tag="Live" live>
            <span className="strip-name">Ashworth</span>
            <span className="strip-num">3</span>
            <span className="strip-dim">(9)</span>
            <span className="strip-num">2</span>
            <span className="strip-name">Chen</span>
          </Strip>
        }
        aside={<TourLiveCard />}
      />
      <FeatureStory stories={stories} />
      <Faq
        items={[
          {
            q: "Which tournaments are covered?",
            a: "Every event on the World Snooker Tour - ranking and invitational events, with their qualifiers and group stages - and the World Women's Snooker Tour. Fixtures and results come from snooker.org.",
          },
          {
            q: "Can I watch matches in the app?",
            a: "Where a match is being streamed, Snookered links to the stream. What you can watch depends on where you are and who holds the rights there.",
          },
          {
            q: "How quickly do scores update?",
            a: "Within a minute or so of a frame ending while a tournament is on. Open the app and it shows the latest straight away.",
          },
          {
            q: "Do I need an account to follow players?",
            a: "Following works without one, and pins their matches to the top. Signing in adds notifications when their matches start and finish.",
          },
        ]}
      />
      <Cta title="Follow the tour your way." body="Snookered is coming to iPhone. Want to know when it lands, or have a question about the pro tour? Get in touch." />
    </>
  );
}
