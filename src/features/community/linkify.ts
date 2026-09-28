/**
 * Turns the useful bits of a plain-text chat message - a phone number, an email address, a UK
 * postcode - into tappable links: call, email or open in Maps. Everything else stays as plain
 * text. Deliberately simple pattern matching rather than a full address parser, since free text
 * like "meet me at the club" cannot be reliably geocoded without a maps API call per message - a
 * postcode is the one address-shaped thing with a fixed, matchable format.
 */

export type LinkSegment = { text: string; kind: "text" | "phone" | "email" | "postcode" };

const EMAIL_SRC = "[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}";
const POSTCODE_SRC = "\\b[A-Z]{1,2}[0-9][A-Z0-9]?\\s?[0-9][A-Z]{2}\\b";
const PHONE_SRC = "\\+?\\d[\\d ()-]{8,}\\d";

const COMBINED = new RegExp(`(${EMAIL_SRC})|(${POSTCODE_SRC})|(${PHONE_SRC})`, "gi");

/** Splits a message into plain-text and linkable segments, in reading order. */
export const linkify = (body: string): LinkSegment[] => {
  const segments: LinkSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(COMBINED)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ text: body.slice(last, index), kind: "text" });
    segments.push({ text: match[0], kind: match[1] ? "email" : match[2] ? "postcode" : "phone" });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ text: body.slice(last), kind: "text" });
  return segments;
};

/** Where tapping a linkable segment should go, or null for plain text. */
export const linkUrlFor = (segment: LinkSegment): string | null => {
  if (segment.kind === "email") return `mailto:${segment.text}`;
  if (segment.kind === "phone") return `tel:${segment.text.replace(/[^\d+]/g, "")}`;
  if (segment.kind === "postcode") return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(segment.text)}`;
  return null;
};
