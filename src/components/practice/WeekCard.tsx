import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { usePracticePlanStore, useRoutineScoresStore, useSessionsStore } from "../../store";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { practiceDays, streaks, WEEKDAY_SHORT, type Streaks } from "../../features/practice/plan";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/** The player's streaks and this week, worked out from everything they have logged. */
export const useStreaks = (): Streaks => {
  const logs = useSessionsStore((state) => state.logs);
  const entries = useRoutineScoresStore((state) => state.entries);
  const plan = usePracticePlanStore((state) => state.plan);
  // Worked out again each render so the week rolls over at midnight; it is cheap.
  const active = useMemo(() => practiceDays(logs, entries), [logs, entries]);
  return streaks(active, plan);
};

const Numeral = ({ value, label }: { value: number; label: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.numeral}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.numeralValue, { color: colors.boardText }]}>
        {value}
      </Text>
      <Text
        maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
        numberOfLines={2}
        style={[styles.numeralLabel, { color: colors.boardMuted }]}
      >
        {label}
      </Text>
    </View>
  );
};

/**
 * This week at a glance: the two streaks, a cell for each day (filled once practised, ringed if
 * planned) and what is planned for today, with a button to start it.
 */
export const WeekCard = ({
  onOpen,
  onStart,
  templateName,
}: {
  /** Opens the plan. Without it the card is not a button. */
  onOpen?: () => void;
  /** Starts a planned preset. */
  onStart?: (templateId: string) => void;
  templateName: (templateId: string) => string | undefined;
}) => {
  const { colors } = useAppTheme();
  const result = useStreaks();
  const { thisWeek } = result;
  const today = thisWeek.days.find((day) => day.isToday);
  const todayPreset = today?.planned?.templateId ? templateName(today.planned.templateId) : undefined;

  const todayLine = today?.practised
    ? "Practised today. Nice work."
    : today?.planned
      ? todayPreset
        ? `Today: ${todayPreset}`
        : "Today is a practice day."
      : thisWeek.reached
        ? "Target reached for the week."
        : `${thisWeek.target - thisWeek.done} more ${thisWeek.target - thisWeek.done === 1 ? "day" : "days"} to reach your target.`;

  const body = (
    <BoardPanel kicker="THIS WEEK" aside={`${thisWeek.done} OF ${thisWeek.target} DAYS`}>
      <View style={styles.numerals}>
        <Numeral value={result.days} label={result.days === 1 ? "DAY IN A ROW" : "DAYS IN A ROW"} />
        <View style={[styles.rule, { backgroundColor: colors.boardRaised }]} />
        <Numeral value={result.weeks} label={result.weeks === 1 ? "WEEK ON TARGET" : "WEEKS ON TARGET"} />
      </View>

      <View style={styles.days}>
        {thisWeek.days.map((day) => {
          const missed = day.isPast && day.planned && !day.practised;
          return (
            <View
              key={day.key}
              style={styles.day}
              accessible
              accessibilityLabel={`${WEEKDAY_SHORT[day.day]}${day.practised ? ", practised" : day.planned ? ", planned" : ""}`}
            >
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.dayLabel, { color: day.isToday ? colors.boardText : colors.boardMuted }]}
              >
                {WEEKDAY_SHORT[day.day].slice(0, 1)}
              </Text>
              <View
                style={[
                  styles.dot,
                  day.practised
                    ? { backgroundColor: colors.boardRule, borderColor: colors.boardRule }
                    : day.planned
                      ? {
                          borderColor: missed ? colors.boardMuted : colors.boardText,
                          borderStyle: missed ? "dashed" : "solid",
                        }
                      : { borderColor: colors.boardRaised },
                ]}
              >
                {day.practised ? <MaterialCommunityIcons name="check" size={14} color={colors.board} /> : null}
              </View>
              <View style={[styles.todayMark, { backgroundColor: day.isToday ? colors.boardText : "transparent" }]} />
            </View>
          );
        })}
      </View>

      <View style={[styles.footer, { borderTopColor: colors.boardRaised }]}>
        <Text style={[styles.todayText, { color: colors.boardText }]} numberOfLines={2}>
          {todayLine}
        </Text>
        {onStart && today?.planned?.templateId && todayPreset && !today.practised ? (
          <Pressable
            onPress={() => onStart(today.planned!.templateId!)}
            accessibilityRole="button"
            accessibilityLabel={`Start ${todayPreset}`}
            style={({ pressed }) => [styles.start, { backgroundColor: colors.boardRule, opacity: pressed ? 0.85 : 1 }]}
          >
            <Text style={[styles.startText, { color: colors.board }]}>Start</Text>
          </Pressable>
        ) : onOpen ? (
          <MaterialCommunityIcons name="chevron-right" size={22} color={colors.boardMuted} />
        ) : null}
      </View>
    </BoardPanel>
  );

  if (!onOpen) return body;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel="Open your practice plan"
      style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}
    >
      {body}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  numerals: { flexDirection: "row", alignItems: "stretch", marginTop: SPACING.xs },
  numeral: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm, minWidth: 0 },
  numeralValue: { fontFamily: FONTS.boardHeavy, fontSize: 44, lineHeight: 48 },
  numeralLabel: { flex: 1, fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1, lineHeight: 15 },
  rule: { width: 1, marginHorizontal: SPACING.md },
  days: { flexDirection: "row", justifyContent: "space-between", marginTop: SPACING.md },
  day: { flex: 1, alignItems: "center", gap: 6 },
  dayLabel: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1 },
  dot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  todayMark: { width: 14, height: 2, borderRadius: 1 },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    minHeight: HIT_TARGET,
  },
  todayText: { flex: 1, fontSize: 14, fontWeight: "700", lineHeight: 19 },
  start: {
    minHeight: 36,
    minWidth: 72,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  startText: { fontSize: 14, fontWeight: "800" },
});
