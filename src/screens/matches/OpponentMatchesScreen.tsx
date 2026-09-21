import React, { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import type { MatchesStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { BoardPanel, ScoreStrip, TaleOfTheTape } from "../../components/scoreboard/Scoreboard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { FormStrip, MatchRow, SectionHeader } from "../../components/matches/MatchRows";
import {
  byNewest,
  getRecordingMode,
  relativeDate,
  summariseMatches,
} from "../../features/matches/matchSummary";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const OpponentMatchesScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "OpponentMatches">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { opponentName } = route.params;

  const { matches, deleteMatch, getFrameRecordsByMatchId } = useMatchesStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const opponentMatches = useMemo(
    () => matches.filter((match) => match.opponent_name.trim() === opponentName.trim()).sort(byNewest),
    [matches, opponentName]
  );

  const record = useMemo(() => summariseMatches(opponentMatches), [opponentMatches]);

  /**
   * Points across every frame against this player. A match entered by hand stores its points
   * directly; a live one has them frame by frame, so they are added up from the frame records.
   */
  const points = useMemo(
    () =>
      opponentMatches.reduce(
        (total, match) => {
          if (getRecordingMode(match) === "manual") {
            return { for: total.for + match.user_score, against: total.against + match.opponent_score };
          }
          const frames = getFrameRecordsByMatchId(match.id);
          return {
            for: total.for + frames.reduce((sum, frame) => sum + frame.user_score, 0),
            against: total.against + frames.reduce((sum, frame) => sum + frame.opponent_score, 0),
          };
        },
        { for: 0, against: 0 }
      ),
    [getFrameRecordsByMatchId, opponentMatches]
  );

  const highestBreaks = useMemo(
    () =>
      opponentMatches.reduce(
        (best, match) =>
          getFrameRecordsByMatchId(match.id).reduce(
            (inner, frame) => ({
              you: Math.max(inner.you, frame.highest_break_user ?? 0),
              them: Math.max(inner.them, frame.highest_break_opponent ?? 0),
            }),
            best
          ),
        { you: 0, them: 0 }
      ),
    [getFrameRecordsByMatchId, opponentMatches]
  );

  const tapeRows = [
    { label: "Matches won", left: record.wins, right: record.losses },
    { label: "Frames won", left: record.framesWon, right: record.framesLost },
    ...(points.for + points.against > 0
      ? [{ label: "Points scored", left: points.for, right: points.against }]
      : []),
    ...(highestBreaks.you + highestBreaks.them > 0
      ? [{ label: "Highest break", left: highestBreaks.you, right: highestBreaks.them }]
      : []),
  ];

  const setSelecting = (value: boolean) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsSelectionMode(value);
    if (!value) setSelectedMatchIds([]);
  };

  const toggleSelection = (id: string) => {
    setSelectedMatchIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  const handleDeleteSelected = async () => {
    if (selectedMatchIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(selectedMatchIds.map((matchId) => deleteMatch(matchId)));
      setSelecting(false);
    } catch (error) {
      console.warn("Failed to delete selected matches:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDeleteSelected = () => {
    const count = selectedMatchIds.length;
    if (count === 0) return;

    dialog.confirm({
      tone: "danger",
      icon: "trash-can-outline",
      title: `Delete ${count} ${count === 1 ? "match" : "matches"}?`,
      message: "Their frames and breaks go too, and this cannot be undone.",
      confirmLabel: count === 1 ? "Delete match" : "Delete matches",
      cancelLabel: "Keep them",
      onConfirm: () => {
        void handleDeleteSelected();
      },
    });
  };

  const lead = record.wins - record.losses;
  const headToHead =
    record.played === 0
      ? "No matches yet"
      : lead > 0
        ? `You lead ${record.wins}–${record.losses}`
        : lead < 0
          ? `${opponentName} leads ${record.losses}–${record.wins}`
          : `Level at ${record.wins}–${record.losses}`;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------------------------------------------------------------- head to head */}
        <BoardPanel
          kicker="HEAD TO HEAD"
          aside={record.lastPlayed ? `LAST ${relativeDate(record.lastPlayed).toUpperCase()}` : undefined}
        >
          <ScoreStrip
            size="hero"
            left={{ name: "You", score: record.wins, leading: lead > 0 }}
            right={{ name: opponentName, score: record.losses, leading: lead < 0 }}
            middle={`(${record.played})`}
            style={styles.heroStrip}
          />

          <Text style={[styles.headToHead, { color: colors.boardText }]}>{headToHead}</Text>
          {record.draws ? (
            <Text style={[styles.drawNote, { color: colors.boardMuted }]}>
              {record.draws} {record.draws === 1 ? "match" : "matches"} drawn
            </Text>
          ) : null}

          <View style={[styles.tape, { borderTopColor: colors.boardRaised }]}>
            <TaleOfTheTape leftName="You" rightName={opponentName} rows={tapeRows} />
          </View>

          {record.form.length ? (
            <View style={styles.formRow}>
              <Text style={[styles.formLabel, { color: colors.boardMuted }]}>YOUR FORM</Text>
              <FormStrip form={record.form} size={22} />
            </View>
          ) : null}
        </BoardPanel>

        <Pressable
          onPress={() => navigation.navigate("NewMatch", { opponentName })}
          accessibilityRole="button"
          accessibilityLabel={`Start a new match against ${opponentName}`}
          style={({ pressed }) => [styles.newMatch, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
          <Text style={[styles.newMatchText, { color: colors.onPrimary }]} numberOfLines={1}>
            New match against {opponentName}
          </Text>
        </Pressable>

        {/* ---------------------------------------------------------------- matches */}
        <SectionHeader
          title="Matches"
          actionLabel={opponentMatches.length ? (isSelectionMode ? "Done" : "Select") : undefined}
          onAction={() => setSelecting(!isSelectionMode)}
        />

        {isSelectionMode ? (
          <Text style={[styles.selectHint, { color: colors.textMuted }]}>Tap the matches you want to delete.</Text>
        ) : null}

        {opponentMatches.map((match) => {
          const selected = selectedMatchIds.includes(match.id);
          return (
            <MatchRow
              key={match.id}
              match={match}
              selectionMode={isSelectionMode}
              selected={selected}
              onLongPress={() => {
                if (isSelectionMode) return;
                setSelecting(true);
                setSelectedMatchIds([match.id]);
              }}
              onPress={() =>
                isSelectionMode
                  ? toggleSelection(match.id)
                  : navigation.navigate("MatchDetail", { matchId: match.id })
              }
            />
          );
        })}

        {!isSelectionMode && opponentMatches.length > 1 ? (
          <Text style={[styles.tip, { color: colors.textMuted }]}>Press and hold a match to select it.</Text>
        ) : null}
      </ScrollView>

      {isSelectionMode ? (
        <View style={[styles.selectionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <Text style={[styles.selectionCount, { color: colors.text }]}>
            {selectedMatchIds.length ? `${selectedMatchIds.length} selected` : "None selected"}
          </Text>
          <Pressable
            onPress={confirmDeleteSelected}
            disabled={!selectedMatchIds.length || isDeleting}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${selectedMatchIds.length} selected ${selectedMatchIds.length === 1 ? "match" : "matches"}`}
            accessibilityState={{ disabled: !selectedMatchIds.length || isDeleting }}
            style={({ pressed }) => [
              styles.deleteButton,
              {
                backgroundColor: selectedMatchIds.length ? colors.danger : colors.surfaceMuted,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={18}
              color={selectedMatchIds.length ? colors.onDanger : colors.textMuted}
            />
            <Text style={[styles.deleteText, { color: selectedMatchIds.length ? colors.onDanger : colors.textMuted }]}>
              {isDeleting ? "Deleting…" : "Delete"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  heroStrip: { borderTopWidth: 0, borderBottomWidth: 0 },
  headToHead: {
    fontFamily: FONTS.board,
    fontSize: 20,
    letterSpacing: 0.6,
    textAlign: "center",
    marginTop: SPACING.sm,
  },
  drawNote: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 0.8,
    textAlign: "center",
    marginTop: 2,
  },
  tape: {
    borderTopWidth: 1,
    marginTop: SPACING.lg,
    paddingTop: SPACING.md,
  },
  formRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.xs,
  },
  formLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.6 },

  newMatch: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 50,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginTop: SPACING.lg,
  },
  newMatchText: { flexShrink: 1, fontSize: 16, fontWeight: "800" },

  selectHint: { fontSize: 13, fontWeight: "600", marginBottom: SPACING.sm },
  tip: { fontSize: 12, fontWeight: "600", textAlign: "center", marginTop: SPACING.sm },

  selectionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  selectionCount: { fontSize: 15, fontWeight: "700" },
  deleteButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    paddingHorizontal: SPACING.lg,
    borderRadius: RADIUS.md,
  },
  deleteText: { fontSize: 15, fontWeight: "800" },
});
