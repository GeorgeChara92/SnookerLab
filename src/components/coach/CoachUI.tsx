import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { CommunityAvatar } from "../community/CommunityAvatar";
import { clientKeyOf, type CoachBooking, type SessionRecap, type SessionRoutineEntry } from "../../features/coach/types";
import type { PublicProfile } from "../../features/community/types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

// ------------------------------------------------------------------ dates, in a coach's words

const DAY = 86_400_000;
const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "Today", "Tomorrow", "Yesterday", then the weekday and date. */
export const relativeDay = (iso: string, now = new Date()) => {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
};

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** How long until a session starts: "now", "in 40 min", "in 5 h", "in 3 days". */
export const untilLabel = (iso: string, now = new Date()) => {
  const minutes = Math.round((new Date(iso).getTime() - now.getTime()) / 60_000);
  if (minutes <= 0) return "now";
  if (minutes < 60) return `in ${minutes} min`;
  if (minutes < 24 * 60) return `in ${Math.round(minutes / 60)} h`;
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY);
  return `in ${days} day${days === 1 ? "" : "s"}`;
};

/** How long ago something was: "today", "yesterday", "5 days ago", "3 weeks ago". */
export const agoLabel = (iso: string, now = new Date()) => {
  const days = Math.round((startOfDay(now) - startOfDay(new Date(iso))) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30)} months ago`;
};

export const minutesBetween = (start: string, end: string) => Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60_000);

// ------------------------------------------------------------------ what a session left behind

/** Whether a finished session has nothing written up yet - no recap, notes or routines. */
export const needsRecap = (
  booking: CoachBooking,
  recaps: Record<string, SessionRecap>,
  notes: Record<string, string>,
  routines: Record<string, SessionRoutineEntry[]>,
) =>
  !recaps[booking.id]?.summary?.trim() && !recaps[booking.id]?.focus?.length && !notes[booking.id]?.trim() && !routines[booking.id]?.length;

/** A client's most recent recap - what the last session worked on. */
export const lastRecapOf = (clientKey: string, bookings: CoachBooking[], recaps: Record<string, SessionRecap>) =>
  bookings
    .filter((booking) => booking.status === "accepted" && clientKeyOf(booking) === clientKey && recaps[booking.id])
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .map((booking) => recaps[booking.id])[0] ?? null;

/** A client's next confirmed session, if one's booked. */
export const nextSessionOf = (clientKey: string, bookings: CoachBooking[], now = new Date()) =>
  bookings
    .filter((booking) => booking.status === "accepted" && clientKeyOf(booking) === clientKey && new Date(booking.endsAt) > now)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0] ?? null;

// ------------------------------------------------------------------ pieces

/** A client's face: their avatar, or a plain silhouette for a guest with no account. */
export const ClientAvatar = ({ profile, guest, size = 44 }: { profile?: PublicProfile; guest?: boolean; size?: number }) => {
  const { colors } = useAppTheme();
  if (profile && !guest) return <CommunityAvatar profile={profile} size={size} />;
  return (
    <View
      style={[
        styles.guest,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.surfaceMuted,
        },
      ]}
    >
      <MaterialCommunityIcons name="account-outline" size={Math.round(size * 0.5)} color={colors.textMuted} />
    </View>
  );
};

/** A section's label, in the scoreboard's lettering, with an optional count and action. */
export const SectionLabel = ({
  title,
  count,
  action,
  onAction,
}: {
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
}) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionRow}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.textMuted }]}>
        {title.toUpperCase()}
        {count != null ? <Text style={{ color: colors.textSubtle }}>{`  ${count}`}</Text> : null}
      </Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={10} accessibilityRole="button">
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** The areas a session worked on, as small chips. */
export const FocusChips = ({ focus, max = 3, onBoard = false }: { focus: string[]; max?: number; onBoard?: boolean }) => {
  const { colors } = useAppTheme();
  if (!focus.length) return null;
  const shown = focus.slice(0, max);
  const more = focus.length - shown.length;
  return (
    <View style={styles.chips}>
      {shown.map((item) => (
        <View
          key={item}
          style={[styles.chip, onBoard ? { backgroundColor: colors.boardRaised } : { backgroundColor: colors.surfaceMuted }]}
        >
          <Text style={[styles.chipText, { color: onBoard ? colors.boardText : colors.text }]} numberOfLines={1}>
            {item}
          </Text>
        </View>
      ))}
      {more > 0 ? <Text style={[styles.chipMore, { color: onBoard ? colors.boardMuted : colors.textMuted }]}>+{more}</Text> : null}
    </View>
  );
};

/** A small capsule label: GUEST, ON NOW, WAITING. */
export const Tag = ({ label, tone = "muted" }: { label: string; tone?: "muted" | "live" | "accent" | "primary" }) => {
  const { colors } = useAppTheme();
  const colour =
    tone === "live" ? colors.danger : tone === "accent" ? colors.accent : tone === "primary" ? colors.primary : colors.textMuted;
  return (
    <View style={[styles.tag, { borderColor: colour }]}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colour }]}>
        {label}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  guest: { alignItems: "center", justifyContent: "center" },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  sectionTitle: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 1.3,
  },
  sectionAction: { fontSize: 14, fontWeight: "700" },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  chip: {
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    maxWidth: 160,
  },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipMore: { fontSize: 12, fontWeight: "700" },
  tag: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 1,
    alignSelf: "flex-start",
  },
  tagText: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 0.9 },
});
