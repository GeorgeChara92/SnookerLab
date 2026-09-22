/**
 * Words not allowed in anything other players see: handles, names, bios and, later, messages.
 *
 * The same rules as the database's contains_blocked_word, so the app can say no before the
 * server does: whole words only, ignoring case, with common letter swaps (0 for o, 1 for i,
 * 3 for e, 4 and @ for a, 5 and $ for s, 7 for t) undone first. The database's list can grow
 * without an app update; the app adds whatever it has loaded from it to this starting list.
 */

export const STARTING_WORDS = [
  "fuck",
  "fucker",
  "fucking",
  "motherfucker",
  "shit",
  "shite",
  "bullshit",
  "cunt",
  "twat",
  "wanker",
  "bitch",
  "bastard",
  "dickhead",
  "prick",
  "pussy",
  "cock",
  "slut",
  "whore",
  "nazi",
  "rape",
  "rapist",
  "retard",
  "paedo",
  "pedo",
];

const SWAPS: Record<string, string> = { "0": "o", "1": "i", "3": "e", "4": "a", "@": "a", $: "s", "5": "s", "7": "t" };

const normalise = (text: string) =>
  text
    .toLowerCase()
    .split("")
    .map((char) => SWAPS[char] ?? char)
    .join("");

let extraWords: string[] = [];

/** Adds the database's list, once loaded. */
export const setBlockedWords = (words: string[]) => {
  extraWords = words.map((word) => word.trim().toLowerCase()).filter(Boolean);
};

export const containsBlockedWord = (text: string | null | undefined) => {
  if (!text) return false;
  const clean = normalise(text);
  return [...STARTING_WORDS, ...extraWords].some((word) => new RegExp(`(^|[^a-z])${word}($|[^a-z])`).test(clean));
};
