import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { progressLine, targetMet } from "../../features/coach/homework";
import type { Homework, HomeworkProgress } from "../../features/coach/types";
import { RADIUS, SPACING } from "../../constants";

/**
 * One piece of homework, the same on both sides: the routine, how the player is getting on (best
 * score, target, times this week) and the coach's note. A player gets "Start"; a coach gets a way
 * to take it off the list.
 */
export const HomeworkRow = ({
  homework,
  progress,
  onStart,
  onRemove,
  first,
}: {
  homework: Homework;
  progress: HomeworkProgress | undefined;
  onStart?: () => void;
  onRemove?: () => void;
  /** Inside a shared card: no top rule on the first row. */
  first?: boolean;
}) => {
  const { colors } = useAppTheme();
  const met = targetMet(homework, progress);
  const weekDone = !!homework.perWeek && (progress?.thisWeek ?? 0) >= homework.perWeek;
  return (
    <View
      style={[
        styles.row,
        onStart
          ? { borderTopWidth: first ? 0 : StyleSheet.hairlineWidth, borderTopColor: colors.border }
          : { borderWidth: 1, borderColor: colors.border, borderRadius: RADIUS.md, backgroundColor: colors.surface },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: met || weekDone ? colors.primary : colors.surfaceMuted }]}>
        <MaterialCommunityIcons name={met ? "trophy-outline" : weekDone ? "check" : "target"} size={18} color={met || weekDone ? colors.onPrimary : colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {homework.routineName}
        </Text>
        <Text style={[styles.meta, { color: met ? colors.primary : colors.textMuted }]} numberOfLines={1}>
          {met ? `Target hit · ${progressLine(homework, progress)}` : progressLine(homework, progress)}
        </Text>
        {homework.note ? (
          <Text style={[styles.note, { color: colors.text }]} numberOfLines={2}>
            “{homework.note}”
          </Text>
        ) : null}
      </View>
      {onStart ? (
        <Pressable
          onPress={onStart}
          accessibilityRole="button"
          accessibilityLabel={`Start ${homework.routineName}`}
          style={({ pressed }) => [styles.start, { borderColor: colors.primary, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[styles.startText, { color: colors.primary }]}>Start</Text>
        </Pressable>
      ) : null}
      {onRemove ? (
        <Pressable onPress={onRemove} accessibilityRole="button" accessibilityLabel={`Remove ${homework.routineName}`} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.sm, paddingVertical: SPACING.md },
  icon: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  name: { fontSize: 15, fontWeight: "800" },
  meta: { fontSize: 12, fontWeight: "600" },
  note: { fontSize: 12, fontStyle: "italic", lineHeight: 16 },
  start: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 32, justifyContent: "center" },
  startText: { fontSize: 13, fontWeight: "800" },
});
