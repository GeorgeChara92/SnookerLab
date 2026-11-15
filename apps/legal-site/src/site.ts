export const SUPPORT_EMAIL = "support@snookeredapp.com";
export const SITE_URL = "https://snookeredapp.com";

export type RouteMeta = { path: string; title: string; description: string };

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Snookered · Snooker scoring, practice and club app",
    description:
      "Score matches ball by ball, practise with purpose, track your progress, get coaching from a clip of your own game, play your mates and follow the pro tour live. Coming soon to iPhone.",
  },
  {
    path: "/scoring",
    title: "Snooker scoring app: score every frame ball by ball · Snookered",
    description:
      "Live snooker scoring on your phone: points remaining, snookers required, fouls and breaks worked out as you play, with a match overview and share card at the end.",
  },
  {
    path: "/record-snooker",
    title: "Record a Snooker: put the balls back exactly after a miss · Snookered",
    description:
      "Walk round the table before you play a snooker and the camera finds every ball. After a foul and a miss, a ring on the cloth shows where each one goes back.",
  },
  {
    path: "/practice",
    title: "Snooker practice routines, routine builder and AI coach · Snookered",
    description:
      "Snooker practice that counts: build your own routines, run the line-up and more with a personal best on each, keep a weekly plan and streak, and get AI coaching from a clip.",
  },
  {
    path: "/coaching",
    title: "Snooker coaching: AI feedback or a real coach · Snookered",
    description:
      "Two ways to get coached in Snookered: feedback on your technique from a clip of your own game, or book a verified coach near you. Coaches can run their whole diary in the app.",
  },
  {
    path: "/coach",
    title: "Snookered Coach: coaching from a clip of your own game",
    description:
      "Record a clip at the table and get coaching feedback on your technique: what went well, the one thing to fix first, and the routines that train it.",
  },
  {
    path: "/find-a-coach",
    title: "Find a snooker coach, or run your own diary · Snookered",
    description:
      "Book a verified coach near you, or apply to coach yourself: take bookings, message your clients, run a broadcast group, and keep your own diary - even clients with no Snookered account.",
  },
  {
    path: "/coach-diary",
    title: "Coach Diary: booking calendar, clients and session notes · Snookered",
    description:
      "Run your coaching business from Snookered: a booking calendar, a client list including walk-ins with no account, broadcast groups for drills, and private session notes. £4.99 a month.",
  },
  {
    path: "/features",
    title: "Every feature in the Snookered snooker app",
    description:
      "Everything Snookered does, in one place: live scoring with free balls and the rules, Record a Snooker, practice routines and guides, the AI coach, stats, friends and groups, the pro tour and the coaching diary.",
  },
  {
    path: "/community",
    title: "Snooker club groups, friend matches and live scores · Snookered",
    description:
      "Play friends in matches that count for both players, follow their frames live, and run a group for your snooker club or league with its own chat, feed and leaderboards.",
  },
  {
    path: "/pro-tour",
    title: "Live snooker scores, fixtures and results in your time zone · Snookered",
    description:
      "Follow the professional snooker tour live: scores, fixtures and results in your own time zone, the full draw and bracket, money rankings, player profiles and notifications for the players you follow.",
  },
  {
    path: "/plans",
    title: "Plans and pricing · Snookered",
    description: "Snookered plans: Free, Half-Century and Century. Compare matches, tournaments and AI coach reviews a month. Free to start, billed through your Apple account.",
  },
  {
    path: "/support",
    title: "Support and help · Snookered",
    description: "Help with Snookered: your account, subscriptions, the AI coach, confirmation emails and reporting. Email us and a person will reply within two working days.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy · Snookered",
    description: "What data Snookered collects, why it is collected, who processes it, and the controls you have over your account and your data.",
  },
  { path: "/terms", title: "Terms of Use · Snookered", description: "The terms for using the Snookered snooker app: your account, subscriptions, acceptable use, AI coaching guidance and content ownership." },
  { path: "/404", title: "Page not found · Snookered", description: "That page could not be found. Head back to the Snookered home page." },
];

export const metaFor = (path: string) => ROUTES.find((route) => route.path === path) ?? ROUTES[ROUTES.length - 1];

export const NAV = [
  { to: "/scoring", label: "Scoring" },
  { to: "/record-snooker", label: "Record a Snooker" },
  { to: "/practice", label: "Practice" },
  { to: "/coaching", label: "Coaching" },
  { to: "/community", label: "Community" },
  { to: "/pro-tour", label: "Pro Tour" },
  { to: "/plans", label: "Plans" },
  { to: "/features", label: "All features" },
];

/** In the menu and the footer, not the top bar: the pages behind Coaching, and the rest. */
export const MORE_NAV = [
  { to: "/coach", label: "Snookered Coach" },
  { to: "/find-a-coach", label: "Find a Coach" },
  { to: "/coach-diary", label: "Coach Diary" },
  { to: "/support", label: "Support" },
];

export type Screen =
  | "ai-coach"
  | "chat"
  | "community"
  | "dashboard"
  | "group"
  | "live-match"
  | "live-scoring"
  | "match-overview"
  | "routine"
  | "routine-builder"
  | "share-card"
  | "stats"
  | "tournament"
  | "find-coach"
  | "coach-profile"
  | "my-coaching"
  | "coach-calendar"
  | "coach-clients"
  | "coach-group"
  | "coach-message"
  | "coach-dashboard"
  | "session-notes"
  | "record-snooker"
  | "guide"
  | "rules"
  | "pro-tour-live"
  | "pro-tour-bracket"
  | "rankings"
  | "player-season"
  | "ai-coach-plan";

/** monthly/annual are null for Free - there is nothing to charge, so no price to show. */
export const PLANS: Array<{
  name: string;
  line: string;
  who: string;
  tag?: string;
  monthly: number | null;
  annual: number | null;
  items: string[];
}> = [
  {
    name: "Free",
    line: "Start your game.",
    who: "For players trying it out.",
    monthly: null,
    annual: null,
    items: [
      "Every routine, guide and video",
      "The Pro Tour, the rules and the community",
      "12 matches and 1 tournament a month",
      "1 Snookered Coach review a month",
      "3 recorded snookers a month",
      "Build up to 3 routines and save 1 practice session",
      "Stats from the last 30 days",
    ],
  },
  {
    name: "Half-Century",
    line: "For regular players.",
    who: "For players at the table every week.",
    tag: "Most popular with weekly players",
    monthly: 3.99,
    annual: 29.99,
    items: [
      "40 matches and 4 tournaments a month",
      "8 Snookered Coach reviews a month",
      "Unlimited recorded snookers",
      "Build as many routines and save as many sessions as you like",
      "Your full stats history",
      "More result card backgrounds",
      "A subscriber badge in chat and community",
    ],
  },
  {
    name: "Century",
    line: "The full Snookered experience.",
    who: "For players chasing centuries and running club nights.",
    monthly: 7.99,
    annual: 59.99,
    items: [
      "Unlimited matches and tournaments",
      "20 Snookered Coach reviews a month",
      "Everything in Half-Century",
      "Every result card background, gold Century card included",
      "A subscriber badge, plus an exclusive app icon",
      "Early access to new features before they're released",
    ],
  },
];

/** Kept apart from PLANS: a coach's subscription isn't a step up from Century, it's a different
 * thing entirely, and COMPARE (player-only metrics like matches/month) does not apply to it. */
export const COACH_PLAN = {
  name: "Coach",
  line: "Run your own coaching diary.",
  who: "For an approved coach ready to take bookings.",
  monthly: 4.99,
  annual: 39.99,
  items: [
    "Your own booking calendar and diary",
    "A client list, including walk-ins with no account",
    "Broadcast groups for drills, videos and PDFs",
    "Private session notes and routine scores",
  ],
};

export const COMPARE: [string, string, string, string][] = [
  ["Every routine, guide and video", "yes", "yes", "yes"],
  ["The Pro Tour, the rules and the community", "yes", "yes", "yes"],
  ["Matches a month", "12", "40", "Unlimited"],
  ["Tournaments a month", "1", "4", "Unlimited"],
  ["Snookered Coach reviews a month", "1", "8", "20"],
  ["Recorded snookers a month", "3", "Unlimited", "Unlimited"],
  ["Your own routines", "3", "Unlimited", "Unlimited"],
  ["Saved practice sessions", "1", "Unlimited", "Unlimited"],
  ["Stats history", "30 days", "All of it", "All of it"],
  ["Result card backgrounds", "2", "4", "All 6"],
  ["Subscriber badge in chat and community", "no", "yes", "yes"],
  ["Exclusive app icon", "no", "no", "yes"],
  ["Early access to new features", "no", "no", "yes"],
];
