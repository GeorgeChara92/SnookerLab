import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { CommunityAvatar } from "./CommunityAvatar";
import { nameOf, type PublicProfile } from "../../features/community/types";
import type { FeedItem } from "../../features/community/groupFeed";
import type { ActivityKind } from "../../features/community/activityItems";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const KIND: Record<ActivityKind, { icon: string; label: string; gold?: boolean }> = {
  maximum: { icon: "crown", label: "MAXIMUM", gold: true },
  century: { icon: "fire", label: "CENTURY", gold: true },
  high_break: { icon: "trending-up", label: "HIGH BREAK" },
  match: { icon: "trophy-outline", label: "WIN" },
  personal_best: { icon: "target", label: "PERSONAL BEST" },
  level_up: { icon: "arrow-up-bold-circle-outline", label: "LEVEL UP" },
  achievement: { icon: "medal-outline", label: "ACHIEVEMENT", gold: true },
};

export const timeAgo = (iso: string) => {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * One moment in a feed: who, what kind (a small scoreboard-style label, gold for the big ones),
 * what happened and when. A maximum or a century gets the gold rule down its side.
 */
export const FeedItemRow = ({
  item,
  profile,
  isMe,
  onOpenPlayer,
}: {
  item: FeedItem;
  profile: PublicProfile | undefined;
  isMe: boolean;
  onOpenPlayer: () => void;
}) => {
  const { colors } = useAppTheme();
  const kind = KIND[item.kind] ?? KIND.match;
  const accent = kind.gold ? colors.boardRule : colors.primary;
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
        kind.gold ? { borderLeftColor: colors.boardRule, borderLeftWidth: 3 } : null,
      ]}
    >
      <Pressable onPress={onOpenPlayer} accessibilityRole="button" accessibilityLabel={`Open ${nameOf(profile)}`}>
        <CommunityAvatar profile={profile} size={40} />
      </Pressable>
      <View style={styles.text}>
        <View style={styles.top}>
          <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
            {isMe ? "You" : nameOf(profile)}
          </Text>
          <Text style={[styles.when, { color: colors.textMuted }]}>{timeAgo(item.createdAt)}</Text>
        </View>
        <View style={styles.labelRow}>
          <MaterialCommunityIcons name={kind.icon as any} size={13} color={accent} />
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: accent }]}>
            {kind.label}
          </Text>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{item.title}</Text>
        {item.detail ? <Text style={[styles.detail, { color: colors.textMuted }]}>{item.detail}</Text> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  text: { flex: 1, minWidth: 0, gap: 2 },
  top: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
  name: { flex: 1, fontSize: 15, fontWeight: "800" },
  when: { fontSize: 12 },
  labelRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  label: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2 },
  title: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  detail: { fontSize: 13, lineHeight: 18 },
});
