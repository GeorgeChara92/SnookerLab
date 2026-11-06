import { SPOTS, type BallColour } from "../scanSnooker/table";
import type { PlacedBall } from "../scanSnooker/position";

/**
 * The rules of snooker, in plain words, for looking up during a match or a practice session.
 * Written from the WPBSA Official Rules of Snooker, not copied from them, so anything here should
 * be checked against the current edition before it changes. Club and league rules sometimes
 * differ (the miss rule most of all), and the topics say so where it matters.
 */

export type RuleTopicId =
  | "basics"
  | "snookers"
  | "fouls"
  | "foul-and-miss"
  | "free-ball"
  | "touching-ball"
  | "end-of-frame";

export type RuleSection = {
  heading: string;
  body?: string;
  points?: string[];
};

export type RuleTopic = {
  id: RuleTopicId;
  title: string;
  /** A MaterialCommunityIcons name. */
  icon: string;
  /** The answer in one or two sentences, shown first and in the list. */
  short: string;
  sections: RuleSection[];
  /** A position on the table that shows the rule. */
  diagram?: { caption: string; balls: PlacedBall[] };
  questions: Array<{ q: string; a: string }>;
  related: RuleTopicId[];
};

let ballCount = 0;
const at = (colour: BallColour, x: number, y: number): PlacedBall => ({ id: `rule-ball-${(ballCount += 1)}`, colour, x, y });
const onSpot = (colour: Exclude<BallColour, "cue" | "red">) => at(colour, SPOTS[colour].x, SPOTS[colour].y);
const allColours = () => (["yellow", "green", "brown", "blue", "pink", "black"] as const).map(onSpot);

export const RULE_TOPICS: RuleTopic[] = [
  {
    id: "basics",
    title: "How a frame works",
    icon: "billiards",
    short:
      "Pot a red, then a colour, and repeat. Once the reds are gone, pot the colours in order from yellow to black. The higher score wins the frame.",
    sections: [
      {
        heading: "Breaking off",
        body: "Toss a coin for who breaks off in the first frame, then take turns. The cue ball starts in hand: you can place it anywhere in the D, on the line or inside it. The break-off must hit a red first.",
      },
      {
        heading: "The ball on",
        body: "The ball on is the ball you must hit first. Every visit starts on a red. Pot a red and you are on a colour of your choice. Pot the colour and you are back on a red.",
        points: [
          "If it isn't obvious which colour you are playing, nominate it before you play.",
          "Each red that goes in on a fair shot scores 1, so potting two reds at once scores 2. You still get only one colour after.",
          "Your visit ends when you fail to pot or you foul.",
        ],
      },
      {
        heading: "Colours go back, reds don't",
        body: "While reds are left, a potted colour is put back on its own spot. Reds never come back, even one that went in on a foul.",
        points: [
          "If a colour's spot is covered, it goes on the highest-value spot that's free.",
          "If every spot is covered, it goes as close to its own spot as it can.",
        ],
      },
      {
        heading: "The clearance",
        body: "After the last red, and the colour you pot after it, the colours are played in order: yellow, green, brown, blue, pink, black. Now they stay down.",
      },
      {
        heading: "The maximum",
        body: "Fifteen reds each followed by the black, then all six colours, is 147: the highest break possible without a free ball.",
      },
    ],
    questions: [
      {
        q: "Can I pot a red and a colour on the same shot?",
        a: "No. When you are on a red, the colour isn't on, so potting it is a foul.",
      },
      {
        q: "What if I nominate the blue but hit the green first?",
        a: "That's a foul, worth 5: the value of the ball on, because it's higher than the green.",
      },
      {
        q: "Do I have to nominate every colour?",
        a: "Only when it isn't clear which one you are playing. If your opponent or the referee asks, you must say.",
      },
    ],
    related: ["fouls", "end-of-frame"],
  },
  {
    id: "fouls",
    title: "Fouls and penalties",
    icon: "alert-octagon-outline",
    short:
      "A foul gives your opponent at least 4 points, or more if a higher-value ball was involved. Then they choose who plays next.",
    sections: [
      {
        heading: "What a foul is worth",
        body: "The penalty is the value of the ball on or of the highest-value ball involved in the foul, whichever is more. It is never less than 4, so a foul is always worth 4, 5, 6 or 7.",
        points: [
          "On a red, the cue ball goes in-off: 4.",
          "On a red, you hit the blue first: 5.",
          "You nominate the blue and hit the green first: 5, the value of the ball on.",
          "On a red, the black goes in: 7.",
        ],
      },
      {
        heading: "The common fouls",
        points: [
          "Missing every ball, or hitting a ball that isn't on first.",
          "Going in-off: the cue ball goes into a pocket.",
          "Potting a ball that isn't on.",
          "Knocking any ball off the table.",
          "Touching any ball with your body, clothes, the rest or anything else, other than the cue ball with the tip of your cue as you play.",
          "A push shot: the tip is still on the cue ball when it hits the object ball, or stays on it for longer than a normal strike.",
          "A jump shot: the cue ball leaves the cloth and goes over any part of a ball before hitting the ball on. If it hits the ball on first and then jumps, that's fine.",
          "Hitting the cue ball more than once on the same shot.",
          "Hitting two balls at the same moment, unless they are two reds, or a free ball and the ball on.",
          "Playing without at least one foot on the floor.",
          "Playing before every ball has stopped, or before a colour has been put back on its spot.",
          "Playing from outside the D when the cue ball is in hand.",
        ],
      },
      {
        heading: "What happens next",
        body: "The penalty goes on your opponent's score, and nothing you potted on that shot counts. Your opponent then chooses:",
        points: [
          "Play the next shot themselves, from where the balls are.",
          "Make you play again from where the balls are.",
          "If the referee called a miss, have the balls put back and make you play again.",
        ],
      },
      {
        heading: "Balls after a foul",
        body: "Reds that went in, or off the table, stay off and score nothing. Colours are put back on their spots. If the cue ball went in-off or off the table, the next player has it in hand and places it in the D.",
      },
    ],
    questions: [
      {
        q: "Do I lose the points I scored earlier in the break?",
        a: "No. Points from earlier shots stand. Only the shot you fouled on scores nothing.",
      },
      {
        q: "Is a miscue a foul?",
        a: "Not on its own. It's a foul only if something else goes wrong, such as missing the ball on or the tip hitting the cue ball twice.",
      },
      {
        q: "My sleeve touched a ball but it didn't move. Is that a foul?",
        a: "Yes. Touching a ball is a foul whether it moves or not. It's good sportsmanship to call your own fouls.",
      },
      {
        q: "Do I have to hit a cushion after hitting the ball on?",
        a: "No, that's a pool rule. In snooker, a shot that hits the ball on first and breaks no other rule is fair.",
      },
    ],
    related: ["foul-and-miss", "free-ball", "touching-ball"],
  },
  {
    id: "foul-and-miss",
    title: "Foul and a miss",
    icon: "replay",
    short:
      "If you don't make a good enough attempt to hit the ball on, the referee calls a miss. Your opponent gets the penalty, and can have the balls put back for you to try again.",
    sections: [
      {
        heading: "Why it exists",
        body: "Without it, a player could miss on purpose: give away 4 points but leave their opponent in a worse spot. The miss rule means you must genuinely try to hit the ball on.",
      },
      {
        heading: "When it's called",
        body: "Whenever you fail to hit the ball on first, the referee decides whether that was your best attempt. If it wasn't, they call foul and a miss. It's a judgement, based on how hard the escape was and how good the player is.",
      },
      {
        heading: "When it isn't called",
        points: [
          "Only the black is left.",
          "There is no way to hit the ball on at all.",
          "Usually, once the score means either player needs snookers, as long as the referee is satisfied the miss wasn't deliberate.",
        ],
      },
      {
        heading: "Three misses and you lose the frame",
        body: "If you had a clear, straight path to hit a ball on full in the face, with nothing in the way, a miss is called every time you fail to hit it. Fail three times in a row from that position and you lose the frame. The referee warns you after the second miss.",
      },
      {
        heading: "Your opponent's choice",
        points: [
          "Play the next shot from where the balls are.",
          "Make you play again from where the balls are.",
          "Have the referee put every ball back where it was, and make you play again. You pay the penalty each time.",
        ],
      },
      {
        heading: "In club and league games",
        body: "Many leagues play the miss rule loosely or not at all, and without a referee it's rarely called. Agree how you're playing it before you start. In live scoring, Scan snooker records where the balls are so you can put them back after a miss.",
      },
    ],
    diagram: {
      caption:
        "Snookered behind the blue with the reds beyond it. Any escape the referee judges a genuine try is just a foul; a weak one is a foul and a miss.",
      balls: [
        ...allColours(),
        at("red", 800, 700),
        at("red", 950, 650),
        at("red", 1060, 760),
        at("red", 700, 800),
        at("red", 890, 560),
        at("cue", 889, 1842),
      ],
    },
    questions: [
      {
        q: "Is a miss an extra penalty?",
        a: "No. You give away the same points as the foul. What the miss adds is your opponent's option to put the balls back.",
      },
      {
        q: "Can it be a miss if I was snookered?",
        a: "Yes. Being snookered doesn't excuse a weak attempt. Only the three-miss rule needs a clear path to the ball on.",
      },
    ],
    related: ["fouls", "snookers", "free-ball"],
  },
  {
    id: "free-ball",
    title: "Free ball",
    icon: "numeric-1-circle-outline",
    short:
      "If a foul leaves you snookered, you can nominate any ball to play as the ball on. It counts as the ball on and scores the same.",
    sections: [
      {
        heading: "When you get one",
        body: "After a foul, if the next player is snookered on every ball on, the referee calls free ball. The next player can take it, or make the player who fouled play again, in which case there's no free ball for them.",
      },
      {
        heading: "How it scores",
        points: [
          "While reds are left, the free ball counts as a red: pot it for 1, then play a colour as normal.",
          "On the colours, the free ball is worth the same as the colour you are on. Pot it and you are still on that colour.",
          "A colour potted as a free ball goes back on its spot.",
        ],
      },
      {
        heading: "What you can't do",
        points: [
          "Hit another ball first. You must hit the free ball first, or the free ball and the ball on together.",
          "Snooker your opponent behind the free ball. That's a foul, unless only the pink and black are left.",
        ],
      },
      {
        heading: "If you pot both",
        body: "If the free ball and the ball on both go in, only the ball on scores. On the reds, each ball counts as a red, so both score.",
      },
      {
        heading: "The 155 break",
        body: "A free ball at the start, followed by the black, then fifteen reds and blacks and all the colours, makes 155: the highest break possible.",
      },
    ],
    diagram: {
      caption:
        "After a foul the cue ball is left tight behind the brown, so every red is blocked. That's a free ball: the next player can nominate any colour and play it as a red.",
      balls: [...allColours(), at("red", 760, 960), at("red", 1010, 930), at("red", 880, 1060), at("red", 1130, 1150), at("red", 650, 1180), at("cue", 889, 2886)],
    },
    questions: [
      {
        q: "Do I have to take the free ball?",
        a: "No. You can make the player who fouled play again instead.",
      },
      {
        q: "I can see part of one red. Is it still a free ball?",
        a: "Yes, as long as you can't hit both edges of any ball on. If even one ball on is clear on both edges, it isn't a free ball.",
      },
      {
        q: "After potting the free ball, can I play the same colour again?",
        a: "Yes. It goes back on its spot, and if you are now on a colour, you can choose it.",
      },
    ],
    related: ["snookers", "fouls", "foul-and-miss"],
  },
  {
    id: "touching-ball",
    title: "Touching ball",
    icon: "circle-double",
    short:
      "If the cue ball stops touching a ball you can play, you must play away without moving that ball, and you don't need to hit anything else.",
    sections: [
      {
        heading: "What happens",
        body: "The referee calls touching ball. Play the cue ball away from the ball it's touching. If that ball moves, it's a push shot and a foul.",
      },
      {
        heading: "Touching a ball on",
        body: "Playing away counts as hitting it, so you don't need to hit another ball. You can play safe anywhere on the table.",
        points: [
          "On the colours after potting a red, any colour it's touching can be on: nominate it and play away.",
        ],
      },
      {
        heading: "Touching a ball that isn't on",
        body: "Play away without moving it, and you must still hit a ball on. The usual penalties apply.",
      },
    ],
    diagram: {
      caption:
        "The cue ball has stopped against a red. On a red, playing away counts as hitting it, so you can play safe without touching another ball.",
      balls: [...allColours(), at("red", 820, 760), at("red", 980, 720), at("red", 600, 1300), at("cue", 652.5, 1300)],
    },
    questions: [
      {
        q: "The balls are almost touching. Can I play straight through?",
        a: "Usually that's a push shot, unless you only clip a fine edge. Ask the referee whether they are touching before you play.",
      },
      {
        q: "It's touching a red and I'm on a red. Do I need to hit another red?",
        a: "No. Play away without moving the red it's touching, and that counts as a fair shot.",
      },
    ],
    related: ["fouls", "basics"],
  },
  {
    id: "snookers",
    title: "Snookers",
    icon: "eye-off-outline",
    short:
      "You're snookered when a ball you can't hit blocks your straight path to every ball you can. Needing snookers means you're behind by more than is left on the table.",
    sections: [
      {
        heading: "What snookered means",
        body: "You're snookered when a straight shot at every ball on is fully or partly blocked by a ball that isn't on. If you can hit both edges of any ball on directly, you're not snookered.",
      },
      {
        heading: "Laying a snooker",
        body: "A snooker is a safety: you hide the cue ball so your opponent can't hit the ball on directly, hoping they foul or leave you a chance.",
      },
      {
        heading: "Needing snookers",
        body: "Count what's left. While reds remain, each red is worth 8 (the red and the black), plus 27 for the colours. If you're behind by more than that, you need snookers: penalty points from your opponent's fouls to catch up.",
        points: ["With 3 reds left, there are 3 × 8 + 27 = 51 points on the table."],
      },
    ],
    questions: [
      {
        q: "Is missing the ball on a foul if I'm snookered?",
        a: "Yes, always. Whether it's also a miss is a separate call by the referee.",
      },
      {
        q: "Do I get a free ball every time I'm snookered?",
        a: "No, only when the snooker comes straight after your opponent's foul. A snooker laid with a fair shot is just good safety.",
      },
    ],
    related: ["free-ball", "foul-and-miss", "end-of-frame"],
  },
  {
    id: "end-of-frame",
    title: "Ending a frame",
    icon: "flag-checkered",
    short:
      "A frame ends when the last black is potted or fouled, or a player concedes. If the scores are level, the black is re-spotted.",
    sections: [
      {
        heading: "The last black",
        body: "With only the black left, the frame ends as soon as it is potted or there is a foul. The higher score wins.",
      },
      {
        heading: "Re-spotted black",
        body: "If the scores are level once the black has gone, the black goes back on its spot. The players toss a coin, and the winner chooses who plays first, with the cue ball in hand in the D. The next pot or foul wins it.",
      },
      {
        heading: "Conceding",
        body: "You can concede instead of playing the frame out. Most players do once they need snookers and getting them looks hopeless. The frame goes to your opponent.",
      },
      {
        heading: "Re-rack",
        body: "If neither player can make progress and the position keeps repeating, the referee can call a stalemate. Players are warned first, and if nothing changes the frame is started again, with the same player breaking off.",
      },
    ],
    questions: [
      {
        q: "If I foul on the last black, does my opponent win?",
        a: "They get 7 and the frame ends. If that leaves the scores level, it goes to a re-spotted black.",
      },
      {
        q: "Can I still win a frame when I need snookers?",
        a: "Yes. Lay a snooker, and every foul your opponent makes adds penalty points to your score.",
      },
    ],
    related: ["snookers", "basics"],
  },
];

export const RULE_GROUPS: Array<{ title: string; topics: RuleTopicId[] }> = [
  { title: "Playing a frame", topics: ["basics", "snookers"] },
  { title: "Fouls", topics: ["fouls", "foul-and-miss", "free-ball", "touching-ball"] },
  { title: "Finishing", topics: ["end-of-frame"] },
];

export const RULES_SOURCE =
  "Written from the WPBSA Official Rules of Snooker. Clubs and leagues sometimes play their own versions, the miss rule most of all, so agree before you start.";

export const getRuleTopic = (id: RuleTopicId) => RULE_TOPICS.find((topic) => topic.id === id);
