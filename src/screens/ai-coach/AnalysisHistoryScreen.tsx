import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppCard } from "../../components/ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAIAnalysesStore } from "../../store";
import type { AICoachStackParamList, AnalysisStatus, AnalysisType } from "../../types";

const STATUS_FILTERS: { label: string; value: AnalysisStatus | "all" }[] = [
  { label: "All", value: "all" },
  { label: "Completed", value: "completed" },
  { label: "Processing", value: "processing" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

const TYPE_FILTERS: { label: string; value: AnalysisType | "all" }[] = [
  { label: "All types", value: "all" },
  { label: "Shot", value: "shot" },
  { label: "Stance", value: "stance" },
  { label: "Technique", value: "technique" },
  { label: "Tactical", value: "tactical" },
  { label: "Full session", value: "full_session" },
];

export const AnalysisHistoryScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const { colors } = useAppTheme();
  const { analyses } = useAIAnalysesStore();
  const [statusFilter, setStatusFilter] = useState<AnalysisStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<AnalysisType | "all">("all");

  const filtered = useMemo(() => {
    return analyses.filter((item) => {
      const statusOk = statusFilter === "all" || item.status === statusFilter;
      const typeOk = typeFilter === "all" || item.analysis_type === typeFilter;
      return statusOk && typeOk;
    });
  }, [analyses, statusFilter, typeFilter]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Text style={[styles.title, { color: colors.text }]}>Analysis History</Text>
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>Filter by status and type to find previous reports quickly.</Text>

      <AppCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Status</Text>
        <View style={styles.chipsWrap}>
          {STATUS_FILTERS.map((filter) => {
            const selected = statusFilter === filter.value;
            return (
              <Pressable
                key={filter.value}
                onPress={() => setStatusFilter(filter.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>Type</Text>
        <View style={styles.chipsWrap}>
          {TYPE_FILTERS.map((filter) => {
            const selected = typeFilter === filter.value;
            return (
              <Pressable
                key={filter.value}
                onPress={() => setTypeFilter(filter.value)}
                style={[
                  styles.chip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>{filter.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </AppCard>

      <AppCard style={styles.card}>
        <View style={styles.resultsHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Results</Text>
          <Text style={[styles.resultsCount, { color: colors.textMuted }]}>{filtered.length} items</Text>
        </View>
        {filtered.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No analyses match the current filters.</Text>
        ) : (
          filtered.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate("AnalysisDetail", { analysisId: item.id })}
              style={[styles.row, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            >
              <View style={styles.rowMeta}>
                <Text style={[styles.rowType, { color: colors.text }]}>{item.analysis_type.replace("_", " ").toUpperCase()}</Text>
                <Text
                  style={[
                    styles.rowStatus,
                    { color: item.status === "completed" ? colors.primary : item.status === "failed" ? colors.danger : colors.textMuted },
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.rowDate, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
              {item.report_json?.summary ? (
                <Text style={[styles.rowSummary, { color: colors.text }]} numberOfLines={2}>{item.report_json.summary}</Text>
              ) : item.feedback ? (
                <Text style={[styles.rowSummary, { color: colors.text }]} numberOfLines={2}>{item.feedback}</Text>
              ) : null}
              <Text style={[styles.openHint, { color: colors.primary }]}>Open analysis</Text>
            </Pressable>
          ))
        )}
      </AppCard>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 6, marginBottom: 14, lineHeight: 20 },
  card: { marginBottom: 12 },
  sectionTitle: { fontSize: 14, fontWeight: "800", marginBottom: 8, marginTop: 4 },
  resultsHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  resultsCount: { fontSize: 12, fontWeight: "700" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  chipText: { fontSize: 12, fontWeight: "700" },
  empty: { fontSize: 13 },
  row: { borderWidth: 1, borderRadius: 10, padding: 10, marginTop: 8 },
  rowMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowType: { fontSize: 12, fontWeight: "800" },
  rowStatus: { fontSize: 11, fontWeight: "700" },
  rowDate: { marginTop: 4, fontSize: 11 },
  rowSummary: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  openHint: { marginTop: 8, fontSize: 12, fontWeight: "700" },
});
