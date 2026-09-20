import { Routine, RoutineCategory } from "../types";
import { getYoutubeWatchUrl } from "../utils/youtube";

/**
 * The second wave of the routine library.
 *
 * These are the drills that keep coming up wherever snooker is coached: Frank Callan's practice
 * routines (the coach behind Steve Davis and John Parrott), the graded routines used by academy
 * players, and the standards that have been passed around club tables for decades - the line-up
 * family, reds across the middle, the shot to nothing, the break-off.
 *
 * Each drill says where every ball goes in words rather than in a picture: on a spot, so many
 * inches from another ball, in line with a named pocket. It is how a coach would tell you to set
 * it up, and unlike a drawing it cannot quietly put a ball in the wrong place.
 */

const now = new Date().toISOString();

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
      "Clear the table completely, then put the cue ball on the brown spot. Nothing else is needed: the blue, " +
      "pink and black spots are your aiming line, and the top cushion is your target. Stand at the baulk end, " +
      "square to the line of spots.",
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
      "Put a red on the black spot. Place the cue ball about three inches out from the jaws of a middle pocket, " +
      "so your bridge hand has to span the opening rather than rest on cloth. Work round all six pockets in " +
      "turn; the corner pockets are the awkward ones because the cushion rail runs away from you.",
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
      "Put a red on the blue spot, then spread six more across the table in line with it, three each side, " +
      "roughly six inches apart, finishing about a foot from each side cushion. That is seven reds in a " +
      "straight line across the middle of the table. Cue ball in hand for the first shot. As you improve, add " +
      "reds to the same line until all fifteen are on it, spaced about three inches apart.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "TxjTAmP-9B4", title: "41. Practice Straight Cueing - It will improve your potting", channel: "Barry Stark Snooker Coach" },
      { id: "h6H4sSf4vZ0", title: "43. Long Potting - Practice for success", channel: "Barry Stark Snooker Coach" }
    ),
    id: "routine-long-straight-reds",
    category_id: "cat-long-potting",
    name: "Long Straight Reds",
    icon: "🎯",
    difficulty: "intermediate",
    summary: "Dead straight the length of the table: the shot that hides nothing.",
    description:
      "A straight long pot is the honest test. There is no angle to help you and no cover for a crooked delivery, and it is the shot that decides frames from the break-off exchange.",
    setup_instructions:
      "Place five reds across the table level with the pink spot, one on the centre line and two each side, " +
      "about a foot apart. For each attempt, put the cue ball on the baulk line directly in line with the red " +
      "you are taking and the far corner pocket, so the pot is dead straight.",
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
    setup_instructions:
      "Blue on its spot, nothing else on the table. Cue ball anywhere in the D; you may move it between shots. " +
      "The blue goes back on its spot after every pot.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "KpYvbEkXsLk", title: "Snooker Practice Exercise - Long Potting & Safety", channel: "BartonSnooker" }
    ),
    id: "routine-topspin-long-pots",
    category_id: "cat-long-potting",
    name: "Top Spin Long Pots",
    icon: "⬆️",
    difficulty: "advanced",
    summary: "Long pots played with running top, so the white comes off the top cushion and back down.",
    description:
      "Potting a long red is one thing; potting it and ending up back in the balls is another. Rolling the white through with top and off the top cushion is how a long pot turns into a break rather than a one-visit gamble.",
    setup_instructions:
      "All six colours on their spots. Place five reds across the table about six inches below the pink spot, " +
      "spread evenly between the two side cushions. Cue ball on the baulk line, moved so each red is a " +
      "reachable pot into a top corner.",
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
  },

  // ---------------------------------------------------------------- break building
  {
    ...base,
    ...withVideo(
      { id: "yiY51CVSh7E", title: "Snooker Practice Routines - Guide on How To Clear The Line Up", channel: "CueBald Snooker" },
      { id: "qMFj7_LJkSY", title: "Mix Up Your Practice - Snooker Line-Up & Routines", channel: "BartonSnooker" }
    ),
    id: "routine-half-line-up",
    category_id: "cat-break-building",
    name: "The Half Line Up",
    icon: "➗",
    difficulty: "beginner",
    summary: "The line-up with seven reds: the sensible way in before the full fifteen.",
    description:
      "The full line-up is a thirty-minute commitment and punishing when you are learning. Seven reds gives you the same pattern, the same discipline and a break you can actually finish, which matters more than you would think.",
    setup_instructions:
      "All six colours on their spots. Place seven reds in a straight line down the middle of the table, " +
      "following the line of the spots: one just above the black, then the rest running down towards the pink " +
      "and the blue, roughly two ball widths apart, leaving the colour spots clear. Cue ball in hand for the " +
      "first shot only.",
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
      "Blue on its spot, everything else off the table. Ring six reds around it at about a foot's distance, " +
      "spaced evenly, so that each red is open to a different pocket: two towards the top corners, two towards " +
      "the middles, two towards the baulk corners. Cue ball in hand for the first red.",
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
    setup_instructions:
      "The same layout as Six Reds, Six Blues: blue on its spot with six reds ringed around it at a foot's " +
      "distance, each open to a different pocket. Decide the order you will take them in before you start.",
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
      "Pink and black on their spots. Scatter six reds loosely between the pink spot and the top cushion, none " +
      "of them tight to a cushion and none in line with each other, leaving the black open to both top pockets. " +
      "Take the blue and the baulk colours off the table so the drill is only about the scoring area. Cue ball " +
      "in hand for the first red.",
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
      "Black on its spot. Place three reds in a small cluster about four inches above it, towards the top " +
      "cushion, touching or nearly touching. Cue ball below the black at a shallow angle, so potting the black " +
      "sends the white on into the reds.",
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
      "Blue and pink on their spots. Set a loose cluster of four or five reds directly behind the pink, between " +
      "it and the black spot. Place the cue ball below the blue with a slight angle, so that potting the blue " +
      "carries the white up the table into the pink.",
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
      "Black on its spot. Place six reds in a straight line beside it, about four inches to one side of the " +
      "black and running from level with the top cushion down towards the pink spot, each red about three " +
      "inches from the next. Cue ball in hand for the first red.",
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
      "All six colours on their spots. Set fifteen reds in a V: one red as the point, sitting just below the " +
      "black spot, then seven running down and out to the left and seven down and out to the right, each about " +
      "two ball widths from the last, so the arms finish level with the middle pockets. Cue ball in hand for " +
      "the first red.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "W7SjvuEmI00", title: "Snooker Practice Routines - Zig-Zag Line Up Drill", channel: "CueBald Snooker" }
    ),
    id: "routine-alternate-reds",
    category_id: "cat-break-building",
    name: "Alternate Reds",
    icon: "🔀",
    difficulty: "advanced",
    summary: "The line-up, but you must take the reds from alternate ends.",
    description:
      "The line-up rewards you for working quietly down the line. This version forbids it: every red sends you to the other end of the formation, so the cue ball travels the length of the table again and again and your position has to be genuinely deliberate.",
    setup_instructions:
      "Set the standard line-up: colours on their spots and fifteen reds in a straight line down the middle of " +
      "the table following the line of the spots, two above the black, then on down past the pink towards the " +
      "blue, leaving each colour spot clear. Cue ball in hand for the first red.",
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
    setup_instructions:
      "A full frame, set as you would to play: fifteen reds in the triangle with the apex red directly behind " +
      "the pink, and all six colours on their spots.",
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
  },

  // ---------------------------------------------------------------- cue ball control
  {
    ...base,
    ...withVideo(
      { id: "t-vvICLpv4A", title: "Snooker practice routine for beginners - Potting blues", channel: "CuePal" }
    ),
    id: "routine-ten-blues",
    category_id: "cat-cue-ball-control",
    name: "Ten Blues",
    icon: "🔟",
    difficulty: "beginner",
    summary: "Pot the blue into a middle pocket ten times, playing from wherever the white finishes.",
    description:
      "The blue goes back on its spot; you do not get to move. Each pot sets the next one, so a careless shot leaves you a horrible angle and the routine punishes you immediately. It teaches, very quickly, that where the white stops matters as much as whether the ball went in.",
    setup_instructions:
      "Blue on its spot, nothing else on the table. Cue ball in hand for the first shot only; after that you " +
      "play from wherever the white finishes. The blue goes back on its spot after every pot.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "HZv0MGi9pfk", title: "Blue, pink and black practice routine", channel: "Michael Holt Snooker Coaching" }
    ),
    id: "routine-pink-blacks",
    category_id: "cat-cue-ball-control",
    name: "Pink and Blacks",
    icon: "🎀",
    difficulty: "intermediate",
    summary: "Pink, black, pink, black, for as long as you can hold the position.",
    description:
      "The two highest-value balls and about eighteen inches between them. It is the pattern that produces centuries, and holding it for ten shots tells you more about your cue-ball control than an hour of potting practice.",
    setup_instructions:
      "Pink and black on their spots, nothing else on the table. Cue ball in hand for the first shot only. Both " +
      "balls go back on their spots after every pot.",
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
    setup_instructions:
      "Black on its spot, nothing else on the table. Cue ball in hand for the first shot only. The black is " +
      "re-spotted after every pot and you play from wherever the white stops.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "n3IBvWCM87Y", title: "58. Clearing the Colours - Practice from their spots", channel: "Barry Stark Snooker Coach" },
      { id: "BnLJ2znIFh4", title: "Snooker Clearing The Colours - Key Shots - Tutorial", channel: "BartonSnooker" }
    ),
    id: "routine-colours-stun",
    category_id: "cat-cue-ball-control",
    name: "Colours in Order, Stun Only",
    icon: "🛑",
    difficulty: "intermediate",
    summary: "Clear the colours using nothing but stun.",
    description:
      "Taking screw and roll out of your hands leaves one tool: a dead centre strike at the right pace. It sounds restrictive, and that is the point - pace control is the thing most amateurs never practise deliberately.",
    setup_instructions:
      "All six colours on their spots, no reds. Cue ball in hand for the yellow only; after that you play from " +
      "wherever the white finishes. Colours stay down once potted, as in a frame.",
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
      "Black on its spot. Place five reds in a line running from about a foot below the black down towards the " +
      "pink spot, set a few inches to one side so each is pottable into the top corner on that side. Cue ball " +
      "in hand for each attempt.",
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
      "Place five reds across the table about six inches below the pink spot, each one roughly in line with a " +
      "top corner pocket. Cue ball on the baulk line for every attempt, moved so the red you are taking is a " +
      "genuine long pot.",
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
      "All six colours on their spots. Place five reds in a loose diagonal below the pink spot, spread across " +
      "the width of the table so you can clip each one thinly from either side. Cue ball on the baulk line, a " +
      "few inches to one side of the brown.",
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
      "Black on its spot. Put the cue ball about four inches directly below the black so the black blocks a " +
      "straight path, and a red near a top corner as your target. Move the white a couple of inches between " +
      "attempts so the amount of bend you need keeps changing.",
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
      "All six colours on their spots and two reds in open play near the middle of the table, a foot or so " +
      "apart and clear of the cushions. One player breaks the exchange off from the D.",
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
      "A full frame set as normal: fifteen reds in the triangle with the apex red behind the pink, colours on " +
      "their spots. Cue ball in the D, about two inches to one side of the brown. Put a piece of chalk on the " +
      "baulk cushion as a target for the white to finish behind.",
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
      "Colours on their spots. Set the reds in a loose triangle around the pink with three or four pulled out " +
      "towards the middle of the table, as they would sit after a break-off exchange. Cue ball behind the baulk " +
      "line for every attempt, as if you have just been left safe.",
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
      "Spread five reds through the middle third of the table, none tight to a cushion. For each attempt place " +
      "the cue ball above the red you are taking, so you are potting back down the table into a baulk corner " +
      "pocket.",
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
      "Place five reds either side of the pink spot, spread across the table towards the side cushions, level " +
      "with the pink. Cue ball at the baulk end, far enough away that every shot genuinely needs the rest.",
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
    setup_instructions:
      "Blue on its spot, nothing else on the table. Cue ball at the top end of the table, above the pink spot, " +
      "so the rest is the only way to play the shot.",
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
      "Four positions, five shots at each. One: cue ball frozen on a side cushion with a red on the black spot. " +
      "Two: cue ball directly behind the blue with a red near a top corner, so you must bridge over the blue. " +
      "Three: cue ball at the top cushion with the pot at the baulk end, so you have to stretch. Four: cue ball " +
      "in a corner, tight to both cushions.",
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
    setup_instructions:
      "Red on the black spot. Cue ball frozen against a side cushion, level with the blue spot to begin with. " +
      "Move it along the cushion between shots so you play the pot from a different angle each time.",
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
      "Set the cue ball directly behind the blue with a red near a top corner, so a normal bridge is impossible " +
      "and the cue has to come over the blue. For the swan neck, build a small cluster of two or three reds " +
      "around the cue ball so the spider's legs will not sit flat.",
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
    setup_instructions:
      "Black on its spot, nothing else on the table. Cue ball in hand to start and after any miss; otherwise " +
      "play from where the white finishes. The black goes back on its spot after every pot.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "BnLJ2znIFh4", title: "Snooker Clearing The Colours - Key Shots - Tutorial", channel: "BartonSnooker" },
      { id: "6cAsmAO7Pwo", title: "Snooker Colours Clearance - Beginners Guide", channel: "BartonSnooker" }
    ),
    id: "routine-105-challenge",
    category_id: "cat-challenges",
    name: "The 105 Challenge",
    icon: "🪜",
    difficulty: "advanced",
    summary: "Clear the colours in ladders of increasing length: pink-black, then blue-pink-black, and on.",
    description:
      "A graded academy test that builds pressure the way a frame does. Each ladder is longer than the last, so by the time you are on the final run of six you have already invested twenty minutes and have everything to lose.",
    setup_instructions:
      "All six colours on their spots, no reds. Cue ball in hand at the start of each ladder only. Colours are " +
      "re-spotted between ladders.",
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
      "Black on its spot. Place two reds near it, about six inches away on either side, so one is always " +
      "available after a black. Each red is replaced as you pot it, so there are always two on the table, and " +
      "the black is re-spotted every time.",
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
      "Black on its spot. Spread fifteen reds over the top half of the table in three rows of five, running " +
      "between the blue spot and the pink spot, with about four inches between reds. Cue ball in hand to start.",
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
    setup_instructions:
      "A full frame set as normal: fifteen reds in the triangle with the apex red behind the pink, all six " +
      "colours on their spots.",
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
  },
  {
    ...base,
    ...withVideo(
      { id: "n3IBvWCM87Y", title: "58. Clearing the Colours - Practice from their spots", channel: "Barry Stark Snooker Coach" },
      { id: "6cAsmAO7Pwo", title: "Snooker Colours Clearance - Beginners Guide", channel: "BartonSnooker" }
    ),
    id: "routine-colours-100",
    category_id: "cat-challenges",
    name: "A Hundred off the Colours",
    icon: "🌈",
    difficulty: "advanced",
    summary: "Make 100 with colours alone, never taking the same one twice in a row.",
    description:
      "No reds, no line-up, nowhere to hide. Every colour is re-spotted and you may not repeat one, so the white has to keep travelling between spots with real precision. It is the purest positional test in the library.",
    setup_instructions:
      "All six colours on their spots, no reds. Cue ball in hand for the first shot only. Every colour goes " +
      "back on its spot after it is potted.",
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
  },
];
