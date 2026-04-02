import React from "react";
import { View, StyleSheet, Text, ScrollView, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { AppCard } from "../../components/ui/AppCard";
import { AppButton } from "../../components/ui/AppButton";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAIAnalysesStore } from "../../store";
import type { AICoachStackParamList } from "../../types";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TierPaywallModal } from "../../components/subscription";

export const AIDashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const { colors } = useAppTheme();
  const { analyses } = useAIAnalysesStore();
  const subscription = useSubscriptionAccess();
  const [showPaywall, setShowPaywall] = React.useState(false);
  const completedCount = analyses.filter((item) => item.status === "completed").length;
  const processingCount = analyses.filter((item) => item.status === "processing" || item.status === "pending").length;
  const failedCount = analyses.filter((item) => item.status === "failed").length;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <AppCard style={[styles.heroCard, { borderColor: colors.primary }]}> 
        <Text style={[styles.eyebrow, { color: colors.primary }]}>AI COACH</Text>
        <Text style={[styles.title, { color: colors.text }]}>Train with clip-by-clip coaching</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Upload a short clip, get structured feedback, and track your progress over time.</Text>
        <View style={styles.heroActions}>
          <View style={styles.heroActionPrimary}>
            <AppButton label="New analysis" onPress={() => navigation.navigate("VideoUpload")} />
          </View>
          <Pressable onPress={() => navigation.navigate("AnalysisHistory")} style={[styles.heroLink, { borderColor: colors.border }]}> 
            <Text style={[styles.heroLinkText, { color: colors.text }]}>View history</Text>
          </Pressable>
        </View>
      </AppCard>

      <AppCard style={styles.featureCard}>
        <View style={styles.statsRow}>
          <View style={[styles.statPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Completed</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{completedCount}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>In Progress</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{processingCount}</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>Failed</Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{failedCount}</Text>
          </View>
        </View>
      </AppCard>

      {processingCount > 0 ? (
        <AppCard style={styles.featureCard}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Analysis In Progress</Text>
          <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
            We are still processing {processingCount} clip{processingCount > 1 ? "s" : ""}. You can continue using the app and come back here for results.
          </Text>
          <View style={[styles.inlineProgressTrack, { backgroundColor: colors.border }]}>
            <View style={[styles.inlineProgressFill, { backgroundColor: colors.primary }]} />
          </View>
        </AppCard>
      ) : null}

      <AppCard style={styles.featureCard}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>Video Analysis</Text>
        <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
          Upload videos of your shots or practice sessions. Our AI will analyse your cue action,
          alignment, and technique to provide detailed feedback.
        </Text>
        <View>
          <AppButton label="Upload Video" onPress={() => (subscription.canUseAI ? navigation.navigate("VideoUpload") : setShowPaywall(true))} />
          {subscription.canUseAI ? null : (
            <View style={styles.lockedLayer}>
              <Pressable style={[styles.unlockPill, { backgroundColor: colors.primary }]} onPress={() => setShowPaywall(true)}>
                <Text style={[styles.unlockText, { color: colors.onPrimary }]}>Unlock</Text>
              </Pressable>
            </View>
          )}
        </View>
      </AppCard>

      <AppCard style={styles.featureCard}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>How to get better results</Text>
        <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
          Keep your full cue action in frame, use steady camera placement, and capture 30-60 seconds from one clear angle.
        </Text>
      </AppCard>

      <AppCard style={styles.featureCard}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>Personalized Recommendations</Text>
        <Text style={[styles.featureDescription, { color: colors.textMuted }]}>
          Receive tailored practice recommendations based on your technique analysis.
        </Text>
      </AppCard>

      <AppCard style={styles.featureCard}>
        <Text style={[styles.featureTitle, { color: colors.text }]}>How it works</Text>
        <View style={styles.stepsWrap}>
          <View style={styles.stepRow}>
            <Text style={[styles.stepIndex, { color: colors.primary }]}>1</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Record one clear shot sequence or short practice segment</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={[styles.stepIndex, { color: colors.primary }]}>2</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Upload and add context tags or coach notes</Text>
          </View>
          <View style={styles.stepRow}>
            <Text style={[styles.stepIndex, { color: colors.primary }]}>3</Text>
            <Text style={[styles.stepText, { color: colors.textMuted }]}>Review structured analysis and practice recommendations</Text>
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.featureCard}>
        <View style={styles.recentHeader}>
          <Text style={[styles.featureTitle, { color: colors.text }]}>Recent Analyses</Text>
          {analyses.length > 0 ? (
            <Pressable onPress={() => navigation.navigate("AnalysisHistory")}>
              <Text style={[styles.viewAll, { color: colors.primary }]}>View all</Text>
            </Pressable>
          ) : null}
        </View>
        {analyses.length === 0 ? (
          <Text style={[styles.featureDescription, { color: colors.textMuted }]}>No analyses yet. Upload your first clip to get coached feedback.</Text>
        ) : (
          analyses.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => navigation.navigate("AnalysisDetail", { analysisId: item.id })}
              style={[styles.analysisRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            >
              <View style={styles.analysisMeta}>
                <Text style={[styles.analysisType, { color: colors.text }]}>{item.analysis_type.replace("_", " ").toUpperCase()}</Text>
                <Text
                  style={[
                    styles.analysisStatus,
                    { color: item.status === "completed" ? colors.primary : item.status === "failed" ? colors.danger : colors.textMuted },
                  ]}
                >
                  {item.status.toUpperCase()}
                </Text>
              </View>
              <Text style={[styles.analysisDate, { color: colors.textMuted }]}>{new Date(item.created_at).toLocaleString()}</Text>
              {item.report_json?.summary ? (
                <Text style={[styles.analysisFeedback, { color: colors.text }]} numberOfLines={3}>{item.report_json.summary}</Text>
              ) : item.feedback ? (
                <Text style={[styles.analysisFeedback, { color: colors.text }]} numberOfLines={3}>{item.feedback}</Text>
              ) : null}
              {item.status === "failed" && item.error_message ? (
                <Text style={[styles.analysisError, { color: colors.danger }]} numberOfLines={2}>{item.error_message}</Text>
              ) : null}
              <Text style={[styles.openHint, { color: colors.primary }]}>Open analysis</Text>
            </Pressable>
          ))
        )}
      </AppCard>

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
  content: { padding: 16, paddingBottom: 28 },
  heroCard: { marginBottom: 16 },
  eyebrow: { fontSize: 11, letterSpacing: 1, fontWeight: "800", marginBottom: 8 },
  title: { fontSize: 26, fontWeight: "800", marginBottom: 8, lineHeight: 30 },
  subtitle: { fontSize: 14, lineHeight: 20 },
  heroActions: { marginTop: 14, gap: 10 },
  heroActionPrimary: { width: "100%" },
  heroLink: { borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  heroLinkText: { fontSize: 13, fontWeight: "700" },
  featureCard: {
    marginBottom: 16,
  },
  statsRow: { flexDirection: "row", gap: 8 },
  statPill: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8 },
  statLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  statValue: { fontSize: 18, fontWeight: "800", marginTop: 4 },
  inlineProgressTrack: { height: 8, borderRadius: 999, overflow: "hidden" },
  inlineProgressFill: { width: "42%", height: "100%" },
  featureTitle: { fontSize: 19, fontWeight: "700", marginBottom: 8 },
  featureDescription: { fontSize: 14, marginBottom: 10, lineHeight: 20 },
  recentHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  viewAll: { fontSize: 13, fontWeight: "700" },
  stepsWrap: { gap: 8 },
  stepRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  stepIndex: { fontSize: 15, fontWeight: "800", width: 16 },
  stepText: { flex: 1, fontSize: 13, lineHeight: 19 },
  lockedLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.24)",
    borderColor: "rgba(255,255,255,0.42)",
    borderWidth: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  unlockPill: {
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  unlockText: { fontSize: 12, fontWeight: "800" },
  analysisRow: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginTop: 8,
  },
  analysisMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  analysisType: { fontSize: 12, fontWeight: "800" },
  analysisStatus: { fontSize: 11, fontWeight: "700" },
  analysisDate: { marginTop: 4, fontSize: 11 },
  analysisFeedback: { marginTop: 6, fontSize: 12, lineHeight: 18 },
  analysisError: { marginTop: 6, fontSize: 12, lineHeight: 16 },
  openHint: { marginTop: 8, fontSize: 12, fontWeight: "700" },
});
