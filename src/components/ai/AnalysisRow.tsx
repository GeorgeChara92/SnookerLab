import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { AIAnalysis } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS, RADIUS, SPACING } from "../../constants";
import { analysisDate, statusInfo, tagLabel, typeInfo } from "../../features/ai/analysisLabels";

/**
 * One analysis in a list: what kind, when, the tags it was filed under, and the first line of the
 * coach's summary. A finished report needs no badge; one still being analysed or one that failed
 * says so, because that is the only time the status tells you something.
 */
export const AnalysisRow = ({ analysis, onPress }: { analysis: AIAnalysis; onPress: () => void }) => {
  const { colors } = useAppTheme();
  const type = typeInfo(analysis.analysis_type);
  const status = statusInfo(analysis.status);
  const summary = analysis.report_json?.summary ?? analysis.feedback;
  const tags = (analysis.context_tags ?? []).map(tagLabel);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${type.label} analysis, ${analysisDate(analysis.created_at)}, ${status.label}`}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons name={type.icon} size={20} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            {type.label}
          </Text>
          <Text style={[styles.date, { color: colors.textMuted }]}>{analysisDate(analysis.created_at).toUpperCase()}</Text>
        </View>

        {tags.length ? (
          <Text style={[styles.tags, { color: colors.textMuted }]} numberOfLines={1}>
            {tags.join(" · ")}
          </Text>
        ) : null}

        {status.tone !== "ready" ? (
          <View style={styles.statusLine}>
            {status.tone === "working" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <MaterialCommunityIcons name="alert-circle-outline" size={14} color={colors.danger} />
            )}
            <Text style={[styles.status, { color: status.tone === "failed" ? colors.danger : colors.primary }]}>
              {status.label}
            </Text>
          </View>
        ) : summary ? (
          <Text style={[styles.summary, { color: colors.text }]} numberOfLines={2}>
            {summary}
          </Text>
        ) : null}
      </View>

      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSubtle} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, gap: 3 },
  titleLine: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: SPACING.sm },
  title: { flexShrink: 1, fontSize: 16, fontWeight: "700" },
  date: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1 },
  tags: { fontSize: 12, fontWeight: "600" },
  summary: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  statusLine: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  status: { fontSize: 13, fontWeight: "700" },
});
