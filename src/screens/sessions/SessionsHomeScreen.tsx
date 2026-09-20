import React, { useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSessionsStore } from "../../store";
import type { SessionsStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";

type TemplateWithStats = {
  id: string;
  name: string;
  notes?: string;
  routine_ids: string[];
  runs: number;
  latest?: string;
};

const formatLastPractised = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
};

const PresetCard = ({
  item,
  colors,
  onPress,
  onStart,
  onEdit,
  onDelete,
}: {
  item: TemplateWithStats;
  colors: ReturnType<typeof useAppTheme>["colors"];
  onPress: () => void;
  onStart: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) => {
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable
        style={styles.cardBody}
        onPress={onPress}
        android_ripple={{ color: colors.primary + "10" }}
      >
        <View style={styles.cardHeader}>
          <View style={styles.titleRow}>
            <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.chevron}>›</Text>
          </View>
          <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
            {item.routine_ids.length} routine{item.routine_ids.length !== 1 ? "s" : ""}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.primary }]}>{item.runs}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Sessions</Text>
          </View>
          <View style={styles.statCol}>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {item.latest ? formatLastPractised(item.latest) : "—"}
            </Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Last practiced</Text>
          </View>
          {item.runs > 0 && (
            <View style={styles.statCol}>
              <View style={[styles.historyBadge, { backgroundColor: colors.primary + "15" }]}>
                <Text style={[styles.historyBadgeText, { color: colors.primary }]}>View history</Text>
              </View>
            </View>
          )}
        </View>

        {item.runs === 0 && (
          <Text style={[styles.emptyHint, { color: colors.textMuted }]}>
            No sessions yet. Tap to view details.
          </Text>
        )}
      </Pressable>

      <View style={[styles.cardActions, { borderTopColor: colors.border }]}>
        <Pressable
          style={[styles.actionBtn, styles.startBtn, { backgroundColor: colors.primary }]}
          onPress={onStart}
        >
          <Text style={[styles.actionBtnText, { color: colors.onPrimary }]}>Start</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}
          onPress={onEdit}
        >
          <Text style={[styles.actionBtnText, { color: colors.text }]}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.surfaceMuted }]}
          onPress={onDelete}
        >
          <Text style={[styles.actionBtnText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
};

export const SessionsHomeScreen = () => {
  const navigation = useNavigation<NavigationProp<SessionsStackParamList>>();
  const { templates, logs, deleteTemplate } = useSessionsStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();

  const templateStats = useMemo<TemplateWithStats[]>(
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
    dialog.confirm({
      title: "Delete this preset?",
      message: "The preset and every practice date saved against it will be removed. This cannot be undone.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Delete preset",
      cancelLabel: "Keep it",
      onConfirm: async () => {
        try {
          await deleteTemplate(templateId);
        } catch (error) {
          dialog.alert({
            title: "Delete failed",
            message: "Could not delete this preset. Check your connection and try again.",
            tone: "danger",
            icon: "wifi-off",
            confirmLabel: "Try again",
          });
        }
      },
    });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("GuidedSessionBuilder")}
      >
        <Text style={styles.primaryButtonIcon}>+</Text>
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>New Practice Session</Text>
      </Pressable>

      <Pressable
        style={[styles.secondaryButton, { borderColor: colors.border }]}
        onPress={() => navigation.navigate("SessionSetup")}
      >
        <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Custom Preset</Text>
        <Text style={[styles.secondaryButtonHint, { color: colors.textMuted }]}>Build your own routine list</Text>
      </Pressable>

      <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>Your Presets</Text>

      <FlatList
        data={templateStats}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No presets yet</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Create a preset to quickly start practice sessions with your favourite routines.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <PresetCard
            item={item}
            colors={colors}
            onPress={() => navigation.navigate("SessionTemplateDetail", { templateId: item.id })}
            onStart={() => navigation.navigate("ActiveSession", { templateId: item.id })}
            onEdit={() => navigation.navigate("SessionSetup", { templateId: item.id })}
            onDelete={() => confirmDelete(item.id)}
          />
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  primaryButton: {
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    marginBottom: 12,
  },
  primaryButtonIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: "#FFF",
  },
  primaryButtonText: { fontWeight: "700", fontSize: 15 },
  secondaryButton: {
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  secondaryButtonText: { fontWeight: "600", fontSize: 14, textAlign: "center" },
  secondaryButtonHint: { fontSize: 12, textAlign: "center", marginTop: 2 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 12,
  },
  list: { paddingBottom: 24 },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  emptyText: { fontSize: 13, textAlign: "center", lineHeight: 18, paddingHorizontal: 20 },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  cardBody: {
    padding: 14,
  },
  cardHeader: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    marginRight: 8,
  },
  chevron: {
    fontSize: 20,
    fontWeight: "300",
    color: "#9CA3AF",
  },
  cardMeta: {
    fontSize: 12,
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: "row",
    alignItems: "flex-start",
    flexWrap: "wrap",
    gap: 12,
  },
  statCol: {
    minWidth: 80,
  },
  statValue: {
    fontSize: 18,
    fontWeight: "700",
  },
  statLabel: {
    fontSize: 11,
    marginTop: 2,
  },
  historyBadge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 4,
  },
  historyBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  emptyHint: {
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 8,
  },
  cardActions: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  startBtn: {},
  actionBtnText: { fontWeight: "700", fontSize: 13 },
});