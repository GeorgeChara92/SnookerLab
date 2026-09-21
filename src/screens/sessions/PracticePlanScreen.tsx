import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Routine, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { usePracticePlanStore, useRoutineScoresStore, useRoutinesStore, useSessionsStore } from "../../store";
import { WeekCard, useStreaks } from "../../components/practice/WeekCard";
import { SwipeToDelete } from "../../components/ui/SwipeToDelete";
import {
  goalStatus,
  WEEKDAY_LONG,
  WEEKDAY_SHORT,
  weekdayOf,
  type RoutineGoal,
  type Weekday,
} from "../../features/practice/plan";
import { formatScore, routineProgress } from "../../features/routines/progress";
import { parseDateKey } from "../../utils/date";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const scoringFor = (kind: RoutineGoal["kind"]): Routine["scoring_type"] =>
  kind === "time" ? "time" : kind === "percent" ? "percentage" : "points";

const GoalRow = ({ goal }: { goal: RoutineGoal }) => {
  const { colors } = useAppTheme();
  const entries = useRoutineScoresStore((state) => state.entries);
  const logs = useSessionsStore((state) => state.logs);
  const routine = useRoutinesStore((state) => state.getRoutineById(goal.routineId));
  const status = useMemo(
    () =>
      goalStatus(
        goal,
        routineProgress(
          {
            id: goal.routineId,
            scoring_type: routine?.scoring_type ?? scoringFor(goal.kind),
            max_score: routine?.max_score,
          },
          entries,
          logs
        )
      ),
    [goal, routine, entries, logs]
  );

  const reached = status.reachedAt !== null;
  const deadline = goal.deadline
    ? parseDateKey(goal.deadline).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;
  const when = reached
    ? `Reached ${new Date(status.reachedAt!).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : status.daysLeft === null
      ? "No deadline"
      : status.daysLeft < 0
        ? `Deadline passed (${deadline})`
        : status.daysLeft === 0
          ? "Due today"
          : `By ${deadline}, ${status.daysLeft} ${status.daysLeft === 1 ? "day" : "days"} left`;

  return (
    <View
      style={[styles.goal, { backgroundColor: colors.surface, borderColor: reached ? colors.primary : colors.border }]}
    >
      <View style={styles.goalHead}>
        <Text style={[styles.goalName, { color: colors.text }]} numberOfLines={1}>
          {routine?.name ?? goal.routineName}
        </Text>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.goalTarget, { color: colors.text }]}>
          {goal.kind === "time" ? "Under " : ""}
          {formatScore(goal.target, goal.kind)}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
        <View
          style={[
            styles.fill,
            { width: `${Math.round(status.fraction * 100)}%`, backgroundColor: reached ? colors.primary : colors.text },
          ]}
        />
      </View>
      <View style={styles.goalFoot}>
        <Text style={[styles.goalNote, { color: colors.textMuted }]}>
          {status.best === null ? "No scores yet" : `Best ${formatScore(status.best, goal.kind)}`}
        </Text>
        <View style={styles.whenRow}>
          {reached ? <MaterialCommunityIcons name="flag-checkered" size={14} color={colors.primary} /> : null}
          <Text
            style={[
              styles.goalNote,
              {
                color: reached
                  ? colors.primary
                  : status.daysLeft !== null && status.daysLeft < 0
                    ? colors.danger
                    : colors.textMuted,
              },
            ]}
          >
            {when}
          </Text>
        </View>
      </View>
    </View>
  );
};

/** The week the player means to practise, how many days they aim for, and their goals. */
export const PracticePlanScreen = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const plan = usePracticePlanStore((state) => state.plan);
  const setDay = usePracticePlanStore((state) => state.setDay);
  const setWeeklyTarget = usePracticePlanStore((state) => state.setWeeklyTarget);
  const removeGoal = usePracticePlanStore((state) => state.removeGoal);
  const templates = useSessionsStore((state) => state.templates);
  const result = useStreaks();
  const [editing, setEditing] = useState<Weekday>(() => weekdayOf(new Date()));

  const templateName = (id: string) => templates.find((template) => template.id === id)?.name;
  const planned = plan.days.find((day) => day.day === editing);

  const Option = ({
    label,
    hint,
    selected,
    onPress,
  }: {
    label: string;
    hint?: string;
    selected: boolean;
    onPress: () => void;
  }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.option,
        {
          borderColor: selected ? colors.primary : colors.border,
          backgroundColor: selected ? colors.primary + "14" : colors.surface,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={selected ? "radiobox-marked" : "radiobox-blank"}
        size={20}
        color={selected ? colors.primary : colors.textMuted}
      />
      <View style={styles.optionText}>
        <Text style={[styles.optionLabel, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? <Text style={[styles.optionHint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
    </Pressable>
  );

  const Stepper = ({
    icon,
    onPress,
    disabled,
    label,
  }: {
    icon: "minus" | "plus";
    onPress: () => void;
    disabled: boolean;
    label: string;
  }) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.stepper,
        { borderColor: colors.border, backgroundColor: colors.surface, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
    </Pressable>
  );

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <WeekCard
        templateName={templateName}
        onStart={(templateId) => navigation.navigate("ActiveSession", { templateId })}
      />
      <Text style={[styles.best, { color: colors.textMuted }]}>
        Best so far: {result.bestDays} {result.bestDays === 1 ? "day" : "days"} in a row, {result.bestWeeks}{" "}
        {result.bestWeeks === 1 ? "week" : "weeks"} on target.
      </Text>

      {/* The weekly target */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Weekly target</Text>
        <View style={styles.targetRow}>
          <Stepper
            icon="minus"
            label="One day fewer"
            disabled={plan.weeklyTarget <= 1}
            onPress={() => setWeeklyTarget(plan.weeklyTarget - 1)}
          />
          <View style={styles.targetValue}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.targetNumber, { color: colors.text }]}>
              {plan.weeklyTarget}
            </Text>
            <Text style={[styles.optionHint, { color: colors.textMuted }]}>
              {plan.weeklyTarget === 1 ? "day a week" : "days a week"}
            </Text>
          </View>
          <Stepper
            icon="plus"
            label="One day more"
            disabled={plan.weeklyTarget >= 7}
            onPress={() => setWeeklyTarget(plan.weeklyTarget + 1)}
          />
        </View>
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>
          Any day with a session or a routine score counts. Reach the target each week to build your week streak.
        </Text>
      </View>

      {/* The days */}
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>Plan your week</Text>
        <View style={styles.dayTabs} accessibilityRole="tablist">
          {WEEKDAY_SHORT.map((label, index) => {
            const day = index as Weekday;
            const selected = day === editing;
            const isPlanned = plan.days.some((item) => item.day === day);
            return (
              <Pressable
                key={label}
                onPress={() => setEditing(day)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                accessibilityLabel={`${WEEKDAY_LONG[day]}${isPlanned ? ", planned" : ""}`}
                style={[
                  styles.dayTab,
                  {
                    backgroundColor: selected
                      ? colors.primary
                      : isPlanned
                        ? colors.primary + "1F"
                        : colors.surfaceMuted,
                  },
                ]}
              >
                <Text
                  maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                  style={[styles.dayTabText, { color: selected ? colors.onPrimary : colors.text }]}
                >
                  {label.slice(0, 2)}
                </Text>
                <View
                  style={[
                    styles.dayTabDot,
                    { backgroundColor: isPlanned ? (selected ? colors.onPrimary : colors.primary) : "transparent" },
                  ]}
                />
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.dayTitle, { color: colors.text }]}>{WEEKDAY_LONG[editing]}</Text>
        <View style={styles.options}>
          <Option label="Rest day" selected={!planned} onPress={() => setDay(editing, undefined)} />
          <Option
            label="Any practice"
            hint="A session, or any routine"
            selected={planned?.templateId === null}
            onPress={() => setDay(editing, null)}
          />
          {templates.map((template) => (
            <Option
              key={template.id}
              label={template.name}
              hint={`${template.routine_ids.length} ${template.routine_ids.length === 1 ? "routine" : "routines"}`}
              selected={planned?.templateId === template.id}
              onPress={() => setDay(editing, template.id)}
            />
          ))}
        </View>
        {templates.length === 0 ? (
          <Text style={[styles.cardHint, { color: colors.textMuted }]}>
            Make a session preset to plan exactly what to practise on a day.
          </Text>
        ) : null}
      </View>

      {/* Goals */}
      <View style={styles.goalsHead}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Goals</Text>
        <Pressable
          onPress={() => navigation.navigate("NewGoal")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.addGoal, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="plus" size={18} color={colors.onPrimary} />
          <Text style={[styles.addGoalText, { color: colors.onPrimary }]}>Add goal</Text>
        </Pressable>
      </View>
      {plan.goals.length === 0 ? (
        <Text style={[styles.cardHint, { color: colors.textMuted }]}>
          Set a score to reach on a routine, with a date if you like. Your progress shows here as you record scores.
        </Text>
      ) : (
        plan.goals.map((goal) => (
          <SwipeToDelete key={goal.id} onDelete={() => removeGoal(goal.id)} deleteLabel="Delete goal">
            <GoalRow goal={goal} />
          </SwipeToDelete>
        ))
      )}
      {plan.goals.length ? (
        <Text style={[styles.swipeHint, { color: colors.textMuted }]}>Swipe a goal left to delete it.</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.md },
  best: { fontSize: 13, textAlign: "center", marginTop: -SPACING.xs },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  cardHint: { fontSize: 13, lineHeight: 18 },
  targetRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: SPACING.lg },
  targetValue: { alignItems: "center", minWidth: 96 },
  targetNumber: { fontFamily: FONTS.boardHeavy, fontSize: 48, lineHeight: 52 },
  stepper: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  dayTabs: { flexDirection: "row", gap: 4 },
  dayTab: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
  },
  dayTabText: { fontFamily: FONTS.boardLabel, fontSize: 15, letterSpacing: 0.5 },
  dayTabDot: { width: 5, height: 5, borderRadius: 3 },
  dayTitle: { fontSize: 15, fontWeight: "800" },
  options: { gap: SPACING.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  optionText: { flex: 1, minWidth: 0 },
  optionLabel: { fontSize: 15, fontWeight: "700" },
  optionHint: { fontSize: 12 },
  goalsHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SPACING.sm },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  addGoal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 36,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  addGoalText: { fontSize: 14, fontWeight: "800" },
  goal: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  goalHead: { flexDirection: "row", alignItems: "baseline", gap: SPACING.sm },
  goalName: { flex: 1, fontSize: 15, fontWeight: "800" },
  goalTarget: { fontFamily: FONTS.board, fontSize: 22 },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
  goalFoot: { flexDirection: "row", justifyContent: "space-between", flexWrap: "wrap", gap: SPACING.sm },
  whenRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  goalNote: { fontSize: 12, fontWeight: "600" },
  swipeHint: { fontSize: 12, textAlign: "center" },
});
