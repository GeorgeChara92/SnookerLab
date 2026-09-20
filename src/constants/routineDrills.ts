import { Routine, RoutineCategory, RoutineDiagram } from "../types";
import { getYoutubeWatchUrl } from "../utils/youtube";
import { DIAGRAM_BALL_LENGTH, DIAGRAM_BALL_WIDTH } from "./theme";
import { LINE_UP_REDS, centreLineReds } from "./routineDiagrams";

/**
 * The second wave of the routine library.
 *
 * These are the drills that keep coming up wherever snooker is coached: Frank Callan's practice
 * routines (the coach behind Steve Davis and John Parrott), the graded routines used by academy
 * players, and the standards that have been passed around club tables for decades - the line-up
 * family, reds across the middle, the shot to nothing, the break-off.
 *
 * Every drill carries a diagram, because a paragraph describing where fifteen reds go is far
 * harder to follow than a picture of the table. Positions are fractions of the playing surface:
 * x from the left cushion, y from the baulk cushion.
 */

const now = new Date().toISOString();

/** Spot positions, worked out from the real dimensions of a full-size table. */
const SPOT = {
  yellow: [0.663, 0.206] as [number, number],
  green: [0.337, 0.206] as [number, number],
  brown: [0.5, 0.206] as [number, number],
  blue: [0.5, 0.5] as [number, number],
  pink: [0.5, 0.75] as [number, number],
  black: [0.5, 0.909] as [number, number],
};

const colourSpots = (): RoutineDiagram["balls"] => [
  { colour: "yellow", x: SPOT.yellow[0], y: SPOT.yellow[1] },
  { colour: "green", x: SPOT.green[0], y: SPOT.green[1] },
  { colour: "brown", x: SPOT.brown[0], y: SPOT.brown[1] },
  { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
  { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
  { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
];

/** Reds evenly spaced along a straight line between two points. */
const redLine = (
  from: [number, number],
  to: [number, number],
  count: number
): RoutineDiagram["balls"] =>
  Array.from({ length: count }, (_, index) => {
    const t = count === 1 ? 0.5 : index / (count - 1);
    return {
      colour: "red" as const,
      x: from[0] + (to[0] - from[0]) * t,
      y: from[1] + (to[1] - from[1]) * t,
    };
  });

/** How wide a ball is as a fraction of the table, matching how the diagram draws it. */
const BALL_W = DIAGRAM_BALL_WIDTH;
const BALL_L = DIAGRAM_BALL_LENGTH;

/**
 * The full triangle: fifteen reds in five rows, apex sitting behind the pink and widening
 * towards the black. Rows are a ball apart, offset by the height of an equilateral triangle.
 */
const pack = (apexY = 0.78): RoutineDiagram["balls"] =>
  Array.from({ length: 5 }).flatMap((_, row) =>
    Array.from({ length: row + 1 }, (_, index) => ({
      colour: "red" as const,
      x: 0.5 + (index - row / 2) * BALL_W,
      y: apexY + row * BALL_L * 0.866,
    }))
  );

/** Reds evenly spaced around a circle, for the drills that ring a colour. */
const redRing = (centre: [number, number], radius: number, count: number): RoutineDiagram["balls"] =>
  Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2;
    return {
      colour: "red" as const,
      // The table is twice as long as it is wide, so the ring is scaled to stay round on screen.
      x: centre[0] + Math.cos(angle) * radius,
      y: centre[1] + (Math.sin(angle) * radius) / 2,
    };
  });

type VideoMeta = { id: string; title: string; channel: string };

/**
 * Lessons that cover the drill, so the page has a thumbnail to open with. Every id here was
 * checked against YouTube's oembed endpoint, so none of them are dead links.
 */
const withVideo = (primary: VideoMeta, alternate?: VideoMeta) => ({
  youtube_video_id: primary.id,
  youtube_url: getYoutubeWatchUrl(primary.id),
  youtube_title: primary.title,
  youtube_channel: primary.channel,
  youtube_alt_video_id: alternate?.id,
  youtube_alt_url: alternate ? getYoutubeWatchUrl(alternate.id) : undefined,
  youtube_alt_title: alternate?.title,
  youtube_alt_channel: alternate?.channel,
});

const base = {
  is_system_routine: true,
  created_at: now,
  updated_at: now,
  content_type: "routine" as const,
};

export const EXTRA_CATEGORIES: RoutineCategory[] = [
  {
    id: "cat-openings",
    name: "Break-Off & Openings",
    description:
      "The first shot of the frame and the first shot of a visit. Thin contacts, the return to baulk, and the awkward opening pot that gets a break started.",
    icon: "🎬",
    color: "#2563EB",
    order_index: 7,
  created_at: now,
  },
  {
    id: "cat-rest-play",
    name: "Rest Play & Awkward Shots",
    description:
      "The half of the table you cannot reach. Rest, spider and swan neck, bridging over a ball, and cueing with the white tight on the cushion.",
    icon: "🕸️",
    color: "#7C3AED",
    order_index: 8,
  created_at: now,
  },
  {
    id: "cat-challenges",
    name: "Challenges & Pressure Tests",
    description:
      "Scored tests with a number at the end of them. Play them the same way every time and the score tells you whether you are actually improving.",
    icon: "🏆",
    color: "#B45309",
    order_index: 9,
  created_at: now,
  },
];

export const EXTRA_ROUTINES: Routine[] = [
  // ---------------------------------------------------------------- straight cueing
  {
    ...base,
    id: "routine-up-and-down-spots",
    category_id: "cat-straight-cueing",
    name: "Up and Down the Spots",
    icon: "📏",
    difficulty: "beginner",
    summary: "Frank Callan's test of whether you actually cue straight.",
    description:
      "The cue ball is sent up the table over the blue, pink and black spots and should come back down the same line. Nothing else in snooker shows up unintended side so plainly: if the white returns off line, your cue is not going where you think it is.",
    setup_instructions:
      "Put the cue ball on the brown spot and nothing else on the table. Stand at the baulk end and line up along the spots.",
    steps: [
      "Play the white at medium pace straight over the blue, pink and black spots into the top cushion.",
      "Watch where it comes back. Straight cueing brings it back over all three spots to the brown.",
      "If it drifts, you have put side on without meaning to. Check that the cue is travelling through the ball, not across it.",
      "Play ten and count how many return to within a ball's width of the brown spot.",
      "Then repeat harder. Pace makes straight cueing harder, which is the point of the second half of the drill.",
    ],
    success_criteria: "Count the returns to the brown out of ten. Seven is a sound cue action; ten at pace is excellent.",
    improves: ["Straight cue delivery", "Unintended side", "Feel for pace"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 10,
    diagram: {
      balls: [{ colour: "cue", x: SPOT.brown[0], y: SPOT.brown[1] }],
      lines: [
        { from: [0.5, 0.206], to: [0.5, 0.98], kind: "shot" },
        { from: [0.5, 0.98], to: [0.5, 0.206], kind: "travel" },
      ],
      caption: "Cue ball on the brown spot, up over blue, pink and black, and back down the same line.",
    },
  },
  {
    ...base,
    id: "routine-cueing-over-pockets",
    category_id: "cat-rest-play",
    name: "Cueing Over the Pocket",
    icon: "🕳️",
    difficulty: "intermediate",
    summary: "Bridging over a pocket, which is where most players' technique quietly falls apart.",
    description:
      "Sooner or later the white sits so that your bridge hand has nothing to stand on but the jaws of a pocket. Callan's point is that the whole shot lives in the bridge: settle the hand and arm first, and the delivery takes care of itself.",
    setup_instructions:
      "Put the cue ball a few inches out from a middle pocket so your bridge hand has to sit over the opening, and a red on the black spot.",
    steps: [
      "Build the bridge first. Spread the fingers across both jaws so the hand cannot rock, and take the weight on the forearm.",
      "Shorten the bridge if you need to. A short, solid bridge beats a long, wobbly one every time.",
      "Pot the red with a smooth, unhurried delivery. Do not stab at it.",
      "Work round all six pockets, five shots at each.",
      "Finish with the white tight against a pocket jaw, where you have to cue with the hand almost off the table.",
    ],
    success_criteria: "Count pots out of thirty. More useful still: note which pocket position you dread and go back to it.",
    improves: ["Bridge under pressure", "Hampered cueing", "Composure in awkward spots"],
    scoring_type: "count",
    max_score: 30,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "cue", x: 0.12, y: 0.5 },
        { colour: "red", x: SPOT.black[0], y: SPOT.black[1] },
      ],
      caption: "The white sits over the jaws of the middle pocket, so the bridge hand has to span the opening.",
    },
  },

  // ---------------------------------------------------------------- long potting
  {
    ...base,
    ...withVideo(
      { id: "EftK9MPXdgI", title: "148. Straight Through the Middle", channel: "Barry Stark Snooker Coach" }
    ),
    id: "routine-reds-across-middle",
    category_id: "cat-long-potting",
    name: "Reds Across the Middle",
    icon: "↔️",
    difficulty: "intermediate",
    summary: "A line of reds across the table, potted one after another into the top corners.",
    description:
      "A Callan staple, and a famous one: Steve Davis is said to have made nineteen in a row of the twenty-one-ball version, and Hendry claimed all twenty-one. Start with six or seven and add reds as you hold your nerve.",
    setup_instructions:
      "Line reds across the middle of the table, one on the blue spot and the rest spread either side of it towards the side cushions. Start with seven and work up to fifteen.",
    steps: [
      "Pot the reds one at a time across the table into the top corner pockets.",
      "Take them in order along the line rather than picking the easy ones, so you cannot flatter yourself.",
      "Keep the same rhythm on every shot. The pots get harder as the angle tightens, not because you are tiring.",
      "Count how many you pot before the first miss, then reset.",
      "When fifteen becomes routine, add the six colours to make it twenty-one balls from one middle pocket to the other.",
    ],
    success_criteria: "Log consecutive pots before your first miss. Ten out of fifteen is a strong club standard.",
    improves: ["Potting across the table", "Sighting at width", "Nerve as the line shortens"],
    scoring_type: "count",
    max_score: 15,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [...redLine([0.12, 0.5], [0.88, 0.5], 7), { colour: "cue", x: 0.3, y: 0.28 }],
      caption: "Seven reds across the middle of the table, potted into the top corners.",
    },
  },
  {
    ...base,
    id: "routine-long-straight-reds",
    category_id: "cat-long-potting",
    name: "Long Straight Reds",
    icon: "🎯",
    difficulty: "intermediate",
    summary: "Dead straight the length of the table: the shot that hides nothing.",
    description:
      "A straight long pot is the honest test. There is no angle to help you and no cover for a crooked delivery, and it is the shot that decides frames from the break-off exchange.",
    setup_instructions:
      "Place five reds spread across the table in line with the top corner pockets, and put the cue ball on the baulk line directly in line with each red as you take it.",
    steps: [
      "Set the white so the pot is as straight as you can make it, then take your time over the line.",
      "Play through the ball with a level cue. Do not add side to 'help' it.",
      "Watch where the white finishes. Dead straight means it follows the red towards the pocket.",
      "Ten attempts, two at each red, and count the pots.",
      "Progress by moving the white back to the baulk cushion.",
    ],
    success_criteria: "Count pots out of ten. Six is respectable; eight is the level that wins frames.",
    improves: ["Long potting", "Straight delivery", "Sighting over distance"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "red", x: 0.1, y: 0.74 },
        { colour: "red", x: 0.3, y: 0.74 },
        { colour: "red", x: 0.5, y: 0.74 },
        { colour: "red", x: 0.7, y: 0.74 },
        { colour: "red", x: 0.9, y: 0.74 },
        { colour: "cue", x: 0.1, y: 0.206 },
      ],
      lines: [{ from: [0.1, 0.206], to: [0.05, 0.99], kind: "shot" }],
      caption: "Line the white up behind each red in turn, straight into the far corner.",
    },
  },
  {
    ...base,
    id: "routine-shoot-out-blues",
    category_id: "cat-long-potting",
    name: "Blues from the D",
    icon: "🔵",
    difficulty: "intermediate",
    summary: "Five blues into each top pocket, played from the D.",
    description:
      "An academy staple. The blue never moves, so the only variable is you, and playing the same shot ten times in a row exposes whether your routine really is a routine.",
    setup_instructions: "Blue on its spot. Cue ball anywhere in the D, moved as you like between shots.",
    steps: [
      "Play five blues into the left top pocket, re-spotting the blue each time.",
      "Then five into the right top pocket.",
      "Set up the same way every time so the shots are comparable.",
      "Go through your full pre-shot routine on every one, including the last.",
      "Score one point per pot out of ten.",
    ],
    success_criteria: "Count pots out of ten and keep the running score. It should climb over weeks, not within a session.",
    improves: ["Long potting", "Repeatable routine", "Concentration"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 15,
    diagram: {
      balls: [
        { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
        { colour: "cue", x: 0.42, y: 0.18 },
      ],
      lines: [
        { from: [0.42, 0.18], to: [0.5, 0.5], kind: "shot" },
        { from: [0.5, 0.5], to: [0.02, 0.98], kind: "travel" },
      ],
      caption: "Blue on its spot, white in the D, five into each top pocket.",
    },
  },
  {
    ...base,
    id: "routine-topspin-long-pots",
    category_id: "cat-long-potting",
    name: "Top Spin Long Pots",
    icon: "⬆️",
    difficulty: "advanced",
    summary: "Long pots played with running top, so the white comes off the top cushion and back down.",
    description:
      "Potting a long red is one thing; potting it and ending up back in the balls is another. Rolling the white through with top and off the top cushion is how a long pot turns into a break rather than a one-visit gamble.",
    setup_instructions:
      "Five reds spread just below the pink spot, white on the baulk line. Colours on their spots.",
    steps: [
      "Pot each red into a top corner with top spin so the white runs on into the top cushion.",
      "The shot only counts if the white comes off the top cushion and finishes below the pink spot.",
      "Keep the cue level. Reaching for top with a raised butt costs you the pot.",
      "Ten attempts, counting only the ones that pot and finish in the scoring area.",
      "Progress by naming the colour you want to be on before you play.",
    ],
    success_criteria: "Count shots out of ten that pot and bring the white back down the table.",
    improves: ["Long potting with position", "Top spin control", "Turning a chance into a break"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        ...redLine([0.2, 0.68], [0.8, 0.68], 5),
        ...colourSpots(),
        { colour: "cue", x: 0.4, y: 0.206 },
      ],
      lines: [
        { from: [0.4, 0.206], to: [0.2, 0.68], kind: "shot" },
        { from: [0.2, 0.68], to: [0.62, 0.98], kind: "travel" },
        { from: [0.62, 0.98], to: [0.72, 0.62], kind: "travel" },
      ],
      caption: "Pot into the top corner, run the white into the top cushion and back down for the next one.",
    },
  },

  // ---------------------------------------------------------------- break building
  {
    ...base,
    id: "routine-half-line-up",
    category_id: "cat-break-building",
    name: "The Half Line Up",
    icon: "➗",
    difficulty: "beginner",
    summary: "The line-up with seven reds: the sensible way in before the full fifteen.",
    description:
      "The full line-up is a thirty-minute commitment and punishing when you are learning. Seven reds gives you the same pattern, the same discipline and a break you can actually finish, which matters more than you would think.",
    setup_instructions:
      "All six colours on their spots. Seven reds in a straight line down the middle of the table, spaced a ball apart, running from just below the pink towards the blue.",
    steps: [
      "Place the white where you like for the first shot only.",
      "Pot red, then colour, then the next red, taking the reds in order down the line.",
      "Keep the white in the open. The temptation is to squeeze between the reds, and it never ends well.",
      "If you miss, the visit is over. Note the break and reset the line.",
      "Maximum is 71: seven reds, seven blacks and the colours cleared.",
    ],
    success_criteria: "Record your best break out of 71 and your average over five visits.",
    improves: ["Break rhythm", "Simple positional patterns", "Finishing what you start"],
    scoring_type: "points",
    max_score: 71,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [...centreLineReds(7, 0.8538), ...colourSpots()],
      caption: "Seven reds down the middle, colours on their spots.",
    },
  },
  {
    ...base,
    id: "routine-six-reds-six-blues",
    category_id: "cat-break-building",
    name: "Six Reds, Six Blues",
    icon: "🔷",
    difficulty: "beginner",
    summary: "Red, blue, red, blue: the gentlest introduction to potting two balls in a row.",
    description:
      "Every break is the same trick repeated - pot a ball and arrive at the next one. Six reds around the blue reduces that to its smallest form, with the easiest colour on the table and the shortest distances to travel.",
    setup_instructions:
      "Blue on its spot. Six reds spread around the blue, roughly a foot away, so each one is pottable into a different pocket.",
    steps: [
      "Place the white for the first red only.",
      "Pot a red, then the blue, re-spotting the blue each time.",
      "Come back off the blue to the next red without touching a cushion if you can.",
      "The visit ends on a miss. Maximum is 42.",
      "When that is comfortable, insist on arriving at the correct side of the blue every time.",
    ],
    success_criteria: "Record your break out of 42. Clearing all six is the pass mark.",
    improves: ["Pot and position together", "Short cue-ball journeys", "Confidence"],
    scoring_type: "points",
    max_score: 42,
    estimated_duration_minutes: 15,
    diagram: {
      balls: [...redRing(SPOT.blue, 0.26, 6), { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] }],
      caption: "Six reds ringed around the blue, each one pottable into a different pocket.",
    },
  },
  {
    ...base,
    id: "routine-right-side-of-blue",
    category_id: "cat-cue-ball-control",
    name: "The Right Side of the Blue",
    icon: "↩️",
    difficulty: "intermediate",
    summary: "Same six reds, but now the angle you leave yourself has to be the right one.",
    description:
      "Potting the blue is easy. Arriving on the side of it that lets you reach the next red is the actual skill, and it is the difference between a break of eight and a break of forty.",
    setup_instructions: "As Six Reds, Six Blues: blue on its spot, six reds spread around it.",
    steps: [
      "Before each blue, say out loud which side of it you need to finish on.",
      "Pot the blue and land on that side. Finishing on the wrong side counts as a miss even if the pot went in.",
      "Take the reds in a fixed order so the routine does not let you dodge the hard one.",
      "Score two points for each blue that finishes on the correct side, one for a pot on the wrong side.",
      "Twelve is a clean run.",
    ],
    success_criteria: "Score out of twelve, where twelve means every blue potted and every angle correct.",
    improves: ["Choosing the side", "Angle control", "Thinking a shot ahead"],
    scoring_type: "points",
    max_score: 12,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [...redRing(SPOT.blue, 0.26, 6), { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] }],
      lines: [
        { from: [0.5, 0.5], to: [0.3, 0.58], kind: "travel" },
        { from: [0.5, 0.5], to: [0.7, 0.58], kind: "travel" },
      ],
      caption: "Name the side of the blue you need before you play, then land on it.",
    },
  },
  {
    ...base,
    id: "routine-scoring-zone",
    category_id: "cat-break-building",
    name: "The Scoring Zone",
    icon: "💰",
    difficulty: "intermediate",
    summary: "Reds scattered round the pink and black, where breaks are actually made.",
    description:
      "Callan's point is blunt: heavy scoring happens at the bottom end of the table. Learning to keep the white in that small area between the pink and the black, taking red after red with the black, is what separates a thirty from a hundred.",
    setup_instructions:
      "Scatter six or seven reds loosely around the pink and black spots, making sure the black is pottable into both top pockets. Put the blue and the baulk colours away if you like, so the drill is only about the scoring zone.",
    steps: [
      "Place the white for the first red only.",
      "Pot red, black, red, black, keeping the white inside the area between the pink and the top cushion.",
      "Take the black whenever it is on. When it is not, the pink is the next best thing.",
      "Any time the white leaves the scoring zone, note it. That is the shot that ends breaks.",
      "Record the break. With seven reds and blacks that is a maximum of 56 before the colours.",
    ],
    success_criteria: "Log your break, and count how many shots left the white above the pink where it belongs.",
    improves: ["Scoring round the black", "Tight cue-ball control", "Shot selection"],
    scoring_type: "points",
    max_score: 56,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "red", x: 0.36, y: 0.78 },
        { colour: "red", x: 0.44, y: 0.85 },
        { colour: "red", x: 0.6, y: 0.82 },
        { colour: "red", x: 0.66, y: 0.72 },
        { colour: "red", x: 0.32, y: 0.68 },
        { colour: "red", x: 0.58, y: 0.94 },
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.48, y: 0.62 },
      ],
      caption: "Reds loose around the pink and black, with the black open to both top pockets.",
    },
  },
  {
    ...base,
    id: "routine-cannons-off-the-black",
    category_id: "cat-break-building",
    name: "Cannons off the Black",
    icon: "💥",
    difficulty: "advanced",
    summary: "Pot the black and use the white to move a red into the open.",
    description:
      "Callan again: promoting balls into pottable positions during a break is what makes big breaks possible. The skill is leaving yourself the correct angle on the black so the white arrives at the red you want to move, with the pace to move it and not so much that you lose the table.",
    setup_instructions:
      "Black on its spot with three or four reds clustered above it near the top cushion. White below the black.",
    steps: [
      "Pot the black and carry the white on into the reds, nudging one clear.",
      "Vary where you put the white so you feel how much top or screw the cannon needs.",
      "Then move the white above the black and play the same idea using the top cushion.",
      "Ten attempts. Score one point for potting the black and a second for leaving a red clearly pottable.",
      "Note which angles let you do both, because those are the ones to play for in a frame.",
    ],
    success_criteria: "Score out of twenty: one for the pot, one for a red left on.",
    improves: ["Developing reds", "Pace on the cannon", "Reading angles in advance"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "red", x: 0.452, y: 0.945 },
        { colour: "red", x: 0.548, y: 0.945 },
        { colour: "red", x: 0.5, y: 0.969 },
        { colour: "cue", x: 0.38, y: 0.84 },
      ],
      lines: [
        { from: [0.38, 0.84], to: [0.5, 0.909], kind: "shot" },
        { from: [0.5, 0.909], to: [0.5, 0.945], kind: "travel" },
      ],
      caption: "Pot the black and carry on into the reds behind it.",
    },
  },
  {
    ...base,
    id: "routine-full-in-the-face",
    category_id: "cat-break-building",
    name: "Full in the Face",
    icon: "🎳",
    difficulty: "advanced",
    summary: "Pot the blue, cannon the pink dead full, and open the pack.",
    description:
      "Harder than it sounds, which is Callan's own warning. Catch the pink even slightly thin and the white slides off towards a corner pocket and out of the game; catch it absolutely full and it goes into the reds while the white stays in the middle of the table.",
    setup_instructions:
      "Blue and pink on their spots, a loose cluster of reds behind the pink towards the black. White below the blue at a slight angle.",
    steps: [
      "Pot the blue and send the white on into the pink.",
      "Hit the pink as full in the face as you can manage, with enough pace to move the reds.",
      "Watch the white. Full contact leaves it near the middle of the table, which is the whole point.",
      "Ten attempts. Score one for the pot and one for the white finishing in the middle third of the table.",
      "If a red comes free and you can pot it, take it. That is the shot doing its job.",
    ],
    success_criteria: "Score out of twenty, and note how often the reds actually moved.",
    improves: ["Opening the pack", "Full-ball contacts", "Power with control"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        ...pack(0.78).slice(0, 10),
        { colour: "cue", x: 0.38, y: 0.4 },
      ],
      lines: [
        { from: [0.38, 0.4], to: [0.5, 0.5], kind: "shot" },
        { from: [0.5, 0.5], to: [0.5, 0.75], kind: "travel" },
      ],
      caption: "Blue first, then the white straight through into the pink and the reds behind it.",
    },
  },
  {
    ...base,
    id: "routine-mini-step-ladder",
    category_id: "cat-break-building",
    name: "Six Reds and Blacks",
    icon: "🪜",
    difficulty: "intermediate",
    summary: "Six reds beside the black. No cannons, no plants, no luck.",
    description:
      "A graded academy routine with one rule that makes it honest: nothing may be moved. You cannot barge a red into a better place, so every red has to be potted from where it sits, and the position has to be exact.",
    setup_instructions:
      "Black on its spot. Six reds in a line beside the black, a ball apart, running from near the top cushion down towards the pink.",
    steps: [
      "Place the white for the first red only.",
      "Pot red, black, red, black through all six reds, re-spotting the black each time.",
      "No cannons and no plants. If you disturb another ball, the attempt is over.",
      "Maximum is 48.",
      "When you can clear it, tighten the line so the reds sit closer together.",
    ],
    success_criteria: "Record your break out of 48. Clearing it twice in a session is a good day.",
    improves: ["Precision position", "Discipline", "Repeating the black"],
    scoring_type: "points",
    max_score: 48,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        ...redLine([0.66, 0.96], [0.66, 0.7], 6),
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.44, y: 0.8 },
      ],
      caption: "Six reds in a line beside the black, taken from top to bottom.",
    },
  },
  {
    ...base,
    id: "routine-the-v",
    category_id: "cat-break-building",
    name: "The V",
    icon: "📂",
    difficulty: "advanced",
    summary: "Fifteen reds in a V, point towards the black. Tighter than the line-up and less forgiving.",
    description:
      "A line-up variant that narrows as you work into it. The two arms give you angles to play with early on, then the point forces precise, short cue-ball movement around the black in exactly the way a real cluster does.",
    setup_instructions:
      "All six colours on their spots. Fifteen reds in a V: the point sitting just below the black spot, the arms opening out down the table towards the middle pockets.",
    steps: [
      "Place the white for the first red only, then pot red and colour through the V.",
      "Work the outside of the arms first. Going into the point early leaves you nothing.",
      "Take the black whenever it is available, because the V is built to keep you near it.",
      "A miss ends the visit. Reset and record the break.",
      "Maximum is 147.",
    ],
    success_criteria: "Best break out of 147, and the number of reds cleared before the first miss.",
    improves: ["Working a cluster", "Break planning", "Patience"],
    scoring_type: "points",
    max_score: 147,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [
        { colour: "red", x: 0.5, y: 0.88 },
        // Seven up each arm from the point, a ball and a half apart along the arm.
        ...[-1, 1].flatMap((side) =>
          Array.from({ length: 7 }, (_, index) => ({
            colour: "red" as const,
            x: Number((0.5 + side * (index + 1) * BALL_W * 1.15).toFixed(4)),
            y: Number((0.88 - (index + 1) * BALL_L * 1.25).toFixed(4)),
          }))
        ),
        ...colourSpots(),
      ],
      caption: "Fifteen reds in a V, the point just below the black.",
    },
  },
  {
    ...base,
    id: "routine-alternate-reds",
    category_id: "cat-break-building",
    name: "Alternate Reds",
    icon: "🔀",
    difficulty: "advanced",
    summary: "The line-up, but you must take the reds from alternate ends.",
    description:
      "The line-up rewards you for working quietly down the line. This version forbids it: every red sends you to the other end of the formation, so the cue ball travels the length of the table again and again and your position has to be genuinely deliberate.",
    setup_instructions: "Set up the standard line-up: colours on their spots, fifteen reds in a line down the middle.",
    steps: [
      "Place the white for the first red only.",
      "Take the top red, then a colour, then the bottom red, then a colour, working inwards from both ends.",
      "Never take two reds from the same end in succession.",
      "A miss, or taking the wrong red, ends the visit.",
      "Maximum is 147, but a break of 40 here is worth far more than 40 in the standard line-up.",
    ],
    success_criteria: "Best break out of 147, plus how many reds you cleared before losing position.",
    improves: ["Long-range position", "Cue-ball journeys", "Planning under constraint"],
    scoring_type: "points",
    max_score: 147,
    estimated_duration_minutes: 30,
    diagram: {
      // The real line-up leaves the colour spots clear, so the reds are not evenly spaced.
      balls: [...LINE_UP_REDS, ...colourSpots()],
      lines: [{ from: [0.5, 0.96], to: [0.5, 0.37], kind: "travel" }],
      caption: "Standard line-up, taken from alternate ends so the white keeps crossing the table.",
    },
  },
  {
    ...base,
    id: "routine-open-table",
    category_id: "cat-break-building",
    name: "The Open Table",
    icon: "🎲",
    difficulty: "advanced",
    summary: "Break off, open the reds, then clear what you are left with. No second chances at the layout.",
    description:
      "Every other break-building drill gives you a tidy formation. A frame does not. This one has you break the reds yourself and then make the best of whatever you get, which is the skill that actually transfers.",
    setup_instructions: "Full frame set up as normal: reds in the triangle, colours on their spots.",
    steps: [
      "Break off properly, as you would in a frame.",
      "Play the reds open with your next shot - a controlled split rather than a smash.",
      "Re-spot the pink if it has moved, take the white in hand for the first shot only, then clear the table.",
      "Play the balls as they lie. No resetting a red that finished awkwardly.",
      "Record the break, then set the whole frame up again.",
    ],
    success_criteria: "Best break out of 147 from a live layout. Compare it with your line-up score; it will be lower, and that gap is the real work.",
    improves: ["Reading a live table", "Opening the pack", "Shot selection"],
    scoring_type: "points",
    max_score: 147,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [
        ...colourSpots(),
        ...pack(),
        { colour: "cue", x: 0.42, y: 0.18 },
      ],
      caption: "A full frame. Break off, split the pack, then clear whatever you leave yourself.",
    },
  },

  // ---------------------------------------------------------------- cue ball control
  {
    ...base,
    id: "routine-ten-blues",
    category_id: "cat-cue-ball-control",
    name: "Ten Blues",
    icon: "🔟",
    difficulty: "beginner",
    summary: "Pot the blue into a middle pocket ten times, playing from wherever the white finishes.",
    description:
      "The blue goes back on its spot; you do not get to move. Each pot sets the next one, so a careless shot leaves you a horrible angle and the routine punishes you immediately. It teaches, very quickly, that where the white stops matters as much as whether the ball went in.",
    setup_instructions: "Blue on its spot, white in hand for the first shot only.",
    steps: [
      "Pot the blue into either middle pocket and re-spot it.",
      "Play the next one from wherever the white has finished.",
      "Try to leave yourself a slight angle rather than dead straight, so you have something to work with.",
      "Ten pots in a row is the target. Count how many you get before the first miss.",
      "Progress by insisting they all go into the same middle pocket.",
    ],
    success_criteria: "Count consecutive blues out of ten.",
    improves: ["Positional awareness", "Angle management", "Consistency"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 15,
    diagram: {
      balls: [
        { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
        { colour: "cue", x: 0.36, y: 0.42 },
      ],
      lines: [
        { from: [0.5, 0.5], to: [0.02, 0.5], kind: "travel" },
        { from: [0.5, 0.5], to: [0.98, 0.5], kind: "travel" },
      ],
      caption: "Blue on its spot into either middle pocket, then play from wherever you finish.",
    },
  },
  {
    ...base,
    id: "routine-pink-blacks",
    category_id: "cat-cue-ball-control",
    name: "Pink and Blacks",
    icon: "🎀",
    difficulty: "intermediate",
    summary: "Pink, black, pink, black, for as long as you can hold the position.",
    description:
      "The two highest-value balls and about eighteen inches between them. It is the pattern that produces centuries, and holding it for ten shots tells you more about your cue-ball control than an hour of potting practice.",
    setup_instructions: "Pink and black on their spots, white in hand for the first shot only.",
    steps: [
      "Pot the pink, re-spot it, and land on the black.",
      "Pot the black, re-spot it, and land on the pink.",
      "Keep going. Small, soft shots: this is a stun-and-touch drill, not a power drill.",
      "Count the pots before the first miss or before you lose position badly enough to need a rescue.",
      "Twenty is an excellent run.",
    ],
    success_criteria: "Count consecutive pots out of twenty.",
    improves: ["Short-range position", "Soft stun and screw", "Scoring round the spots"],
    scoring_type: "count",
    max_score: 20,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.42, y: 0.83 },
      ],
      lines: [{ from: [0.42, 0.83], to: [0.5, 0.75], kind: "shot" }],
      caption: "Pink and black on their spots, both re-spotted, alternating for as long as you can.",
    },
  },
  {
    ...base,
    id: "routine-black-off-spot-cushion",
    category_id: "cat-cue-ball-control",
    name: "Black off the Spot, One Cushion",
    icon: "🎱",
    difficulty: "advanced",
    summary: "The classic black-off-its-spot drill, with the white forced into a cushion every time.",
    description:
      "Potting the black from wherever the white finishes is a well-known drill. Adding the rule that the white must strike a cushion after every pot removes the easy dead-weight shots and forces you to control the ball over a longer journey.",
    setup_instructions: "Black on its spot, white in hand for the first shot only.",
    steps: [
      "Pot the black and re-spot it.",
      "The white must contact at least one cushion on every shot. A pot without a cushion does not count.",
      "Play from wherever the white finishes, however awkward.",
      "Count consecutive pots. Twenty-five is the standard to chase.",
      "Harder version: the white must come off two cushions.",
    ],
    success_criteria: "Count consecutive pots out of twenty-five, all with a cushion contact.",
    improves: ["Cue-ball control off the cushion", "Angle recovery", "Potting the black from anywhere"],
    scoring_type: "count",
    max_score: 25,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.62, y: 0.8 },
      ],
      lines: [
        { from: [0.62, 0.8], to: [0.5, 0.909], kind: "shot" },
        { from: [0.5, 0.909], to: [0.98, 0.86], kind: "travel" },
        { from: [0.98, 0.86], to: [0.66, 0.7], kind: "travel" },
      ],
      caption: "Every pot must send the white into a cushion before it settles.",
    },
  },
  {
    ...base,
    id: "routine-colours-stun",
    category_id: "cat-cue-ball-control",
    name: "Colours in Order, Stun Only",
    icon: "🛑",
    difficulty: "intermediate",
    summary: "Clear the colours using nothing but stun.",
    description:
      "Taking screw and roll out of your hands leaves one tool: a dead centre strike at the right pace. It sounds restrictive, and that is the point - pace control is the thing most amateurs never practise deliberately.",
    setup_instructions: "All six colours on their spots. White in hand for the yellow only.",
    steps: [
      "Clear yellow, green, brown, blue, pink, black in order.",
      "Every shot must be a stun: strike the centre of the white and let pace do the positional work.",
      "No screw, no roll-through, no side.",
      "If you have to break the rule to stay in the drill, the attempt is over.",
      "Score 27 for a full clearance.",
    ],
    success_criteria: "Points out of 27, and note which colour you keep failing to reach.",
    improves: ["Pace control", "Centre-ball striking", "Clearing the colours"],
    scoring_type: "points",
    max_score: 27,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [...colourSpots(), { colour: "cue", x: 0.6, y: 0.26 }],
      caption: "Colours on their spots, cleared in order with stun shots only.",
    },
  },
  {
    ...base,
    id: "routine-back-of-black",
    category_id: "cat-cue-ball-control",
    name: "Around the Back of the Black",
    icon: "🔄",
    difficulty: "advanced",
    summary: "Pot the red and take the white behind the black, ready for the next one.",
    description:
      "An academy test with a strict condition: the pot only counts if the white travels around the back of the black. It is the route that keeps a break alive when the black is on its spot and the reds are below it.",
    setup_instructions:
      "Black on its spot. Five reds in line with the black and a top corner pocket, spaced out below it. White in hand.",
    steps: [
      "Pot a red into the top corner.",
      "The white must travel behind the black - between the black and the top cushion - and come back out.",
      "A pot without that route scores nothing.",
      "Ten attempts, two at each red.",
      "Score one point per successful shot.",
    ],
    success_criteria: "Count successful shots out of ten.",
    improves: ["Cue-ball routes", "Control near the top cushion", "Break continuation"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        ...redLine([0.36, 0.82], [0.36, 0.6], 5),
        { colour: "cue", x: 0.3, y: 0.52 },
      ],
      lines: [
        { from: [0.3, 0.52], to: [0.36, 0.72], kind: "shot" },
        { from: [0.36, 0.72], to: [0.5, 0.97], kind: "travel" },
        { from: [0.5, 0.97], to: [0.66, 0.86], kind: "travel" },
      ],
      caption: "The white has to go behind the black and come back out for the shot to count.",
    },
  },

  // ---------------------------------------------------------------- safety
  {
    ...base,
    ...withVideo(
      { id: "fhoHHNLWDaQ", title: "How to utilise a Shot To Nothing", channel: "Shaun Murphy Snooker" },
      { id: "TPwgL-WbQzM", title: "Professional snooker player and his daily shot to nothing practice", channel: "Victoria Snooker" }
    ),
    id: "routine-shot-to-nothing",
    category_id: "cat-safety",
    name: "The Shot to Nothing",
    icon: "🪤",
    difficulty: "intermediate",
    summary: "Go for the long red, but leave nothing behind if it misses.",
    description:
      "The shot that comes up in every frame you will ever play. A long red with the white returning behind the baulk line: pot it and you are in, miss it and your opponent has the same problem you just had. The pot is almost the less important half.",
    setup_instructions:
      "Five reds below the pink, each in line with a top corner pocket. White on the baulk line.",
    steps: [
      "Pick a red and play the pot with enough check side or screw to bring the white back behind the baulk line.",
      "Score two points if you pot it and the white finishes behind baulk.",
      "Score one point if you miss the pot but the white still finishes behind baulk with nothing on.",
      "Score nothing if the white finishes in open play, whether the red went in or not.",
      "Ten attempts, maximum twenty.",
    ],
    success_criteria: "Score out of twenty. Anything over twelve means you are genuinely playing the percentages.",
    improves: ["Safe attacking", "Screw back at distance", "Match discipline"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        ...redLine([0.28, 0.66], [0.72, 0.62], 5),
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        { colour: "cue", x: 0.46, y: 0.206 },
      ],
      lines: [
        { from: [0.46, 0.206], to: [0.28, 0.66], kind: "shot" },
        { from: [0.28, 0.66], to: [0.5, 0.1], kind: "travel" },
      ],
      caption: "Pot if you can, but the white must finish behind the baulk line either way.",
    },
  },
  {
    ...base,
    id: "routine-figure-of-eight-safety",
    category_id: "cat-safety",
    name: "Figure of Eight Safety",
    icon: "🎗️",
    difficulty: "advanced",
    summary: "Clip the red thin with side and bring the white all the way back to baulk.",
    description:
      "The safety shot that wins frames from a poor break-off: a thin clip that leaves the red where it was and sends the white the length of the table and back behind the line. Side spin is what bends the return path away from the middle of the table.",
    setup_instructions:
      "Five reds spread diagonally below the pink. White on the baulk line, colours on their spots.",
    steps: [
      "Clip a red as thinly as you can with running side.",
      "The white should travel up the table and return behind the baulk line without leaving the red pottable.",
      "Score one point per attempt where the white finishes behind baulk and no red is left on.",
      "Ten attempts, alternating the side you clip from.",
      "If you are leaving the red in the open, you are hitting it too full, not too hard.",
    ],
    success_criteria: "Count safe shots out of ten.",
    improves: ["Thin contacts", "Side spin on safety", "Length of table control"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "red", x: 0.3, y: 0.66 },
        { colour: "red", x: 0.4, y: 0.7 },
        { colour: "red", x: 0.5, y: 0.64 },
        { colour: "red", x: 0.6, y: 0.7 },
        { colour: "red", x: 0.7, y: 0.66 },
        ...colourSpots(),
        { colour: "cue", x: 0.42, y: 0.206 },
      ],
      lines: [
        { from: [0.42, 0.206], to: [0.3, 0.66], kind: "shot" },
        { from: [0.3, 0.66], to: [0.06, 0.9], kind: "travel" },
        { from: [0.06, 0.9], to: [0.6, 0.06], kind: "travel" },
      ],
      caption: "A thin clip with side, up the table and back behind the line.",
    },
  },
  {
    ...base,
    ...withVideo(
      { id: "4jfoSoh1JA4", title: "50. Swerve - Part 1: When and how", channel: "Barry Stark Snooker Coach" },
      { id: "FLxZDEBB-WI", title: "Snooker how to Swerve", channel: "Break from life" }
    ),
    id: "routine-swerve-escape",
    category_id: "cat-safety",
    name: "The Swerve Escape",
    icon: "🌀",
    difficulty: "advanced",
    summary: "Bend the white round a blocking ball to escape a snooker.",
    description:
      "When there is no cushion route, the swerve is what is left. Elevate the butt, strike across the ball, and it curves. Keep the elevation modest and the pace soft - the two mistakes everyone makes are lifting too high and hitting too hard.",
    setup_instructions:
      "Put the black on its spot and the white directly behind it, snookered, with a red near a top corner as your target. Move the white a few inches between attempts.",
    steps: [
      "Elevate the butt to roughly thirty degrees - enough to bend the ball, not enough to dig into the cloth.",
      "Strike across the white at four or eight o'clock, depending on which way you need it to bend.",
      "Play softly. The curve comes from spin gripping the cloth, and pace kills it.",
      "Ten attempts. Score one point for a clean hit on the target ball.",
      "Never gouge downwards. If the shot needs a massé, play a cushion escape instead.",
    ],
    success_criteria: "Count clean contacts out of ten.",
    improves: ["Swerve technique", "Escaping snookers", "Cue elevation control"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "black", x: 0.5, y: 0.5 },
        { colour: "cue", x: 0.5, y: 0.4 },
        { colour: "red", x: 0.78, y: 0.86 },
      ],
      lines: [
        { from: [0.5, 0.4], to: [0.62, 0.62], kind: "shot" },
        { from: [0.62, 0.62], to: [0.78, 0.86], kind: "travel" },
      ],
      caption: "Snookered behind the black: bend the white round it to reach the red.",
    },
  },
  {
    ...base,
    id: "routine-safety-exchange",
    category_id: "cat-safety",
    name: "Safety Exchange",
    icon: "🤝",
    difficulty: "advanced",
    summary: "Two players, two reds, and nothing but safety until someone cracks.",
    description:
      "Safety is the one part of the game you cannot really practise alone, because the pressure comes from a person on the other side of the table waiting for you to leave something. Play it as a game to ten and it stops feeling like a drill.",
    setup_instructions:
      "Two reds in open play near the middle of the table, all colours on their spots. Players alternate.",
    steps: [
      "Neither player may attempt a pot. Safety only.",
      "A point goes to your opponent if you leave a red pottable, fail to hit a red, or leave the white in the open past the middle pockets.",
      "Play to ten points.",
      "Say out loud, before each shot, where you intend to leave the white.",
      "Alternate who plays first each game so neither of you inherits the easier table.",
    ],
    success_criteria: "Score the game to ten. Track wins across sessions rather than single games.",
    improves: ["Safety under pressure", "Reading the table", "Patience"],
    scoring_type: "points",
    max_score: 10,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [
        ...colourSpots(),
        { colour: "red", x: 0.42, y: 0.56 },
        { colour: "red", x: 0.6, y: 0.62 },
        { colour: "cue", x: 0.5, y: 0.14 },
      ],
      caption: "Two reds, all colours, and no pots allowed.",
    },
  },

  // ---------------------------------------------------------------- openings
  {
    ...base,
    ...withVideo(
      { id: "Rzg_pmjDh7k", title: "Snooker Break Off - Snooker Breaking Off - Snooker Lesson", channel: "BartonSnooker" },
      { id: "QMBnqoz9jRw", title: "Do This Everytime To MASTER The Break-Off", channel: "Stephen Hendry's Cue Tips" }
    ),
    id: "routine-break-off-standard",
    category_id: "cat-openings",
    name: "The Standard Break-Off",
    icon: "🎬",
    difficulty: "beginner",
    summary: "Thin clip off the outside red, white back down onto the baulk cushion.",
    description:
      "The first shot of every frame, and the one most club players never practise. The white sits a couple of inches to one side of the brown, clips the outside red of the pack as thinly as possible, and comes back to sit on the baulk cushion where it is no use to anybody.",
    setup_instructions:
      "Full triangle of reds with the pink on its spot. White in the D, about two inches to the side of the brown.",
    steps: [
      "Aim at the outermost red on the same side of the pack as the white.",
      "Clip it as thinly as you can, using check side - right side from the yellow side of the brown, left side from the green side.",
      "The side bends the return path so the white avoids the blue and settles near the baulk cushion.",
      "Put a piece of chalk on the baulk cushion as a target and try to finish behind it.",
      "Ten break-offs. Score one point for a thin contact that returns to baulk, and nothing if you leave a red pottable or the white in the open.",
    ],
    success_criteria: "Count good break-offs out of ten. Coaches suggest this is worth a tenth of your practice time.",
    improves: ["Thin contacts", "Side spin", "Starting the frame properly"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        ...pack(),
        { colour: "cue", x: 0.44, y: 0.206 },
      ],
      lines: [
        { from: [0.44, 0.206], to: [0.404, 0.863], kind: "shot" },
        { from: [0.404, 0.863], to: [0.02, 0.62], kind: "travel" },
        { from: [0.02, 0.62], to: [0.5, 0.04], kind: "travel" },
      ],
      caption: "Two inches off the brown, thinnest possible contact, back down to the baulk cushion.",
    },
  },
  {
    ...base,
    ...withVideo(
      { id: "zIyky-vR75c", title: "Snooker Coaching Session - Shot by Shot Break Tips", channel: "BartonSnooker" }
    ),
    id: "routine-first-red-of-the-break",
    category_id: "cat-openings",
    name: "The First Red",
    icon: "1️⃣",
    difficulty: "intermediate",
    summary: "The awkward opening pot that has to end with you on a colour.",
    description:
      "Breaks are lost at the start far more often than in the middle. The first red is usually long, often half-safe, and the position you take from it decides whether there is a break at all.",
    setup_instructions:
      "Reds in a loose triangle near the pink with three or four spread out towards the middle of the table. White behind the baulk line, as if you have just been left safe.",
    steps: [
      "Pick the red you would actually go for in a frame, not the easiest one on the table.",
      "Pot it and land on a colour you can score from - the blue or the black, not a thin cut on the green.",
      "Score two points if you pot and land on a scoring colour, one if you pot and survive, none if you miss.",
      "Ten attempts, moving the white behind baulk each time.",
      "Say your intended colour before every shot.",
    ],
    success_criteria: "Score out of twenty. The number that matters is how often you reached a scoring colour.",
    improves: ["Starting breaks", "Long pot with position", "Shot selection"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        ...colourSpots(),
        ...pack(0.8).slice(0, 10),
        { colour: "red", x: 0.34, y: 0.62 },
        { colour: "red", x: 0.66, y: 0.58 },
        { colour: "red", x: 0.6, y: 0.46 },
        { colour: "cue", x: 0.4, y: 0.12 },
      ],
      lines: [
        { from: [0.4, 0.12], to: [0.34, 0.62], kind: "shot" },
        { from: [0.34, 0.62], to: [0.5, 0.5], kind: "travel" },
      ],
      caption: "From behind baulk: pot the red you would really go for, and finish on a scoring colour.",
    },
  },
  {
    ...base,
    id: "routine-break-off-pots",
    category_id: "cat-openings",
    name: "Reds into the Baulk Pockets",
    icon: "↙️",
    difficulty: "intermediate",
    summary: "The pots that come up straight after a break-off, back down into the baulk corners.",
    description:
      "After a break-off exchange the pottable red is usually the one that has drifted down the table, and the pocket is a baulk corner over your shoulder. It is an unfamiliar angle for anyone who only ever practises potting towards the black.",
    setup_instructions:
      "Five reds spread through the middle third of the table. White in hand for each attempt, placed above the red so you are potting back towards baulk.",
    steps: [
      "Pot each red into a baulk corner pocket.",
      "Play the white back up the table afterwards so you are not left in a heap at the baulk cushion.",
      "Ten attempts, two at each red.",
      "Score one point per pot, and a bonus point if the white finishes above the blue spot.",
      "Note how different the sighting feels facing this way. That is the whole reason for the drill.",
    ],
    success_criteria: "Score out of twenty: pots plus position.",
    improves: ["Potting towards baulk", "Sighting from an unfamiliar angle", "Recovering position"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        ...redLine([0.2, 0.45], [0.8, 0.55], 5),
        { colour: "cue", x: 0.4, y: 0.68 },
      ],
      lines: [
        { from: [0.4, 0.68], to: [0.2, 0.45], kind: "shot" },
        { from: [0.2, 0.45], to: [0.02, 0.02], kind: "travel" },
      ],
      caption: "Reds through the middle, potted back down into the baulk corners.",
    },
  },

  // ---------------------------------------------------------------- rest play
  {
    ...base,
    ...withVideo(
      { id: "tF-kPbZFtr4", title: "Snooker Lesson Rest Play - Coaching Tutorial", channel: "BartonSnooker" },
      { id: "l57RjLfD3pM", title: "12. Using the Rest in Snooker", channel: "Barry Stark Snooker Coach" }
    ),
    id: "routine-rest-pots",
    category_id: "cat-rest-play",
    name: "Rest Pots",
    icon: "🪃",
    difficulty: "intermediate",
    summary: "Ten pots with the rest, because nobody practises with it and it shows.",
    description:
      "Callan puts it plainly: not many people enjoy practising with the rest, which is why not many people are any good with it. Ten deliberate pots a session is enough to stop it being a shot you dread.",
    setup_instructions:
      "Five reds either side of the pink spot, spread across the table. Stand so every shot genuinely needs the rest.",
    steps: [
      "Pot each red into the nearest top corner using the rest.",
      "Set the rest head close to the white and keep it still - most rest misses are the rest moving, not the cue.",
      "Cue beside your ear with the palm up, and deliver slowly.",
      "Ten attempts, one at each red.",
      "Score one point per pot.",
    ],
    success_criteria: "Count pots out of ten. Six with the rest is worth more than nine without it.",
    improves: ["Rest technique", "Confidence at the far end", "Steady delivery"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        ...redLine([0.16, 0.75], [0.4, 0.75], 3),
        ...redLine([0.6, 0.75], [0.84, 0.75], 3),
        { colour: "pink", x: SPOT.pink[0], y: SPOT.pink[1] },
        { colour: "cue", x: 0.5, y: 0.3 },
      ],
      caption: "Reds either side of the pink, every one potted with the rest.",
    },
  },
  {
    ...base,
    ...withVideo(
      { id: "R3HUoypZ5To", title: "Snooker How To Use The Rest - Coaching Video", channel: "BartonSnooker" },
      { id: "hNMni0n-ajE", title: "How to Use the Rest", channel: "Break from life" }
    ),
    id: "routine-rest-spin",
    category_id: "cat-rest-play",
    name: "Spin with the Rest",
    icon: "🌪️",
    difficulty: "advanced",
    summary: "Stun, screw, side and top - all of it with the rest in your hand.",
    description:
      "Potting with the rest is one problem; controlling the white with it is another. This is the drill that turns the rest from a survival tool into a shot you can actually play position from.",
    setup_instructions: "Blue on its spot, white at the far end of the table so the rest is unavoidable.",
    steps: [
      "Pot the blue with a dead stun and stop the white. Repeat five times.",
      "Then five with screw back, five with top, and five with side.",
      "Notice how much less power you can safely apply with the rest, and work inside it.",
      "Score one point for each shot that pots the blue and does what you intended with the white.",
      "Twenty is a clean sheet.",
    ],
    success_criteria: "Score out of twenty. Be strict about whether the white did what you said it would.",
    improves: ["Spin with the rest", "Power control", "Removing a weakness"],
    scoring_type: "points",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
        { colour: "cue", x: 0.5, y: 0.9 },
      ],
      lines: [{ from: [0.5, 0.9], to: [0.5, 0.5], kind: "shot" }],
      caption: "White at the far end so the rest is the only option, blue on its spot.",
    },
  },
  {
    ...base,
    id: "routine-awkward-bridging",
    category_id: "cat-rest-play",
    name: "Awkward Bridging",
    icon: "🤲",
    difficulty: "intermediate",
    summary: "Over a ball, against the cushion, stretched out: the bridges nobody teaches you.",
    description:
      "Four or five times a frame the table gives you nowhere sensible to put your hand. Callan's advice is that there is no single correct method, because we are all built differently - what there is, is a way that works for you, and you only find it by practising the positions.",
    setup_instructions:
      "Set up four positions in turn: white tight on a side cushion, white directly behind another ball, white needing a long stretch, and white in a corner.",
    steps: [
      "Cushion: flatten the bridge hand, run the cue along your fingers and keep the butt low.",
      "Over a ball: build a high bridge on the fingertips and keep the wrist locked.",
      "Stretched: take the weight through the bridge arm and shorten the backswing rather than leaning further.",
      "Corner: use the rest rather than contorting. Knowing when to give up on the hand bridge is part of the skill.",
      "Five pots from each position, twenty in total.",
    ],
    success_criteria: "Count pots out of twenty, and note which of the four positions costs you the most.",
    improves: ["Bridge variety", "Stability in awkward spots", "Knowing when to use the rest"],
    scoring_type: "count",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "cue", x: 0.04, y: 0.6 },
        { colour: "red", x: 0.3, y: 0.86 },
        { colour: "blue", x: SPOT.blue[0], y: SPOT.blue[1] },
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
      ],
      caption: "Start with the white tight on the cushion, then work through the other three positions.",
    },
  },
  {
    ...base,
    id: "routine-cueing-off-the-cushion",
    category_id: "cat-rest-play",
    name: "Cueing off the Cushion",
    icon: "🧱",
    difficulty: "beginner",
    summary: "The white tight against the cushion, where a normal bridge is impossible.",
    description:
      "A ball on the cushion turns a simple pot into a technical problem: the bridge has to flatten, the cue has to stay level, and there is no room for a backswing. Get the hand right and the shot is ordinary. Get it wrong and you miscue.",
    setup_instructions: "White frozen on a side cushion, red on the black spot. Move along the cushion between shots.",
    steps: [
      "Lay the bridge hand flat on the cushion rail and run the cue between the first and second fingers.",
      "Keep the cue as level as the rail allows. Lifting the butt is what causes miscues here.",
      "Strike the centre of the white. Forget spin until the contact is clean.",
      "Ten pots, moving the white along the cushion each time.",
      "Then try the same shot with the white on the baulk cushion, facing up the table.",
    ],
    success_criteria: "Count clean pots out of ten, and count miscues separately - that number should reach zero first.",
    improves: ["Cushion bridge", "Level cueing", "Avoiding miscues"],
    scoring_type: "count",
    max_score: 10,
    estimated_duration_minutes: 15,
    diagram: {
      balls: [
        { colour: "cue", x: 0.035, y: 0.55 },
        { colour: "red", x: SPOT.black[0], y: SPOT.black[1] },
      ],
      lines: [{ from: [0.035, 0.55], to: [0.5, 0.909], kind: "shot" }],
      caption: "White frozen on the cushion. The bridge hand goes flat on the rail.",
    },
  },
  {
    ...base,
    ...withVideo(
      { id: "CCLKVFEZyxM", title: "45. Spider & Swan-Neck Usage - Full use of table equipment", channel: "Barry Stark Snooker Coach" },
      { id: "RMK16b4DvPk", title: "701. Correct Rest-Play, Spider & Swan-Neck Rest", channel: "Arshad Qureshi - AQ Snooker" }
    ),
    id: "routine-spider-swan-neck",
    category_id: "cat-rest-play",
    name: "Spider and Swan Neck",
    icon: "🕷️",
    difficulty: "advanced",
    summary: "The two rests that come out once a match and get fumbled every time.",
    description:
      "The spider lifts the cue over an intervening ball; the swan neck reaches into a cluster where the spider will not sit. Both feel alien until you have played fifty shots with them, and fifty shots is about an hour of your life.",
    setup_instructions:
      "Set the white directly behind a ball so a normal bridge is impossible, with a red pottable beyond it. Build a small cluster for the swan neck work.",
    steps: [
      "Spider: set it close enough that the cue is supported near the tip, and cue down the groove without gripping tightly.",
      "Keep the head still. The spider magnifies every movement because your bridge is nowhere near the ball.",
      "Swan neck: use it when balls are too close for the spider's legs. Rest it on the cloth or the cushion, never on a ball.",
      "Ten pots with each, twenty in total.",
      "Play a few with soft pace and a few firm, so you learn what each rest will take.",
    ],
    success_criteria: "Count pots out of twenty, split by which rest you used.",
    improves: ["Spider technique", "Swan neck technique", "Not losing frames to equipment"],
    scoring_type: "count",
    max_score: 20,
    estimated_duration_minutes: 25,
    diagram: {
      balls: [
        { colour: "cue", x: 0.4, y: 0.34 },
        { colour: "blue", x: 0.44, y: 0.44 },
        { colour: "red", x: 0.56, y: 0.78 },
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
      ],
      lines: [{ from: [0.4, 0.34], to: [0.56, 0.78], kind: "shot" }],
      caption: "The blue blocks a normal bridge, so the cue has to come over it.",
    },
  },

  // ---------------------------------------------------------------- challenges
  {
    ...base,
    id: "routine-blacks-100",
    category_id: "cat-challenges",
    name: "Blacks out of 100",
    icon: "💯",
    difficulty: "intermediate",
    summary: "One hundred attempts at the black. One number at the end.",
    description:
      "A long, honest test. The black goes back on its spot every time and you play from wherever the white stops, so the run holds you to account over an hour rather than over five shots. The score is comparable week to week, which is the point.",
    setup_instructions: "Black on its spot. White in hand after a miss, otherwise played from where it finishes.",
    steps: [
      "Pot the black and re-spot it. Continue from wherever the white finishes.",
      "After a miss, take the white in hand and carry on.",
      "Count every pot. One hundred attempts in total.",
      "Do not stop early because it is going badly. A bad score you record is worth more than a good one you abandoned.",
      "Write the number down and date it.",
    ],
    success_criteria: "Pots out of 100. Seventy is a solid club player; ninety is a very good one.",
    improves: ["Potting under repetition", "Concentration over time", "An honest benchmark"],
    scoring_type: "count",
    max_score: 100,
    estimated_duration_minutes: 45,
    diagram: {
      balls: [
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.58, y: 0.82 },
      ],
      caption: "Black on its spot, re-spotted after every pot, one hundred attempts.",
    },
  },
  {
    ...base,
    id: "routine-105-challenge",
    category_id: "cat-challenges",
    name: "The 105 Challenge",
    icon: "🪜",
    difficulty: "advanced",
    summary: "Clear the colours in ladders of increasing length: pink-black, then blue-pink-black, and on.",
    description:
      "A graded academy test that builds pressure the way a frame does. Each ladder is longer than the last, so by the time you are on the final run of six you have already invested twenty minutes and have everything to lose.",
    setup_instructions: "All six colours on their spots. White in hand at the start of each ladder only.",
    steps: [
      "Clear pink and black. Re-spot them.",
      "Then blue, pink, black. Then brown, blue, pink, black.",
      "Then green, brown, blue, pink, black. Then yellow, green, brown, blue, pink, black.",
      "A miss ends that ladder; add up what you scored and move to the next one.",
      "The five ladders total 105 points if you clear them all.",
    ],
    success_criteria: "Points out of 105. Anything over 80 is a genuinely good session.",
    improves: ["Clearing under pressure", "Positional stamina", "Handling a rising stake"],
    scoring_type: "points",
    max_score: 105,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [...colourSpots(), { colour: "cue", x: 0.42, y: 0.82 }],
      lines: [
        { from: [0.5, 0.75], to: [0.5, 0.909], kind: "travel" },
        { from: [0.5, 0.5], to: [0.5, 0.75], kind: "travel" },
      ],
      caption: "Five ladders, each one colour longer than the last, ending pink and black every time.",
    },
  },
  {
    ...base,
    id: "routine-red-black-120",
    category_id: "cat-challenges",
    name: "Fifteen Reds, Fifteen Blacks",
    icon: "⚫",
    difficulty: "advanced",
    summary: "The 120 break, with the reds handed to you and nothing else.",
    description:
      "Two reds, re-spotted, and the black. It strips break-building down to the single repeated pattern that every century is made of, and asks whether you can hold it together for thirty shots.",
    setup_instructions:
      "Black on its spot. Two reds placed near the black so that one is always available. Re-spot a red each time you pot one, so there are always two on the table.",
    steps: [
      "Pot red, black, red, black through fifteen pairs.",
      "Re-spot the black every time, and replace each red so two are always in play.",
      "A miss ends the attempt. Record the score.",
      "Maximum is 120.",
      "The drill is about rhythm. When you feel yourself speeding up, stop and take the full routine again.",
    ],
    success_criteria: "Points out of 120. Getting past 60 twice in a session means it is working.",
    improves: ["Break rhythm", "Repeating the black", "Stamina"],
    scoring_type: "points",
    max_score: 120,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "red", x: 0.38, y: 0.84 },
        { colour: "red", x: 0.62, y: 0.84 },
        { colour: "cue", x: 0.5, y: 0.78 },
      ],
      caption: "Two reds beside the black, both replaced as you go.",
    },
  },
  {
    ...base,
    id: "routine-pot-quiz-speed",
    category_id: "cat-challenges",
    name: "The Speed Clearance",
    icon: "⏱️",
    difficulty: "intermediate",
    summary: "Fifteen reds and the black, against the clock.",
    description:
      "A game John Parrott plays with professionals: clear the reds with the black in the fastest time you can. Rushing does not work, because a poor position costs you far more seconds than a slow routine ever will. It teaches close cue-ball control by punishing the opposite.",
    setup_instructions:
      "Fifteen reds spread in three rows of five between the blue and black spots. Black on its spot, white in hand to start.",
    steps: [
      "Start the clock and clear all fifteen reds, taking the black whenever it is available.",
      "The black is re-spotted each time. A missed red simply costs you time - carry on.",
      "Stop the clock when the last red is potted.",
      "Log the time in minutes and seconds.",
      "Play it the same way every time so the times mean something.",
    ],
    success_criteria: "Record the time. Under five minutes is quick; under four is excellent.",
    improves: ["Close cue-ball control", "Decision speed", "Playing without dithering"],
    scoring_type: "time",
    estimated_duration_minutes: 20,
    diagram: {
      balls: [
        ...redLine([0.25, 0.58], [0.75, 0.58], 5),
        ...redLine([0.25, 0.68], [0.75, 0.68], 5),
        ...redLine([0.25, 0.78], [0.75, 0.78], 5),
        { colour: "black", x: SPOT.black[0], y: SPOT.black[1] },
        { colour: "cue", x: 0.5, y: 0.4 },
      ],
      caption: "Three rows of five reds, cleared with the black against the clock.",
    },
  },
  {
    ...base,
    id: "routine-training-frame",
    category_id: "cat-challenges",
    name: "The Training Frame",
    icon: "🎞️",
    difficulty: "intermediate",
    summary: "Play a frame against yourself where every visit starts with the ball in hand.",
    description:
      "Solo practice rarely feels like a frame. This does: you break off properly, play the balls where they lie, and the only concession is that each new visit starts with the white in hand. Your score is the frame score, and it is a number worth chasing.",
    setup_instructions: "Full frame set up as normal.",
    steps: [
      "Break off as you would in a match.",
      "Take the white in hand and build a break from the layout in front of you.",
      "When you miss, take the white in hand again and start the next visit. Do not reset the balls.",
      "Keep going until the frame is finished or no scoring shot remains.",
      "Record the total you made across the frame.",
    ],
    success_criteria: "Total points in the frame out of 147. Track it weekly.",
    improves: ["Playing a real layout", "Recovering after a miss", "Match rhythm"],
    scoring_type: "points",
    max_score: 147,
    estimated_duration_minutes: 40,
    diagram: {
      balls: [
        ...colourSpots(),
        ...pack(),
        { colour: "cue", x: 0.44, y: 0.18 },
      ],
      caption: "A normal frame, with the white in hand at the start of each visit.",
    },
  },
  {
    ...base,
    id: "routine-colours-100",
    category_id: "cat-challenges",
    name: "A Hundred off the Colours",
    icon: "🌈",
    difficulty: "advanced",
    summary: "Make 100 with colours alone, never taking the same one twice in a row.",
    description:
      "No reds, no line-up, nowhere to hide. Every colour is re-spotted and you may not repeat one, so the white has to keep travelling between spots with real precision. It is the purest positional test in the library.",
    setup_instructions: "All six colours on their spots. White in hand for the first shot only.",
    steps: [
      "Pot any colour, re-spot it, and move to a different one.",
      "You may never pot the same colour twice in succession.",
      "Keep going until you miss, then record the total.",
      "One hundred is the target, which is roughly eighteen colours in a row.",
      "The blue is the safety valve: when you lose position, get back on it.",
    ],
    success_criteria: "Points in a single visit, with 100 as the pass mark.",
    improves: ["Positional precision", "Working between the spots", "Concentration"],
    scoring_type: "points",
    max_score: 100,
    estimated_duration_minutes: 30,
    diagram: {
      balls: [...colourSpots(), { colour: "cue", x: 0.56, y: 0.6 }],
      lines: [
        { from: [0.5, 0.5], to: [0.5, 0.909], kind: "travel" },
        { from: [0.5, 0.909], to: [0.663, 0.206], kind: "travel" },
      ],
      caption: "Six colours, all re-spotted, and never the same one twice in a row.",
    },
  },
];
