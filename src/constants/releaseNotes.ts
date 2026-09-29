/**
 * What changed in each version, newest first, for the "What's new" sheet that shows once after
 * an update. Add an entry whenever app.json's version goes up; a version with no entry shows
 * nothing. Keep it in the player's words: what they can now do, and what was fixed.
 */

export type ReleaseNote = {
  version: string;
  /** e.g. "September 2026" */
  date: string;
  headline: string;
  added: Array<{ icon: string; title: string; body: string }>;
  fixed?: string[];
};

export const RELEASE_NOTES: ReleaseNote[] = [
  {
    version: "1.1.0",
    date: "October 2026",
    headline: "Coaching, verified",
    added: [
      {
        icon: "shield-check-outline",
        title: "Coaches are checked by hand",
        body: "Every coach applies first and is reviewed before they can list themselves or take a booking. Look for the verified badge on Find a Coach.",
      },
      {
        icon: "whistle-outline",
        title: "Apply to coach",
        body: "Think you should be coaching? Apply from Profile with your experience and qualifications - we review every application.",
      },
      {
        icon: "star-outline",
        title: "Reviews on coach profiles",
        body: "Had a session? Rate and review your coach - it shows on their profile for the next player deciding whether to book.",
      },
      {
        icon: "message-star-outline",
        title: "Send us feedback",
        body: "A new spot in Profile to tell us what's working and what isn't, separate from a support request.",
      },
    ],
  },
  {
    version: "1.0.0",
    date: "September 2026",
    headline: "The community is here",
    added: [
      {
        icon: "account-multiple-outline",
        title: "Friends, groups and chat",
        body: "Add the people you play, start a group for your league or club night, and chat with them.",
      },
      {
        icon: "access-point",
        title: "Follow matches live",
        body: "Friends can follow your matches frame by frame as you score them, and you can follow theirs.",
      },
      {
        icon: "link-variant",
        title: "Matches that count for both",
        body: "Play a friend and, once they confirm the score, the match counts in both your records.",
      },
      {
        icon: "podium",
        title: "Leaderboards and shared routines",
        body: "Share your routines with a link or QR code and see who has the best score on every routine.",
      },
      {
        icon: "trophy-variant-outline",
        title: "Pro tour news",
        body: "The latest from the World Snooker Tour and BBC Sport, on Home and in Community.",
      },
      {
        icon: "view-dashboard-outline",
        title: "A cleaner Home and Stats",
        body: "Everything that matters on one screen, and your week at a glance.",
      },
    ],
    fixed: [
      "Match details now update the moment a match finishes.",
      "Several games on one day sit under one heading in Matches.",
      "Home and Stats count your practice the same way.",
    ],
  },
];

const parts = (version: string) => version.split(".").map((part) => Number(part) || 0);

/** Whether version a is newer than b ("1.2.0" > "1.10.0" is false). */
export const isNewer = (a: string, b: string) => {
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
  }
  return false;
};

/** The notes a player has not seen: every version after the last one they saw, up to this one. */
export const unseenNotes = (current: string, lastSeen: string | null, notes = RELEASE_NOTES) =>
  notes.filter((note) => !isNewer(note.version, current) && (lastSeen === null || isNewer(note.version, lastSeen)));
