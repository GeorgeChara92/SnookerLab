import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import type { Match, MatchesStackParamList } from "../../types";
import { RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { useDialog } from "../../components/ui/DialogProvider";

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
    () =>
      matches
        .filter((match: Match) => match.opponent_name === opponentName)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches, opponentName]
  );

  const summary = useMemo(() => {
    return opponentMatches.reduce(
      (acc, match) => {
        if (match.result === "win") acc.wins += 1;
        if (match.result === "loss") acc.losses += 1;
        if (match.result === "draw") acc.draws += 1;

        const frameRecords = getFrameRecordsByMatchId(match.id);
        if (frameRecords.length > 0) {
          // Live scored match - use frame records
          acc.totalScoreFor += frameRecords.reduce((sum, frame) => sum + frame.user_score, 0);
          acc.totalScoreAgainst += frameRecords.reduce((sum, frame) => sum + frame.opponent_score, 0);

          frameRecords.forEach((frame) => {
            acc.totalFrames += 1;
            if (frame.winner === "user") acc.frameWins += 1;
            if (frame.winner === "opponent") acc.frameLosses += 1;
            if (frame.winner === "draw") acc.frameDraws += 1;
          });
        } else {
          // Manual entry - single frame with point scores
          acc.totalScoreFor += match.user_score;
          acc.totalScoreAgainst += match.opponent_score;

          // Manual entry is always 1 frame
          acc.totalFrames += 1;
          if (match.result === "win") acc.frameWins += 1;
          if (match.result === "loss") acc.frameLosses += 1;
          if (match.result === "draw") acc.frameDraws += 1;
        }

        return acc;
      },
      {
        wins: 0,
        losses: 0,
        draws: 0,
        totalScoreFor: 0,
        totalScoreAgainst: 0,
        frameWins: 0,
        frameLosses: 0,
        frameDraws: 0,
        totalFrames: 0,
      }
    );
  }, [getFrameRecordsByMatchId, opponentMatches]);

  const getBestOfLabel = (match: Match) => {
    if (match.target_frames && match.target_frames > 0) return `Best of ${match.target_frames}`;
    if (match.frames_played && match.frames_played > 0) {
      const inferred = match.frames_played % 2 === 0 ? match.frames_played + 1 : match.frames_played;
      return `Best of ${inferred}`;
    }
    return "Best of ?";
  };

  const toggleSelection = (id: string) => {
    setSelectedMatchIds((current) =>
      current.includes(id) ? current.filter((itemId) => itemId !== id) : [...current, id]
    );
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedMatchIds([]);
  };

  const handleDeleteSelected = async () => {
    if (selectedMatchIds.length === 0) return;

    try {
      setIsDeleting(true);
      await Promise.all(selectedMatchIds.map((matchId) => deleteMatch(matchId)));
      exitSelectionMode();
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

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.summaryCard, { backgroundColor: colors.primaryStrong }]}> 
        <Text style={[styles.title, { color: colors.onPrimary }]}>{opponentName}</Text>
        <Text style={[styles.summaryLine, { color: "#C8DED5" }]}> 
          Record: {summary.wins}W - {summary.losses}L - {summary.draws}D
        </Text>
        <Text style={[styles.summaryLine, { color: "#C8DED5" }]}>Frame Record: {summary.frameWins}W - {summary.frameLosses}L - {summary.frameDraws}D ({summary.totalFrames})</Text>
        <Text style={[styles.summaryLine, { color: "#C8DED5" }]}>Total Score: {summary.totalScoreFor} - {summary.totalScoreAgainst}</Text>

        <View style={styles.addButtonWrap}>
          <AppButton
            label="Add Match Against This Opponent"
            variant="secondary"
            onPress={() => navigation.navigate("NewMatch", { opponentName })}
          />
        </View>

        <View style={styles.addButtonWrap}>
          {isSelectionMode ? (
            <AppButton label="Cancel Selection" variant="secondary" onPress={exitSelectionMode} />
          ) : (
            <AppButton label="Select Matches" variant="secondary" onPress={() => setIsSelectionMode(true)} />
          )}
        </View>
      </View>

      {isSelectionMode ? (
        <View style={[styles.bulkBar, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.bulkText, { color: colors.text }]}>{selectedMatchIds.length} selected</Text>
          <Pressable
            style={[
              styles.bulkDeleteButton,
              { backgroundColor: colors.danger, borderColor: colors.danger },
              selectedMatchIds.length === 0 && styles.bulkDeleteButtonDisabled,
            ]}
            disabled={selectedMatchIds.length === 0 || isDeleting}
            accessibilityRole="button"
            accessibilityLabel={`Delete ${selectedMatchIds.length} selected ${selectedMatchIds.length === 1 ? "match" : "matches"}`}
            accessibilityState={{ disabled: selectedMatchIds.length === 0 || isDeleting }}
            onPress={confirmDeleteSelected}
          >
            <Text style={[styles.bulkDeleteText, { color: colors.onDanger }]}>
              {isDeleting ? "Deleting…" : "Delete selected"}
            </Text>
          </Pressable>
        </View>
      ) : null}

      <FlatList
        data={opponentMatches}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.matchCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
              isSelectionMode && selectedMatchIds.includes(item.id) && styles.matchCardSelected,
            ]}
            onLongPress={() => {
              if (!isSelectionMode) {
                setIsSelectionMode(true);
                setSelectedMatchIds([item.id]);
              }
            }}
            onPress={() => {
              if (isSelectionMode) {
                toggleSelection(item.id);
                return;
              }

              navigation.navigate("MatchDetail", { matchId: item.id });
            }}
          >
            <View style={styles.row}>
              <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(item.date).toLocaleDateString()}</Text>
              <Text style={[styles.result, styles[item.result]]}>{item.result.toUpperCase()}</Text>
            </View>
            <Text style={[styles.matchMeta, { color: colors.textMuted }]}>{getBestOfLabel(item)} · Match Score</Text>
            <Text style={[styles.score, { color: colors.text }]}>{item.user_score} - {item.opponent_score}</Text>
            {item.location ? <Text style={[styles.location, { color: colors.textMuted }]}>📍 {item.location}</Text> : null}
            <Text style={[styles.openHint, { color: colors.primary }]}>Press to view match details</Text>
            {isSelectionMode ? (
              <View style={[styles.selectionBadge, selectedMatchIds.includes(item.id) && styles.selectionBadgeActive]}>
                <Text style={styles.selectionBadgeText}>{selectedMatchIds.includes(item.id) ? "Selected" : "Tap to select"}</Text>
              </View>
            ) : null}
          </Pressable>
        )}
      />

    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  summaryCard: {
    borderRadius: 14,
    padding: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  summaryLine: {
    marginTop: 6,
    fontSize: 13,
  },
  list: {
    paddingTop: 12,
    paddingBottom: 20,
  },
  addButtonWrap: {
    marginTop: 12,
  },
  bulkBar: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  bulkText: {
    fontSize: 13,
    fontWeight: "700",
  },
  bulkDeleteButton: {
    minHeight: 44,
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.md,
  },
  bulkDeleteButtonDisabled: {
    opacity: 0.45,
  },
  bulkDeleteText: {
    fontSize: 13,
    fontWeight: "800",
  },
  matchCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  matchCardSelected: {
    borderColor: "#52C997",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  date: {
    fontSize: 13,
  },
  result: {
    fontSize: 12,
    fontWeight: "700",
  },
  win: { color: "#0F766E" },
  loss: { color: "#B91C1C" },
  draw: { color: "#B45309" },
  score: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "800",
  },
  matchMeta: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: "700",
  },
  location: {
    marginTop: 4,
    fontSize: 12,
  },
  openHint: {
    marginTop: 5,
    fontSize: 12,
    fontWeight: "700",
  },
  selectionBadge: {
    marginTop: 7,
    borderWidth: 1,
    borderColor: "#3D6B5A",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  selectionBadgeActive: {
    borderColor: "#52C997",
    backgroundColor: "rgba(82,201,151,0.14)",
  },
  selectionBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6FCFAD",
  },
});
