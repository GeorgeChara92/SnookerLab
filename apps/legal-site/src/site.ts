export const SUPPORT_EMAIL = "support@snookeredapp.com";
export const SITE_URL = "https://snookeredapp.com";

export type RouteMeta = { path: string; title: string; description: string };

export const ROUTES: RouteMeta[] = [
  {
    path: "/",
    title: "Snookered · The snooker app for scoring, practice and friends",
    description:
      "Snookered is the all-in-one snooker app: score every frame live, practise with purpose, play your friends for real and follow the pro tour.",
  },
  {
    path: "/scoring",
    title: "Scoring · Snookered",
    description:
      "Live snooker scoring ball by ball: points remaining, snookers required, fouls, breaks and a match overview you can share.",
  },
  {
    path: "/practice",
    title: "Practice · Snookered",
    description:
      "Snooker practice routines with personal bests and leaderboards, weekly plans and streaks, and an AI coach that watches you play.",
  },
  {
    path: "/scan-snooker",
    title: "Scan Snooker · Snookered",
    description:
      "Scan Snooker: record where the balls were, then replace them in AR after a foul and a miss, and set routines up on the real table.",
  },
  {
    path: "/community",
    title: "Community · Snookered",
    description:
      "Play friends in matches that count for both of you, follow their matches live, and run groups for your league or club.",
  },
  {
    path: "/plans",
    title: "Plans · Snookered",
    description: "Snookered plans: Free, Half-Century and Century. Compare matches, tournaments and AI coach reviews.",
  },
  {
    path: "/support",
    title: "Support · Snookered",
    description: "Get help with Snookered: your account, subscriptions, the AI coach and more.",
  },
  {
    path: "/privacy",
    title: "Privacy Policy · Snookered",
    description: "What data Snookered collects, why, and the controls available to you.",
  },
  { path: "/terms", title: "Terms of Use · Snookered", description: "The terms for using the Snookered app." },
  { path: "/404", title: "Page not found · Snookered", description: "That page could not be found." },
];

export const metaFor = (path: string) => ROUTES.find((route) => route.path === path) ?? ROUTES[ROUTES.length - 1];

export const NAV = [
  { to: "/scoring", label: "Scoring" },
  { to: "/practice", label: "Practice" },
  { to: "/scan-snooker", label: "Scan Snooker" },
  { to: "/community", label: "Community" },
  { to: "/plans", label: "Plans" },
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
  | "tournament";

export const PLANS = [
  {
    name: "Free",
    line: "Track your practice and see where you stand.",
    items: ["12 matches a month", "1 tournament a month", "1 AI coach review a month", "Practice routines and sessions"],
  },
  {
    name: "Half-Century",
    line: "For players practising every week.",
    tag: "For weekly players",
    items: [
      "40 matches a month",
      "4 tournaments a month",
      "8 AI coach reviews a month",
      "The full routine library and advanced tracking",
    ],
  },
  {
    name: "Century",
    line: "Everything, for players chasing centuries.",
    items: [
      "Unlimited matches",
      "Unlimited tournaments",
      "20 AI coach reviews a month",
      "The full analytics suite and early access to new features",
    ],
  },
];

export const COMPARE: [string, string, string, string][] = [
  ["Matches a month", "12", "40", "Unlimited"],
  ["Tournaments a month", "1", "4", "Unlimited"],
  ["AI coach reviews a month", "1", "8", "20"],
  ["Practice routines and sessions", "yes", "yes", "yes"],
  ["Playing friends and groups", "yes", "yes", "yes"],
  ["The full routine library", "no", "yes", "yes"],
  ["Advanced tracking", "no", "yes", "yes"],
  ["Full analytics suite", "no", "no", "yes"],
  ["Early access to new features", "no", "no", "yes"],
];
