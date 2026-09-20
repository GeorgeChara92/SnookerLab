import React, { useMemo, useState } from "react";
import { LayoutAnimation, Platform, Pressable, ScrollView, StyleSheet, Text, UIManager, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { Routine, SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FALLBACK_MINUTES = 5;

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
};

const scoringLabel = (routine?: Routine) => {
  if (!routine) return "";
  const base =
    routine.scoring_type === "points"
      ? "Points"
      : routine.scoring_type === "percentage"
        ? "Success rate"
        : routine.scoring_type === "count"
          ? "Pots made"
          : "Time";
  return routine.max_score && routine.max_score > 0 ? `${base} out of ${routine.max_score}` : base;
};

export const SessionTemplateDetailScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionTemplateDetail">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templateId } = route.params;

  const { getTemplateById, getLogsForTemplate, deleteSessionLog } = useSessionsStore();
  const { getRoutineById } = useRoutinesStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const [openLogId, setOpenLogId] = useState<string | null>(null);

  const template = getTemplateById(templateId);
  const logs = getLogsForTemplate(templateId);

  /** Each routine in the preset, with what it was scored last time it was played. */
  const routineRows = useMemo(
    () =>
      (template?.routine_ids ?? []).map((id) => {
        const routine = getRoutineById(id);
        const lastLog = logs.find((log) => log.results?.some((result) => result.routine_id === id && result.score));
        const lastScore = lastLog?.results.find((result) => result.routine_id === id)?.score;

        return {
          id,
          name: routine?.name ?? "Unknown routine",
          icon: routine?.icon ?? "🎱",
          meta: scoringLabel(routine),
          minutes: routine?.estimated_duration_minutes ?? FALLBACK_MINUTES,
          lastScore,
        };
      }),
    [template?.routine_ids, getRoutineById, logs]
  );

  const totalMinutes = routineRows.reduce((total, row) => total + row.minutes, 0);

  const stats = useMemo(() => {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return {
      totalSessions: logs.length,
      thisWeek: logs.filter((log) => new Date(log.date) >= weekAgo).length,
      lastPractised: logs[0]?.date,
    };
  }, [logs]);

  if (!template) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.missing, { color: colors.textMuted }]}>Session preset not found.</Text>
      </View>
    );
  }

  const confirmDeleteLog = (logId: string) => {
    dialog.confirm({
      title: "Delete this practice date?",
      message: "The scores logged on this date will be removed from the session's history. This cannot be undone.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete date",
      cancelLabel: "Keep it",
      onConfirm: () => deleteSessionLog(logId),
    });
  };

  const toggleLog = (logId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenLogId((current) => (current === logId ? null : logId));
  };

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.heroTitle, { color: colors.text }]}>{template.name}</Text>
        <Text style={[styles.heroMeta, { color: colors.textMuted }]}>
          {routineRows.length} {routineRows.length === 1 ? "routine" : "routines"} · about {totalMinutes} min
        </Text>
        {template.notes ? <Text style={[styles.heroNotes, { color: colors.textMuted }]}>{template.notes}</Text> : null}

        {/* Three zeroes say nothing. Until there is history, one line is honest and quieter. */}
        {logs.length ? (
          <View style={[styles.statsRow, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalSessions}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sessions</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]}>{stats.thisWeek}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>This week</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statValue, { color: colors.text }]} numberOfLines={1}>
                {stats.lastPractised ? formatDate(stats.lastPractised) : "—"}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Last played</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.firstRun, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="flag-outline" size={16} color={colors.textMuted} />
            <Text style={[styles.firstRunText, { color: colors.textMuted }]}>
              Not played yet. Start it and your scores land here.
            </Text>
          </View>
        )}

        <Pressable
          onPress={() => navigation.navigate("ActiveSession", { templateId })}
          accessibilityRole="button"
          accessibilityLabel="Start this session"
          style={({ pressed }) => [styles.startButton, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="play" size={20} color={colors.onPrimary} />
          <Text style={[styles.startButtonText, { color: colors.onPrimary }]}>Start session</Text>
        </Pressable>

        <Pressable
          onPress={() => navigation.navigate("SessionSetup", { templateId })}
          accessibilityRole="button"
          accessibilityLabel="Edit which routines are in this session"
          style={styles.editButton}
        >
          <Text style={[styles.editButtonText, { color: colors.textMuted }]}>Edit routines</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>THE ROUTINES</Text>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {routineRows.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No routines in this preset yet.</Text>
        ) : (
          routineRows.map((row, index) => (
            <View
              key={`${row.id}-${index}`}
              style={[
                styles.routineRow,
                index < routineRows.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : null,
              ]}
            >
              <View style={[styles.routineIndex, { backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.routineIndexText, { color: colors.textMuted }]}>{index + 1}</Text>
              </View>

              <View style={styles.routineText}>
                <Text style={[styles.routineName, { color: colors.text }]} numberOfLines={1}>
                  {row.name}
                </Text>
                <Text style={[styles.routineMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {row.meta} · about {row.minutes} min
                </Text>
              </View>

              {row.lastScore ? (
                <View style={[styles.lastScore, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                  <Text style={[styles.lastScoreText, { color: colors.primary }]}>{row.lastScore}</Text>
                </View>
              ) : null}
            </View>
          ))
        )}
      </View>

      <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>PRACTICE HISTORY</Text>

      {logs.length === 0 ? (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="history" size={24} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No sessions yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Play this preset and each date shows up here with the scores you logged.
          </Text>
        </View>
      ) : (
        logs.map((log) => {
          const scored = (log.results ?? []).filter((result) => result.score?.trim().length).length;
          const isOpen = openLogId === log.id;

          return (
            <View key={log.id} style={[styles.card, styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Pressable
                onPress={() => toggleLog(log.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                accessibilityLabel={`${formatDate(log.date)}, ${scored} of ${log.results?.length ?? 0} drills scored`}
                style={styles.logHeader}
              >
                <View style={styles.logText}>
                  <Text style={[styles.logDate, { color: colors.text }]}>{formatDate(log.date)}</Text>
                  <Text style={[styles.logMeta, { color: colors.textMuted }]}>
                    {scored} of {log.results?.length ?? 0} drills scored
                  </Text>
                </View>
                <MaterialCommunityIcons
                  name={isOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>

              {isOpen ? (
                <View style={styles.logBody}>
                  {(log.results ?? []).length === 0 ? (
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>Nothing was scored on this date.</Text>
                  ) : (
                    (log.results ?? []).map((result, index) => (
                      <View key={`${log.id}-${result.routine_id}-${index}`} style={styles.resultRow}>
                        <Text style={[styles.resultName, { color: colors.text }]} numberOfLines={1}>
                          {getRoutineById(result.routine_id)?.name ?? "Routine"}
                        </Text>
                        <Text style={[styles.resultScore, { color: result.score ? colors.primary : colors.textMuted }]}>
                          {result.score || "Not scored"}
                        </Text>
                      </View>
                    ))
                  )}

                  <Pressable
                    onPress={() => confirmDeleteLog(log.id)}
                    accessibilityRole="button"
                    accessibilityLabel={`Delete the practice on ${formatDate(log.date)}`}
                    style={styles.deleteRow}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={16} color={colors.danger} />
                    <Text style={[styles.deleteText, { color: colors.danger }]}>Delete this date</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  missing: { textAlign: "center", marginTop: 40, fontSize: 14 },

  hero: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  heroTitle: { fontSize: 22, fontWeight: "800" },
  heroMeta: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  heroNotes: { fontSize: 13, lineHeight: 19, marginTop: SPACING.sm },

  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  stat: { flex: 1, alignItems: "center", paddingHorizontal: SPACING.xs },
  statValue: { fontSize: 17, fontWeight: "800" },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.6, marginTop: 2, textTransform: "uppercase" },
  statDivider: { width: 1, alignSelf: "stretch" },

  firstRun: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    marginTop: SPACING.lg,
  },
  firstRunText: { flex: 1, fontSize: 12, fontWeight: "600", lineHeight: 17 },

  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 50,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  startButtonText: { fontSize: 16, fontWeight: "800" },
  editButton: {
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  editButtonText: { fontSize: 14, fontWeight: "700" },

  sectionHeading: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
  },

  card: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
  },
  emptyCard: {
    alignItems: "center",
    gap: SPACING.xs,
    paddingVertical: SPACING.xl,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700" },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: "center", paddingVertical: SPACING.md },

  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 60,
    paddingVertical: SPACING.sm,
  },
  routineIndex: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  routineIndexText: { fontSize: 12, fontWeight: "800" },
  routineText: { flex: 1 },
  routineName: { fontSize: 15, fontWeight: "700" },
  routineMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  lastScore: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  lastScoreText: { fontSize: 12, fontWeight: "800", fontVariant: ["tabular-nums"] },

  logCard: { marginBottom: SPACING.sm },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: 60,
  },
  logText: { flex: 1 },
  logDate: { fontSize: 15, fontWeight: "700" },
  logMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  logBody: { paddingBottom: SPACING.md },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingVertical: 6,
  },
  resultName: { flex: 1, fontSize: 13, fontWeight: "600" },
  resultScore: { fontSize: 13, fontWeight: "800", fontVariant: ["tabular-nums"] },
  deleteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    minHeight: HIT_TARGET,
  },
  deleteText: { fontSize: 13, fontWeight: "700" },
});
