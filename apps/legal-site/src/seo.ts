import { SITE_URL, SUPPORT_EMAIL } from "./site";

/** Structured data: only ever describing what is actually on the page. */

const app = {
  "@type": "SoftwareApplication",
  "@id": `${SITE_URL}/#app`,
  name: "Snookered",
  applicationCategory: "SportsApplication",
  operatingSystem: "iOS",
  url: SITE_URL,
  image: `${SITE_URL}/og.jpg`,
  description:
    "A snooker app for scoring frames ball by ball, building and running practice routines, AI coaching from a clip of your game, and playing friends in matches that count for both players.",
  inLanguage: "en-GB",
  featureList: [
    "Ball-by-ball snooker scoring",
    "Practice routines with personal bests and leaderboards",
    "Routine builder",
    "AI coaching from a video clip",
    "Friend matches, groups and live scores",
    "Club tournaments",
  ],
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "GBP",
    description: "Free plan with 12 matches, 1 tournament and 1 AI coach review a month.",
  },
};

const organisation = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#org`,
  name: "Snookered",
  url: SITE_URL,
  logo: `${SITE_URL}/icon-512.jpg`,
  email: SUPPORT_EMAIL,
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: SUPPORT_EMAIL,
    availableLanguage: "English",
  },
};

const crumbs = (path: string, name: string) => ({
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
    { "@type": "ListItem", position: 2, name, item: `${SITE_URL}${path}` },
  ],
});

const faq = (items: [string, string][]) => ({
  "@type": "FAQPage",
  mainEntity: items.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
});

/** The same questions and answers a visitor reads on the page. */
const PLAN_FAQ: [string, string][] = [
  ["How do I cancel?", "Any time, in your Apple account under Subscriptions. You keep your plan until the end of the period you paid for."],
  ["When do the monthly limits reset?", "Once a month, on the same date each month."],
  ["Can I change plan later?", "Yes. Upgrade or downgrade from the Plans screen in the app, or in your Apple account."],
  ["Something wrong with a payment?", `Apple handles billing and refunds. For anything else, email ${SUPPORT_EMAIL}.`],
];

const SUPPORT_FAQ: [string, string][] = [
  [
    "I did not get my confirmation or reset email",
    "Check your spam or junk folder for an email from Snookered. Links work once and expire after an hour, so ask for a new one from the sign-in screen if it is old.",
  ],
  [
    "How do I delete my account?",
    "In the app, go to Profile, then Settings, then Delete Account. It removes your account and its data. If you cannot sign in, email us from the address on the account.",
  ],
  ["How do I cancel my subscription?", "Subscriptions are managed by Apple: open Settings on your iPhone, tap your name, then Subscriptions."],
  [
    "A friend's match is not showing on my profile",
    "Matches with a friend count for both players once the other player confirms the score. Ask them to check their match requests.",
  ],
  ["How do I report someone?", "Use Report on the message, group or routine. It goes to a person for review. For anything urgent, email us."],
  ["Where is my data kept?", "See the Privacy Policy for what we collect, why, and the controls you have."],
];

const SCAN_FAQ: [string, string][] = [
  ["Do I need the newest iPhone?", "No. Any iPhone that runs the app can scan. Phones with LiDAR are more accurate, and every phone can use the table diagram."],
  ["What if the balls hide the spots?", "Calibration only needs two landmarks, and pockets count, so there is almost always a pair you can see."],
  ["Can I use it without the camera?", "Yes. Place the balls on the table diagram instead: same positions, same replace step, no AR."],
  ["When will it be ready?", "Scan Snooker is in testing now and will arrive in an update."],
];

/** The JSON-LD graph for a page, or null where there is nothing worth describing. */
export function structuredData(path: string) {
  const graph: Record<string, unknown>[] = [];
  if (path === "/") {
    graph.push(app, organisation, {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#site`,
      name: "Snookered",
      url: SITE_URL,
      publisher: { "@id": `${SITE_URL}/#org` },
      inLanguage: "en-GB",
    });
  } else {
    const names: Record<string, string> = {
      "/scoring": "Scoring",
      "/practice": "Practice",
      "/scan-snooker": "Scan Snooker",
      "/community": "Community",
      "/plans": "Plans",
      "/support": "Support",
      "/privacy": "Privacy Policy",
      "/terms": "Terms of Use",
    };
    const name = names[path];
    if (!name) return null;
    graph.push(crumbs(path, name));
    if (path === "/plans") graph.push(faq(PLAN_FAQ));
    if (path === "/support") graph.push(faq(SUPPORT_FAQ));
    if (path === "/scan-snooker") graph.push(faq(SCAN_FAQ));
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
