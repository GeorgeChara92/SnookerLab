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
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { FormStrip, MatchRow, SectionHeader } from "../../components/matches/MatchRows";
import {
  byNewest,
  getRecordingMode,
  initialsOf,
  relativeDate,
  summariseMatches,
} from "../../features/matches/matchSummary";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

/** "Mon 1 Jun", with the year only when it is not this one. */
const matchDate = (dateStr: string) => {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(date.getFullYear() === new Date().getFullYear() ? {} : { year: "numeric" }),
  });
};

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
        {/* ---------------------------------------------------------------- who */}
        <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.heroTop}>
            <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.avatarText, { color: colors.text }]}>{initialsOf(opponentName)}</Text>
            </View>
            <View style={styles.heroText}>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {opponentName}
              </Text>
              <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
                {record.played} {record.played === 1 ? "match" : "matches"}
                {record.lastPlayed ? ` · last played ${relativeDate(record.lastPlayed).toLowerCase()}` : ""}
              </Text>
            </View>
          </View>

          <Text
            style={[
              styles.headToHead,
              { color: lead > 0 ? colors.primary : lead < 0 ? colors.danger : colors.text },
            ]}
          >
            {headToHead}
          </Text>

          <View style={[styles.stats, { borderColor: colors.border }]}>
            {[
              { label: "Won", value: `${record.wins}`, colour: colors.primary },
              { label: "Lost", value: `${record.losses}`, colour: colors.danger },
              { label: "Drawn", value: `${record.draws}`, colour: colors.text },
              { label: "Frames", value: `${record.framesWon}–${record.framesLost}`, colour: colors.text },
            ].map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.stat,
                  index > 0 ? { borderLeftWidth: 1, borderLeftColor: colors.border } : null,
                ]}
              >
                <Text style={[styles.statValue, { color: item.colour }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{item.label}</Text>
              </View>
            ))}
          </View>

          <View style={styles.heroFoot}>
            {record.form.length ? (
              <View style={styles.footItem}>
                <Text style={[styles.footLabel, { color: colors.textMuted }]}>Form</Text>
                <FormStrip form={record.form} />
              </View>
            ) : null}
            {points.for + points.against > 0 ? (
              <View style={[styles.footItem, styles.footRight]}>
                <Text style={[styles.footLabel, { color: colors.textMuted }]}>Points</Text>
                <Text style={[styles.footValue, { color: colors.text }]}>
                  {points.for}–{points.against}
                </Text>
              </View>
            ) : null}
          </View>

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
        </View>

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
              title={matchDate(match.date)}
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

  hero: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 20, fontWeight: "800" },
  heroText: { flex: 1 },
  name: { fontSize: 24, fontWeight: "800" },
  heroMeta: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  headToHead: { fontSize: 15, fontWeight: "800", marginTop: SPACING.lg },

  stats: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.sm,
  },
  stat: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 20, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 11, fontWeight: "700", marginTop: 2 },

  heroFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: SPACING.md,
  },
  footItem: { gap: 4 },
  footRight: { alignItems: "flex-end" },
  footLabel: { fontSize: 11, fontWeight: "700" },
  footValue: { fontSize: 17, fontWeight: "800", fontVariant: ["tabular-nums"] },

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
