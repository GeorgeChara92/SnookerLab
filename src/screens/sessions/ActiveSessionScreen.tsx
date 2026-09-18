import React, { useEffect, useState, useRef } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { ScoringType, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

const getQuickScores = (scoringType: ScoringType, maxScore?: number) => {
  const scoreMax = maxScore && maxScore > 0 ? maxScore : undefined;

  if (scoringType === "percentage") {
    return [
      { label: "0%", value: "0%" },
      { label: "25%", value: "25%" },
      { label: "50%", value: "50%" },
      { label: "75%", value: "75%" },
      { label: "100%", value: "100%" },
    ];
  }

  if (scoringType === "points") {
    if (scoreMax) {
      const q1 = Math.round(scoreMax * 0.25);
      const q2 = Math.round(scoreMax * 0.5);
      const q3 = Math.round(scoreMax * 0.75);
      return [
        { label: `0/${scoreMax}`, value: "0" },
        { label: `${q1} pts`, value: `${q1}` },
        { label: `${q2} pts`, value: `${q2}` },
        { label: `${q3} pts`, value: `${q3}` },
        { label: `${scoreMax} pts`, value: `${scoreMax}` },
      ];
    }
    return [
      { label: "0", value: "0" },
      { label: "25", value: "25" },
      { label: "50", value: "50" },
      { label: "20 pts", value: "20" },
      { label: "75", value: "75" },
      { label: "100", value: "100" },
    ];
  }

  if (scoringType === "count") {
    if (scoreMax) {
      const q1 = Math.max(0, Math.round(scoreMax * 0.25));
      const q2 = Math.max(0, Math.round(scoreMax * 0.5));
      const q3 = Math.max(0, Math.round(scoreMax * 0.75));
      return [
        { label: `0/${scoreMax}`, value: `0/${scoreMax}` },
        { label: `${q1}/${scoreMax}`, value: `${q1}/${scoreMax}` },
        { label: `${q2}/${scoreMax}`, value: `${q2}/${scoreMax}` },
        { label: `${q3}/${scoreMax}`, value: `${q3}/${scoreMax}` },
        { label: `${scoreMax}/${scoreMax}`, value: `${scoreMax}/${scoreMax}` },
      ];
    }
    return [
      { label: "0/10", value: "0/10" },
      { label: "3/10", value: "3/10" },
      { label: "5/10", value: "5/10" },
      { label: "8/10", value: "8/10" },
      { label: "10/10", value: "10/10" },
    ];
  }

  if (scoringType === "time") {
    return [
      { label: "05:00", value: "05:00" },
      { label: "10:00", value: "10:00" },
      { label: "15:00", value: "15:00" },
      { label: "20:00", value: "20:00" },
    ];
  }

  return [
    { label: "0", value: "0" },
    { label: "5", value: "5" },
    { label: "10", value: "10" },
    { label: "15", value: "15" },
  ];
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

const getScoringIndicator = (scoringType: ScoringType, maxScore?: number) => {
  const base =
    scoringType === "points"
      ? "Points"
      : scoringType === "percentage"
        ? "Percentage"
        : scoringType === "count"
          ? "Count"
          : "Time";
  return maxScore && maxScore > 0 ? `${base} (max ${maxScore})` : base;
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
  const [isSaving, setIsSaving] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({});
  const scrollRef = useRef<ScrollView>(null);
  const progressAnimations = useRef<Record<string, Animated.Value>>({}).current;

  const template = getTemplateById(templateId);

  useEffect(() => {
    if (activeTemplateId !== templateId || !activeResults.length) {
      startSession(templateId, route.params.date);
    }
  }, [templateId]);

  const completedCount = activeResults.filter((r) => r.score.trim().length > 0).length;
  const totalRoutines = activeResults.length;
  const progress = totalRoutines > 0 ? completedCount / totalRoutines : 0;

  const handleScoreSelect = (routineId: string, score: string) => {
    updateActiveResult(routineId, { score });
    
    if (!progressAnimations[routineId]) {
      progressAnimations[routineId] = new Animated.Value(0);
    }
    Animated.sequence([
      Animated.timing(progressAnimations[routineId], {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnimations[routineId], {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const toggleNotes = (routineId: string) => {
    setExpandedNotes((prev) => ({ ...prev, [routineId]: !prev[routineId] }));
  };

  const handleComplete = async () => {
    try {
      setIsSaving(true);
      await saveActiveSession();
      Alert.alert("Session Complete", "Your results have been saved.", [
        {
          text: "Done",
          onPress: () => navigation.navigate("SessionTemplateDetail", { templateId }),
        },
      ]);
    } catch (error) {
      Alert.alert("Save failed", "Could not save session results right now.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!template) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Session preset not found.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <View style={[styles.progressHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}> 
        <View style={styles.progressInfo}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>Progress</Text>
          <Text style={[styles.progressValue, { color: colors.text }]}>
            {completedCount} of {totalRoutines} drills
          </Text>
        </View>
        <View style={[styles.progressBar, { backgroundColor: colors.border }]}> 
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${progress * 100}%` }]} />
        </View>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.sessionHeader, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.sessionTitle, { color: colors.text }]}>{template.name}</Text>
          <Text style={[styles.sessionDate, { color: colors.textMuted }]}>
            {new Date(activeDate).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}
          </Text>
        </View>

        {activeResults.map((result, index) => {
          const routine = getRoutineById(result.routine_id);
          const scoringType = (routine?.scoring_type ?? "count") as ScoringType;
          const quickScores = getQuickScores(scoringType, routine?.max_score);
          const hasScore = result.score.trim().length > 0;
          const showNotes = expandedNotes[result.routine_id];

          if (!progressAnimations[result.routine_id]) {
            progressAnimations[result.routine_id] = new Animated.Value(0);
          }
          const scale = progressAnimations[result.routine_id].interpolate({
            inputRange: [0, 1],
            outputRange: [1, 1.02],
          });

          return (
            <Animated.View
              key={result.routine_id}
              style={[
                styles.drillCard,
                { backgroundColor: colors.surface, borderColor: hasScore ? colors.primary : colors.border, transform: [{ scale }] },
              ]}
            >
              <View style={styles.drillHeader}>
                <View style={styles.drillNumber}>
                  <Text style={[styles.drillNumberText, { color: hasScore ? colors.onPrimary : colors.textMuted }]}>
                    {index + 1}
                  </Text>
                </View>
                <View style={styles.drillTitleWrap}>
                  <Text style={[styles.drillName, { color: colors.text }]}>{routine?.name ?? "Routine"}</Text>
                  <Text style={[styles.drillMeta, { color: colors.textMuted }]}>
                    {getScoringIndicator(scoringType, routine?.max_score)}
                  </Text>
                  {hasScore && (
                    <Text style={[styles.drillScore, { color: colors.primary }]}>{result.score}</Text>
                  )}
                </View>
              </View>

              <View style={styles.quickScores}>
                {quickScores.map((qs) => {
                  const selected = result.score === qs.value;
                  return (
                    <Pressable
                      key={qs.value}
                      style={[
                        styles.quickScoreBtn,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.primary + "15" : colors.surfaceMuted,
                        },
                      ]}
                      onPress={() => handleScoreSelect(result.routine_id, qs.value)}
                    >
                      <Text style={[styles.quickScoreText, { color: selected ? colors.primary : colors.text }]}>{qs.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.customScoreRow}>
                <TextInput
                  style={[styles.customScoreInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  placeholder={getCustomPlaceholder(scoringType)}
                  placeholderTextColor={colors.textMuted}
                  value={result.score}
                  onChangeText={(text) =>
                    updateActiveResult(result.routine_id, {
                      score: sanitizeScoreInput(text, scoringType, routine?.max_score),
                    })
                  }
                  keyboardType={scoringType === "time" ? "numbers-and-punctuation" : "default"}
                />
              </View>

              <Pressable style={styles.notesToggle} onPress={() => toggleNotes(result.routine_id)}>
                <Text style={[styles.notesToggleText, { color: colors.textMuted }]}>
                  {showNotes ? "Hide notes" : "Add note"}
                </Text>
              </Pressable>

              {showNotes && (
                <TextInput
                  style={[styles.notesInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  placeholder="Optional notes..."
                  placeholderTextColor={colors.textMuted}
                  value={result.notes ?? ""}
                  onChangeText={(text) => updateActiveResult(result.routine_id, { notes: text })}
                  multiline
                  textAlignVertical="top"
                />
              )}
            </Animated.View>
          );
        })}
      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}> 
        <View style={styles.actionSummary}>
          <Text style={[styles.actionProgress, { color: colors.text }]}>
            {completedCount}/{totalRoutines} drills completed
          </Text>
          {completedCount < totalRoutines && (
            <Text style={[styles.actionHint, { color: colors.textMuted }]}>
              {totalRoutines - completedCount} remaining
            </Text>
          )}
        </View>
        <Pressable
          style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]}
          onPress={handleComplete}
          disabled={isSaving}
        >
          <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Save Session</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  progressLabel: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  progressValue: { fontSize: 14, fontWeight: "700" },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  scrollView: { flex: 1 },
  content: { padding: 16, paddingBottom: 100 },
  sessionHeader: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sessionTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  sessionDate: { fontSize: 13 },
  drillCard: {
    borderRadius: 14,
    borderWidth: 1.5,
    padding: 14,
    marginBottom: 10,
  },
  drillHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  drillNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0F5A43",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  drillNumberText: { fontSize: 13, fontWeight: "700" },
  drillTitleWrap: { flex: 1 },
  drillName: { fontSize: 15, fontWeight: "700" },
  drillMeta: { fontSize: 12, marginTop: 2 },
  drillScore: { fontSize: 13, marginTop: 2 },
  quickScores: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  quickScoreBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  quickScoreText: { fontSize: 13, fontWeight: "600" },
  customScoreRow: { marginBottom: 8 },
  customScoreInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  notesToggle: {
    paddingVertical: 6,
  },
  notesToggleText: { fontSize: 12, fontWeight: "600" },
  notesInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    minHeight: 60,
    marginTop: 4,
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    borderTopWidth: 1,
  },
  actionSummary: {
    marginBottom: 10,
  },
  actionProgress: { fontSize: 14, fontWeight: "700" },
  actionHint: { fontSize: 12, marginTop: 2 },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  saveButtonText: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 16, padding: 20, textAlign: "center" },
});
