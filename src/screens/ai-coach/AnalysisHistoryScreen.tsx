import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAIAnalysesStore } from "../../store";
import type { AICoachStackParamList, AnalysisType } from "../../types";
import { AnalysisRow } from "../../components/ai/AnalysisRow";
import { FONTS, RADIUS, SPACING } from "../../constants";
import { ANALYSIS_TYPES, ANALYSIS_TYPE_ORDER } from "../../features/ai/analysisLabels";

type StatusFilter = "all" | "ready" | "working" | "failed";

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "ready", label: "Ready" },
  { value: "working", label: "In progress" },
  { value: "failed", label: "Failed" },
];

export const AnalysisHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const { colors } = useAppTheme();
  const { analyses } = useAIAnalysesStore();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<AnalysisType | "all">("all");

  const sorted = useMemo(
    () => [...analyses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [analyses]
  );

  // Only offer the filters that would show something.
  const typesPresent = ANALYSIS_TYPE_ORDER.filter((type) => sorted.some((item) => item.analysis_type === type));
  const statusesPresent = STATUS_FILTERS.filter(
    (filter) =>
      filter.value === "all" ||
      sorted.some((item) =>
        filter.value === "ready"
          ? item.status === "completed"
          : filter.value === "failed"
            ? item.status === "failed"
            : item.status === "processing" || item.status === "pending"
      )
  );

  const filtered = sorted.filter((item) => {
    const statusOk =
      statusFilter === "all" ||
      (statusFilter === "ready" && item.status === "completed") ||
      (statusFilter === "failed" && item.status === "failed") ||
      (statusFilter === "working" && (item.status === "processing" || item.status === "pending"));
    const typeOk = typeFilter === "all" || item.analysis_type === typeFilter;
    return statusOk && typeOk;
  });

  const Chip = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {typesPresent.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="All types" selected={typeFilter === "all"} onPress={() => setTypeFilter("all")} />
          {typesPresent.map((type) => (
            <Chip
              key={type}
              label={ANALYSIS_TYPES[type].label}
              selected={typeFilter === type}
              onPress={() => setTypeFilter(type)}
            />
          ))}
        </ScrollView>
      ) : null}

      {statusesPresent.length > 2 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {statusesPresent.map((filter) => (
            <Chip
              key={filter.value}
              label={filter.label}
              selected={statusFilter === filter.value}
              onPress={() => setStatusFilter(filter.value)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Text style={[styles.count, { color: colors.textMuted }]}>
        {filtered.length} {filtered.length === 1 ? "REPORT" : "REPORTS"}
      </Text>

      {filtered.length ? (
        filtered.map((item) => (
          <AnalysisRow
            key={item.id}
            analysis={item}
            onPress={() => navigation.navigate("AnalysisDetail", { analysisId: item.id })}
          />
        ))
      ) : (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {sorted.length ? "Nothing matches those filters." : "No reports yet. Upload a clip from the AI Coach tab."}
          </Text>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  chips: { gap: SPACING.sm, paddingBottom: SPACING.sm },
  chip: {
    minHeight: 36,
    justifyContent: "center",
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
  },
  chipText: { fontSize: 13, fontWeight: "700" },
  count: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.6, marginVertical: SPACING.sm },
  empty: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
