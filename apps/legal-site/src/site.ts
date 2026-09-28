export const SUPPORT_EMAIL = "support@snookeredapp.com";
export const SITE_URL = "https://snookeredapp.com";

export type RouteMeta = { path: string; title: string; description: string };

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Snookered · Snooker scoring, practice and club app",
    description:
      "Score matches ball by ball, practise with purpose, track your progress, get coaching from a clip of your own game and play your mates. Coming soon to iPhone.",
  },
  {
    path: "/scoring",
    title: "Snooker scoring app: score every frame ball by ball · Snookered",
    description:
      "Live snooker scoring on your phone: points remaining, snookers required, fouls and breaks worked out as you play, with a match overview and share card at the end.",
  },
  {
    path: "/practice",
    title: "Snooker practice routines, routine builder and AI coach · Snookered",
    description:
      "Snooker practice that counts: build your own routines, run the line-up and more with a personal best on each, keep a weekly plan and streak, and get AI coaching from a clip.",
  },
  {
    path: "/coach",
    title: "Coach: AI snooker coaching from a clip of your game · Snookered",
    description:
      "Record a clip at the table and get coaching feedback on your technique: what went well, the one thing to fix first, and the routines that train it.",
  },
  {
    path: "/find-a-coach",
    title: "Find a snooker coach, or run your own diary · Snookered",
    description:
      "Book a real coach near you, or list yourself as one: take bookings, message your clients, run a broadcast group, and keep your own diary - even clients with no Snookered account.",
  },
  {
    path: "/scan-snooker",
    title: "Scan a Snooker: replace the balls after a miss in AR · Snookered",
    description:
      "Scan the table before you play a snooker, then put every ball back exactly where it was after a foul and a miss, using AR ghosts on the real table.",
  },
  {
    path: "/community",
    title: "Snooker club groups, friend matches and live scores · Snookered",
    description:
      "Play friends in matches that count for both players, follow their frames live, and run a group for your snooker club or league with its own chat, feed and leaderboards.",
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
  { to: "/practice", label: "Practice" },
  { to: "/coach", label: "Coach" },
  { to: "/find-a-coach", label: "Find a Coach" },
  { to: "/scoring", label: "Scoring" },
  { to: "/community", label: "Community" },
  { to: "/plans", label: "Plans" },
];

/** In the menu and the footer, not the top bar: it is a feature, not a section of the site. */
export const MORE_NAV = [
  { to: "/scan-snooker", label: "Scan a Snooker" },
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
  | "session-notes";

export const PLANS = [
  {
    name: "Free",
    line: "Start your game.",
    who: "For players trying it out.",
    items: ["12 matches a month", "1 tournament a month", "1 Coach review a month", "Practice routines and sessions"],
  },
  {
    name: "Half-Century",
    line: "For regular players.",
    who: "For players at the table every week.",
    tag: "Most popular with weekly players",
    items: [
      "40 matches a month",
      "4 tournaments a month",
      "8 Coach reviews a month",
      "The full routine library and advanced tracking",
    ],
  },
  {
    name: "Century",
    line: "The full Snookered experience.",
    who: "For players chasing centuries and running club nights.",
    items: [
      "Unlimited matches",
      "Unlimited tournaments",
      "20 Coach reviews a month",
      "The full analytics suite and early access to new features",
    ],
  },
];

export const COMPARE: [string, string, string, string][] = [
  ["Matches a month", "12", "40", "Unlimited"],
  ["Tournaments a month", "1", "4", "Unlimited"],
  ["Coach reviews a month", "1", "8", "20"],
  ["Practice routines and sessions", "yes", "yes", "yes"],
  ["Playing friends and groups", "yes", "yes", "yes"],
  ["The full routine library", "no", "yes", "yes"],
  ["Advanced tracking", "no", "yes", "yes"],
  ["Full analytics suite", "no", "no", "yes"],
  ["Early access to new features", "no", "no", "yes"],
];
