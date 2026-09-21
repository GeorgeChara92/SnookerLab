import React, { useEffect, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { VideoView, useVideoPlayer } from "expo-video";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAIAnalysesStore } from "../../store";
import { AICoachStackParamList } from "../../types";
import { supabase } from "../../api/supabase";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";
import { analysisDate, statusInfo, tagLabel, typeInfo } from "../../features/ai/analysisLabels";
import { suggestRoutines } from "../../features/ai/suggestRoutines";
import { DEFAULT_ROUTINES } from "../../constants/routines";

type AnalysisDetailRoute = RouteProp<AICoachStackParamList, "AnalysisDetail">;

const ClipPlayer = ({ url }: { url: string }) => {
  const player = useVideoPlayer({ uri: url }, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} style={styles.video} nativeControls contentFit="contain" />;
};

export const AnalysisDetailScreen = () => {
  const route = useRoute<AnalysisDetailRoute>();
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { analyses, deleteAnalysis, runAnalysis } = useAIAnalysesStore();
  const [retrying, setRetrying] = useState(false);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const analysis = analyses.find((item) => item.id === route.params.analysisId);
  const report = analysis?.report_json;

  useEffect(() => {
    let mounted = true;

    const loadPlaybackUrl = async () => {
      if (!analysis?.video_url || analysis.video_url.startsWith("demo://")) {
        if (mounted) setPlaybackUrl(null);
        return;
      }

      try {
        setVideoFailed(false);
        if (analysis.video_url.startsWith("http://") || analysis.video_url.startsWith("https://")) {
          if (mounted) setPlaybackUrl(analysis.video_url);
          return;
        }

        const { data, error } = await supabase.storage.from("ai-videos").createSignedUrl(analysis.video_url, 60 * 10);
        if (error) throw error;
        if (mounted) setPlaybackUrl(data?.signedUrl ?? null);
      } catch (error) {
        if (!mounted) return;
        setPlaybackUrl(null);
        setVideoFailed(true);
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
    } catch (error) {
      dialog.alert({
        title: "Could not delete this report",
        message: "It is still here. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = () => {
    dialog.confirm({
      tone: "danger",
      icon: "trash-can-outline",
      title: "Delete this report?",
      message: "The report and its clip go too, and this cannot be undone.",
      confirmLabel: "Delete report",
      cancelLabel: "Keep it",
      onConfirm: () => {
        void handleDelete();
      },
    });
  };

  const toggle = (key: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  if (!analysis) {
    return (
      <View style={[styles.missing, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="file-search-outline" size={32} color={colors.textMuted} />
        <Text style={[styles.missingTitle, { color: colors.text }]}>This report is not here</Text>
        <Text style={[styles.missingBody, { color: colors.textMuted }]}>
          It may have been deleted, or it has not finished loading. Go back and open it again.
        </Text>
      </View>
    );
  }

  const type = typeInfo(analysis.analysis_type);
  const status = statusInfo(analysis.status);
  const tags = (analysis.context_tags ?? []).map(tagLabel);

  const List = ({ items, icon, iconColour }: { items: string[]; icon: "check-circle" | "target" | "circle-small"; iconColour: string }) => (
    <View style={styles.list}>
      {items.map((item, index) => (
        <View key={`${icon}-${index}`} style={styles.listRow}>
          <MaterialCommunityIcons name={icon} size={18} color={iconColour} style={styles.listIcon} />
          <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
        </View>
      ))}
    </View>
  );

  const Fold = ({ title, sectionKey, children }: { title: string; sectionKey: string; children: React.ReactNode }) => {
    const open = openSections[sectionKey] ?? false;
    return (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => toggle(sectionKey)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          style={styles.foldHead}
        >
          <Text style={[styles.cardTitle, { color: colors.text }]}>{title}</Text>
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={22} color={colors.textMuted} />
        </Pressable>
        {open ? <View style={styles.foldBody}>{children}</View> : null}
      </View>
    );
  };

  const hasClip = Boolean(analysis.video_url) && !analysis.video_url.startsWith("demo://");
  const suggestions = suggestRoutines(report, analysis.analysis_type, DEFAULT_ROUTINES);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------------- the clip */}
      {hasClip ? (
        playbackUrl ? (
          <ClipPlayer url={playbackUrl} />
        ) : (
          <View style={[styles.video, styles.videoPlaceholder, { backgroundColor: colors.board }]}>
            {videoFailed ? (
              <>
                <MaterialCommunityIcons name="video-off-outline" size={26} color={colors.boardMuted} />
                <Text style={[styles.videoNote, { color: colors.boardMuted }]}>
                  The clip would not load. Check your connection and open the report again.
                </Text>
              </>
            ) : (
              <ActivityIndicator color={colors.boardText} />
            )}
          </View>
        )
      ) : null}

      {/* ---------------------------------------------------------------- what this is */}
      <View style={styles.heading}>
        <View style={styles.metaLine}>
          <Text style={[styles.meta, { color: colors.textMuted }]}>{analysisDate(analysis.created_at).toUpperCase()}</Text>
          {status.tone !== "ready" ? (
            <Text style={[styles.meta, { color: status.tone === "failed" ? colors.danger : colors.primary }]}>
              · {status.label.toUpperCase()}
            </Text>
          ) : null}
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{type.label}</Text>
        {tags.length ? (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <Text style={[styles.tagText, { color: colors.textMuted }]}>{tag}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {status.tone === "working" ? (
        <View style={[styles.card, styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.bodyText, { color: colors.text, flex: 1 }]}>
            The coach is still looking at this clip. The report appears here when it is ready.
          </Text>
        </View>
      ) : null}

      {status.tone === "failed" ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.danger }]}>
          <Text style={[styles.cardTitle, { color: colors.danger }]}>This clip could not be analysed</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>
            {analysis.error_message ?? "Something went wrong analysing this clip."}
          </Text>
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            Trying again uses the same clip and does not count as another analysis.
          </Text>
          <Pressable
            onPress={async () => {
              setRetrying(true);
              try {
                await runAnalysis(analysis.id);
              } catch {
                // The reason is already on the card.
              } finally {
                setRetrying(false);
              }
            }}
            disabled={retrying}
            accessibilityRole="button"
            accessibilityLabel="Try the analysis again"
            accessibilityState={{ disabled: retrying, busy: retrying }}
            style={({ pressed }) => [
              styles.retry,
              { backgroundColor: colors.primary, opacity: pressed || retrying ? 0.8 : 1 },
            ]}
          >
            {retrying ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <>
                <MaterialCommunityIcons name="refresh" size={18} color={colors.onPrimary} />
                <Text style={[styles.retryText, { color: colors.onPrimary }]}>Try again</Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      {/* ---------------------------------------------------------------- the report */}
      {report ? (
        <>
          <Text style={[styles.summary, { color: colors.text }]}>{report.summary}</Text>

          {/* How much the camera showed, so a thin report reads as a thin view, not a verdict. */}
          {report.confidence ? (
            <View
              style={[
                styles.viewNote,
                {
                  backgroundColor: colors.surface,
                  borderColor: report.confidence === "low" ? colors.warning : colors.border,
                },
              ]}
            >
              <MaterialCommunityIcons
                name={report.confidence === "high" ? "eye-check-outline" : "eye-outline"}
                size={18}
                color={report.confidence === "high" ? colors.primary : colors.textMuted}
              />
              <Text style={[styles.viewNoteText, { color: colors.textMuted }]}>
                {report.confidence === "high"
                  ? "Clear view of what this analysis needs"
                  : report.confidence === "medium"
                    ? "Partial view: some of this report is limited by the camera angle"
                    : "Limited view: film side-on and level with the cue for a fuller report"}
                {report.camera_view ? `. Camera: ${report.camera_view}` : ""}
              </Text>
            </View>
          ) : null}

          {report.positives.length ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>What went well</Text>
              <List items={report.positives} icon="check-circle" iconColour={colors.primary} />
            </View>
          ) : null}

          {report.improvements.length ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>What to work on</Text>
              <List items={report.improvements} icon="target" iconColour={colors.textMuted} />
            </View>
          ) : null}

          {report.coaching_tip ? (
            <BoardPanel kicker="TAKE TO THE TABLE">
              <Text style={[styles.tipText, { color: colors.boardText }]}>{report.coaching_tip}</Text>
            </BoardPanel>
          ) : null}

          {suggestions.length ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.cardTitle, { color: colors.text }]}>Practise this next</Text>
              <View style={styles.suggestions}>
                {suggestions.map(({ routine, topic, because }, index) => (
                  <Pressable
                    key={routine.id}
                    onPress={() =>
                      navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId: routine.id } })
                    }
                    accessibilityRole="button"
                    accessibilityLabel={`${routine.name}, for ${topic}`}
                    style={({ pressed }) => [
                      styles.suggestion,
                      index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
                      { opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    <View style={styles.suggestionText}>
                      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.suggestionTopic, { color: colors.primary }]}>
                        {topic.toUpperCase()}
                      </Text>
                      <Text style={[styles.suggestionName, { color: colors.text }]}>{routine.name}</Text>
                      {because ? (
                        <Text numberOfLines={2} style={[styles.suggestionWhy, { color: colors.textMuted }]}>
                          For: {because}
                        </Text>
                      ) : (
                        <Text style={[styles.suggestionWhy, { color: colors.textMuted }]}>
                          A good routine for what you asked the coach to look at.
                        </Text>
                      )}
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {report.possible_causes.length ? (
            <Fold title="Possible causes" sectionKey="causes">
              <List items={report.possible_causes} icon="circle-small" iconColour={colors.textMuted} />
            </Fold>
          ) : null}

          {report.not_assessable.length ? (
            <Fold title="What the clip could not show" sectionKey="limits">
              <List items={report.not_assessable} icon="circle-small" iconColour={colors.textMuted} />
            </Fold>
          ) : null}
        </>
      ) : null}

      {!report && analysis.feedback ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Feedback</Text>
          <Text style={[styles.bodyText, { color: colors.text }]}>{analysis.feedback}</Text>
        </View>
      ) : null}

      {analysis.recommendations?.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Next steps</Text>
          {analysis.recommendations.map((item, index) => (
            <View key={`rec-${index}`} style={styles.listRow}>
              <Text style={[styles.stepNumber, { color: colors.primary }]}>{index + 1}</Text>
              <Text style={[styles.listText, { color: colors.text }]}>{item}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {analysis.user_notes ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Your notes</Text>
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>{analysis.user_notes}</Text>
        </View>
      ) : null}

      <Pressable
        onPress={confirmDelete}
        disabled={isDeleting}
        accessibilityRole="button"
        accessibilityLabel="Delete this report"
        accessibilityState={{ disabled: isDeleting, busy: isDeleting }}
        style={styles.delete}
      >
        <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.danger} />
        <Text style={[styles.deleteText, { color: colors.danger }]}>{isDeleting ? "Deleting…" : "Delete this report"}</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  retry: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  retryText: { fontSize: 15, fontWeight: "800" },
  viewNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
  },
  viewNoteText: { flex: 1, fontSize: 13, lineHeight: 18 },
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },

  video: { width: "100%", aspectRatio: 16 / 9, borderRadius: RADIUS.lg, backgroundColor: "#000", overflow: "hidden" },
  videoPlaceholder: { alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.lg },
  videoNote: { fontSize: 13, fontWeight: "600", lineHeight: 18, textAlign: "center" },

  heading: { gap: 4, marginTop: SPACING.xs },
  metaLine: { flexDirection: "row", gap: 6 },
  meta: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1.4 },
  title: { fontSize: 28, fontWeight: "800", letterSpacing: -0.4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  tag: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 5 },
  tagText: { fontSize: 13, fontWeight: "600" },

  summary: { fontSize: 17, lineHeight: 25, fontWeight: "500" },

  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  row: { flexDirection: "row", alignItems: "center" },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  bodyText: { fontSize: 14, lineHeight: 20 },
  errorDetail: { fontSize: 12, lineHeight: 17 },

  list: { gap: SPACING.md },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: SPACING.md },
  listIcon: { marginTop: 1 },
  listText: { flex: 1, fontSize: 15, lineHeight: 21 },
  stepNumber: { fontFamily: FONTS.board, fontSize: 18, width: 16, textAlign: "center" },

  suggestions: { marginTop: -SPACING.xs },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    paddingVertical: SPACING.sm,
  },
  suggestionText: { flex: 1, gap: 2 },
  suggestionTopic: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2 },
  suggestionName: { fontSize: 16, fontWeight: "800" },
  suggestionWhy: { fontSize: 13, lineHeight: 18 },
  tipText: { fontSize: 18, fontWeight: "600", lineHeight: 26 },

  foldHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 28 },
  foldBody: {},

  delete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    marginTop: SPACING.sm,
  },
  deleteText: { fontSize: 15, fontWeight: "700" },

  missing: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  missingTitle: { fontSize: 18, fontWeight: "800" },
  missingBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
