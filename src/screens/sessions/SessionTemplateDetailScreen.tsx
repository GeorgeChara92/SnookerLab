import React, { useMemo } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useRoutinesStore, useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

export const SessionTemplateDetailScreen = () => {
  const route = useRoute<RouteProp<SessionsStackParamList, "SessionTemplateDetail">>();
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templateId } = route.params;

  const { getTemplateById, getLogsForTemplate, deleteSessionLog } = useSessionsStore();
  const { getRoutineById } = useRoutinesStore();
  const { colors } = useAppTheme();

  const template = getTemplateById(templateId);
  const logs = getLogsForTemplate(templateId);

  const routineNames = useMemo(
    () => (template?.routine_ids ?? []).map((id) => getRoutineById(id)?.name ?? "Unknown Routine"),
    [template?.routine_ids, getRoutineById]
  );

  if (!template) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>Session preset not found.</Text>
      </View>
    );
  }

  const confirmDeleteLog = (logId: string) => {
    Alert.alert("Delete Practice Date", "Remove this session log entry?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteSessionLog(logId) },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>🎯 {template.name}</Text>
        {template.notes ? <Text style={[styles.notes, { color: colors.textMuted }]}>{template.notes}</Text> : null}
        <Text style={[styles.sectionLabel, { color: colors.text }]}>Preset Routines</Text>
        {routineNames.map((name, idx) => (
          <Text key={`${name}-${idx}`} style={[styles.routineItem, { color: colors.textMuted }]}>• {name}</Text>
        ))}
        <View style={styles.actionsRow}>
          <Pressable style={[styles.startButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate("ActiveSession", { templateId })}>
            <Text style={[styles.startButtonText, { color: colors.onPrimary }]}>Start Session</Text>
          </Pressable>
          <Pressable style={[styles.editButton, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => navigation.navigate("SessionSetup", { templateId })}>
            <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit Preset</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.logsHeading, { color: colors.text }]}>Practice Dates</Text>
      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.logsList}
        ListEmptyComponent={<Text style={[styles.empty, { color: colors.textMuted }]}>No sessions logged yet for this preset.</Text>}
        renderItem={({ item }) => (
          <View style={[styles.logCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.logTop}>
              <Text style={[styles.logDate, { color: colors.text }]}>📅 {new Date(item.date).toLocaleDateString()}</Text>
              <Pressable onPress={() => confirmDeleteLog(item.id)}>
                <Text style={[styles.deleteLog, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
            {item.results.map((result) => (
              <Text key={`${item.id}-${result.routine_id}`} style={[styles.logResult, { color: colors.textMuted }]}>
                • {getRoutineById(result.routine_id)?.name ?? "Routine"}: {result.score || "-"}
                {result.notes ? ` (${result.notes})` : ""}
              </Text>
            ))}
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  headerCard: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  title: { fontSize: 20, fontWeight: "800" },
  notes: { marginTop: 6, fontSize: 13 },
  sectionLabel: { marginTop: 10, fontWeight: "700", fontSize: 13 },
  routineItem: { marginTop: 4, fontSize: 13 },
  actionsRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  startButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  startButtonText: { fontWeight: "700" },
  editButton: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", borderWidth: 1 },
  editButtonText: { fontWeight: "700" },
  logsHeading: { marginTop: 14, marginBottom: 8, fontWeight: "800", fontSize: 16 },
  logsList: { paddingBottom: 20 },
  logCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  logTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logDate: { fontWeight: "700" },
  deleteLog: { fontSize: 12, fontWeight: "700" },
  logResult: { marginTop: 6, fontSize: 13 },
  empty: { textAlign: "center", marginTop: 20 },
});
