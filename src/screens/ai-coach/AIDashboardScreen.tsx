import React, { useMemo } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppCard } from "../../components/ui/AppCard";
import { AppButton } from "../../components/ui/AppButton";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAIAnalysesStore } from "../../store";
import type { AICoachStackParamList } from "../../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TierPaywallModal } from "../../components/subscription";
import { useRef } from "react";

type AnalysisType = "stroke_analysis" | "alignment_check" | "technique_review";

const ANALYSIS_LABELS: Record<AnalysisType, { label: string; focus: string }> = {
  stroke_analysis: { label: "Stroke", focus: "cue action consistency" },
  alignment_check: { label: "Alignment", focus: "body and cue positioning" },
  technique_review: { label: "Technique", focus: "overall form" },
};

const getDaysSince = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const formatDateAgo = (dateStr: string): string => {
  const days = getDaysSince(dateStr);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

type FocusArea = {
  area: string;
  label: string;
  count: number;
  lastDate: string;
};

const deriveFocusAreas = (analyses: { analysis_type: string; created_at: string; status: string }[]): FocusArea[] => {
  const areaCounts: Record<string, { count: number; lastDate: string }> = {};

  analyses
    .filter((a) => a.status === "completed")
    .forEach((a) => {
      const type = a.analysis_type as AnalysisType;
      if (!areaCounts[type]) {
        areaCounts[type] = { count: 0, lastDate: a.created_at };
      }
      areaCounts[type].count += 1;
      if (a.created_at > areaCounts[type].lastDate) {
        areaCounts[type].lastDate = a.created_at;
      }
    });

  return Object.entries(areaCounts)
    .map(([type, data]) => ({
      area: type,
      label: ANALYSIS_LABELS[type as AnalysisType]?.label ?? type,
      count: data.count,
      lastDate: data.lastDate,
    }))
    .sort((a, b) => b.count - a.count);
};

const getCoachingState = (
  analyses: { analysis_type: string; created_at: string; status: string; report_json?: { improvements?: string[] } }[]
): { title: string; message: string; action?: string; greeting?: string } => {
  const completed = analyses.filter((a) => a.status === "completed");

  if (completed.length === 0) {
    return {
      title: "Start Your First Analysis",
      message: "Upload a clip to get personalised coaching feedback.",
      action: "Upload now",
      greeting: "Welcome",
    };
  }

  const latest = completed[0];
  const analysisType = latest.analysis_type as AnalysisType;
  const typeInfo = ANALYSIS_LABELS[analysisType] ?? { label: "Analysis", focus: "your game" };
  const daysSince = getDaysSince(latest.created_at);

  if (daysSince > 7) {
    return {
      title: "Time for a Check-in",
      message: `Your last ${typeInfo.label.toLowerCase()} analysis was ${daysSince} days ago.`,
      action: "Upload new clip",
      greeting: "Welcome back",
    };
  }

  if (completed.length === 1) {
    return {
      title: `Focus: ${typeInfo.label}`,
      message: `Based on your first analysis, work on ${typeInfo.focus}.`,
      greeting: "Good start",
    };
  }

  const focusAreas = deriveFocusAreas(completed);

  if (focusAreas.length > 0) {
    const topFocus = focusAreas[0];
    return {
      title: `Focus: ${topFocus.label}`,
      message: `You've analysed ${topFocus.label.toLowerCase()} ${topFocus.count}x. Keep refining.`,
      greeting: completed.length > 3 ? "Great progress" : "Keep going",
    };
  }

  return {
    title: "Continue Training",
    message: `${completed.length} analyses completed. Upload another to track progress.`,
    greeting: "Keep it up",
  };
};

const getImprovementTrend = (
  analyses: { status: string; report_json?: { improvements?: string[] } }[]
): { trend: "improving" | "stable" | "needs_work"; label: string } => {
  const completed = analyses.filter((a) => a.status === "completed" && a.report_json?.improvements);

  if (completed.length < 2) {
    return { trend: "stable", label: "Track progress with more analyses" };
  }

  const recent = completed.slice(0, 2);
  const avgImprovements = recent.reduce((sum, a) => sum + (a.report_json?.improvements?.length ?? 0), 0) / recent.length;

  if (avgImprovements <= 1) {
    return { trend: "improving", label: "Areas for improvement decreasing" };
  }
  if (avgImprovements >= 4) {
    return { trend: "needs_work", label: "Multiple areas to work on" };
  }
  return { trend: "stable", label: "Consistent feedback pattern" };
};

export const AIDashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { analyses } = useAIAnalysesStore();
  const { width } = useWindowDimensions();
  const [showPaywall, setShowPaywall] = React.useState(false);

  const contentOpacity = useRef(new Animated.Value(0)).current;
  const contentShift = useRef(new Animated.Value(16)).current;
  const heroScale = useRef(new Animated.Value(0.96)).current;

  React.useEffect(() => {
    contentOpacity.setValue(0);
    contentShift.setValue(16);
    heroScale.setValue(0.96);

    Animated.stagger(80, [
      Animated.parallel([
        Animated.timing(contentOpacity, {
          toValue: 1,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(contentShift, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(heroScale, {
        toValue: 1,
        duration: 200,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentShift, heroScale]);

  const completedCount = analyses.filter((item) => item.status === "completed").length;
  const processingCount = analyses.filter((item) => item.status === "processing" || item.status === "pending").length;
  const failedCount = analyses.filter((item) => item.status === "failed").length;

  const coachingState = useMemo(() => getCoachingState(analyses), [analyses]);
  const focusAreas = useMemo(() => deriveFocusAreas(analyses), [analyses]);
  const improvementTrend = useMemo(() => getImprovementTrend(analyses), [analyses]);

  const lastAnalysisDate = analyses[0]?.created_at;

  const recentAnalyses = analyses.slice(0, 3);

  const getTrendColor = (trend: "improving" | "stable" | "needs_work") => {
    if (trend === "improving") return colors.primary;
    if (trend === "needs_work") return colors.danger;
    return colors.textMuted;
  };

  const getTrendIcon = (trend: "improving" | "stable" | "needs_work") => {
    if (trend === "improving") return "↑";
    if (trend === "needs_work") return "↓";
    return "→";
  };

  const renderAnalysisCard = (item: typeof analyses[0], index: number) => {
    const statusColor = item.status === "completed" ? colors.primary : item.status === "failed" ? colors.danger : colors.textMuted;
    const typeInfo = ANALYSIS_LABELS[item.analysis_type as AnalysisType] ?? { label: item.analysis_type, focus: "" };
    const summary = item.report_json?.summary ?? item.feedback;
    const improvements = item.report_json?.improvements ?? [];

    return (
      <Pressable
        key={item.id}
        onPress={() => navigation.navigate("AnalysisDetail", { analysisId: item.id })}
        style={[styles.analysisCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        <View style={styles.analysisHeader}>
          <View style={styles.analysisHeaderLeft}>
            <Text style={[styles.analysisType, { color: colors.text }]}>{typeInfo.label}</Text>
            <Text style={[styles.analysisDate, { color: colors.textMuted }]}>{formatDateAgo(item.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}> 
            <Text style={[styles.statusText, { color: statusColor }]}>{item.status.toUpperCase()}</Text>
          </View>
        </View>

        {summary && (
          <Text style={[styles.analysisSummary, { color: colors.text }]} numberOfLines={2}>{summary}</Text>
        )}

        {improvements.length > 0 && (
          <View style={styles.tagsRow}>
            {improvements.slice(0, 3).map((imp, idx) => (
              <View key={idx} style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}> 
                <Text style={[styles.tagText, { color: colors.textMuted }]} numberOfLines={1}>{imp}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={[styles.viewHint, { color: colors.primary }]}>View analysis →</Text>
      </Pressable>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <Animated.View style={[{ opacity: contentOpacity, transform: [{ translateY: contentShift }] }]}>
        <Animated.View style={[styles.heroCard, { backgroundColor: colors.primaryStrong, borderColor: colors.primaryStrong, transform: [{ scale: heroScale }] }]}> 
          <Text style={styles.heroGreeting}>{coachingState.greeting}</Text>
          <Text style={styles.heroTitle}>{coachingState.title}</Text>
          <Text style={styles.heroMessage}>{coachingState.message}</Text>

          <View style={styles.heroActions}>
            <Pressable
              style={({ pressed }) => [styles.heroButton, { backgroundColor: colors.onPrimary, opacity: pressed ? 0.9 : 1 }]}
              onPress={() => (subscription.canUseAI ? navigation.navigate("VideoUpload") : setShowPaywall(true))}
            >
              <Text style={[styles.heroButtonText, { color: colors.primary }]}>{coachingState.action ?? "New analysis"}</Text>
            </Pressable>
          </View>
        </Animated.View>

        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.statValue, { color: colors.primary }]}>{completedCount}</Text>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Completed</Text>
          </View>
          {processingCount > 0 && (
            <View style={[styles.statPill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.statValue, { color: colors.text }]}>{processingCount}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Processing</Text>
            </View>
          )}
          {processingCount === 0 && lastAnalysisDate && (
            <View style={[styles.statPill, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.statValue, { color: colors.text }]}>{formatDateAgo(lastAnalysisDate)}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Last upload</Text>
            </View>
          )}
        </View>

        {processingCount > 0 && (
          <View style={[styles.processingCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
            <View style={styles.processingHeader}>
              <Text style={[styles.processingTitle, { color: colors.text }]}>Analysis In Progress</Text>
              <Text style={[styles.processingCount, { color: colors.primary }]}>{processingCount}</Text>
            </View>
            <Text style={[styles.processingText, { color: colors.textMuted }]}>
              We're analysing your clip{processingCount > 1 ? "s" : ""}. Come back shortly for results.
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.border }]}> 
              <View style={[styles.progressFill, { backgroundColor: colors.primary }]} />
            </View>
          </View>
        )}

        {completedCount >= 1 && (
          <View style={[styles.focusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Current Focus</Text>
            {focusAreas.length > 0 ? (
              <>
                <Text style={[styles.focusLabel, { color: colors.primary }]}>{focusAreas[0].label}</Text>
                <Text style={[styles.focusSubtext, { color: colors.textMuted }]}>
                  Work on {ANALYSIS_LABELS[focusAreas[0].area as AnalysisType]?.focus ?? "your technique"}
                </Text>
                <View style={styles.focusStats}>
                  <Text style={[styles.focusStatText, { color: colors.text }]}>
                    {focusAreas[0].count} {focusAreas[0].count === 1 ? "analysis" : "analyses"}
                  </Text>
                  <Text style={[styles.focusStatDot, { color: colors.textMuted }]}>•</Text>
                  <Text style={[styles.focusStatText, { color: colors.textMuted }]}>
                    Last {formatDateAgo(focusAreas[0].lastDate)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={[styles.focusSubtext, { color: colors.textMuted }]}>
                Complete an analysis to see your focus areas.
              </Text>
            )}
          </View>
        )}

        {completedCount >= 2 && (
          <View style={[styles.trendCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}> 
            <View style={styles.trendHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Progress</Text>
              <Text style={[styles.trendIcon, { color: getTrendColor(improvementTrend.trend) }]}>
                {getTrendIcon(improvementTrend.trend)}
              </Text>
            </View>
            <Text style={[styles.trendLabel, { color: getTrendColor(improvementTrend.trend) }]}>{improvementTrend.label}</Text>
          </View>
        )}

        <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Analyses</Text>
            {analyses.length > 3 && (
              <Pressable onPress={() => navigation.navigate("AnalysisHistory")}>
                <Text style={[styles.viewAllLink, { color: colors.primary }]}>View all</Text>
              </Pressable>
            )}
          </View>

          {analyses.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>No analyses yet</Text>
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Upload a clip to get personalised coaching feedback on your technique.
              </Text>
            </View>
          ) : (
            <View style={styles.analysesList}>
              {recentAnalyses.map((item, index) => renderAnalysisCard(item, index))}
            </View>
          )}
        </View>

        {completedCount < 2 && (
          <View style={[styles.tipsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Getting Better Results</Text>
            <Text style={[styles.tipText, { color: colors.textMuted }]}>
              Keep your full cue action in frame, use steady camera placement, and capture 10-20 seconds from one clear angle.
            </Text>
          </View>
        )}
      </Animated.View>

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="AI Coach Monthly Limit"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  heroCard: {
    borderRadius: 18,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
  },
  heroGreeting: {
    color: "#BDE6D7",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 6,
    lineHeight: 30,
  },
  heroMessage: {
    color: "#BDE6D7",
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  heroActions: {
    flexDirection: "row",
    gap: 10,
  },
  heroButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  heroButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  statPill: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "800",
  },
  statLabel: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
    marginTop: 2,
  },
  processingCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  processingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  processingTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  processingCount: {
    fontSize: 18,
    fontWeight: "800",
  },
  processingText: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    width: "40%",
    height: "100%",
    borderRadius: 2,
  },
  focusCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 8,
  },
  focusLabel: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 2,
  },
  focusSubtext: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  focusStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  focusStatText: {
    fontSize: 12,
  },
  focusStatDot: {
    fontSize: 12,
  },
  trendCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  trendHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  trendIcon: {
    fontSize: 20,
    fontWeight: "700",
  },
  trendLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  sectionCard: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  viewAllLink: {
    fontSize: 13,
    fontWeight: "700",
  },
  emptyState: {
    paddingVertical: 16,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  analysesList: {
    gap: 10,
  },
  analysisCard: {
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
  },
  analysisHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  analysisHeaderLeft: {
    flex: 1,
  },
  analysisType: {
    fontSize: 14,
    fontWeight: "700",
  },
  analysisDate: {
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  analysisSummary: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 8,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    maxWidth: 120,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "500",
  },
  viewHint: {
    fontSize: 12,
    fontWeight: "600",
  },
  tipsCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
  },
  tipText: {
    fontSize: 13,
    lineHeight: 18,
  },
});