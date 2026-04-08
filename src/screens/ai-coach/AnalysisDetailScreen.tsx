import React, { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAIAnalysesStore } from "../../store";
import { AICoachStackParamList } from "../../types";
import { supabase } from "../../api/supabase";

type AnalysisDetailRoute = RouteProp<AICoachStackParamList, "AnalysisDetail">;

const ClipPlayer = ({ url }: { url: string }) => {
  const player = useVideoPlayer({ uri: url }, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} style={styles.videoPlayer} nativeControls contentFit="contain" />;
};

const ANALYSIS_LABELS: Record<string, { label: string }> = {
  stroke_analysis: { label: "Stroke" },
  alignment_check: { label: "Alignment" },
  technique_review: { label: "Technique" },
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
};

export const AnalysisDetailScreen = () => {
  const route = useRoute<AnalysisDetailRoute>();
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const { analyses, deleteAnalysis } = useAIAnalysesStore();
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const analysis = analyses.find((item) => item.id === route.params.analysisId);
  const report = analysis?.report_json;

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

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

  const handleDelete = async () => {
    if (!analysis) return;
    setIsDeleting(true);
    try {
      await deleteAnalysis(analysis.id);
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to delete analysis");
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  if (!analysis) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.background }]}> 
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Analysis not found</Text>
        <Text style={[styles.emptySubtitle, { color: colors.textMuted }]}>It may have been removed or not loaded yet.</Text>
      </View>
    );
  }

  const typeInfo = ANALYSIS_LABELS[analysis.analysis_type] ?? { label: analysis.analysis_type };
  const statusColor = analysis.status === "completed" ? colors.primary : analysis.status === "failed" ? colors.danger : colors.textMuted;

  const renderBulletList = (items: string[], key: string) => (
    <View style={styles.bulletList}>
      {items.map((item, index) => (
        <View key={`${key}-${index}`} style={styles.bulletRow}>
          <View style={[styles.bulletDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.bulletText, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );

  const CollapsibleSection = ({ title, children, sectionKey, defaultExpanded = false }: { title: string; children: React.ReactNode; sectionKey: string; defaultExpanded?: boolean }) => {
    const isExpanded = expandedSections[sectionKey] ?? defaultExpanded;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable style={styles.collapsibleHeader} onPress={() => toggleSection(sectionKey)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>{isExpanded ? "▲" : "▼"}</Text>
        </Pressable>
        {isExpanded && children}
      </View>
    );
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={[styles.typeLabel, { color: colors.text }]}>{typeInfo.label}</Text>
            <Text style={[styles.dateLabel, { color: colors.textMuted }]}>{formatDate(analysis.created_at)}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}> 
            <Text style={[styles.statusText, { color: statusColor }]}>{analysis.status.toUpperCase()}</Text>
          </View>
        </View>
        {analysis.context_tags && analysis.context_tags.length > 0 && (
          <View style={styles.tagsRow}>
            {analysis.context_tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}> 
                <Text style={[styles.tagText, { color: colors.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
        <Pressable style={styles.deleteButton} onPress={() => setShowDeleteModal(true)}>
          <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.cardTitle, { color: colors.text }]}>Clip</Text>
        {playbackUrl ? (
          <ClipPlayer url={playbackUrl} />
        ) : !analysis.video_url || analysis.video_url.startsWith("demo://") ? (
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>No clip attached to this analysis.</Text>
        ) : videoError ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>Could not load clip: {videoError}</Text>
        ) : (
          <Text style={[styles.placeholderText, { color: colors.textMuted }]}>Loading clip...</Text>
        )}
      </View>

      {report && (
        <>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardTitle, { color: colors.text }]}>Key Takeaway</Text>
            <Text style={[styles.takeawayText, { color: colors.text }]}>{report.summary}</Text>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardTitle, { color: colors.text }]}>What You Did Well</Text>
            {renderBulletList(report.positives, "positives")}
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.cardTitle, { color: colors.text }]}>What to Improve</Text>
            {renderBulletList(report.improvements, "improvements")}
          </View>

          <View style={[styles.tipCard, { backgroundColor: colors.primaryStrong, borderColor: colors.primary }]}> 
            <Text style={styles.tipLabel}>COACHING TIP</Text>
            <Text style={styles.tipText}>{report.coaching_tip}</Text>
          </View>

          {report.possible_causes.length > 0 && (
            <CollapsibleSection title="Possible Causes" sectionKey="causes" defaultExpanded={false}>
              {renderBulletList(report.possible_causes, "causes")}
            </CollapsibleSection>
          )}

          {report.not_assessable.length > 0 && (
            <CollapsibleSection title="Limitations" sectionKey="limitations" defaultExpanded={false}>
              {renderBulletList(report.not_assessable, "limitations")}
            </CollapsibleSection>
          )}
        </>
      )}

      {analysis.user_notes && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your Notes</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>{analysis.user_notes}</Text>
        </View>
      )}

      {!report && analysis.feedback && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Feedback</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>{analysis.feedback}</Text>
        </View>
      )}

      {analysis.recommendations && analysis.recommendations.length > 0 && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.cardTitle, { color: colors.text }]}>Recommendations</Text>
          {analysis.recommendations.map((item, index) => (
            <View key={`rec-${index}`} style={styles.recRow}>
              <Text style={[styles.recIndex, { color: colors.primary }]}>{index + 1}</Text>
              <Text style={[styles.bodyText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      )}

      {analysis.status === "failed" && analysis.error_message && (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger }]}> 
          <Text style={[styles.cardTitle, { color: colors.danger }]}>Error</Text>
          <Text style={[styles.bodyText, { color: colors.danger }]}>{analysis.error_message}</Text>
        </View>
      )}

      <Modal visible={showDeleteModal} transparent animationType="fade" onRequestClose={() => setShowDeleteModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}> 
            <Text style={[styles.modalTitle, { color: colors.text }]}>Delete Analysis?</Text>
            <Text style={[styles.modalBody, { color: colors.textMuted }]}>This cannot be undone. The analysis and its video will be permanently removed.</Text>
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalButton, styles.modalCancel]} onPress={() => setShowDeleteModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalButton, styles.modalDelete, { backgroundColor: colors.danger }]} onPress={handleDelete} disabled={isDeleting}>
                <Text style={styles.modalDeleteText}>{isDeleting ? "Deleting..." : "Delete"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  headerCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  headerLeft: { flex: 1 },
  typeLabel: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  dateLabel: { fontSize: 13 },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  tagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  tagText: { fontSize: 11, fontWeight: "600" },
  deleteButton: {
    marginTop: 16,
    paddingVertical: 8,
  },
  deleteButtonText: { fontSize: 13, fontWeight: "600" },
  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 12 },
  placeholderText: { fontSize: 14, lineHeight: 20 },
  errorText: { fontSize: 14, lineHeight: 20 },
  videoPlayer: { width: "100%", height: 200, borderRadius: 10, backgroundColor: "#000", marginTop: 8 },
  takeawayText: { fontSize: 15, lineHeight: 22, fontWeight: "500" },
  bulletList: { gap: 8 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 7 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
  tipCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  tipLabel: { color: "#BDE6D7", fontSize: 11, fontWeight: "700", letterSpacing: 0.5, marginBottom: 8 },
  tipText: { color: "#FFFFFF", fontSize: 15, lineHeight: 22 },
  collapsibleHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  chevron: { fontSize: 12 },
  recRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 8,
  },
  recIndex: { fontSize: 14, fontWeight: "700" },
  bodyText: { fontSize: 14, lineHeight: 20 },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  emptyTitle: { fontSize: 20, fontWeight: "700", marginBottom: 8 },
  emptySubtitle: { fontSize: 14, textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalCard: {
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 320,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  modalBody: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  modalActions: { flexDirection: "row", gap: 12 },
  modalButton: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  modalCancel: { backgroundColor: "transparent", borderWidth: 1, borderColor: "#ccc" },
  modalCancelText: { fontSize: 14, fontWeight: "600" },
  modalDelete: {},
  modalDeleteText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});