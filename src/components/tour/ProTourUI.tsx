import React, { useEffect, useRef } from "react";
import { Animated, Easing, Linking, Pressable, ScrollView, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  dayLabel,
  matchStatus,
  playerName,
  resultPending,
  roundInfo,
  roundTitle,
  sessionsLabel,
  sideUndecided,
  streamName,
  type ProTourMatch,
  type ProTourRounds,
  type TournamentStatus,
} from "../../features/tour/liveScores";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const open = (url: string | null) => {
  if (url) void Linking.openURL(url);
};

/** A small red dot that breathes - the one piece of motion on these screens, reserved for "live". */
export const LiveDot = ({ size = 8 }: { size?: number }) => {
  const { colors } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={{ width: size, height: size }}>
      <Animated.View
        style={{
          position: "absolute",
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: colors.danger,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.6, 0] }),
          transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
        }}
      />
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.danger }} />
    </View>
  );
};

export const Pill = ({ label, tone = "neutral", style }: { label: string; tone?: TournamentStatus["tone"] | "accent"; style?: StyleProp<ViewStyle> }) => {
  const { colors } = useAppTheme();
  const palette = {
    live: { bg: colors.balls.red.wash, fg: colors.danger },
    soon: { bg: colors.surfaceMuted, fg: colors.primary },
    done: { bg: colors.surfaceMuted, fg: colors.textMuted },
    neutral: { bg: colors.surfaceMuted, fg: colors.textMuted },
    accent: { bg: colors.accentWash, fg: colors.accent },
  }[tone];
  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      {tone === "live" ? <LiveDot size={6} /> : null}
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.pillText, { color: palette.fg }]}>
        {label}
      </Text>
    </View>
  );
};

/** The best photo we have for a player: Wikimedia Commons first (usually more recent, and properly
 *  licensed), then snooker.org's own. */
export const playerPhotoUrl = (
  photos: Record<number, { url: string }>,
  profiles: Record<number, { photo: string | null }>,
  id: number | null | undefined
): string | null => (id == null ? null : photos[id]?.url ?? profiles[id]?.photo ?? null);

/** Wikimedia serves a photo at a few standard widths: the 250px one is plenty for a small avatar and
 *  under half the download of the 500px one. */
const sizedPhoto = (url: string, size: number) => (size <= 64 ? url.replace(/\/500px-/, "/250px-") : url);

/** A player's photo (cached on the phone after the first load), or their initials. */
export const PlayerAvatar = ({ name, photo, size = 36, ring }: { name: string; photo?: string | null; size?: number; ring?: string }) => {
  const { colors } = useAppTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.surfaceMuted,
        borderWidth: ring ? 2 : 0,
        borderColor: ring,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {photo ? (
        // Anchored to the top, not centred: most player photos are tall portraits, and centring a
        // tall photo in a circle crops through the top of the head.
        <Image
          source={{ uri: sizedPhoto(photo, size) }}
          style={{ position: "absolute", top: 0, left: 0, width: size, height: size * 1.45 }}
          contentFit="cover"
          contentPosition="top"
          cachePolicy="memory-disk"
          recyclingKey={photo}
          transition={120}
        />
      ) : (
        <Text style={{ fontFamily: FONTS.board, fontSize: size * 0.38, color: colors.textMuted }}>{initials}</Text>
      )}
    </View>
  );
};

/** "Watch on YouTube" when snooker.org has a stream for the match. */
export const WatchButton = ({ url, compact }: { url: string; compact?: boolean }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => open(url)}
      accessibilityRole="link"
      accessibilityLabel={`Watch on ${streamName(url)}`}
      hitSlop={8}
      style={({ pressed }) => [
        compact ? styles.watchCompact : styles.watch,
        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
      ]}
    >
      <MaterialCommunityIcons name="play" size={compact ? 14 : 16} color={colors.onPrimary} />
      {!compact ? <Text style={[styles.watchText, { color: colors.onPrimary }]}>Watch · {streamName(url)}</Text> : null}
    </Pressable>
  );
};

/**
 * One fixture or result, stacked like every good scores app: a player per line, the score beside
 * each, the winner bright and the loser receding. Tap a name for the player, the row for the World
 * Snooker Tour match centre.
 */
export const FixtureRow = ({
  match,
  players,
  rounds,
  showRound,
  context,
  labelFor,
  first,
}: {
  match: ProTourMatch;
  players: Record<number, string>;
  rounds?: ProTourRounds;
  showRound?: boolean;
  /** A line above the players, e.g. the tournament and round when the row is shown out of context. */
  context?: string;
  /** What to call an undecided side ("Winner of Xiao v Craigie"), when the draw says. */
  labelFor?: (match: ProTourMatch, side: 1 | 2) => string | null;
  first?: boolean;
}) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const status = matchStatus(match);
  const pendingResult = resultPending(match);
  // A real fixture opens the match screen; a slot the draw hasn't created yet (negative id) doesn't.
  const real = match.id > 0;
  const sides = [
    { id: match.player1Id, score: match.score1, other: match.score2 },
    { id: match.player2Id, score: match.score2, other: match.score1 },
  ];
  const title = context ?? (showRound && rounds ? roundTitle(roundInfo(rounds, match.eventId, match.round), match.round) : null);
  const sessions =
    status !== "finished" && match.laterSessions.length && match.scheduledAt
      ? `${match.laterSessions.length + 1} sessions · ${sessionsLabel(new Date(match.scheduledAt), match.laterSessions)}`
      : null;

  return (
    <Pressable
      onPress={() => navigation.navigate("ProTourMatch", { matchId: match.id })}
      disabled={!real}
      accessibilityRole={real ? "button" : undefined}
      style={({ pressed }) => [
        styles.row,
        { borderTopColor: colors.border, borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
      ]}
    >
      <View style={styles.rowMain}>
        {title || status === "live" || sessions || pendingResult || match.walkover ? (
          <View style={styles.rowMeta}>
            {status === "live" ? (
              <View style={styles.liveInline}>
                <LiveDot size={6} />
                <Text style={[styles.metaText, { color: colors.danger }]}>{match.onBreak ? "INTERVAL" : "LIVE"}</Text>
              </View>
            ) : null}
            {pendingResult ? <Text style={[styles.metaText, { color: colors.accent }]}>RESULT TO COME</Text> : null}
            {/* A withdrawal: no frames were played, so no 0-0 "result" either. */}
            {match.walkover ? <Text style={[styles.metaText, { color: colors.accent }]}>WALKOVER</Text> : null}
            {title ? <Text style={[styles.metaText, { color: colors.textSubtle }]}>{title.toUpperCase()}</Text> : null}
            {sessions ? (
              <View style={styles.liveInline}>
                <MaterialCommunityIcons name="clock-outline" size={11} color={colors.primary} />
                <Text style={[styles.metaText, { color: colors.primary }]}>{sessions.toUpperCase()}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
        {sides.map((side, i) => {
          const open = !sideUndecided(match, (i + 1) as 1 | 2, players);
          const name = open ? playerName(players, side.id) : null;
          const pending = open ? null : labelFor?.(match, (i + 1) as 1 | 2) ?? null;
          const won = status === "finished" && match.winnerId === side.id;
          const lost = status === "finished" && !won && !pendingResult;
          const ahead = status === "live" && side.score > side.other;
          return (
            <View key={i} style={styles.sideLine}>
              <Pressable
                disabled={!name || name === "TBD" || side.id == null}
                onPress={() => side.id != null && navigation.navigate("ProTourPlayer", { playerId: side.id })}
                hitSlop={4}
                style={styles.nameCell}
              >
                {name && name !== "TBD" ? (
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.name,
                      { color: lost ? colors.textSubtle : colors.text, fontWeight: won || ahead ? "800" : "600" },
                    ]}
                  >
                    {name}
                  </Text>
                ) : (
                  <Text numberOfLines={1} style={[styles.name, styles.tbd, { color: colors.textSubtle }]}>
                    {pending ?? "To be decided"}
                  </Text>
                )}
                {won ? <MaterialCommunityIcons name="check-circle" size={14} color={colors.primary} /> : null}
              </Pressable>
              {match.walkover ? (
                won ? (
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.walkover, { color: colors.textMuted }]}>
                    W/O
                  </Text>
                ) : null
              ) : status !== "upcoming" ? (
                <Text
                  maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                  style={[
                    styles.score,
                    { color: lost ? colors.textSubtle : ahead ? colors.primary : colors.text },
                  ]}
                >
                  {side.score}
                </Text>
              ) : null}
            </View>
          );
        })}
        {match.walkover && match.note ? (
          <Text numberOfLines={2} style={[styles.walkoverNote, { color: colors.textMuted }]}>
            {match.note}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowSide}>
        {match.videoUrl ? <WatchButton url={match.videoUrl} compact /> : real ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} /> : null}
      </View>
    </Pressable>
  );
};

/** A live match, given the broadcast treatment: the scoreboard green, big numbers, and the ways to follow it. */
export const LiveMatchCard = ({
  match,
  players,
  tournament,
  round,
  bestOf,
  photoFor,
  style,
}: {
  match: ProTourMatch;
  players: Record<number, string>;
  /** The photo to show beside each player, when there is one. */
  photoFor?: (playerId: number | null) => string | null;
  tournament: string;
  round: string;
  bestOf: number | null;
  style?: StyleProp<ViewStyle>;
}) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const sides = [
    { id: match.player1Id, score: match.score1, other: match.score2 },
    { id: match.player2Id, score: match.score2, other: match.score1 },
  ];
  return (
    <View style={[styles.liveCard, { backgroundColor: colors.board, borderColor: colors.boardRule }, style]}>
      <View style={styles.liveHead}>
        <View style={[styles.livePill, { backgroundColor: colors.danger }]}>
          <Text style={styles.livePillText}>{match.onBreak ? "INTERVAL" : "LIVE"}</Text>
        </View>
        <Text numberOfLines={1} style={[styles.liveEvent, { color: colors.boardMuted }]}>
          {tournament} · {round}
          {bestOf ? ` · Best of ${bestOf}` : ""}
        </Text>
      </View>
      {sides.map((side, i) => {
        const ahead = side.score > side.other;
        return (
          <View key={i} style={styles.liveLine}>
            <Pressable
              style={styles.nameCell}
              onPress={() => side.id != null && navigation.navigate("ProTourPlayer", { playerId: side.id })}
              hitSlop={4}
            >
              {photoFor ? <PlayerAvatar name={playerName(players, side.id)} photo={photoFor(side.id)} size={34} /> : null}
              <Text numberOfLines={1} style={[styles.liveName, { color: ahead ? colors.boardText : colors.boardMuted }]}>
                {playerName(players, side.id)}
              </Text>
            </Pressable>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.liveScore, { color: ahead ? colors.boardText : colors.boardMuted }]}>
              {side.score}
            </Text>
          </View>
        );
      })}
      {match.frameScores ? (
        <Text numberOfLines={1} style={[styles.frames, { color: colors.boardMuted }]}>
          {match.frameScores}
        </Text>
      ) : null}
      {match.videoUrl || match.liveUrl ? (
        <View style={styles.liveActions}>
          {match.videoUrl ? <WatchButton url={match.videoUrl} /> : null}
          {match.liveUrl ? (
            <Pressable
              onPress={() => open(match.liveUrl)}
              accessibilityRole="link"
              style={({ pressed }) => [styles.ghostButton, { borderColor: colors.boardRule, opacity: pressed ? 0.8 : 1 }]}
            >
              <MaterialCommunityIcons name="chart-box-outline" size={16} color={colors.boardText} />
              <Text style={[styles.ghostText, { color: colors.boardText }]}>Match centre</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

/** A group of fixtures sharing a start time: "10:00 · est." then the rows in one card. */
export const SessionBlock = ({
  label,
  estimated,
  live,
  children,
}: {
  label: string;
  estimated?: boolean;
  live?: boolean;
  children: React.ReactNode;
}) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.session}>
      <View style={styles.sessionHead}>
        {live ? <LiveDot size={7} /> : <MaterialCommunityIcons name="clock-outline" size={14} color={colors.textMuted} />}
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sessionTime, { color: live ? colors.danger : colors.text }]}>
          {label}
        </Text>
        {estimated ? <Text style={[styles.est, { color: colors.textSubtle, borderColor: colors.border }]}>approx.</Text> : null}
      </View>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>{children}</View>
    </View>
  );
};

export const SectionTitle = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[styles.sectionAction, { color: colors.primary }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

/** The day strip: Yesterday · Today · Tomorrow · Sat 18 Oct... with a dot on a day that has live matches. */
export const DayBar = ({
  days,
  selected,
  onSelect,
}: {
  days: Array<{ dayKey: string; liveCount: number; matchCount: number }>;
  selected: string | null;
  onSelect: (dayKey: string) => void;
}) => {
  const { colors } = useAppTheme();
  const scroller = useRef<ScrollView>(null);
  const index = days.findIndex((d) => d.dayKey === selected);
  useEffect(() => {
    if (index > 1) scroller.current?.scrollTo({ x: Math.max(0, (index - 1) * 92), animated: false });
  }, [index]);
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dayBar}>
      {days.map((day) => {
        const on = day.dayKey === selected;
        return (
          <Pressable
            key={day.dayKey}
            onPress={() => onSelect(day.dayKey)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.dayChip, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
          >
            <View style={styles.dayChipTop}>
              {day.liveCount ? <LiveDot size={6} /> : null}
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.dayChipLabel, { color: on ? colors.onPrimary : colors.text }]}>
                {dayLabel(day.dayKey)}
              </Text>
            </View>
            <Text style={[styles.dayChipCount, { color: on ? colors.onPrimary : colors.textSubtle }]}>
              {day.matchCount} {day.matchCount === 1 ? "match" : "matches"}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
};

/** A tournament in a list: a trophy mark, its name, when and where, and where it's at. */
export const TournamentCard = ({
  name,
  dates,
  place,
  status,
  photo,
  onPress,
}: {
  name: string;
  dates: string | null;
  place: string | null;
  status: TournamentStatus;
  /** The winner's photo, for a finished tournament. */
  photo?: string | null;
  onPress: () => void;
}) => {
  const { colors } = useAppTheme();
  const tint = status.tone === "live" ? colors.danger : status.tone === "soon" ? colors.primary : photo ? colors.text : colors.textSubtle;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 }]}
    >
      {photo ? (
        <View style={styles.tPhoto}>
          <PlayerAvatar name={name} photo={photo} size={44} ring={colors.accent} />
          <View style={[styles.tPhotoBadge, { backgroundColor: colors.board }]}>
            <MaterialCommunityIcons name="trophy-variant" size={11} color={colors.accent} />
          </View>
        </View>
      ) : (
        <View style={[styles.tMark, { backgroundColor: colors.board }]}>
          <MaterialCommunityIcons name="trophy-variant" size={20} color={status.tone === "done" ? colors.boardMuted : colors.accent} />
        </View>
      )}
      <View style={styles.tBody}>
        <Text numberOfLines={1} style={[styles.tName, { color: colors.text }]}>
          {name}
        </Text>
        {dates || place ? (
          <Text numberOfLines={1} style={[styles.tMeta, { color: colors.textMuted }]}>
            {[dates, place].filter(Boolean).join(" · ")}
          </Text>
        ) : null}
        {status.label ? (
          <View style={styles.tStatus}>
            {status.tone === "live" ? <LiveDot size={6} /> : null}
            <Text style={[styles.tStatusText, { color: tint }]}>{status.label}</Text>
          </View>
        ) : null}
      </View>
      <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textSubtle} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  pill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  pillText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.6 },

  row: { flexDirection: "row", alignItems: "center", paddingVertical: SPACING.md, paddingHorizontal: SPACING.md, gap: SPACING.sm },
  rowMain: { flex: 1, gap: 6 },
  rowMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: SPACING.sm, marginBottom: 1 },
  liveInline: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 0.9 },
  sideLine: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 22 },
  nameCell: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 15, flexShrink: 1 },
  tbd: { fontStyle: "italic", fontWeight: "500" },
  score: { fontFamily: FONTS.board, fontSize: 20, fontVariant: ["tabular-nums"], minWidth: 26, textAlign: "right" },
  walkover: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1, textAlign: "right" },
  walkoverNote: { fontSize: 12, marginTop: 2 },
  rowSide: { width: 30, alignItems: "flex-end" },

  watch: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 36 },
  watchCompact: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  watchText: { fontSize: 13, fontWeight: "700" },

  liveCard: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
  liveHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.xs },
  livePill: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  livePillText: { color: "#fff", fontFamily: FONTS.board, fontSize: 12, letterSpacing: 1 },
  liveEvent: { flex: 1, fontSize: 13, fontWeight: "600" },
  liveLine: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  liveName: { fontSize: 19, fontWeight: "800", flexShrink: 1 },
  liveScore: { fontFamily: FONTS.boardHeavy, fontSize: 38, fontVariant: ["tabular-nums"], lineHeight: 42, minWidth: 40, textAlign: "right" },
  frames: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 0.3 },
  liveActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  ghostButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 36 },
  ghostText: { fontSize: 13, fontWeight: "700" },

  session: { gap: SPACING.sm },
  sessionHead: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 2 },
  sessionTime: { fontFamily: FONTS.board, fontSize: 18, fontVariant: ["tabular-nums"] },
  est: { fontSize: 11, fontWeight: "600", borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },

  sectionTitleRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  sectionTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  sectionAction: { fontSize: 14, fontWeight: "700" },

  dayBar: { gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  dayChip: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, minWidth: 84, gap: 2 },
  dayChipTop: { flexDirection: "row", alignItems: "center", gap: 5 },
  dayChipLabel: { fontSize: 14, fontWeight: "800" },
  dayChipCount: { fontSize: 11, fontWeight: "600" },

  tCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  tMark: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  tPhoto: { width: 44, height: 44 },
  tPhotoBadge: { position: "absolute", right: -3, bottom: -3, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  tBody: { flex: 1, gap: 3 },
  tName: { fontSize: 16, fontWeight: "800" },
  tMeta: { fontSize: 13 },
  tStatus: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  tStatusText: { fontSize: 12, fontWeight: "700" },
});
