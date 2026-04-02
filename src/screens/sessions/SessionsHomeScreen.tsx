import React, { useMemo } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

export const SessionsHomeScreen = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templates, logs, deleteTemplate } = useSessionsStore();
  const { colors } = useAppTheme();

  const templateStats = useMemo(
    () =>
      templates.map((template) => {
        const templateLogs = logs.filter((log) => log.template_id === template.id);
        return {
          ...template,
          runs: templateLogs.length,
          latest: templateLogs[0]?.date,
        };
      }),
    [templates, logs]
  );

  const confirmDelete = (templateId: string) => {
    Alert.alert("Delete Session Preset", "Delete this preset and all its saved practice dates?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteTemplate(templateId);
          } catch (error) {
            Alert.alert("Delete failed", "Could not delete this preset right now.");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Pressable style={[styles.newButton, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate("SessionSetup") }>
        <Text style={[styles.newButtonText, { color: colors.onPrimary }]}>+ Create Session Preset</Text>
      </Pressable>

      <FlatList
        data={templateStats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: colors.textMuted }]}>Create a preset session with your favourite routines 🎯</Text>
        }
        renderItem={({ item }) => (
          <Pressable
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => navigation.navigate("SessionTemplateDetail", { templateId: item.id })}
          >
            <Text style={[styles.title, { color: colors.text }]}>🗓️ {item.name}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Routines: {item.routine_ids.length}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Sessions Logged: {item.runs}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>Last Practiced: {item.latest ?? "Not yet"}</Text>

            <View style={styles.actionsRow}>
              <Pressable
                style={[styles.actionButton, styles.startButton, { backgroundColor: colors.surfaceMuted }]}
                onPress={() => navigation.navigate("ActiveSession", { templateId: item.id })}
              >
                <Text style={[styles.startButtonText, { color: colors.primaryStrong }]}>Start</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.editButton, { backgroundColor: colors.surfaceMuted }]}
                onPress={() => navigation.navigate("SessionSetup", { templateId: item.id })}
              >
                <Text style={[styles.editButtonText, { color: colors.primary }]}>Edit</Text>
              </Pressable>
              <Pressable
                style={[styles.actionButton, styles.deleteButton, { backgroundColor: colors.surfaceMuted }]}
                onPress={() => confirmDelete(item.id)}
              >
                <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete</Text>
              </Pressable>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  newButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  newButtonText: { fontWeight: "700", fontSize: 15 },
  list: { paddingTop: 14, paddingBottom: 20 },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  title: { fontSize: 16, fontWeight: "700" },
  meta: { marginTop: 4, fontSize: 13 },
  actionsRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  startButton: {},
  startButtonText: { fontWeight: "700" },
  editButton: {},
  editButtonText: { fontWeight: "700" },
  deleteButton: {},
  deleteButtonText: { fontWeight: "700" },
  empty: { textAlign: "center", marginTop: 24 },
});
