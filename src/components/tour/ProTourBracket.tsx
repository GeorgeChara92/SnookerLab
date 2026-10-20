import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  drawOrder,
  matchStatus,
  playerName,
  roundShortTitle,
  sideUndecided,
  type DrawLinks,
  type DrawRound,
  type ProTourMatch,
} from "../../features/tour/liveScores";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const CARD_H = 58;
const SLOT = 70;
const COL_W = 168;
const GAP_X = 26;
const HEAD_H = 30;

/** "Mark Selby" -> "M. Selby", so a bracket column stays narrow. */
const shortName = (name: string) => {
  const parts = name.split(" ");
  return parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(" ")}` : name;
};

/**
 * The knockout draw as a tree, from a chosen round to the final: each match beside the two that feed
 * it, joined by bracket lines. Ordered by snooker.org's draw links when they're cached; by match
 * number otherwise.
 */
export const ProTourBracket = ({
  rounds,
  links,
  players,
  following,
}: {
  /** The main event's knockout rounds, in playing order, ending with the final. */
  rounds: DrawRound[];
  links: DrawLinks | null | undefined;
  players: Record<number, string>;
  following?: number[];
}) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const startable = rounds.filter((r) => (r.numLeft ?? 0) >= 4 && (r.numLeft ?? 0) <= 128);
  const defaultStart = startable.find((r) => r.numLeft === 16) ?? startable[startable.length - 1] ?? rounds[0];
  const [startKey, setStartKey] = useState<string | null>(null);
  const start = rounds.findIndex((r) => r.key === (startKey ?? defaultStart?.key));
  const shown = start >= 0 ? rounds.slice(start) : rounds;

  const columns = useMemo(() => {
    const items = shown.map((r) => (r.matches.length ? r.matches : r.placeholders));
    const order = drawOrder(
      shown.map((r, i) => ({ eventId: r.eventId, round: r.round, numbers: items[i].map((m) => m.number) })),
      links ?? new Map()
    );
    return shown.map((r, i) => {
      const byNumber = new Map(items[i].map((m) => [m.number, m]));
      const numbers = order.get(`${r.eventId}:${r.round}`) ?? items[i].map((m) => m.number);
      return { round: r, matches: numbers.map((n) => byNumber.get(n)).filter((m): m is ProTourMatch => !!m) };
    });
  }, [shown, links]);

  if (!columns.length) return null;
  const height = Math.max(columns[0].matches.length, 1) * SLOT;
  const top = (col: number, index: number) => {
    const slot = height / Math.max(columns[col].matches.length, 1);
    return HEAD_H + index * slot + (slot - CARD_H) / 2;
  };

  return (
    <View style={styles.wrap}>
      {startable.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.starts}>
          <Text style={[styles.startsLabel, { color: colors.textMuted }]}>From</Text>
          {startable.map((r) => {
            const on = r.key === shown[0]?.key;
            return (
              <Pressable
                key={r.key}
                onPress={() => setStartKey(r.key)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.startChip, { backgroundColor: on ? colors.surfaceMuted : "transparent", borderColor: on ? colors.primary : colors.border }]}
              >
                <Text style={[styles.startText, { color: on ? colors.primary : colors.textMuted }]}>{roundShortTitle(r.title)}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: SPACING.lg }}>
        <View style={{ width: columns.length * COL_W + (columns.length - 1) * GAP_X, height: HEAD_H + height }}>
          {columns.map((col, c) => {
            const x = c * (COL_W + GAP_X);
            const next = columns[c + 1];
            const pairs = next && col.matches.length === next.matches.length * 2;
            return (
              <React.Fragment key={col.round.key}>
                <Text numberOfLines={1} style={[styles.colHead, { left: x, color: colors.textMuted }]}>
                  {roundShortTitle(col.round.title).toUpperCase()}
                  {col.round.info?.bestOf ? `  ·  BO${col.round.info.bestOf}` : ""}
                </Text>
                {pairs
                  ? next.matches.map((_, k) => {
                      const y1 = top(c, k * 2) + CARD_H / 2;
                      const y2 = top(c, k * 2 + 1) + CARD_H / 2;
                      const mid = x + COL_W + GAP_X / 2;
                      return (
                        <React.Fragment key={`l${k}`}>
                          <View style={[styles.line, { left: x + COL_W, top: y1, width: GAP_X / 2, height: 1, backgroundColor: colors.border }]} />
                          <View style={[styles.line, { left: x + COL_W, top: y2, width: GAP_X / 2, height: 1, backgroundColor: colors.border }]} />
                          <View style={[styles.line, { left: mid, top: y1, width: 1, height: y2 - y1 + 1, backgroundColor: colors.border }]} />
                          <View style={[styles.line, { left: mid, top: (y1 + y2) / 2, width: GAP_X / 2, height: 1, backgroundColor: colors.border }]} />
                        </React.Fragment>
                      );
                    })
                  : null}
                {col.matches.map((m, i) => (
                  <BracketCard
                    key={m.id}
                    match={m}
                    players={players}
                    following={following}
                    style={{ left: x, top: top(c, i) }}
                    onPress={m.id > 0 ? () => navigation.navigate("ProTourMatch", { matchId: m.id }) : undefined}
                  />
                ))}
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
};

const BracketCard = ({
  match,
  players,
  following,
  style,
  onPress,
}: {
  match: ProTourMatch;
  players: Record<number, string>;
  following?: number[];
  style: { left: number; top: number };
  onPress?: () => void;
}) => {
  const { colors } = useAppTheme();
  const status = matchStatus(match);
  const live = status === "live";
  const done = status === "finished";
  const row = (side: 1 | 2) => {
    const id = side === 1 ? match.player1Id : match.player2Id;
    const open = !sideUndecided(match, side, players);
    const score = side === 1 ? match.score1 : match.score2;
    const won = done && match.winnerId === id;
    const followed = open && id != null && !!following?.includes(id);
    return (
      <View style={styles.cardRow}>
        <Text
          numberOfLines={1}
          style={[
            styles.cardName,
            { color: !open || (done && !won) ? colors.textSubtle : followed ? colors.accent : colors.text, fontWeight: won ? "800" : "600" },
          ]}
        >
          {open ? shortName(playerName(players, id)) : "To be decided"}
        </Text>
        {status !== "upcoming" ? (
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cardScore, { color: won || live ? colors.text : colors.textSubtle }]}>
            {match.walkover ? (won ? "W/O" : "") : score}
          </Text>
        ) : null}
      </View>
    );
  };
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      style={[styles.card, style, { backgroundColor: colors.surface, borderColor: live ? colors.danger : colors.border }]}
    >
      {live ? <View style={[styles.liveBar, { backgroundColor: colors.danger }]} /> : null}
      {row(1)}
      {row(2)}
      {onPress ? <MaterialCommunityIcons name="chevron-right" size={14} color={colors.textSubtle} style={styles.cardChevron} /> : null}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md },
  starts: { alignItems: "center", gap: 6, paddingRight: SPACING.lg },
  startsLabel: { fontSize: 12, fontWeight: "700", marginRight: 2 },
  startChip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 10, minHeight: 30, justifyContent: "center" },
  startText: { fontSize: 12, fontWeight: "700" },
  colHead: { position: "absolute", top: 0, width: COL_W, fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  line: { position: "absolute" },
  card: {
    position: "absolute",
    width: COL_W,
    height: CARD_H,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingLeft: 10,
    paddingRight: 18,
    justifyContent: "center",
    gap: 4,
    overflow: "hidden",
  },
  liveBar: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3 },
  cardRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  cardName: { flex: 1, fontSize: 13 },
  cardScore: { fontFamily: FONTS.board, fontSize: 15, fontVariant: ["tabular-nums"], minWidth: 16, textAlign: "right" },
  cardChevron: { position: "absolute", right: 3, top: CARD_H / 2 - 8 },
});
