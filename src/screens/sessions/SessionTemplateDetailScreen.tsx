import React, { useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";

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

export const SessionTemplateDetailScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionTemplateDetail">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templateId } = route.params;

  const { getTemplateById, getLogsForTemplate, deleteSessionLog } = useSessionsStore();
  const { getRoutineById } = useRoutinesStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const template = getTemplateById(templateId);
  const logs = getLogsForTemplate(templateId);

  const routineNames = useMemo(
    () => (template?.routine_ids ?? []).map((id) => getRoutineById(id)?.name ?? "Unknown Routine"),
    [template?.routine_ids, getRoutineById]
  );

  const stats = useMemo(() => {
    const totalSessions = logs.length;
    const lastPractised = logs[0]?.date;
    const thisWeek = logs.filter((log) => {
      const logDate = new Date(log.date);
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return logDate >= weekAgo;
    }).length;

    return {
      totalSessions,
      lastPractised,
      thisWeek,
    };
  }, [logs]);

  if (!template) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>Session preset not found.</Text>
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

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.text }]}>{template.name}</Text>
        {template.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>{template.notes}</Text> : null}

        <View style={[styles.statsRow, { backgroundColor: colors.surfaceMuted }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{stats.totalSessions}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total Sessions</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>{stats.thisWeek}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>This Week</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {stats.lastPractised ? formatDate(stats.lastPractised) : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Last Practiced</Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <Pressable
            style={[styles.startButton, { backgroundColor: colors.primary }]}
            onPress={() => navigation.navigate("ActiveSession", { templateId })}
          >
            <Text style={[styles.startButtonText, { color: colors.onPrimary }]}>Start Session</Text>
          </Pressable>
          <Pressable
            style={[styles.editButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            onPress={() => navigation.navigate("SessionSetup", { templateId })}
          >
            <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Preset</Text>
          </Pressable>
        </View>
      </View>

      <View style={[styles.routinesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Routines ({routineNames.length})</Text>
        {routineNames.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>No routines added to this preset.</Text>
        ) : (
          routineNames.map((name, idx) => (
            <View key={`${name}-${idx}`} style={styles.routineRow}>
              <Text style={[styles.routineNumber, { color: colors.primary }]}>{idx + 1}</Text>
              <Text style={[styles.routineName, { color: colors.text }]}>{name}</Text>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.logsHeading, { color: colors.text }]}>Practice History</Text>

      {logs.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No sessions yet</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Start this preset to begin tracking your practice history.
          </Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.logsList}
          renderItem={({ item }) => (
            <View style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.logHeader}>
                <Text style={[styles.logDate, { color: colors.text }]}>
                  {formatDate(item.date)}
                </Text>
                <Pressable onPress={() => confirmDeleteLog(item.id)} hitSlop={8}>
                  <Text style={[styles.deleteLog, { color: colors.danger }]}>Delete</Text>
                </Pressable>
              </View>
              {item.results && item.results.length > 0 ? (
                item.results.map((result, idx) => (
                  <View key={`${item.id}-${result.routine_id}-${idx}`} style={styles.resultRow}>
                    <Text style={[styles.resultDot, { color: colors.textMuted }]}>•</Text>
                    <Text style={[styles.resultName, { color: colors.text }]}>
                      {getRoutineById(result.routine_id)?.name ?? "Routine"}
                    </Text>
                    {result.score && <Text style={[styles.resultScore, { color: colors.primary }]}>{result.score}</Text>}
                  </View>
                ))
              ) : (
                <Text style={[styles.noResults, { color: colors.textMuted }]}>No results recorded</Text>
              )}
            </View>
          )}
        />
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 14,
    margin: 16,
    marginBottom: 12,
    padding: 16,
  },
  title: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  notes: { fontSize: 13, marginBottom: 12, lineHeight: 18 },
  statsRow: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 18, fontWeight: "700" },
  statLabel: { fontSize: 10, marginTop: 2, textTransform: "uppercase", letterSpacing: 0.3 },
  actionsRow: { flexDirection: "row", gap: 8 },
  startButton: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  startButtonText: { fontWeight: "700", fontSize: 15 },
  editButton: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  editButtonText: { fontWeight: "700", fontSize: 15 },
  routinesCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 14,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  emptyText: { fontSize: 13, lineHeight: 18 },
  emptyTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  routineRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(120,120,120,0.1)",
  },
  routineNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    textAlign: "center",
    lineHeight: 24,
    fontSize: 12,
    fontWeight: "700",
    marginRight: 10,
  },
  routineName: { fontSize: 14, flex: 1 },
  logsHeading: { fontSize: 16, fontWeight: "800", marginHorizontal: 16, marginBottom: 10 },
  logsList: { paddingHorizontal: 16, paddingBottom: 24 },
  emptyCard: {
    borderWidth: 1,
    borderRadius: 14,
    marginHorizontal: 16,
    padding: 20,
    alignItems: "center",
  },
  logCard: {
    borderWidth: 1,
    borderRadius: 12,
    marginBottom: 10,
    padding: 14,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  logDate: { fontSize: 14, fontWeight: "700" },
  deleteLog: { fontSize: 12, fontWeight: "600" },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
  },
  resultDot: { fontSize: 14, marginRight: 4 },
  resultName: { fontSize: 13, flex: 1 },
  resultScore: { fontSize: 13, fontWeight: "600" },
  noResults: { fontSize: 12, fontStyle: "italic" },
  empty: { textAlign: "center", marginTop: 40, fontSize: 14 },
});