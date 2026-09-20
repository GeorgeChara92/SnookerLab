type GuidePlaybook = {
  intro: string;
  whereToStart: string[];
  stepByStep: string[];
  progression: string[];
  commonTechniques: string[];
  importance: string[];
  commonIssues: string[];
  adaptNotes: string[];
  sessionPlan: string[];
  checkpoints: string[];
};

const GUIDE_PLAYBOOKS: Record<string, GuidePlaybook> = {
  "routine-bridge-grip-stance": {
    intro:
      "A stable stance is not about copying one exact pose. It is about creating a balanced base that lets your cue travel on the intended line under pressure.",
    whereToStart: [
      "Start with 6-8 straight pots from short range. Do not test difficult shots yet.",
      "Use one repeat pre-shot routine: stand behind line, step in, settle, deliver, hold finish.",
      "Film 5 shots from side view before changing anything so you have a baseline.",
    ],
    stepByStep: [
      "For right-handed players, place left foot on shot line, right foot slightly behind and turned out for balance. Reverse this if left-handed.",
      "Set most weight through the front/lead leg and keep back leg supportive rather than locked rigid.",
      "Lower from the hips, not by collapsing shoulders, so your cue stays level to the cloth.",
      "Lower into stance only after selecting the line while standing.",
      "Keep chin close to cue without forcing neck strain; eyes should stay level and calm.",
      "Keep head still and hold finish for a two-count after each shot.",
      "After every 5 shots, check if body height and shoulder level look consistent.",
      "If balance feels strained, adjust foot width slightly and retest with same shot.",
    ],
    progression: [
      "Phase 1: 20 straight pots with still head and stable finish.",
      "Phase 2: 20 slight-angle pots while preserving same setup mechanics.",
      "Phase 3: Add medium-distance shots only when stance shape stays repeatable.",
    ],
    commonTechniques: [
      "Classic textbook setup: lead foot on line, rear foot behind at comfortable angle, cue centred under dominant eye line.",
      "Square setup variant: feet less staggered, often used by players preferring upright balance and less trunk rotation.",
      "Long-reach variant: slightly wider base with lower hip hinge, used for extended bridge shots without losing balance.",
      "Key rule across all variants: stance must allow straight cue delivery without tension.",
    ],
    importance: [
      "Your stance controls balance, and balance controls whether your cueing arm can swing freely.",
      "Head stability improves aiming consistency because your eye line stops drifting during delivery.",
      "A repeatable address position makes misses easier to diagnose and fix session to session.",
    ],
    commonIssues: [
      "Leaning or reaching late causes body movement through impact and random thick or thin contact.",
      "Too much weight on one leg often creates steering with the upper body.",
      "Lifting early or peeking up breaks follow-through and changes strike timing.",
    ],
    adaptNotes: [
      "Foot angles can vary by flexibility and height. Prioritise comfort and stability over imitation.",
      "If your lower back tightens, shorten your stance slightly and retest cue freedom.",
      "Keep the principle constant: balanced base, quiet head, straight cue path.",
    ],
    sessionPlan: [
      "Play 10 straight pots while focusing only on getting into stance the same way every time.",
      "Play 10 slight cuts and hold your finish for a two-count to check head stillness.",
      "Record one short video from side or rear view and compare early and late shots.",
    ],
    checkpoints: [
      "I feel balanced before starting the final backswing.",
      "My head remains still through contact and follow-through.",
      "My finish position looks similar from shot to shot.",
    ],
  },
  "routine-pre-shot-routine": {
    intro:
      "Grip pressure is your connection to the cue. The goal is controlled freedom: soft enough to let the cue swing, firm enough to keep direction through impact.",
    whereToStart: [
      "Start with one easy repeat pot at short distance and one at medium distance.",
      "Use plain-ball contact first. No heavy side or power shots for the first set.",
      "Keep same bridge and same line so only grip pressure is being tested.",
    ],
    stepByStep: [
      "Play 10 shots with light grip pressure and note cue freedom and line control.",
      "Play 10 shots with medium grip pressure and compare contact quality.",
      "Play 10 shots with firmer pressure on positive strokes; avoid clamping early.",
      "Track if grip tightens too soon in backswing (common cause of jabbed strike).",
      "Track if grip is too loose at impact (a common cause of cue wobble and poor energy transfer).",
      "Review: choose the pressure that gives best balance of straight cue path and pace control.",
      "Lock in one default grip pressure for your next session and use it consistently.",
    ],
    progression: [
      "Phase 1: Plain-ball shots only until grip timing feels natural.",
      "Phase 2: Add slightly firmer pace while keeping same smooth arm swing.",
      "Phase 3: Add light stun/screw and confirm grip pressure still stays controlled.",
    ],
    commonTechniques: [
      "Neutral relaxed grip: cue rests mainly in fingers, with minimal palm squeeze until delivery.",
      "Finger-forward feel: used by some players to reduce cue seesaw during the backswing.",
      "Back-finger support: used by some players to stop the cue lifting through impact.",
      "Balanced-finger support: a two-finger dominant hold used by some players to steady the cue through the swing.",
      "Use these as experiments, not rules. Keep whichever gives straight cueing and best timing.",
    ],
    importance: [
      "Proper grip pressure keeps the forearm relaxed, which supports a straighter delivery.",
      "Consistent grip timing helps avoid jabbed transitions from backswing to strike.",
      "Pressure awareness improves power control without sacrificing line.",
    ],
    commonIssues: [
      "Gripping too tightly too early locks the wrist and often pulls the cue off line.",
      "Holding too lightly on positive strokes can make the cue unstable through contact.",
      "Changing grip pressure shot to shot causes inconsistent pace and spin outcomes.",
    ],
    adaptNotes: [
      "Different hand sizes and cue weights can change your ideal pressure point.",
      "Some players feel best with a deeper butt-in-hand position; others prefer lighter fingertip control.",
      "Keep the principle constant: smooth arm swing first, grip only supports it.",
    ],
    sessionPlan: [
      "Run 3 blocks of 10 shots with light, medium, then firmer grip pressure.",
      "Use the same pot each block and compare cue path, contact, and pace control.",
      "Keep the pressure level that gives cleanest cueing under both plain-ball and firmer pace shots.",
    ],
    checkpoints: [
      "My grip stays relaxed during feathering.",
      "I do not snatch or clamp the cue before impact.",
      "My cue path stays stable on both soft and firmer shots.",
    ],
  },
  "routine-bridge-fundamentals": {
    intro:
      "A strong bridge gives the cue a reliable line of travel. Learn one stable base shape first, then adapt it for different table situations.",
    whereToStart: [
      "Start with open bridge on one straight pot and one slight-angle pot.",
      "Focus on finger pads gripping cloth, stable hand base, and a clean cue channel.",
      "Use medium bridge length first, then test small adjustments if cue feels cramped or unstable.",
    ],
    stepByStep: [
      "Open bridge: spread fingers, plant hand, build cue groove with thumb against forefinger.",
      "Closed bridge: loop forefinger over cue for extra guidance on firmer or spin shots.",
      "Pressure test: keep finger pads and especially forefinger base pressed into cloth to remove side wobble.",
      "Screw bridge: lower bridge height while maintaining firmness and cue clearance.",
      "Cushion bridge: use cushion support with stable hand contact, avoid cue scraping.",
      "Over-ball bridge: elevate safely, reduce pace, and prioritise straight cueing over power.",
      "Rest/spider shots: keep same cueing rhythm as normal shots, even if bridge tool changes hand feel.",
    ],
    progression: [
      "Phase 1: 10 open-bridge shots + 10 closed-bridge shots on the same pot.",
      "Phase 2: 10 cushion-bridge shots down the cushion and compare strike stability.",
      "Phase 3: 6-8 over-ball or awkward-bridge shots with controlled tempo.",
    ],
    commonTechniques: [
      "Open bridge: most common baseline for visibility and touch shots.",
      "Closed bridge: common choice for added cue guidance on power, side, or deep screw.",
      "Loop bridge variation: traditional option for very low strike and deep screw control.",
      "Bridge-on-cushion and bridge-over-ball adaptations: mandatory for match realism on awkward positions.",
      "Rest/spider adaptation: same fundamentals, different support tool.",
    ],
    importance: [
      "Bridge stability controls tip direction at the final moment before impact.",
      "Correct bridge height and width help produce clean plain-ball and spin strikes.",
      "Bridge adaptability lets you stay technically sound on awkward shots.",
    ],
    commonIssues: [
      "A narrow or floating bridge rocks sideways and sends the cue off line.",
      "Poor thumb-finger channel causes cue drag and steering near impact.",
      "Using one bridge shape for every shot can fail on cushion, screw, or over-ball positions.",
    ],
    adaptNotes: [
      "Open bridge is a common starting point for visibility and control.",
      "Closed bridge can improve cue guidance on power and side-spin shots.",
      "Rail, over-ball, and elevated bridges should keep the same base rule: planted support and clear cue channel.",
    ],
    sessionPlan: [
      "Practise 10 shots each with open and closed bridges on the same pot.",
      "Play along-cushion shots with cushion bridge focus and evaluate cue freedom.",
      "Add 6-8 raised-bridge shots over an object ball and prioritise stability over pace.",
    ],
    checkpoints: [
      "My finger pads stay planted through impact.",
      "The cue runs cleanly in the bridge channel without scraping.",
      "I can switch bridge type without losing my cueing rhythm.",
    ],
  },
  "routine-rest-shot-fundamentals": {
    intro:
      "Sighting links decision and execution. Choose the shot line early, step in cleanly, and stay with that decision through the cue action.",
    whereToStart: [
      "Start with 3 shot types: straight, half-ball, and three-quarter-ball pots.",
      "Before every shot, call the contact thickness out loud.",
      "Use the same approach routine each time to train visual consistency.",
    ],
    stepByStep: [
      "Stand directly behind cue ball and define object-ball contact point first.",
      "Use a consistent visual order: object-ball contact point, then cue-ball strike point, then back to object-ball intention.",
      "Walk in on the line, place bridge, then settle cue onto chosen line.",
      "Keep final eye routine consistent before delivery and avoid late re-aiming.",
      "Pause before final delivery so decision and execution stay connected.",
      "After each shot, label result as thick, thin, or pace error.",
      "Repeat each shot type in 5-shot blocks so patterns become obvious.",
    ],
    progression: [
      "Phase 1: 15 straight-line decisions with clear contact calls.",
      "Phase 2: 20 mixed half/three-quarter-ball pots with call-and-check method.",
      "Phase 3: Add medium distance while keeping same visual sequence.",
    ],
    commonTechniques: [
      "Centre-of-face sighting: cue delivered along visual centre line between eyes and cue.",
      "Dominant-eye bias setup: slight head offset to keep dominant eye naturally on cue line.",
      "Contact-point-first method: decide object-ball contact before getting down.",
      "Contact-picture visualisation: imagine the exact object-ball contact needed before you get down.",
      "Any method is useful if it is repeatable and reduces late steering.",
    ],
    importance: [
      "Clear aiming decisions reduce late corrections and improve cueing confidence.",
      "Consistent visual routine supports timing and lowers hesitation on key balls.",
      "Calling contact thickness develops judgement for both potting and positional control.",
    ],
    commonIssues: [
      "Getting down too early leads to re-aiming while cueing, which often causes steering.",
      "Changing eye focus pattern from shot to shot disrupts timing and pause quality.",
      "Unclear contact intention creates misses that feel random and hard to fix.",
    ],
    adaptNotes: [
      "Dominant-eye alignment varies between players, so exact head position can differ.",
      "Use the visual sequence that keeps you calm, clear, and decisive.",
      "Keep the principle constant: decide from standing, deliver without late changes.",
    ],
    sessionPlan: [
      "Run a sequence of straight, half-ball, and three-quarter-ball pots.",
      "Call the intended contact before each shot and say whether the result matched.",
      "Track misses as thick, thin, or pace-related to find patterns quickly.",
    ],
    checkpoints: [
      "I decide the shot line before I get down.",
      "My approach into stance is on-line, not corrected late.",
      "I stay with one visual decision through delivery.",
    ],
  },
  "routine-potting-fundamentals": {
    intro:
      "Cue action is your engine. A smooth rhythm, clear pause, and complete follow-through make your strike more predictable in both practice and matches.",
    whereToStart: [
      "Start with plain-ball pots only from short-to-medium distance.",
      "Use one fixed routine: settle, feather, pause, deliver, hold finish.",
      "Ignore score at first; focus on timing quality and cue path consistency.",
    ],
    stepByStep: [
      "Play 10 shots focusing only on smooth transition from backswing to forward swing.",
      "Play 10 shots with explicit pause before final delivery.",
      "Play 10 shots emphasising full follow-through and still head position.",
      "Use a simple count rhythm (for example: settle, feather, pause, go) to stabilise tempo.",
      "Review misses and classify cause: jab, deceleration, steering, or pace misread.",
      "Only then add gentle stun/screw while keeping the same timing signature.",
    ],
    progression: [
      "Phase 1: Plain-ball rhythm and finish control.",
      "Phase 2: Controlled pace changes with same cue action.",
      "Phase 3: Add spin shots without losing pause and follow-through quality.",
    ],
    commonTechniques: [
      "Three-stage cueing model: rest position, backswing, follow-through.",
      "Pause-and-deliver model: brief pause at end of backswing to improve strike timing.",
      "Longer follow-through model: emphasises positive acceleration through the cue-ball.",
      "Compact cueing model: shorter cue action for tight positional shots while preserving smoothness.",
    ],
    importance: [
      "Stable timing improves centre-ball contact and reduces unplanned side.",
      "A controlled pause before delivery helps transition from aiming to execution.",
      "Good follow-through supports pace control and cleaner object-ball contact.",
    ],
    commonIssues: [
      "Rushing the final transition often leads to jabbed delivery and thin misses.",
      "Decelerating into the cue ball weakens strike and hurts positional control.",
      "Jumping up early removes feedback and masks the real cause of misses.",
    ],
    adaptNotes: [
      "Natural tempo differs between players, so do not copy cadence blindly.",
      "Use the rhythm that keeps you loose and repeatable under pressure.",
      "Keep the principle constant: smooth acceleration, stable head, and a held finish.",
    ],
    sessionPlan: [
      "Play plain-ball shots first until cue path and finish look consistent.",
      "Introduce gentle stun and screw while preserving the same timing pattern.",
      "If quality drops, return to plain-ball practice shots before adding complexity again.",
    ],
    checkpoints: [
      "My final backswing has a clear pause before delivery.",
      "The cue accelerates through the ball instead of stabbing at it.",
      "I hold my finish long enough to verify line and head stillness.",
    ],
  },
  "routine-head-position-fundamentals": {
    intro:
      "Head position links what you see to how you deliver the cue. If head height or eye line changes each shot, potting judgement and cueing trust both suffer.",
    whereToStart: [
      "Start with simple straight and slight-angle pots from short range.",
      "Set feet and bridge first, then place head last so you do not chase alignment with your neck.",
      "Use one camera angle from behind cue line to check repeatability.",
    ],
    stepByStep: [
      "Address the shot from standing and decide line before lowering.",
      "Lower body into stance, then settle head until eyes feel level and calm.",
      "Bring chin near the cue only as much as comfort allows; avoid forced neck compression.",
      "Check cue passes under your chosen visual line without shoulder twist.",
      "Stay still through impact and hold finish before looking up.",
    ],
    progression: [
      "Phase 1: 20 short straight shots with fixed head height.",
      "Phase 2: 20 slight cuts while preserving same chin-to-cue relationship.",
      "Phase 3: add medium distance and verify setup remains unchanged.",
    ],
    commonTechniques: [
      "Centre-head method: cue appears centred under face and visual line.",
      "Dominant-eye offset method: small head shift to keep dominant eye on line.",
      "Chin-close method: common with modern players for consistent sight picture.",
      "Higher-head method: used by players prioritising comfort and freedom of movement.",
    ],
    importance: [
      "Stable head gives stable visual information.",
      "Consistent chin and eye position reduce aiming guesswork.",
      "Repeatable head placement supports repeatable cueing.",
    ],
    commonIssues: [
      "Dropping head too early and then correcting body late.",
      "Forcing chin too low, causing neck strain and tension in delivery.",
      "Lifting on strike, which masks true miss cause.",
    ],
    adaptNotes: [
      "Head height can vary by neck mobility and body shape.",
      "Do not copy another player's exact look if it creates tension.",
      "Keep one rule: your chosen position must be repeatable and stable.",
    ],
    sessionPlan: [
      "Run 3 x 10-shot blocks on the same pot while tracking head movement.",
      "After each block, note if misses came with visible head lift.",
      "Finish with 10 mixed shots and keep the same settle-head routine.",
    ],
    checkpoints: [
      "My head arrives after feet and bridge are set.",
      "My chin-to-cue distance feels consistent.",
      "I stay down until shot completion.",
    ],
  },
  "routine-straight-cueing-fundamentals-guide": {
    intro:
      "Straight cueing is the backbone of reliable potting and position. It removes hidden side and makes your misses meaningful.",
    whereToStart: [
      "Start with dead-straight pots at short range.",
      "Use centre-ball only until cue path is clean.",
      "Track miss side instead of just counting misses.",
    ],
    stepByStep: [
      "Align stance and bridge so the cue can travel on a straight line.",
      "Feather with cue centred in bridge groove.",
      "Deliver through centre-ball with no wrist flick.",
      "Hold finish and check whether cue ended on same line.",
      "Review patterns: repeated one-side misses suggest line bias.",
    ],
    progression: [
      "Phase 1: short straight pots for pure cueing-line training.",
      "Phase 2: medium straight pots with controlled pace variation.",
      "Phase 3: slight angles while preserving same cue-line behaviour.",
    ],
    commonTechniques: [
      "Line drill method: repeated straight setups from same marks.",
      "Cushion-return check: send the cue-ball to the cushion and back for straightness feedback.",
      "Rear-camera audit: verify cue path from behind line.",
    ],
    importance: [
      "Reduces accidental side spin.",
      "Improves confidence on simple and pressure balls.",
      "Supports all advanced spin and position skills.",
    ],
    commonIssues: [
      "Steering with shoulder or grip hand.",
      "Cue drifting in bridge channel.",
      "Deceleration causing tip wobble at impact.",
    ],
    adaptNotes: [
      "Some players use slightly different grip and bridge lengths.",
      "Keep what allows repeatable centre-ball strike.",
      "Do not sacrifice straightness for power.",
    ],
    sessionPlan: [
      "Run 5 sets of 6 straight pots and log left/right miss trend.",
      "After each set, adjust one variable only.",
      "Finish with a confidence set where process is identical on each shot.",
    ],
    checkpoints: [
      "Cue remains centred in bridge during feathers and strike.",
      "Misses are reducing on one-side bias.",
      "Centre-ball contact feels predictable.",
    ],
  },
  "routine-cue-ball-control-fundamentals-guide": {
    intro:
      "Cue-ball control starts with predictable basics: where you hit the cue-ball and how fast you deliver the cue.",
    whereToStart: [
      "Use one object-ball setup and fixed distances.",
      "Begin with plain-ball before adding spin.",
      "Record finish zones for each strike type.",
    ],
    stepByStep: [
      "Play centre-ball shots and map natural roll outcomes.",
      "Play above-centre shots and measure run-through distance.",
      "Play below-centre shots and measure check-back distance.",
      "Keep cue speed similar to isolate tip-position effect.",
      "Repeat with mild pace changes once baseline is stable.",
    ],
    progression: [
      "Phase 1: plain-ball/follow/screw on short range.",
      "Phase 2: same strikes at medium range with zone targets.",
      "Phase 3: introduce stun and small side at controlled pace.",
    ],
    commonTechniques: [
      "Five-point strike map (top to bottom) for cue-ball behaviour learning.",
      "Landing-zone method: define cue-ball finishing zones before each shot.",
      "Same-speed comparison method: isolate strike point changes.",
    ],
    importance: [
      "Builds position play foundation.",
      "Improves break-building confidence.",
      "Makes tactical shots more predictable.",
    ],
    commonIssues: [
      "Changing speed unintentionally while testing strike points.",
      "Adding unintended side due to poor alignment.",
      "Trying advanced spin before plain-ball control is stable.",
    ],
    adaptNotes: [
      "Cue-ball response varies with cloth speed and table condition.",
      "Adjust expectations per table, keep process constant.",
      "Prioritise repeatability over flashy spin.",
    ],
    sessionPlan: [
      "3 blocks: centre, top, screw (10 shots each).",
      "Log finish zones and % of intended outcomes.",
      "Repeat next session and compare consistency trend.",
    ],
    checkpoints: [
      "I can call expected cue-ball path before striking.",
      "My strike point and cue speed are intentional.",
      "My finish-zone accuracy improves session to session.",
    ],
  },
  "routine-pre-shot-system-fundamentals": {
    intro:
      "A pre-shot routine is a decision system. It keeps your mind and body in order so pressure does not disrupt your cueing.",
    whereToStart: [
      "Choose 4-6 easy pots and apply one routine sequence to every shot.",
      "Use verbal keywords to reinforce sequence order.",
      "Do not change routine because of previous result.",
    ],
    stepByStep: [
      "Plan from standing: potting line, contact point, cue-ball intention.",
      "Walk in on line and set feet before lowering.",
      "Set bridge and cue, then run feathers and final check.",
      "Deliver without reopening the decision once you are down on the shot.",
      "Post-shot: brief review, then reset for next ball.",
    ],
    progression: [
      "Phase 1: same routine on simple repeat shots.",
      "Phase 2: apply routine to mixed shot list.",
      "Phase 3: timed sets and pressure scoring with unchanged routine.",
    ],
    commonTechniques: [
      "Keyword routine (e.g., plan, place, settle, deliver).",
      "Breath-trigger routine for tempo control.",
      "Fixed-sequence routine with identical order each shot.",
    ],
    importance: [
      "Improves consistency under pressure.",
      "Reduces rushed or impulsive shots.",
      "Creates a reliable reset after mistakes.",
    ],
    commonIssues: [
      "Skipping steps on easy balls.",
      "Overthinking and restarting routine too often.",
      "Changing decision while already down on shot.",
    ],
    adaptNotes: [
      "Routine length can vary by personality and pace preference.",
      "Keep sequence short enough to stay sharp but complete enough to be reliable.",
      "Consistency is more important than style.",
    ],
    sessionPlan: [
      "Run 20-shot routine check and mark any step you skipped.",
      "Repeat with light pressure (e.g., reset count on routine break).",
      "Finish with 10-shot block where every shot uses full routine.",
    ],
    checkpoints: [
      "I know my routine steps in order.",
      "I do not change decisions once I am down.",
      "My tempo remains stable from shot to shot.",
    ],
  },
};

export const getGuidePlaybookByRoutineId = (routineId: string): GuidePlaybook | undefined => GUIDE_PLAYBOOKS[routineId];
