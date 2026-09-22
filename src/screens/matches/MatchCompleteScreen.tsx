import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore, useMatchesStore } from "../../store";
import type { LiveFrameRecord, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { BoardPanel, ScoreStrip, TaleOfTheTape } from "../../components/scoreboard/Scoreboard";
import { ShareMatchSheet, bestOfFor } from "../../components/matches/ShareMatchSheet";
import { FrameTimelineSheet } from "../../components/matches/FrameTimelineSheet";
import { matchTape } from "../../features/matches/breaks";
import { matchStory } from "../../features/matches/matchStory";
import { matchHighlights } from "../../features/matches/highlights";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const NO_FRAMES: LiveFrameRecord[] = [];

/**
 * The end of a match: who won and how, the numbers, every frame, and what next - share it,
 * play again, or go back to the matches. Shown straight after the frame that settles it.
 */
export const MatchCompleteScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "MatchComplete">>();
  const navigation = useNavigation<NativeStackNavigationProp<MatchesStackParamList>>();
  const { matchId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const match = useMatchesStore((state) => state.matches.find((item) => item.id === matchId));
  const storedFrames = useMatchesStore((state) => state.liveFramesByMatch[matchId] ?? NO_FRAMES);
  const allMatches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const username = useAuthStore((state) => state.user?.username);
  const [shareOpen, setShareOpen] = useState(false);
  const [openFrameId, setOpenFrameId] = useState<string | null>(null);
  const rise = useRef(new Animated.Value(0)).current;

  const frames = useMemo(() => [...storedFrames].sort((a, b) => a.frame_number - b.frame_number), [storedFrames]);
  const tape = useMemo(() => matchTape(frames), [frames]);
  const bestOf = match ? bestOfFor(match) : undefined;
  const firstTo = bestOf ? Math.floor(bestOf / 2) + 1 : undefined;
  const story = useMemo(() => matchStory(frames, firstTo), [frames, firstTo]);
  const highlights = useMemo(
    () => (match ? matchHighlights(match, allMatches, liveFramesByMatch, firstTo) : []),
    [match, allMatches, liveFramesByMatch, firstTo]
  );

  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  if (!match) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>This match has been deleted.</Text>
      </View>
    );
  }

  const you = username || "You";
  const won = match.user_score > match.opponent_score;
  const lost = match.user_score < match.opponent_score;
  const winnerName = won ? you : lost ? match.opponent_name : null;
  const headline = winnerName
    ? `${winnerName} ${winnerName === "You" ? "win" : "wins"} ${Math.max(match.user_score, match.opponent_score)}–${Math.min(match.user_score, match.opponent_score)}`
    : `All square at ${match.user_score}–${match.opponent_score}`;

  // The same highlights the share card leads with: a maximum, a century, a new best, a
  // whitewash, a first win over someone.
  const lines = highlights.map((item) => item.sentence);
  const chips = highlights.map((item) => item.label).slice(0, 4);

  /** Back to the full match, without stacking a second copy if the player came from there. */
  const viewMatch = () => {
    const routes = navigation.getState().routes;
    const previous = routes[routes.length - 2];
    if (previous?.name === "MatchDetail" && (previous.params as { matchId?: string })?.matchId === matchId) {
      navigation.goBack();
    } else {
      navigation.replace("MatchDetail", { matchId });
    }
  };

  const rematch = () =>
    navigation.replace("NewMatch", {
      opponentName: match.opponent_name,
      location: match.location || undefined,
      targetFrames: bestOf,
      matchType: match.match_type,
    });

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + SPACING.md, paddingBottom: insets.bottom + SPACING.xl },
        ]}
      >
        <View style={styles.topBar}>
          <Pressable
            onPress={() => navigation.popToTop()}
            accessibilityRole="button"
            style={({ pressed }) => [styles.done, { opacity: pressed ? 0.6 : 1 }]}
          >
            <Text style={[styles.doneText, { color: colors.primary }]}>Done</Text>
          </Pressable>
        </View>

        <Animated.View
          style={[
            styles.hero,
            {
              opacity: rise,
              transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }],
            },
          ]}
        >
          <View
            style={[
              styles.trophy,
              { backgroundColor: won ? colors.board : colors.surfaceMuted, borderColor: colors.boardRule },
            ]}
          >
            <MaterialCommunityIcons
              name={won ? "trophy" : lost ? "handshake-outline" : "scale-balance"}
              size={40}
              color={won ? colors.boardRule : colors.textMuted}
            />
          </View>
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            style={[styles.kicker, { color: won ? colors.boardRule : colors.textMuted }]}
          >
            {won ? "MATCH WON" : lost ? "MATCH LOST" : "MATCH DRAWN"}
          </Text>
          <Text style={[styles.headline, { color: colors.text }]}>{headline}</Text>
          {lines.length ? <Text style={[styles.story, { color: colors.textMuted }]}>{lines.join(" ")}</Text> : null}
        </Animated.View>

        <BoardPanel kicker={bestOf ? `BEST OF ${bestOf}` : "RESULT"} aside={match.location?.toUpperCase() || undefined}>
          <ScoreStrip
            size="hero"
            left={{ name: you, score: match.user_score, leading: !lost }}
            right={{ name: match.opponent_name, score: match.opponent_score, leading: !won }}
            middle={bestOf ? `(${bestOf})` : "V"}
            style={styles.strip}
          />
          {chips.length ? (
            <View style={styles.chips}>
              {chips.map((chip) => (
                <View key={chip} style={[styles.chip, { borderColor: colors.boardRule }]}>
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.chipText, { color: colors.boardRule }]}
                  >
                    {chip}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </BoardPanel>

        <View style={styles.actions}>
          <Pressable
            onPress={() => setShareOpen(true)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
          >
            <MaterialCommunityIcons name="export-variant" size={20} color={colors.onPrimary} />
            <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Share result</Text>
          </Pressable>
          <View style={styles.row}>
            <Pressable
              onPress={rematch}
              accessibilityRole="button"
              accessibilityLabel={`Play ${match.opponent_name} again`}
              style={({ pressed }) => [
                styles.secondary,
                { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="restart" size={18} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>Rematch</Text>
            </Pressable>
            <Pressable
              onPress={viewMatch}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondary,
                { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="scoreboard-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>Full match</Text>
            </Pressable>
          </View>
        </View>

        {frames.length ? (
          <BoardPanel kicker="MATCH STATISTICS">
            <TaleOfTheTape
              leftName={you}
              rightName={match.opponent_name}
              rows={[
                { label: "Points", left: tape.user.points, right: tape.opponent.points },
                { label: "High break", left: tape.user.high, right: tape.opponent.high },
                { label: "50+ breaks", left: tape.user.fifties, right: tape.opponent.fifties },
                { label: "Pots", left: tape.user.pots, right: tape.opponent.pots },
                { label: "Fouls", left: tape.user.fouls, right: tape.opponent.fouls },
              ]}
            />
          </BoardPanel>
        ) : null}

        {frames.length ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Frame by frame</Text>
            {frames.map((frame, index) => {
              const last = index === frames.length - 1;
              return (
                <Pressable
                  key={frame.id}
                  onPress={() => setOpenFrameId(frame.id)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.frame,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.frameLabel, { color: colors.textMuted }]}
                  >
                    FRAME {frame.frame_number}
                    {last && story.decider ? " · DECIDER" : ""}
                  </Text>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={styles.frameScore}>
                    <Text style={{ color: frame.winner === "user" ? colors.text : colors.textMuted }}>
                      {frame.user_score}
                    </Text>
                    <Text style={{ color: colors.textMuted }}>–</Text>
                    <Text style={{ color: frame.winner === "opponent" ? colors.text : colors.textMuted }}>
                      {frame.opponent_score}
                    </Text>
                  </Text>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>

      <FrameTimelineSheet
        frame={frames.find((frame) => frame.id === openFrameId)}
        onClose={() => setOpenFrameId(null)}
      />
      <ShareMatchSheet match={match} visible={shareOpen} onClose={() => setShareOpen(false)} />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  missing: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { paddingHorizontal: SPACING.lg, gap: SPACING.md },
  topBar: { flexDirection: "row", justifyContent: "flex-end" },
  done: { minHeight: HIT_TARGET, minWidth: HIT_TARGET, alignItems: "flex-end", justifyContent: "center" },
  doneText: { fontSize: 17, fontWeight: "800" },
  hero: { alignItems: "center", gap: SPACING.xs, marginBottom: SPACING.sm },
  trophy: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  kicker: { fontFamily: FONTS.boardHeavy, fontSize: 16, letterSpacing: 4 },
  headline: { fontSize: 28, fontWeight: "800", textAlign: "center", letterSpacing: -0.4 },
  story: { fontSize: 15, lineHeight: 21, textAlign: "center", maxWidth: 320 },
  strip: { marginTop: SPACING.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.xs, justifyContent: "center", marginTop: SPACING.md },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  chipText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2 },
  actions: { gap: SPACING.sm },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  row: { flexDirection: "row", gap: SPACING.sm },
  secondary: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: SPACING.xs },
  frame: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET },
  frameLabel: { flex: 1, fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1 },
  frameScore: { fontFamily: FONTS.board, fontSize: 22 },
});
