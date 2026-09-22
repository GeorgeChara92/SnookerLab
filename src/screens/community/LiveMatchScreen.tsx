import React, { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { supabase } from "../../api/supabase";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { profilesFor } from "../../features/community/chat";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { isLiveNow, liveFromRow, loadLiveScore, type LiveScore } from "../../features/matches/liveShare";
import { LiveBadge } from "../../components/matches/LiveMatchCard";
import { timeAgo } from "../../components/community/FeedItemRow";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

/**
 * Following one match as it is scored: the frames, the frame in progress with the break and
 * who is at the table, the high breaks and every frame so far. Updates the moment the scorer
 * taps a ball.
 */
export const LiveMatchScreen = () => {
  const route = useRoute<any>();
  const { matchId } = route.params as { matchId: string };
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const [score, setScore] = useState<LiveScore | null>(null);
  const [player, setPlayer] = useState<PublicProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void loadLiveScore(matchId).then(async (found) => {
      if (cancelled) return;
      setScore(found);
      setLoading(false);
      if (found) {
        const people = await profilesFor([found.userId]);
        if (!cancelled) setPlayer(people[found.userId] ?? null);
      }
    });
    const channel = supabase
      .channel(`live-${matchId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "live_scores", filter: `match_id=eq.${matchId}` },
        (payload) => {
          if (payload.eventType === "DELETE") setScore(null);
          else setScore(liveFromRow(payload.new));
        }
      )
      .subscribe();
    // "Updated 2m ago" keeps moving.
    const clock = setInterval(() => setTick((value) => value + 1), 30_000);
    return () => {
      cancelled = true;
      clearInterval(clock);
      void supabase.removeChannel(channel);
    };
  }, [matchId]);

  if (!score) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="access-point-off" size={32} color={colors.textMuted} />
            <Text style={[styles.gone, { color: colors.textMuted }]}>This match is no longer being shared.</Text>
          </>
        )}
      </View>
    );
  }

  const live = isLiveNow(score);
  const playerName = score.userId === me ? "You" : nameOf(player);
  const isOpponent = score.opponentId === me;
  const sides = [
    { key: "user", name: playerName, frames: score.framesUser, points: score.pointsUser, high: score.highBreakUser },
    {
      key: "opponent",
      name: isOpponent ? "You" : score.opponentName,
      frames: score.framesOpponent,
      points: score.pointsOpponent,
      high: score.highBreakOpponent,
    },
  ] as const;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      {/* The match */}
      <View style={[styles.board, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <View style={styles.boardHead}>
          <LiveBadge score={score} />
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardMuted }]}>
            {score.bestOf ? `BEST OF ${score.bestOf}` : "MATCH"}
          </Text>
        </View>
        {sides.map((side) => {
          const atTable = live && score.atTable === side.key;
          return (
            <View key={side.key} style={styles.side}>
              <View style={[styles.table, { backgroundColor: atTable ? colors.boardRule : colors.boardRaised }]} />
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.name, { color: colors.boardText }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {side.name.toUpperCase()}
              </Text>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.frames, { color: colors.boardText }]}>
                {side.frames}
              </Text>
            </View>
          );
        })}
      </View>

      {/* The frame in progress */}
      {live ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.textMuted }]}>
            FRAME {score.frameNumber}
            {score.remaining !== null ? ` · ${score.remaining} LEFT ON THE TABLE` : ""}
          </Text>
          <View style={styles.points}>
            {sides.map((side, index) => (
              <React.Fragment key={side.key}>
                {index === 1 ? <Text style={[styles.dash, { color: colors.textMuted }]}>–</Text> : null}
                <View style={styles.pointsSide}>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.pointsValue, { color: score.atTable === side.key ? colors.primary : colors.text }]}
                  >
                    {side.points}
                  </Text>
                  <Text style={[styles.pointsName, { color: colors.textMuted }]} numberOfLines={1}>
                    {side.name}
                  </Text>
                </View>
              </React.Fragment>
            ))}
          </View>
          {score.currentBreak ? (
            <View style={[styles.break, { backgroundColor: colors.board }]}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.breakText, { color: colors.boardRule }]}>
                BREAK {score.currentBreak} · {(score.atTable === "user" ? sides[0].name : sides[1].name).toUpperCase()}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* High breaks */}
      <View style={[styles.card, styles.highs, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {sides.map((side) => (
          <View key={side.key} style={styles.high}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.highValue, { color: colors.text }]}>
              {side.high}
            </Text>
            <Text style={[styles.pointsName, { color: colors.textMuted }]} numberOfLines={1}>
              High break · {side.name}
            </Text>
          </View>
        ))}
      </View>

      {/* Frames so far */}
      {score.frames.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.textMuted }]}>
            FRAMES
          </Text>
          {score.frames.map((frame) => (
            <View key={frame.n} style={[styles.frameRow, { borderTopColor: colors.border }]}>
              <Text style={[styles.frameNumber, { color: colors.textMuted }]}>{frame.n}</Text>
              <Text style={[styles.frameScore, { color: colors.text, fontWeight: frame.w === "user" ? "900" : "500" }]}>
                {frame.u}
              </Text>
              <Text style={[styles.frameDash, { color: colors.textMuted }]}>–</Text>
              <Text
                style={[styles.frameScore, { color: colors.text, fontWeight: frame.w === "opponent" ? "900" : "500" }]}
              >
                {frame.o}
              </Text>
              <Text style={[styles.frameWinner, { color: colors.textMuted }]} numberOfLines={1}>
                {frame.w === "user" ? sides[0].name : frame.w === "opponent" ? sides[1].name : ""}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {isOpponent ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          This is your match. When it finishes you will be asked to confirm the result.
        </Text>
      ) : null}
      <Text style={[styles.note, { color: colors.textSubtle }]}>Updated {timeAgo(score.updatedAt).toLowerCase()}</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  gone: { fontSize: 15, textAlign: "center" },
  content: { padding: SPACING.lg, gap: SPACING.md },
  board: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  boardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  side: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  table: { width: 5, height: 30, borderRadius: 3 },
  name: { flex: 1, fontFamily: FONTS.board, fontSize: 24, letterSpacing: 0.5 },
  frames: { fontFamily: FONTS.boardHeavy, fontSize: 44, lineHeight: 46, minWidth: 40, textAlign: "right" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  label: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  points: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.lg },
  pointsSide: { alignItems: "center", flex: 1, minWidth: 0 },
  pointsValue: { fontFamily: FONTS.boardHeavy, fontSize: 56, lineHeight: 60 },
  pointsName: { fontSize: 13 },
  dash: { fontSize: 32 },
  break: { alignSelf: "center", borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  breakText: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  highs: { flexDirection: "row" },
  high: { flex: 1, alignItems: "center", gap: 2 },
  highValue: { fontFamily: FONTS.boardHeavy, fontSize: 30, lineHeight: 32 },
  frameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  frameNumber: { width: 22, fontFamily: FONTS.boardLabel, fontSize: 14 },
  frameScore: { width: 34, fontSize: 16, textAlign: "center" },
  frameDash: { fontSize: 14 },
  frameWinner: { flex: 1, fontSize: 13, textAlign: "right" },
  note: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
