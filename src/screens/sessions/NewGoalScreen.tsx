import React, { useMemo, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { Routine, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import {
  useCustomRoutinesStore,
  usePracticePlanStore,
  useRoutineScoresStore,
  useRoutinesStore,
  useSessionsStore,
} from "../../store";
import { toRoutine } from "../../features/customRoutines/customRoutine";
import { formatScore, routineProgress, type RoutineProgress, type ScoreKind } from "../../features/routines/progress";
import { parseTarget } from "../../features/practice/plan";
import { addDays, toLocalDateKey } from "../../utils/date";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const DEADLINES: Array<{ label: string; days: number | null }> = [
  { label: "No date", days: null },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
  { label: "3 months", days: 91 },
];

const kindFor = (routine: Routine, progress: RoutineProgress): ScoreKind =>
  progress.points.length
    ? progress.kind
    : routine.scoring_type === "time"
      ? "time"
      : routine.scoring_type === "percentage"
        ? "percent"
        : "number";

/** Choosing a routine, then the score to reach on it and when by. */
export const NewGoalScreen = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const library = useRoutinesStore((state) => state.routines);
  const custom = useCustomRoutinesStore((state) => state.routines);
  const entries = useRoutineScoresStore((state) => state.entries);
  const logs = useSessionsStore((state) => state.logs);
  const addGoal = usePracticePlanStore((state) => state.addGoal);

  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Routine | null>(null);
  const [target, setTarget] = useState("");
  const [deadlineDays, setDeadlineDays] = useState<number | null>(30);
  const [error, setError] = useState<string | null>(null);

  // Routines that take a score, the ones the player has practised first.
  const rows = useMemo(() => {
    const routines = [...custom.map(toRoutine), ...library.filter((routine) => routine.content_type !== "guide")];
    const withProgress = routines.map((routine) => ({ routine, progress: routineProgress(routine, entries, logs) }));
    const needle = query.trim().toLowerCase();
    return withProgress
      .filter(({ routine }) => !needle || routine.name.toLowerCase().includes(needle))
      .sort(
        (a, b) =>
          (b.progress.latest?.at ?? "").localeCompare(a.progress.latest?.at ?? "") ||
          a.routine.name.localeCompare(b.routine.name)
      );
  }, [custom, library, entries, logs, query]);

  const progress = useMemo(() => (chosen ? routineProgress(chosen, entries, logs) : null), [chosen, entries, logs]);
  const kind = chosen && progress ? kindFor(chosen, progress) : "number";

  const save = () => {
    if (!chosen || !progress) return;
    const value = parseTarget(target, kind);
    if (value === null) {
      setError(
        kind === "time"
          ? "Enter a time as minutes and seconds, like 6:30."
          : kind === "percent"
            ? "Enter a percentage from 1 to 100."
            : "Enter a score above 0."
      );
      return;
    }
    if (kind === "number" && chosen.max_score && value > chosen.max_score) {
      setError(`The most you can score on this routine is ${chosen.max_score}.`);
      return;
    }
    const best = progress.best?.value;
    if (best !== undefined && (kind === "time" ? value >= best : value <= best)) {
      setError(
        `Your best is already ${formatScore(best, kind)}. Set a target ${kind === "time" ? "under" : "above"} it.`
      );
      return;
    }
    addGoal({
      routineId: chosen.id,
      routineName: chosen.name,
      target: value,
      kind,
      deadline: deadlineDays === null ? null : toLocalDateKey(addDays(new Date(), deadlineDays)),
    });
    navigation.goBack();
  };

  if (!chosen) {
    return (
      <View style={[styles.flex, { backgroundColor: colors.background }]}>
        <View style={styles.searchWrap}>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Find a routine"
              placeholderTextColor={colors.textMuted}
              style={[styles.searchInput, { color: colors.text }]}
              autoCorrect={false}
              returnKeyType="search"
            />
          </View>
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.routine.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: SPACING.lg, paddingBottom: insets.bottom + SPACING.xl }}
          ListEmptyComponent={
            <Text style={[styles.hint, { color: colors.textMuted }]}>No routines match “{query.trim()}”.</Text>
          }
          renderItem={({ item: { routine, progress: itemProgress } }) => (
            <Pressable
              onPress={() => {
                setChosen(routine);
                setError(null);
                setTarget("");
              }}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
            >
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                  {routine.name}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                  {itemProgress.best
                    ? `Best ${formatScore(itemProgress.best.value, itemProgress.kind)}`
                    : "No scores yet"}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
            </Pressable>
          )}
        />
      </View>
    );
  }

  const best = progress?.best;
  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          onPress={() => setChosen(null)}
          accessibilityRole="button"
          accessibilityLabel="Choose a different routine"
          style={[styles.chosen, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
              {chosen.name}
            </Text>
            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
              {best ? `Your best is ${formatScore(best.value, kind)}` : "No scores yet"}
              {chosen.max_score && kind === "number" ? `, out of ${chosen.max_score}` : ""}
            </Text>
          </View>
          <Text style={[styles.change, { color: colors.primary }]}>Change</Text>
        </Pressable>

        <Text style={[styles.label, { color: colors.text }]}>
          {kind === "time" ? "Time to beat" : kind === "percent" ? "Percentage to reach" : "Score to reach"}
        </Text>
        <TextInput
          value={target}
          onChangeText={(text) => {
            setTarget(text);
            setError(null);
          }}
          placeholder={
            kind === "time"
              ? best
                ? formatScore(Math.max(1, best.value - 15), "time")
                : "6:30"
              : best
                ? formatScore(Math.floor(best.value) + 1, kind).replace("%", "")
                : kind === "percent"
                  ? "80"
                  : "25"
          }
          placeholderTextColor={colors.textMuted}
          keyboardType={kind === "time" ? "numbers-and-punctuation" : "number-pad"}
          style={[
            styles.input,
            { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
          ]}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
        />
        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}

        <Text style={[styles.label, { color: colors.text }]}>By when</Text>
        <View style={styles.chips}>
          {DEADLINES.map((option) => {
            const selected = option.days === deadlineDays;
            return (
              <Pressable
                key={option.label}
                onPress={() => setDeadlineDays(option.days)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? colors.primary : colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={save}
          accessibilityRole="button"
          style={({ pressed }) => [styles.save, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="flag-checkered" size={20} color={colors.onPrimary} />
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>Set goal</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchWrap: { padding: SPACING.lg, paddingBottom: SPACING.sm },
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
  hint: { fontSize: 14, textAlign: "center", marginTop: SPACING.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: SPACING.sm,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontSize: 16, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  chosen: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  change: { fontSize: 14, fontWeight: "800" },
  label: { fontSize: 15, fontWeight: "800", marginTop: SPACING.sm },
  input: {
    minHeight: HIT_TARGET + 8,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 22,
    fontWeight: "700",
  },
  error: { fontSize: 13, fontWeight: "600", marginTop: -SPACING.xs },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: {
    minHeight: 40,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: { fontSize: 14, fontWeight: "700" },
  save: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  saveText: { fontSize: 16, fontWeight: "800" },
});
