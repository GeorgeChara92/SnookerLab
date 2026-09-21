/**
 * The words the AI Coach screens use for what is stored in the database.
 *
 * The database keeps short machine values - "technique", "full_session", "cue-action",
 * "processing". Each screen used to keep its own table for turning those into words, and one of
 * them was keyed on values the app never saves, so the player saw the raw "technique" and
 * "cue-action". Everything goes through here now, and anything unknown is still tidied into a
 * readable phrase rather than shown as stored.
 */

import type { AnalysisStatus, AnalysisType } from "../../types";

type TypeInfo = {
  label: string;
  /** Finishes the sentence "Work on ...". */
  focus: string;
  icon: "target" | "human-handsdown" | "billiards" | "chess-knight" | "timer-outline";
};

export const ANALYSIS_TYPES: Record<AnalysisType, TypeInfo> = {
  shot: { label: "Shot", focus: "shot selection and potting", icon: "target" },
  stance: { label: "Stance", focus: "your stance and alignment", icon: "human-handsdown" },
  technique: { label: "Technique", focus: "your cue action and delivery", icon: "billiards" },
  tactical: { label: "Tactical", focus: "safety play and shot choice", icon: "chess-knight" },
  full_session: { label: "Full session", focus: "consistency across a session", icon: "timer-outline" },
};

/** The order the upload screen offers them in. */
export const ANALYSIS_TYPE_ORDER: AnalysisType[] = ["technique", "shot", "stance", "tactical", "full_session"];

export const CONTEXT_TAGS: Array<{ value: string; label: string }> = [
  { value: "practice", label: "Practice" },
  { value: "match", label: "Match" },
  { value: "break-building", label: "Break building" },
  { value: "safety", label: "Safety" },
  { value: "long-pot", label: "Long pot" },
  { value: "cue-action", label: "Cue action" },
];

/** "cue-action" or "full_session" becomes "Cue action" / "Full session". */
export const humanise = (value: string): string => {
  const words = value.replace(/[-_]+/g, " ").trim().toLowerCase();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
};

export const typeInfo = (type: string): TypeInfo =>
  ANALYSIS_TYPES[type as AnalysisType] ?? { label: humanise(type) || "Analysis", focus: "your game", icon: "target" };

export const tagLabel = (tag: string): string =>
  CONTEXT_TAGS.find((item) => item.value === tag)?.label ?? humanise(tag);

export type StatusInfo = { label: string; tone: "ready" | "working" | "failed" };

export const statusInfo = (status: AnalysisStatus | string): StatusInfo => {
  switch (status) {
    case "completed":
      return { label: "Ready", tone: "ready" };
    case "processing":
      return { label: "Analysing", tone: "working" };
    case "pending":
      return { label: "Queued", tone: "working" };
    case "failed":
      return { label: "Failed", tone: "failed" };
    default:
      return { label: humanise(String(status)), tone: "working" };
  }
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * "Sat 18 Apr", adding the year only when it is not this one. Built by hand because the locale
 * formatter punctuates differently from one device to the next.
 */
export const analysisDate = (iso: string, now = new Date()): string => {
  const date = new Date(iso);
  const base = `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
  return date.getFullYear() === now.getFullYear() ? base : `${base} ${date.getFullYear()}`;
};

/** Whole days between a date and now, for "155 days since your last clip". */
export const daysSince = (iso: string, now = new Date()): number => {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.max(0, Math.round((startOf(now) - startOf(new Date(iso))) / 86_400_000));
};
