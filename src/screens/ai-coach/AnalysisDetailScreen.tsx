import React, { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useRoute } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { AppCard } from "../../components/ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAIAnalysesStore } from "../../store";
import { AICoachStackParamList } from "../../types";
import { supabase } from "../../api/supabase";

type AnalysisDetailRoute = RouteProp<AICoachStackParamList, "AnalysisDetail">;

export const AnalysisDetailScreen = () => {
  const route = useRoute<AnalysisDetailRoute>();
  const { colors } = useAppTheme();
  const { analyses } = useAIAnalysesStore();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const analysis = analyses.find((item) => item.id === route.params.analysisId);
  const report = analysis?.report_json;
  const player = useVideoPlayer(playbackUrl ? { uri: playbackUrl } : null, (instance) => {
    instance.loop = false;
  });

  useEffect(() => {
    let mounted = true;

    const loadPlaybackUrl = async () => {
      if (!analysis?.video_url || analysis.video_url.startsWith("demo://")) {
        if (mounted) setPlaybackUrl(null);
        return;
      }

      try {
        setVideoError(null);
        if (analysis.video_url.startsWith("http://") || analysis.video_url.startsWith("https://")) {
          if (mounted) setPlaybackUrl(analysis.video_url);
          return;
        }

        const { data, error } = await supabase.storage.from("ai-videos").createSignedUrl(analysis.video_url, 60 * 10);
        if (error) throw error;
        if (mounted) setPlaybackUrl(data?.signedUrl ?? null);
      } catch (error: any) {
        if (!mounted) return;
        setPlaybackUrl(null);
        const message = typeof error?.message === "string" ? error.message : "Could not load video";
        setVideoError(message);
      }
    };

    void loadPlaybackUrl();

    return () => {
      mounted = false;
    };
  }, [analysis?.id, analysis?.video_url]);

  if (!analysis) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}> 
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Analysis not found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>It may have been removed or not loaded yet.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <AppCard style={styles.card}>
        <View style={styles.metaRow}>
          <Text style={[styles.type, { color: colors.text }]}>{analysis.analysis_type.replace("_", " ").toUpperCase()}</Text>
          <Text
            style={[
              styles.status,
              { color: analysis.status === "completed" ? colors.primary : analysis.status === "failed" ? colors.danger : colors.textMuted },
            ]}
          >
            {analysis.status.toUpperCase()}
          </Text>
        </View>
        <Text style={[styles.date, { color: colors.textMuted }]}>{new Date(analysis.created_at).toLocaleString()}</Text>
        {analysis.context_tags && analysis.context_tags.length > 0 ? (
          <View style={styles.tagsWrap}>
            {analysis.context_tags.map((tag) => (
              <View key={`${analysis.id}-${tag}`} style={[styles.tagChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}>
                <Text style={[styles.tagText, { color: colors.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </AppCard>

      <AppCard style={styles.card}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Clip</Text>
        {playbackUrl ? (
          <VideoView player={player} style={styles.videoPlayer} nativeControls contentFit="contain" />
        ) : analysis.video_url.startsWith("demo://") ? (
          <Text style={[styles.body, { color: colors.textMuted }]}>Demo analysis has no uploaded clip attached.</Text>
        ) : videoError ? (
          <Text style={[styles.body, { color: colors.danger }]}>Could not load clip: {videoError}</Text>
        ) : (
          <Text style={[styles.body, { color: colors.textMuted }]}>Preparing secure playback link...</Text>
        )}
        <Text style={[styles.privacyNote, { color: colors.textMuted }]}>Private clip playback uses short-lived signed links.</Text>
      </AppCard>

      {report ? (
        <>
          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Summary</Text>
            <Text style={[styles.body, { color: colors.text }]}>{report.summary}</Text>
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What Was Done Well</Text>
            {report.positives.map((item, index) => (
              <Text key={`${analysis.id}-positive-${index}`} style={[styles.body, { color: colors.text }]}>
                - {item}
              </Text>
            ))}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Areas to Improve (Observed)</Text>
            {report.improvements.map((item, index) => (
              <Text key={`${analysis.id}-improve-${index}`} style={[styles.body, { color: colors.text }]}>
                - {item}
              </Text>
            ))}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Possible Causes (If Applicable)</Text>
            {report.possible_causes.length > 0 ? (
              report.possible_causes.map((item, index) => (
                <Text key={`${analysis.id}-cause-${index}`} style={[styles.body, { color: colors.text }]}>- {item}</Text>
              ))
            ) : (
              <Text style={[styles.body, { color: colors.textMuted }]}>None identified from this clip.</Text>
            )}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What Cannot Be Assessed</Text>
            {report.not_assessable.map((item, index) => (
              <Text key={`${analysis.id}-unknown-${index}`} style={[styles.body, { color: colors.text }]}>- {item}</Text>
            ))}
          </AppCard>

          <AppCard style={styles.card}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Coaching Tip</Text>
            <Text style={[styles.body, { color: colors.text }]}>{report.coaching_tip}</Text>
          </AppCard>
        </>
      ) : null}

      {analysis.user_notes ? (
        <AppCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Coach Notes</Text>
          <Text style={[styles.body, { color: colors.text }]}>{analysis.user_notes}</Text>
        </AppCard>
      ) : null}

      {!report && analysis.feedback ? (
        <AppCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Feedback</Text>
          <Text style={[styles.body, { color: colors.text }]}>{analysis.feedback}</Text>
        </AppCard>
      ) : null}

      {analysis.recommendations && analysis.recommendations.length > 0 ? (
        <AppCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Recommendations</Text>
          {analysis.recommendations.map((item, index) => (
            <Text key={`${analysis.id}-rec-${index}`} style={[styles.body, { color: colors.text }]}>
              {index + 1}. {item}
            </Text>
          ))}
        </AppCard>
      ) : null}

      {analysis.status === "failed" && analysis.error_message ? (
        <AppCard style={styles.card}>
          <Text style={[styles.sectionTitle, { color: colors.danger }]}>Analysis Error</Text>
          <Text style={[styles.body, { color: colors.danger }]}>{analysis.error_message}</Text>
        </AppCard>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  card: { marginBottom: 12 },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  type: { fontSize: 13, fontWeight: "800" },
  status: { fontSize: 12, fontWeight: "700" },
  date: { marginTop: 8, fontSize: 12 },
  tagsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontWeight: "700" },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  body: { fontSize: 14, lineHeight: 20, marginBottom: 6 },
  videoPlayer: { width: "100%", height: 220, borderRadius: 10, backgroundColor: "#000" },
  privacyNote: { marginTop: 8, fontSize: 12 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
});
