import type { SubscriptionTier } from "../../types";

/** A player as other players see them. */
export type PublicProfile = {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarPreset: string | null;
  avatarUrl: string | null;
  countryCode: string | null;
  skillLevel: string | null;
  bio: string | null;
  level: number;
  xp: number;
  discoverable: boolean;
  messagePrivacy: Privacy;
  statsPrivacy: Privacy;
  cuePreference: string | null;
  /** Whether they appear on leaderboards. */
  leaderboards: boolean;
  bestBreak: number | null;
  centuries: number | null;
  matchesWon: number | null;
  joinedAt: string | null;
  /** A coach, only ever set by an admin approving a coach_applications row - never by the player
   * themselves, and never instantly at registration. See 20261016_0001_coach_applications.sql. */
  isCoach: boolean;
  /** What a coach says they are qualified in, e.g. "WPBSA Level 2" - reviewed at application time,
   * then editable by the coach the same as their bio. */
  coachQualifications: string[];
  /** Whether a coach says they hold WPBSA accreditation. Self-declared, not checked against the WPBSA's own records. */
  wpbsaAccredited: boolean;
  /** Where a coach takes sessions, e.g. a club or town. Set by the coach themselves. */
  coachLocation: string | null;
  /** Real coordinates behind coachLocation, from the coach's own "Use my current location" - null
   * if they typed a place name by hand instead. */
  coachLat: number | null;
  coachLng: number | null;
  /** A coach's own account of their coaching background, from their application - shown to players
   * alongside their bio and qualifications. */
  coachExperience: string | null;
  /** Synced from billing, read-only from the client - a public copy for the subscriber badge other
   * players see. See 20261019_0001_public_subscription_badge.sql. */
  subscriptionTier: SubscriptionTier;
};

export type Privacy = "everyone" | "friends" | "nobody";

/** The record a player shares, as their stats privacy allows. */
export type PublicStats = {
  matchesPlayed: number;
  matchesWon: number;
  winRate: number;
  bestBreak: number;
  centuries: number;
  fifties: number;
  longestPracticeStreak: number;
  achievements: number;
};

export type Friendship = {
  id: string;
  requester: string;
  addressee: string;
  status: "pending" | "accepted";
  createdAt: string;
  respondedAt: string | null;
};

/** How the signed-in player stands with someone. */
export type Relation = "self" | "friends" | "incoming" | "outgoing" | "none" | "blocked";

export type ReportReason = "spam" | "harassment" | "hate" | "inappropriate" | "impersonation" | "other";

export const REPORT_REASONS: Array<{ value: ReportReason; label: string; hint: string }> = [
  { value: "harassment", label: "Bullying or harassment", hint: "Targeting you or someone else" },
  { value: "hate", label: "Hate or abuse", hint: "Attacks on who someone is" },
  { value: "inappropriate", label: "Inappropriate content", hint: "Sexual, violent or offensive" },
  { value: "impersonation", label: "Pretending to be someone", hint: "A fake or copied profile" },
  { value: "spam", label: "Spam or scams", hint: "Adverts, links, fake offers" },
  { value: "other", label: "Something else", hint: "Tell us what is wrong" },
];

/** A profile row from the database, as the app uses it. */
export const profileFromRow = (row: any): PublicProfile => ({
  id: row.id,
  handle: row.handle ?? null,
  displayName: row.display_name ?? null,
  avatarPreset: row.avatar_preset ?? null,
  avatarUrl: row.avatar_url ?? null,
  countryCode: row.country_code ?? null,
  skillLevel: row.skill_level ?? null,
  bio: row.bio ?? null,
  level: row.level ?? 1,
  xp: row.xp ?? 0,
  discoverable: row.discoverable ?? true,
  messagePrivacy: row.message_privacy ?? "everyone",
  statsPrivacy: row.stats_privacy ?? "friends",
  cuePreference: row.cue_preference ?? null,
  leaderboards: row.leaderboards ?? true,
  bestBreak: row.best_break ?? null,
  centuries: row.centuries ?? null,
  matchesWon: row.matches_won ?? null,
  joinedAt: row.joined_at ?? null,
  isCoach: row.is_coach ?? false,
  coachQualifications: row.coach_qualifications ?? [],
  wpbsaAccredited: row.wpbsa_accredited ?? false,
  coachLocation: row.coach_location ?? null,
  coachLat: row.coach_lat ?? null,
  coachLng: row.coach_lng ?? null,
  coachExperience: row.coach_experience ?? null,
  subscriptionTier: (row.subscription_tier as SubscriptionTier) ?? "free",
});

export const PROFILE_COLUMNS =
  "id, handle, display_name, avatar_preset, avatar_url, country_code, skill_level, bio, level, xp, discoverable, message_privacy, stats_privacy, cue_preference, leaderboards, best_break, centuries, matches_won, joined_at, is_coach, coach_qualifications, wpbsa_accredited, coach_location, coach_lat, coach_lng, coach_experience, subscription_tier";

export const friendshipFromRow = (row: any): Friendship => ({
  id: row.id,
  requester: row.requester,
  addressee: row.addressee,
  status: row.status,
  createdAt: row.created_at,
  respondedAt: row.responded_at ?? null,
});

/** How one player stands with another, from the friendships and blocks the signed-in player can see. */
export const relationTo = (
  me: string | null,
  other: string,
  friendships: Friendship[],
  blocked: string[]
): Relation => {
  if (!me) return "none";
  if (other === me) return "self";
  if (blocked.includes(other)) return "blocked";
  const link = friendships.find(
    (item) => (item.requester === me && item.addressee === other) || (item.requester === other && item.addressee === me)
  );
  if (!link) return "none";
  if (link.status === "accepted") return "friends";
  return link.requester === me ? "outgoing" : "incoming";
};

/** A display name to show for someone, falling back to their handle. */
export const nameOf = (profile: Pick<PublicProfile, "displayName" | "handle"> | null | undefined) =>
  profile?.displayName?.trim() || (profile?.handle ? `@${profile.handle}` : "Player");
