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
  | "end-of-frame"
  | "ball-falls-in"
  | "ball-moved"
  | "last-red"
  | "off-table"
  | "flukes";

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
        heading: "In live scoring",
        body: "After a foul, Free ball appears for the next player. Tap it, then tap the colour that was nominated once it goes in, and it's scored as the ball on.",
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

RULE_TOPICS.push(
  {
    id: "ball-falls-in",
    title: "A ball falls in by itself",
    icon: "arrow-down-circle-outline",
    short:
      "If a ball hanging over a pocket drops in without anything touching it, it's put back where it was. No foul, and the points already scored stand.",
    sections: [
      {
        heading: "It drops in between shots",
        body: "A ball that had stopped and then falls into a pocket on its own, before the next shot, is put back where it was. Nobody scores and nobody fouls, and play carries on as if it hadn't moved.",
      },
      {
        heading: "It drops in during a shot",
        points: [
          "If nothing in the shot touched it, and nothing would have, it's still put back. It isn't part of the shot.",
          "If a ball in the shot would have hit it, or been affected by it, every ball goes back and the shot is played again.",
        ],
      },
      {
        heading: "It wobbles, then drops",
        body: "A ball that's hit, stops for a moment on the edge and then drops in counts as potted. It isn't put back, so whether it scores or is a foul depends on whether it was on.",
      },
      {
        heading: "On a colour when a red drops",
        body: "Say you pot a red and, while you're on a colour, a red that was hanging over a pocket falls in. If nothing touched it, the red goes back on the edge of the pocket, there's no foul, and you're still on your colour. If your shot knocked it in, even with the lightest touch, a red went in while you were on a colour: that's a foul.",
      },
    ],
    diagram: {
      caption:
        "A red hanging over the corner pocket. If it drops in on its own, it's put back exactly here and nobody scores.",
      balls: [...allColours(), at("red", 1744, 34), at("red", 900, 720), at("red", 1050, 820), at("cue", 1400, 1500)],
    },
    questions: [
      {
        q: "Does a ball that falls in on its own score?",
        a: "No. It's put back, so nobody gets points for it.",
      },
      {
        q: "There's no referee. Who decides where it goes back?",
        a: "Agree it with your opponent and put it back as close as you can to where it was.",
      },
    ],
    related: ["ball-moved", "fouls"],
  },
  {
    id: "ball-moved",
    title: "A ball is moved by accident",
    icon: "hand-back-left-outline",
    short:
      "If anyone other than the player at the table moves a ball, it's put back with no penalty. If you move one on your turn, it's a foul.",
    sections: [
      {
        heading: "Moved by someone else",
        body: "If the referee, a spectator or anyone other than the player at the table moves a ball, still or rolling, it's put back where it was, or where it would have stopped. There's no penalty.",
      },
      {
        heading: "Moved by you on your turn",
        body: "Your turn starts as soon as the last shot ends. Touching any ball while it's your turn, even between shots or while walking round the table, is a foul.",
      },
      {
        heading: "Cleaning a ball",
        body: "Ask the referee, who marks its position, lifts it, cleans it and puts it back. Without a referee, agree it with your opponent first.",
      },
    ],
    questions: [
      {
        q: "Can I mark a ball's position with chalk?",
        a: "No. Using chalk or anything else to mark a position is a foul. Only the referee marks balls.",
      },
      {
        q: "My opponent knocked a ball while I was down on a shot. What now?",
        a: "It's put back where it was, with no penalty to you. Then you play your shot.",
      },
    ],
    related: ["ball-falls-in", "fouls"],
  },
  {
    id: "last-red",
    title: "Fouls around the last red",
    icon: "numeric-1-box-outline",
    short: "Once the reds are gone, a foul or a missed colour sends the next player onto the yellow.",
    sections: [
      {
        heading: "Pot the last red, miss the colour",
        body: "You were on any colour. Miss, and the next player starts the clearance on the yellow.",
      },
      {
        heading: "The last red goes in on a foul",
        body: "It stays down and scores nothing. Your opponent gets the penalty and is on the yellow.",
      },
      {
        heading: "Foul on the colour after the last red",
        body: "The penalty is as normal. If a colour went in it's put back, and the next player is on the yellow.",
      },
      {
        heading: "A free ball now",
        body: "If the foul leaves the next player snookered on the yellow, they get a free ball as usual. It counts as the yellow and is worth 2.",
      },
    ],
    questions: [
      {
        q: "I potted the last two reds in one shot. How many colours do I get?",
        a: "One. Both reds score, then you pot one colour before the clearance starts on the yellow.",
      },
    ],
    related: ["basics", "free-ball"],
  },
  {
    id: "off-table",
    title: "A ball leaves the table",
    icon: "arrow-top-right-thin-circle-outline",
    short:
      "A ball that ends up off the cloth is a foul. Reds stay off, colours are put back on their spots, and a cue ball that went off is in hand.",
    sections: [
      {
        heading: "What counts as off",
        body: "A ball is off the table if it comes to rest anywhere other than the cloth or a pocket, such as the floor or the top of the cushion rail. It's also off if someone picks it up while it's still moving.",
      },
      {
        heading: "Up and back on",
        body: "A ball that jumps onto the cushion rail and rolls back onto the cloth is still in play. If nothing else went wrong, there's no foul.",
      },
      {
        heading: "The penalty",
        body: "The value of the ball on or of the ball that went off, whichever is more, and never less than 4.",
      },
      {
        heading: "After it",
        points: [
          "A red stays off and scores nothing.",
          "A colour goes back on its spot.",
          "If the cue ball went off, the next player has it in hand and places it in the D.",
        ],
      },
    ],
    questions: [
      {
        q: "I potted the ball on but the cue ball flew off. Does the pot count?",
        a: "No. It's a foul, so nothing on that shot scores, and a potted red stays down.",
      },
    ],
    related: ["fouls", "ball-moved"],
  },
  {
    id: "flukes",
    title: "Flukes and odd pots",
    icon: "auto-fix",
    short:
      "There's no calling the pocket in snooker. Any ball on that goes in on a fair shot counts, however it got there.",
    sections: [
      {
        heading: "Flukes count",
        body: "A red that goes in off three cushions scores the same as one you meant. Nobody has to say which pocket.",
      },
      {
        heading: "Plants and cannons",
        points: [
          "On the reds, hit a red first and every red that goes in counts, even one knocked in by another red.",
          "If a colour goes in while you're on a red, it's a foul, even if you hit a red first.",
          "On a colour, the nominated colour must be hit first and be the one that goes in. Pot a different colour and it's a foul.",
        ],
      },
      {
        heading: "Doubles and sets",
        body: "Any pot is fine as long as the ball on is hit first and nothing else breaks a rule: doubles off the cushion, plants, sets and kisses all count.",
      },
    ],
    questions: [
      {
        q: "I hit a red and it knocked the black in. Foul?",
        a: "Yes. The black wasn't on, so it's a 7-point foul and the black is put back.",
      },
      {
        q: "I nominated the blue, hit it, and it knocked the pink in. What happens?",
        a: "Foul, worth 6: the pink wasn't on. The pink goes back on its spot.",
      },
    ],
    related: ["fouls", "basics"],
  }
);

export const RULE_GROUPS: Array<{ title: string; topics: RuleTopicId[] }> = [
  { title: "Playing a frame", topics: ["basics", "snookers"] },
  { title: "Fouls", topics: ["fouls", "foul-and-miss", "free-ball", "touching-ball"] },
  { title: "Finishing", topics: ["end-of-frame"] },
  { title: "Unusual situations", topics: ["ball-falls-in", "ball-moved", "last-red", "off-table", "flukes"] },
];

export const RULES_SOURCE =
  "Written from the WPBSA Official Rules of Snooker. Clubs and leagues sometimes play their own versions, the miss rule most of all, so agree before you start.";

export const getRuleTopic = (id: RuleTopicId) => RULE_TOPICS.find((topic) => topic.id === id);
