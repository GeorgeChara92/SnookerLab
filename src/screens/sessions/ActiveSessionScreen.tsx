import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  LayoutAnimation,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { ScoringType, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const getQuickScores = (scoringType: ScoringType, maxScore?: number) => {
  const scoreMax = maxScore && maxScore > 0 ? maxScore : undefined;

  if (scoringType === "percentage") {
    return ["0%", "25%", "50%", "75%", "100%"].map((value) => ({ label: value, value }));
  }

  if (scoringType === "points") {
    if (scoreMax) {
      return [0, 0.25, 0.5, 0.75, 1]
        .map((fraction) => Math.round(scoreMax * fraction))
        .map((points) => ({ label: `${points}`, value: `${points}` }));
    }
    return [0, 25, 50, 75, 100].map((points) => ({ label: `${points}`, value: `${points}` }));
  }

  if (scoringType === "count") {
    const total = scoreMax ?? 10;
    return [0, 0.25, 0.5, 0.75, 1]
      .map((fraction) => Math.max(0, Math.round(total * fraction)))
      .map((made) => ({ label: `${made}`, value: `${made}/${total}` }));
  }

  if (scoringType === "time") {
    return ["05:00", "10:00", "15:00", "20:00"].map((value) => ({ label: value, value }));
  }

  return [0, 5, 10, 15].map((value) => ({ label: `${value}`, value: `${value}` }));
};

const getCustomPlaceholder = (scoringType: ScoringType) => {
  switch (scoringType) {
    case "points":
      return "Enter points total";
    case "percentage":
      return "Enter % or made/attempts";
    case "count":
      return "Enter completed count";
    case "time":
      return "Enter time (mm:ss)";
    default:
      return "Enter score";
  }
};

/** What the quick buttons are counting, said plainly. */
const getScoringIndicator = (scoringType: ScoringType, maxScore?: number) => {
  const base =
    scoringType === "points"
      ? "Points"
      : scoringType === "percentage"
        ? "Success rate"
        : scoringType === "count"
          ? "Pots made"
          : "Time";
  return maxScore && maxScore > 0 ? `${base} out of ${maxScore}` : base;
};

const sanitizeScoreInput = (value: string, scoringType: ScoringType, maxScore?: number) => {
  const trimmed = value.trim();
  if (trimmed.length === 0) return "";

  if (scoringType === "points" || scoringType === "count") {
    if (scoringType === "count") {
      const fractionMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
      if (fractionMatch) {
        const made = Number(fractionMatch[1]);
        let total = Number(fractionMatch[2]);
        if (!Number.isFinite(made) || !Number.isFinite(total) || total <= 0) return value;
        if (maxScore && maxScore > 0) total = maxScore;
        const clampedMade = Math.max(0, Math.min(made, total));
        return `${clampedMade}/${total}`;
      }
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) return value;
    if (maxScore && maxScore > 0) {
      return `${Math.min(parsed, maxScore)}`;
    }
    return `${parsed}`;
  }

  if (scoringType === "percentage") {
    const fractionMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/);
    if (fractionMatch) {
      return `${fractionMatch[1]}/${fractionMatch[2]}`;
    }
    const numeric = Number(trimmed.replace("%", ""));
    if (Number.isFinite(numeric)) {
      return `${Math.max(0, Math.min(100, numeric))}%`;
    }
  }

  return value;
};

export const ActiveSessionScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "ActiveSession">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templateId } = route.params;

  const {
    getTemplateById,
    startSession,
    activeTemplateId,
    activeDate,
    activeResults,
    updateActiveResult,
    saveActiveSession,
  } = useSessionsStore();
  const { getRoutineById } = useRoutinesStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const [isSaving, setIsSaving] = useState(false);
  /** One drill is open at a time: the one being played. The rest sit as one-line rows. */
  const [openDrillId, setOpenDrillId] = useState<string | null>(null);
  const [showNotesFor, setShowNotesFor] = useState<Record<string, boolean>>({});
  const progressAnim = useRef(new Animated.Value(0)).current;

  const template = getTemplateById(templateId);

  useEffect(() => {
    if (activeTemplateId !== templateId || !activeResults.length) {
      startSession(templateId, route.params.date);
    }
  }, [templateId]);

  const completedCount = activeResults.filter((result) => result.score.trim().length > 0).length;
  const totalRoutines = activeResults.length;
  const progress = totalRoutines > 0 ? completedCount / totalRoutines : 0;

  // Open the first drill still to be scored, once the session has loaded.
  useEffect(() => {
    if (openDrillId || !activeResults.length) return;
    const next = activeResults.find((result) => !result.score.trim().length) ?? activeResults[0];
    setOpenDrillId(next.routine_id);
  }, [activeResults, openDrillId]);

  useEffect(() => {
    Animated.timing(progressAnim, { toValue: progress, duration: 320, useNativeDriver: false }).start();
  }, [progress, progressAnim]);

  const openDrill = (routineId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDrillId((current) => (current === routineId ? null : routineId));
  };

  const handleScoreSelect = (routineId: string, score: string) => {
    updateActiveResult(routineId, { score });

    // Scoring a drill with one tap should hand you the next one, not leave you scrolling.
    const remaining = activeResults.filter(
      (result) => result.routine_id !== routineId && !result.score.trim().length
    );

    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenDrillId(remaining.length ? remaining[0].routine_id : null);
  };

  const toggleNotes = (routineId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setShowNotesFor((prev) => ({ ...prev, [routineId]: !prev[routineId] }));
  };

  const handleComplete = async () => {
    try {
      setIsSaving(true);
      await saveActiveSession();
      dialog.alert({
        title: "Session saved",
        message:
          completedCount === totalRoutines
            ? "Every drill is in. It is on this session's history now."
            : `${completedCount} of ${totalRoutines} drills scored. It is on this session's history now.`,
        tone: "success",
        icon: "check-circle-outline",
        confirmLabel: "Done",
        onConfirm: () => navigation.navigate("SessionTemplateDetail", { templateId }),
      });
    } catch (error) {
      dialog.alert({
        title: "Save failed",
        message: "Could not save your session results. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const sessionDate = useMemo(
    () => new Date(activeDate).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }),
    [activeDate]
  );

  if (!template) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.missing, { color: colors.textMuted }]}>Session preset not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <View style={styles.headerText}>
            <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
              {template.name}
            </Text>
            <Text style={[styles.headerDate, { color: colors.textMuted }]}>{sessionDate}</Text>
          </View>
          <Text style={[styles.headerCount, { color: completedCount ? colors.primary : colors.textMuted }]}>
            {completedCount}/{totalRoutines}
          </Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: colors.surfaceMuted }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: colors.primary,
                width: progressAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
              },
            ]}
          />
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {activeResults.map((result, index) => {
          const routine = getRoutineById(result.routine_id);
          const scoringType = (routine?.scoring_type ?? "count") as ScoringType;
          const quickScores = getQuickScores(scoringType, routine?.max_score);
          const hasScore = result.score.trim().length > 0;
          const isOpen = openDrillId === result.routine_id;
          const notesOpen = showNotesFor[result.routine_id];

          return (
            <View
              key={result.routine_id}
              style={[
                styles.drillCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isOpen ? colors.primary : colors.border,
                },
              ]}
            >
              <Pressable
                onPress={() => openDrill(result.routine_id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${routine?.name ?? "Routine"}, ${hasScore ? `scored ${result.score}` : "not scored yet"}`}
                style={styles.drillHeader}
              >
                <View
                  style={[
                    styles.drillNumber,
                    {
                      backgroundColor: hasScore ? colors.primary : colors.surfaceMuted,
                      borderColor: hasScore ? colors.primary : colors.border,
                    },
                  ]}
                >
                  {hasScore ? (
                    <MaterialCommunityIcons name="check" size={16} color={colors.onPrimary} />
                  ) : (
                    <Text style={[styles.drillNumberText, { color: colors.textMuted }]}>{index + 1}</Text>
                  )}
                </View>

                <View style={styles.drillTitleWrap}>
                  <Text style={[styles.drillName, { color: colors.text }]} numberOfLines={1}>
                    {routine?.name ?? "Routine"}
                  </Text>
                  <Text style={[styles.drillMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {getScoringIndicator(scoringType, routine?.max_score)}
                  </Text>
                </View>

                {hasScore ? (
                  <View style={[styles.scorePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                    <Text style={[styles.scorePillText, { color: colors.primary }]}>{result.score}</Text>
                  </View>
                ) : null}

                <MaterialCommunityIcons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.drillBody}>
                  <View style={styles.quickScores}>
                    {quickScores.map((quick) => {
                      const selected = result.score === quick.value;
                      return (
                        <Pressable
                          key={quick.value}
                          onPress={() => handleScoreSelect(result.routine_id, quick.value)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          accessibilityLabel={`Score ${quick.value}`}
                          style={[
                            styles.quickScore,
                            {
                              borderColor: selected ? colors.primary : colors.border,
                              backgroundColor: selected ? colors.primary : colors.surfaceMuted,
                            },
                          ]}
                        >
                          <Text
                            style={[styles.quickScoreText, { color: selected ? colors.onPrimary : colors.text }]}
                          >
                            {quick.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  <View style={styles.entryRow}>
                    <TextInput
                      style={[
                        styles.scoreInput,
                        { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text },
                      ]}
                      placeholder={getCustomPlaceholder(scoringType)}
                      placeholderTextColor={colors.textMuted}
                      value={result.score}
                      onChangeText={(text) =>
                        updateActiveResult(result.routine_id, {
                          score: sanitizeScoreInput(text, scoringType, routine?.max_score),
                        })
                      }
                      keyboardType={scoringType === "time" ? "numbers-and-punctuation" : "default"}
                      accessibilityLabel={`Score for ${routine?.name ?? "this drill"}`}
                    />

                    <Pressable
                      onPress={() => toggleNotes(result.routine_id)}
                      accessibilityRole="button"
                      accessibilityState={{ expanded: !!notesOpen }}
                      accessibilityLabel={notesOpen ? "Hide the note" : "Add a note"}
                      style={[
                        styles.noteButton,
                        {
                          borderColor: notesOpen || result.notes ? colors.primary : colors.border,
                          backgroundColor: colors.surfaceMuted,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name="note-text-outline"
                        size={18}
                        color={notesOpen || result.notes ? colors.primary : colors.textMuted}
                      />
                    </Pressable>
                  </View>

                  {notesOpen ? (
                    <TextInput
                      style={[
                        styles.notesInput,
                        { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text },
                      ]}
                      placeholder="How did it feel? What went wrong?"
                      placeholderTextColor={colors.textMuted}
                      value={result.notes ?? ""}
                      onChangeText={(text) => updateActiveResult(result.routine_id, { notes: text })}
                      multiline
                      textAlignVertical="top"
                      accessibilityLabel={`Note for ${routine?.name ?? "this drill"}`}
                    />
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.actionInfo}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>
            {completedCount === totalRoutines && totalRoutines > 0
              ? "All drills scored"
              : `${completedCount} of ${totalRoutines} scored`}
          </Text>
          <Text style={[styles.actionHint, { color: colors.textMuted }]}>
            {completedCount === totalRoutines
              ? "Save it to your history"
              : "Unscored drills are saved as blank"}
          </Text>
        </View>

        <Pressable
          onPress={handleComplete}
          disabled={isSaving}
          accessibilityRole="button"
          accessibilityLabel="Save this session"
          accessibilityState={{ disabled: isSaving, busy: isSaving }}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : pressed ? 0.85 : 1 },
          ]}
        >
          <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Save session</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  missing: { textAlign: "center", marginTop: 40, fontSize: 14 },

  header: {
    borderBottomWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.md,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerDate: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  headerCount: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  progressTrack: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },

  scrollView: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  drillCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: "hidden",
  },
  drillHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 64,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  drillNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  drillNumberText: { fontSize: 13, fontWeight: "800" },
  drillTitleWrap: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: "700" },
  drillMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  scorePill: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  scorePillText: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },

  drillBody: {
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.md,
    gap: SPACING.sm,
  },
  quickScores: {
    flexDirection: "row",
    gap: SPACING.xs,
  },
  quickScore: {
    flex: 1,
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: 2,
  },
  quickScoreText: { fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] },

  entryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },
  scoreInput: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 15,
  },
  noteButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  notesInput: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
  },

  actionBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  actionInfo: { flex: 1 },
  actionTitle: { fontSize: 15, fontWeight: "800" },
  actionHint: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  saveButton: {
    minHeight: HIT_TARGET,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
  },
  saveButtonText: { fontSize: 15, fontWeight: "800" },
});
