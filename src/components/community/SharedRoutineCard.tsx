import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { TableDiagram } from "../scanSnooker/TableDiagram";
import { summarise } from "../../features/scanSnooker/position";
import { nameOf } from "../../features/community/types";
import type { SharedRoutine } from "../../features/community/sharedRoutines";
import { RADIUS, SPACING } from "../../constants";

/** A shared routine in the library: the table, the name, who made it, and how popular it is. */
export const SharedRoutineCard = ({
  routine,
  rank,
  liked,
  onPress,
}: {
  routine: SharedRoutine;
  /** Its place in the top routines, if it has one. */
  rank?: number;
  liked?: boolean;
  onPress: () => void;
}) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${routine.name} by ${nameOf(routine.author)}, ${routine.likes} likes`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.thumb}>
        <TableDiagram balls={routine.balls} readOnly />
        {rank ? (
          <View style={[styles.rank, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
            <Text style={[styles.rankText, { color: colors.boardRule }]}>{rank}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {routine.name}
        </Text>
        <Text style={[styles.author, { color: colors.textMuted }]} numberOfLines={1}>
          by {nameOf(routine.author)}
        </Text>
        {routine.description ? (
          <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
            {routine.description}
          </Text>
        ) : null}
        <View style={styles.meta}>
          <View style={styles.stat}>
            <MaterialCommunityIcons
              name={liked ? "heart" : "heart-outline"}
              size={15}
              color={liked ? colors.danger : colors.textMuted}
            />
            <Text style={[styles.statText, { color: colors.textMuted }]}>{routine.likes}</Text>
          </View>
          <View style={styles.stat}>
            <MaterialCommunityIcons name="bookmark-outline" size={15} color={colors.textMuted} />
            <Text style={[styles.statText, { color: colors.textMuted }]}>{routine.saves}</Text>
          </View>
          <Text style={[styles.statText, { color: colors.textMuted }]} numberOfLines={1}>
            {summarise(routine.balls)}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: { flexDirection: "row", gap: SPACING.md, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.sm },
  thumb: { width: 64, height: 116, borderRadius: RADIUS.sm, overflow: "hidden" },
  rank: {
    position: "absolute",
    top: 4,
    left: 4,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 12, fontWeight: "900" },
  body: { flex: 1, minWidth: 0, justifyContent: "center", gap: 2 },
  name: { fontSize: 16, fontWeight: "800" },
  author: { fontSize: 13, fontWeight: "600" },
  description: { fontSize: 13, lineHeight: 18 },
  meta: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginTop: 4 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 12, fontWeight: "700" },
});
