import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore, useMatchesStore } from "../../store";
import type { LiveFrameRecord, MatchType, MatchesStackParamList } from "../../types";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAppTheme } from "../../hooks/useAppTheme";
import { BoardPanel, ScoreStrip, TaleOfTheTape } from "../../components/scoreboard/Scoreboard";
import { ShareMatchSheet, bestOfFor } from "../../components/matches/ShareMatchSheet";
import { EditMatchSheet } from "../../components/matches/EditMatchSheet";
import { FrameTimelineSheet } from "../../components/matches/FrameTimelineSheet";
import { countsAsResult } from "../../features/matches/matchSummary";
import { matchTape } from "../../features/matches/breaks";
import { parseDateValue } from "../../utils/date";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const TYPE_LABEL: Record<MatchType, string> = {
  casual: "CASUAL",
  league: "LEAGUE",
  tournament: "TOURNAMENT",
  practice: "PRACTICE",
};

const NO_FRAMES: LiveFrameRecord[] = [];

/**
 * One match: the result as a broadcast scoreboard, what to do next (carry on scoring, share
 * it), the match statistics and every frame. Details are changed in a sheet, so the page reads
 * as a result rather than a form.
 *
 * The match and its frames are read from the store as they change, so a frame saved in live
 * scoring shows here the moment the player comes back.
 */
export const MatchDetailScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "MatchDetail">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matchId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();

  const match = useMatchesStore((state) => state.matches.find((item) => item.id === matchId));
  const storedFrames = useMatchesStore((state) => state.liveFramesByMatch[matchId] ?? NO_FRAMES);
  const deleteMatch = useMatchesStore((state) => state.deleteMatch);
  const username = useAuthStore((state) => state.user?.username);

  const [openFrameId, setOpenFrameId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const frames = useMemo(() => [...storedFrames].sort((a, b) => a.frame_number - b.frame_number), [storedFrames]);
  const tape = useMemo(() => matchTape(frames), [frames]);

  if (!match) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="scoreboard-outline" size={32} color={colors.textMuted} />
        <Text style={[styles.missingText, { color: colors.textMuted }]}>This match has been deleted.</Text>
      </View>
    );
  }

  const you = username || "You";
  const bestOf = bestOfFor(match);
  const firstTo = bestOf ? Math.floor(bestOf / 2) + 1 : undefined;
  const complete = firstTo ? match.user_score >= firstTo || match.opponent_score >= firstTo : false;
  const typedScore = frames.length === 0 && (match.user_score > 0 || match.opponent_score > 0);
  const canScoreLive = !typedScore && !complete;
  const inProgress = canScoreLive && frames.length > 0;
  const result = countsAsResult(match);
  const won = match.user_score > match.opponent_score;
  const lost = match.user_score < match.opponent_score;
  const date = parseDateValue(match.date).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const status = inProgress ? "IN PROGRESS" : !result ? "NOT STARTED" : won ? "WON" : lost ? "LOST" : "DRAWN";

  const confirmDelete = () =>
    dialog.confirm({
      title: "Delete this match?",
      message: "Every frame, break and pot scored in it goes too. This cannot be undone.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete match",
      cancelLabel: "Keep it",
      onConfirm: async () => {
        try {
          await deleteMatch(match.id);
          navigation.goBack();
        } catch {
          dialog.alert({
            title: "Could not delete the match",
            message: "It is still here. Check your connection and try again.",
            tone: "danger",
            icon: "wifi-off",
          });
        }
      },
    });

  const primaryAction = canScoreLive
    ? {
        label: frames.length ? `Score frame ${frames.length + 1}` : "Start live scoring",
        icon: "play-circle-outline" as const,
        onPress: () => navigation.navigate("LiveFrameScoring", { matchId: match.id }),
      }
    : result
      ? { label: "Share result", icon: "export-variant" as const, onPress: () => setShareOpen(true) }
      : null;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
        {/* The result */}
        <BoardPanel kicker={`${TYPE_LABEL[match.match_type] ?? "MATCH"} · ${date.toUpperCase()}`} aside={status}>
          <ScoreStrip
            size="hero"
            left={{ name: you, score: match.user_score, leading: result && !lost }}
            right={{ name: match.opponent_name, score: match.opponent_score, leading: result && !won }}
            middle={bestOf ? `(${bestOf})` : "V"}
            style={styles.strip}
          />
          {match.location ? (
            <View style={styles.venue}>
              <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.boardMuted} />
              <Text style={[styles.venueText, { color: colors.boardMuted }]} numberOfLines={1}>
                {match.location}
              </Text>
            </View>
          ) : null}
          {tape.user.high || tape.opponent.high ? (
            <View style={[styles.highs, { borderTopColor: colors.boardRaised }]}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.highLabel, { color: colors.boardMuted }]}>
                HIGH BREAK
              </Text>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.highValue, { color: colors.boardText }]}>
                <Text style={{ color: tape.user.high >= tape.opponent.high ? colors.boardRule : colors.boardText }}>
                  {tape.user.high}
                </Text>
                <Text style={{ color: colors.boardMuted }}>{"  ·  "}</Text>
                <Text style={{ color: tape.opponent.high > tape.user.high ? colors.boardRule : colors.boardText }}>
                  {tape.opponent.high}
                </Text>
              </Text>
            </View>
          ) : null}
        </BoardPanel>

        {/* What to do next */}
        <View style={styles.actions}>
          {primaryAction ? (
            <Pressable
              onPress={primaryAction.onPress}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <MaterialCommunityIcons name={primaryAction.icon} size={20} color={colors.onPrimary} />
              <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{primaryAction.label}</Text>
            </Pressable>
          ) : null}
          <View style={styles.secondaryRow}>
            {canScoreLive && result ? (
              <Pressable
                onPress={() => setShareOpen(true)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.secondary,
                  { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="export-variant" size={18} color={colors.text} />
                <Text style={[styles.secondaryText, { color: colors.text }]}>Share</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setEditOpen(true)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.secondary,
                { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.text} />
              <Text style={[styles.secondaryText, { color: colors.text }]}>Edit details</Text>
            </Pressable>
          </View>
        </View>

        {/* Match statistics */}
        {frames.length ? (
          <BoardPanel kicker="MATCH STATISTICS">
            <TaleOfTheTape
              leftName={you}
              rightName={match.opponent_name}
              rows={[
                { label: "Frames", left: tape.user.frames, right: tape.opponent.frames },
                { label: "Points", left: tape.user.points, right: tape.opponent.points },
                { label: "High break", left: tape.user.high, right: tape.opponent.high },
                { label: "50+ breaks", left: tape.user.fifties, right: tape.opponent.fifties },
                { label: "Pots", left: tape.user.pots, right: tape.opponent.pots },
                { label: "Fouls", left: tape.user.fouls, right: tape.opponent.fouls },
              ]}
            />
          </BoardPanel>
        ) : null}

        {/* Frames */}
        {frames.length ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Frames</Text>
            {frames.map((frame, index) => {
              const total = Math.max(1, frame.user_score + frame.opponent_score);
              const userWon = frame.winner === "user";
              const oppWon = frame.winner === "opponent";
              return (
                <Pressable
                  key={frame.id}
                  onPress={() => setOpenFrameId(frame.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`Frame ${frame.frame_number}, ${frame.user_score} to ${frame.opponent_score}. Open the timeline`}
                  style={({ pressed }) => [
                    styles.frame,
                    index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                    { opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <View style={styles.frameTop}>
                    <Text
                      maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                      style={[styles.frameNumber, { color: colors.textMuted }]}
                    >
                      FRAME {frame.frame_number}
                      {frame.abandoned ? " · ABANDONED" : ""}
                    </Text>
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={styles.frameScore}>
                      <Text style={{ color: userWon ? colors.text : colors.textMuted }}>{frame.user_score}</Text>
                      <Text style={{ color: colors.textMuted }}>–</Text>
                      <Text style={{ color: oppWon ? colors.text : colors.textMuted }}>{frame.opponent_score}</Text>
                    </Text>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                  </View>
                  <View style={[styles.share, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={{
                        width: `${(frame.user_score / total) * 100}%`,
                        backgroundColor: userWon ? colors.primary : colors.textMuted,
                      }}
                    />
                  </View>
                  <Text style={[styles.frameMeta, { color: colors.textMuted }]}>
                    High break {frame.highest_break_user} · {frame.highest_break_opponent}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : !result ? (
          <View style={[styles.card, styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="billiards" size={26} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Score the first frame live and every pot, break and foul is kept here.
            </Text>
          </View>
        ) : null}

        {match.notes ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Notes</Text>
            <Text style={[styles.notes, { color: colors.text }]}>{match.notes}</Text>
          </View>
        ) : null}

        <Pressable
          onPress={confirmDelete}
          accessibilityRole="button"
          style={({ pressed }) => [styles.delete, { opacity: pressed ? 0.6 : 1 }]}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
          <Text style={[styles.deleteText, { color: colors.danger }]}>Delete match</Text>
        </Pressable>
      </ScrollView>

      <FrameTimelineSheet
        frame={frames.find((frame) => frame.id === openFrameId)}
        onClose={() => setOpenFrameId(null)}
      />
      <EditMatchSheet
        match={match}
        scoreFromFrames={frames.length > 0}
        visible={editOpen}
        onClose={() => setEditOpen(false)}
      />
      {result ? <ShareMatchSheet match={match} visible={shareOpen} onClose={() => setShareOpen(false)} /> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  missingText: { fontSize: 15 },
  strip: { marginTop: SPACING.xs },
  venue: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: SPACING.sm },
  venueText: { fontSize: 13, fontWeight: "600" },
  highs: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
  },
  highLabel: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  highValue: { fontFamily: FONTS.board, fontSize: 22 },
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
  secondaryRow: { flexDirection: "row", gap: SPACING.sm },
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
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.xs },
  cardTitle: { fontSize: 16, fontWeight: "800", marginBottom: SPACING.xs },
  frame: { paddingVertical: SPACING.sm, gap: 6 },
  frameTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  frameNumber: { flex: 1, fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1 },
  frameScore: { fontFamily: FONTS.board, fontSize: 22 },
  share: { height: 4, borderRadius: 2, overflow: "hidden", flexDirection: "row" },
  frameMeta: { fontSize: 12, fontWeight: "600" },
  empty: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  notes: { fontSize: 15, lineHeight: 22 },
  delete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    marginTop: SPACING.sm,
  },
  deleteText: { fontSize: 15, fontWeight: "700" },
});
