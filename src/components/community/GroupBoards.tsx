import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCustomRoutinesStore } from "../../store";
import { DEFAULT_ROUTINES } from "../../constants/routines";
import { leaderboardKeyFor } from "../../features/customRoutines/customRoutine";
import {
  GLOBAL_METRICS,
  globalLeaderboard,
  routineLeaderboard,
  type BoardEntry,
  type GlobalMetric,
} from "../../features/community/sharedRoutines";
import { groupRoutines, pinRoutine, unpinRoutine, type GroupRoutine } from "../../features/community/groupFeed";
import { nameOf } from "../../features/community/types";
import { LeaderboardRow } from "./LeaderboardRow";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

type Pinned = GroupRoutine & { entries: BoardEntry[] | null };

/**
 * A group's leaderboards: the members ranked on level, high break, centuries and wins, and the
 * routines the owner and admins pin, each with the members' bests. Only members who appear on
 * leaderboards are counted.
 */
export const GroupBoards = ({
  groupId,
  groupName,
  memberIds,
  me,
  canPin,
  onOpenPlayer,
  onOpenBoard,
}: {
  groupId: string;
  groupName: string;
  memberIds: string[];
  me: string | null;
  canPin: boolean;
  onOpenPlayer: (userId: string) => void;
  onOpenBoard: (routineKey: string, name: string) => void;
}) => {
  const { colors } = useAppTheme();
  const [metric, setMetric] = useState<GlobalMetric>("xp");
  const [standings, setStandings] = useState<BoardEntry[] | null>(null);
  const [pinned, setPinned] = useState<Pinned[] | null>(null);
  const [picking, setPicking] = useState(false);
  const memberKey = memberIds.join(",");

  useEffect(() => {
    let cancelled = false;
    setStandings(null);
    void globalLeaderboard(metric, { friends: memberIds, limit: 10 }).then((rows) => {
      if (!cancelled) setStandings(rows);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metric, memberKey]);

  const loadPinned = useCallback(async () => {
    const rows = await groupRoutines(groupId);
    setPinned(rows.map((row) => ({ ...row, entries: null })));
    const boards = await Promise.all(
      rows.map((row) => routineLeaderboard(row.routineKey, { friends: memberIds, limit: 3 }))
    );
    setPinned(rows.map((row, index) => ({ ...row, entries: boards[index].entries })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, memberKey]);

  useEffect(() => {
    void loadPinned();
  }, [loadPinned]);

  const unpin = async (row: GroupRoutine) => {
    setPinned((prev) => prev?.filter((item) => item.routineKey !== row.routineKey) ?? null);
    if (!(await unpinRoutine(groupId, row.routineKey))) void loadPinned();
  };

  const unit = GLOBAL_METRICS.find((item) => item.value === metric)?.unit;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Standings</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {GLOBAL_METRICS.map((item) => {
          const selected = item.value === metric;
          return (
            <Pressable
              key={item.value}
              onPress={() => setMetric(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.board : colors.surface,
                  borderColor: selected ? colors.boardRule : colors.border,
                },
              ]}
            >
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.chipText, { color: selected ? colors.boardText : colors.text }]}
              >
                {item.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {standings === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : standings.length === 0 ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          Nobody here is on the leaderboards yet. Members who switch leaderboards off are left out.
        </Text>
      ) : (
        <View style={styles.list}>
          {standings.map((entry) => (
            <LeaderboardRow
              key={entry.profile.id}
              entry={unit ? { ...entry, raw: `${entry.raw} ${unit}` } : entry}
              isMe={entry.profile.id === me}
              onPress={() => onOpenPlayer(entry.profile.id)}
            />
          ))}
        </View>
      )}

      <View style={styles.titleRow}>
        <Text style={[styles.sectionTitle, styles.flex, { color: colors.text }]}>Group routines</Text>
        {canPin ? (
          <Pressable
            onPress={() => setPicking(true)}
            accessibilityRole="button"
            style={[styles.pinButton, { borderColor: colors.primary }]}
          >
            <MaterialCommunityIcons name="pin-outline" size={16} color={colors.primary} />
            <Text style={[styles.pinText, { color: colors.primary }]}>Pin a routine</Text>
          </Pressable>
        ) : null}
      </View>
      {pinned === null ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : pinned.length === 0 ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>
          {canPin
            ? "Pin routines for the group to practise, and members' bests on them are ranked here."
            : "No routines pinned yet. The owner and admins can pin some."}
        </Text>
      ) : (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {pinned.map((row, index) => {
            const mine = row.entries?.find((entry) => entry.profile.id === me);
            const leader = row.entries?.[0];
            return (
              <View
                key={row.routineKey}
                style={[
                  styles.pinned,
                  index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                ]}
              >
                <Pressable
                  onPress={() => onOpenBoard(row.routineKey, row.name)}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.name} leaderboard`}
                  style={styles.pinnedMain}
                >
                  <MaterialCommunityIcons name="target" size={20} color={colors.primary} />
                  <View style={styles.flex}>
                    <Text style={[styles.pinnedName, { color: colors.text }]} numberOfLines={1}>
                      {row.name}
                    </Text>
                    <Text style={[styles.pinnedMeta, { color: colors.textMuted }]} numberOfLines={1}>
                      {row.entries === null
                        ? "Loading…"
                        : leader
                          ? `Best ${leader.raw} · ${leader.profile.id === me ? "you" : nameOf(leader.profile)}`
                          : "No scores yet"}
                    </Text>
                  </View>
                  {mine ? (
                    <Text
                      maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                      style={[styles.rank, { color: mine.rank === 1 ? colors.boardRule : colors.text }]}
                    >
                      #{mine.rank}
                    </Text>
                  ) : null}
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
                {canPin ? (
                  <Pressable
                    onPress={() => unpin(row)}
                    accessibilityRole="button"
                    accessibilityLabel={`Unpin ${row.name}`}
                    style={styles.unpin}
                  >
                    <MaterialCommunityIcons name="pin-off-outline" size={18} color={colors.textMuted} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>
      )}

      <PinPicker
        visible={picking}
        groupId={groupId}
        groupName={groupName}
        pinnedKeys={new Set((pinned ?? []).map((row) => row.routineKey))}
        onClose={() => setPicking(false)}
        onPinned={loadPinned}
      />
    </View>
  );
};

/** Choosing a routine to pin: the library's scored routines, and the player's shared ones. */
const PinPicker = ({
  visible,
  groupId,
  groupName,
  pinnedKeys,
  onClose,
  onPinned,
}: {
  visible: boolean;
  groupId: string;
  groupName: string;
  pinnedKeys: Set<string>;
  onClose: () => void;
  onPinned: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const custom = useCustomRoutinesStore((state) => state.routines);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const options = useMemo(() => {
    const mine = custom
      .map((item) => ({ key: leaderboardKeyFor(item), name: item.name, section: "Your routines" }))
      .filter((item): item is { key: string; name: string; section: string } => Boolean(item.key));
    const library = DEFAULT_ROUTINES.filter((routine) => routine.content_type !== "guide").map((routine) => ({
      key: routine.id,
      name: routine.name,
      section: "Library",
    }));
    const needle = query.trim().toLowerCase();
    return [...mine, ...library].filter((item) => !needle || item.name.toLowerCase().includes(needle));
  }, [custom, query]);

  const pin = async (key: string, name: string) => {
    setBusy(key);
    setError(null);
    const result = await pinRoutine(groupId, key, name);
    setBusy(null);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    onPinned();
  };

  let lastSection = "";
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <Text style={[styles.sheetTitle, { color: colors.text }]}>Pin to {groupName}</Text>
        <Text style={[styles.sheetBody, { color: colors.textMuted }]}>
          Your own routines appear here once they are shared to the community.
        </Text>
        <View style={[styles.search, { backgroundColor: colors.background, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search routines"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
          {options.map((item) => {
            const header = item.section !== lastSection ? item.section : null;
            lastSection = item.section;
            const done = pinnedKeys.has(item.key);
            return (
              <View key={item.key}>
                {header ? <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>{header}</Text> : null}
                <Pressable
                  onPress={() => pin(item.key, item.name)}
                  disabled={done || Boolean(busy)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: done }}
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                  ]}
                >
                  <Text style={[styles.optionText, { color: colors.text }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                  {busy === item.key ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <MaterialCommunityIcons
                      name={done ? "pin" : "pin-outline"}
                      size={20}
                      color={done ? colors.primary : colors.textMuted}
                    />
                  )}
                </Pressable>
              </View>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  wrap: { gap: SPACING.md },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginTop: SPACING.sm },
  chips: { gap: SPACING.sm },
  chip: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
    justifyContent: "center",
  },
  chipText: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1 },
  loading: { marginVertical: SPACING.md },
  note: { fontSize: 14, lineHeight: 20 },
  list: { gap: SPACING.sm },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  pinButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 34,
  },
  pinText: { fontSize: 13, fontWeight: "800" },
  pinned: { flexDirection: "row", alignItems: "center" },
  pinnedMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 16,
    paddingLeft: SPACING.md,
    paddingRight: SPACING.sm,
  },
  pinnedName: { fontSize: 15, fontWeight: "700" },
  pinnedMeta: { fontSize: 13, marginTop: 1 },
  rank: { fontFamily: FONTS.boardHeavy, fontSize: 20 },
  unpin: { width: HIT_TARGET, height: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  sheet: {
    marginTop: "auto",
    maxHeight: "80%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill },
  sheetTitle: { fontSize: 20, fontWeight: "800" },
  sheetBody: { fontSize: 13, lineHeight: 18 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  error: { fontSize: 13, fontWeight: "600" },
  sheetList: { flexGrow: 0 },
  sectionLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.8, marginTop: SPACING.md, marginBottom: 4 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  optionText: { flex: 1, fontSize: 15, fontWeight: "600" },
});
