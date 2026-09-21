import type { AIAnalysis, AnalysisType, Routine } from "../../types";

/**
 * Routines to practise after a coaching report.
 *
 * The coach writes in plain words - "the head lifts on the strike", "the bridge hand moves" - so
 * each part of the game is a set of words a coach would use for it and the library routines that
 * work on it. The report's findings are read for those words: what it says to work on counts
 * most, then the likely causes and the tip, then the summary. What the clip could not show is
 * left out, so a routine is never suggested for something the coach did not see.
 */

type Report = NonNullable<AIAnalysis["report_json"]>;

type Topic = {
  /** What the routine works on, as the player would say it. */
  label: string;
  words: RegExp;
  /** Library routines for it, most useful first. Drills before guides where there is a drill. */
  routines: string[];
};

export const TOPICS: Topic[] = [
  {
    label: "Cue delivery",
    words:
      /\b(straight(ness)?|deliver(y|ing)|cue action|cueing arm|follow[- ]through|elbow|back ?swing|feathers?|feathering|jab(bing|s)?|snatch(ing|ed)?|steer(ing|s)?|pause|transition|cue arm|wobbl\w*)\b/i,
    routines: [
      "routine-straight-cueing-line",
      "routine-cueing-secret-session",
      "routine-straight-cueing-fundamentals-guide",
    ],
  },
  {
    label: "Head still",
    words: /\b(head|chin|lift(s|ing|ed)? (up|the head)|jump(s|ing)? up|eyes?|looking up|stay(ing)? down)\b/i,
    routines: ["routine-head-position-fundamentals", "routine-straight-cueing-line"],
  },
  {
    label: "Stance and balance",
    words:
      /\b(stance|balance|feet|foot|footing|weight distribution|sway(s|ing)?|legs?|hips?|body (position|alignment|movement)|standing)\b/i,
    routines: ["routine-bridge-grip-stance"],
  },
  {
    label: "Grip",
    words: /\b(grip(s|ping)?|wrist|fingers?|squeez\w*|tight hand|loose hand)\b/i,
    routines: ["routine-pre-shot-routine", "routine-cueing-secret-session"],
  },
  {
    label: "Bridge",
    words: /\b(bridg(e|es|ing)|bridge hand|loop bridge)\b/i,
    routines: ["routine-bridge-fundamentals"],
  },
  {
    label: "Aim and alignment",
    words:
      /\b(aim(s|ing)?|align(ment|ed)?|sight(ing)?|line of (aim|the shot)|shot line|cue line|over-?cut|under-?cut|thin|thick)\b/i,
    routines: ["routine-rest-shot-fundamentals", "routine-straight-cueing-line"],
  },
  {
    label: "Pre-shot routine",
    words:
      /\b(pre-?shot|rush(ed|ing)?|hurr(y|ied|ying)|tempo|rhythm|commit(ment|ted)?|hesita\w*|decision|composure|settl(e|ing))\b/i,
    routines: ["routine-pre-shot-system-fundamentals"],
  },
  {
    label: "Screw",
    words: /\b(screw(s|ing)?|back ?spin|draw|low on the (cue ?)?ball|bottom of the (cue ?)?ball)\b/i,
    routines: ["routine-screw-back", "routine-deep-screw"],
  },
  {
    label: "Stun",
    words: /\b(stun(s|ning|ned)?)\b/i,
    routines: ["routine-stun-line", "routine-stun-run-through"],
  },
  {
    label: "Top spin",
    words: /\b(top ?spin|follow shot|run[- ]through|high on the (cue ?)?ball)\b/i,
    routines: ["routine-top-spin-control"],
  },
  {
    label: "Side spin",
    words: /\b(side ?spin|english|swerve|(using|use|put|putting|adding|add|with) (some |too much |a lot of )?side)\b/i,
    routines: ["routine-side-spin-control"],
  },
  {
    label: "Cue ball control",
    words:
      /\b(positional|position (for|on)|(get|getting|got) position|cue[- ]ball control|pace|weight of shot|leaves?|cue ball (ran|ends?|finishe[sd]))\b/i,
    routines: ["routine-cue-ball-control", "routine-cue-ball-control-fundamentals-guide"],
  },
  {
    label: "Long potting",
    words: /\b(long (pots?|reds?|shots?|potting|blue|range)|length of the table)\b/i,
    routines: ["routine-long-potting-classic", "routine-long-blue-straight-cue"],
  },
  {
    label: "Break building",
    words:
      /\b(break[- ]building|build(ing)? (a |the |your )?breaks?|shot selection|planning|pattern|cluster|next red)\b/i,
    routines: ["routine-line-up", "routine-break-building-foundations", "routine-t-routine"],
  },
  {
    label: "Clearing the colours",
    words: /\b(colours|clearance|clear(ing)? the colours)\b/i,
    routines: ["routine-around-colours", "routine-3-reds-colours"],
  },
  {
    label: "Safety",
    words: /\b(safety|safeties|safe|containment|tactical)\b/i,
    routines: ["routine-baulk-safety"],
  },
  {
    label: "Escapes",
    words: /\b(escap(e|es|ing)|snookered|kicks?|cushion)\b/i,
    routines: ["routine-escape-science", "routine-two-cushion-escape"],
  },
  { label: "Black", words: /\bblack\b/i, routines: ["routine-black-off-spot"] },
  { label: "Pink", words: /\bpink\b/i, routines: ["routine-pink-ball-routine"] },
  { label: "Blue", words: /\bblue\b/i, routines: ["routine-blue-ball-control"] },
];

/** When the report names nothing the library covers, a routine for what the player asked about. */
const FOR_FOCUS: Record<AnalysisType, string> = {
  shot: "routine-straight-cueing-line",
  technique: "routine-straight-cueing-line",
  stance: "routine-bridge-grip-stance",
  tactical: "routine-baulk-safety",
  full_session: "routine-line-up",
};

/** How much a mention counts, by where in the report it is. */
const WEIGHT = { improvement: 3, cause: 2, tip: 2, summary: 1 } as const;

export type RoutineSuggestion = {
  routine: Routine;
  /** What it works on. */
  topic: string;
  /** The finding it answers, in the coach's words; absent for the fallback. */
  because?: string;
};

export const suggestRoutines = (
  report: Report | undefined,
  analysisType: AnalysisType,
  library: Routine[],
  limit = 3
): RoutineSuggestion[] => {
  const byId = new Map(library.map((routine) => [routine.id, routine]));
  if (!report) return [];

  const findings: Array<{ text: string; weight: number }> = [
    ...report.improvements.map((text) => ({ text, weight: WEIGHT.improvement })),
    ...report.possible_causes.map((text) => ({ text, weight: WEIGHT.cause })),
    { text: report.coaching_tip ?? "", weight: WEIGHT.tip },
    { text: report.summary ?? "", weight: WEIGHT.summary },
  ].filter((finding) => finding.text.trim());

  const ranked = TOPICS.map((topic, order) => {
    const hits = findings.filter((finding) => topic.words.test(finding.text));
    const score = hits.reduce((sum, hit) => sum + hit.weight, 0);
    // The strongest finding that mentions it is the one to quote.
    const because = [...hits].sort((a, b) => b.weight - a.weight)[0]?.text;
    return { topic, score, because, order };
  })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.order - b.order);

  const chosen: RoutineSuggestion[] = [];
  const taken = new Set<string>();
  const take = (id: string, topic: string, because?: string) => {
    const routine = byId.get(id);
    if (!routine || taken.has(id) || chosen.length >= limit) return false;
    taken.add(id);
    chosen.push({ routine, topic, because });
    return true;
  };

  // One routine for each part of the game first, so three suggestions cover three things...
  ranked.forEach((row) => row.topic.routines.some((id) => take(id, row.topic.label, row.because)));
  // ...then more for the most talked-about ones if there is room.
  ranked.forEach((row) => row.topic.routines.forEach((id) => take(id, row.topic.label, row.because)));

  if (chosen.length === 0) take(FOR_FOCUS[analysisType] ?? FOR_FOCUS.technique, "Your focus");
  return chosen;
};
