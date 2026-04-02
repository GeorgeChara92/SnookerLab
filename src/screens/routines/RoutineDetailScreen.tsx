import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import {
  useRoute,
  useNavigation,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { WebView } from "react-native-webview";
import { useRoutinesStore, useRoutineScoresStore } from "../../store";
import type { PracticeStackParamList } from "../../types";
import { getYoutubeEmbedUrl, getYoutubeThumbnailUrl, getYoutubeWatchUrl } from "../../utils/youtube";
import { useAppTheme } from "../../hooks/useAppTheme";

export const RoutineDetailScreen = () => {
  const route = useRoute<RouteProp<PracticeStackParamList, "RoutineDetail">>();
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const [inlineVideo, setInlineVideo] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<"primary" | "alt">("primary");
  const { colors } = useAppTheme();

  const { routineId } = route.params;
  const { getRoutineById, categories } = useRoutinesStore();
  const { getEntriesForRoutine } = useRoutineScoresStore();

  const routine = getRoutineById(routineId);
  const categoryName = categories.find((c) => c.id === routine?.category_id)?.name;
  const entries = getEntriesForRoutine(routineId).slice(0, 4);

  const primaryVideoId = routine?.youtube_video_id;
  const altVideoId = routine?.youtube_alt_video_id;
  const hasPrimary = Boolean(primaryVideoId);
  const hasAlt = Boolean(altVideoId);

  useEffect(() => {
    if (!hasPrimary && hasAlt) {
      setSelectedVideo("alt");
    } else {
      setSelectedVideo("primary");
    }
    setInlineVideo(false);
  }, [routineId, hasPrimary, hasAlt]);

  const activeVideoId =
    selectedVideo === "alt"
      ? altVideoId ?? primaryVideoId
      : primaryVideoId ?? altVideoId;

  const activeTitle =
    selectedVideo === "alt"
      ? routine?.youtube_alt_title ?? routine?.youtube_title
      : routine?.youtube_title ?? routine?.youtube_alt_title;

  const activeChannel =
    selectedVideo === "alt"
      ? routine?.youtube_alt_channel ?? routine?.youtube_channel
      : routine?.youtube_channel ?? routine?.youtube_alt_channel;

  const thumbnail = activeVideoId ? getYoutubeThumbnailUrl(activeVideoId) : undefined;
  const youtubeUrl = activeVideoId
    ? getYoutubeWatchUrl(activeVideoId)
    : selectedVideo === "alt"
      ? routine?.youtube_alt_url
      : routine?.youtube_url;
  const embedUrl = activeVideoId ? getYoutubeEmbedUrl(activeVideoId) : undefined;

  if (!routine) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Routine not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.heroCard, { backgroundColor: colors.primaryStrong }]}>
        <Text style={styles.icon}>{routine.icon ?? "🎱"}</Text>
        <Text style={[styles.title, { color: colors.onPrimary }]}>{routine.name}</Text>
        <Text style={[styles.meta, { color: "#D6E3DE" }]}>Category: {categoryName ?? "Practice"}</Text>
        <Text style={[styles.meta, { color: "#D6E3DE" }]}>Difficulty: {routine.difficulty}</Text>
        <Text style={[styles.summary, { color: "#C3D8D0" }]}>{routine.summary ?? routine.description}</Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Video Guide</Text>

        {(hasPrimary || hasAlt) ? (
          <View style={styles.videoPickerRow}>
            {hasPrimary ? (
              <Pressable
                style={[styles.videoPickerButton, selectedVideo === "primary" && styles.videoPickerButtonActive]}
                onPress={() => {
                  setSelectedVideo("primary");
                  setInlineVideo(false);
                }}
              >
                <Text
                  style={[
                    styles.videoPickerButtonText,
                    selectedVideo === "primary" && styles.videoPickerButtonTextActive,
                  ]}
                >
                  Primary Guide
                </Text>
              </Pressable>
            ) : null}

            {hasAlt ? (
              <Pressable
                style={[styles.videoPickerButton, selectedVideo === "alt" && styles.videoPickerButtonActive]}
                onPress={() => {
                  setSelectedVideo("alt");
                  setInlineVideo(false);
                }}
              >
                <Text
                  style={[
                    styles.videoPickerButtonText,
                    selectedVideo === "alt" && styles.videoPickerButtonTextActive,
                  ]}
                >
                  Alternative Guide
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {activeTitle ? <Text style={[styles.videoMetaTitle, { color: colors.text }]}>{activeTitle}</Text> : null}
        {activeChannel ? <Text style={[styles.videoMetaChannel, { color: colors.textMuted }]}>Channel: {activeChannel}</Text> : null}

        {inlineVideo && embedUrl ? (
          <View style={styles.videoFrame}>
            <WebView source={{ uri: embedUrl }} style={styles.webview} allowsFullscreenVideo />
          </View>
        ) : thumbnail ? (
          <Pressable style={styles.thumbnailWrap} onPress={() => setInlineVideo(true)}>
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            <View style={styles.playOverlay}>
              <Text style={styles.playOverlayText}>▶</Text>
            </View>
          </Pressable>
        ) : (
          <Text style={styles.empty}>No video attached yet.</Text>
        )}

        <View style={styles.videoActions}>
          <Pressable style={styles.inlineButton} onPress={() => setInlineVideo((prev) => !prev)}>
            <Text style={styles.inlineButtonText}>{inlineVideo ? "Show Thumbnail" : "Play Inline"}</Text>
          </Pressable>

          {youtubeUrl ? (
            <Pressable style={styles.youtubeButton} onPress={() => Linking.openURL(youtubeUrl)}>
              <Text style={styles.youtubeButtonText}>Open in YouTube</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Setup</Text>
        <Text style={[styles.sectionContent, { color: colors.textMuted }]}>{routine.setup_instructions}</Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>How to Run the Drill</Text>
        {(routine.steps ?? []).map((step, index) => (
          <Text key={`${routine.id}-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
            {index + 1}. {step}
          </Text>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Scoring & Success Criteria</Text>
        <Text style={[styles.sectionContent, { color: colors.textMuted }]}>{routine.success_criteria}</Text>
        <Text style={[styles.statRow, { color: colors.textMuted }]}>📝 Scoring Type: {routine.scoring_type}</Text>
        {routine.max_score ? <Text style={[styles.statRow, { color: colors.textMuted }]}>🏆 Max Score: {routine.max_score}</Text> : null}
        {routine.target_score ? <Text style={[styles.statRow, { color: colors.textMuted }]}>🎯 Target Score: {routine.target_score}</Text> : null}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>What This Improves</Text>
        {(routine.improves ?? []).map((tip, index) => (
          <Text key={`${routine.id}-tip-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
            🎯 {tip}
          </Text>
        ))}
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Results</Text>
        {entries.length === 0 ? (
          <Text style={styles.empty}>No scores recorded yet. Add your first result below.</Text>
        ) : (
          entries.map((entry) => (
              <View key={entry.id} style={[styles.entryCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <View style={styles.entryHeader}>
                  <Text style={[styles.entryScore, { color: colors.text }]}>📈 {entry.score}</Text>
                  <Text style={[styles.entryDate, { color: colors.textMuted }]}>{new Date(entry.recorded_at).toLocaleString()}</Text>
                </View>
                {entry.notes ? <Text style={[styles.entryNotes, { color: colors.textMuted }]}>📝 {entry.notes}</Text> : null}
              </View>
            ))
        )}
      </View>

      <Pressable
        style={[styles.primaryButton, { backgroundColor: colors.primary }]}
        onPress={() => navigation.navigate("RecordRoutineScore", { routineId: routine.id })}
      >
        <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>Record Score</Text>
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F0F4F8",
  },
  content: {
    padding: 16,
    paddingBottom: 28,
  },
  heroCard: {
    backgroundColor: "#102A43",
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
  },
  icon: {
    fontSize: 26,
    marginBottom: 6,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    marginBottom: 6,
    color: "#FFFFFF",
  },
  meta: {
    fontSize: 13,
    color: "#D9E2EC",
    marginBottom: 3,
    textTransform: "capitalize",
  },
  summary: {
    marginTop: 8,
    fontSize: 14,
    color: "#BCCCDC",
    lineHeight: 19,
  },
  section: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
    color: "#102A43",
  },
  sectionContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  thumbnailWrap: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  thumbnail: {
    width: "100%",
    height: 200,
    backgroundColor: "#E2E8F0",
  },
  playOverlay: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: [{ translateX: -24 }, { translateY: -24 }],
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  playOverlayText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
  },
  videoFrame: {
    borderRadius: 12,
    overflow: "hidden",
    height: 220,
  },
  webview: {
    flex: 1,
    backgroundColor: "#000",
  },
  videoActions: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  videoPickerRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  videoPickerButton: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#D9E2EC",
    backgroundColor: "#F8FAFC",
    paddingVertical: 8,
    alignItems: "center",
  },
  videoPickerButtonActive: {
    backgroundColor: "#DBEAFE",
    borderColor: "#93C5FD",
  },
  videoPickerButtonText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#486581",
  },
  videoPickerButtonTextActive: {
    color: "#1D4ED8",
  },
  videoMetaTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#102A43",
    marginBottom: 2,
  },
  videoMetaChannel: {
    fontSize: 12,
    color: "#627D98",
    marginBottom: 8,
  },
  inlineButton: {
    flex: 1,
    backgroundColor: "#DBEAFE",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  inlineButtonText: {
    color: "#1D4ED8",
    fontWeight: "700",
    fontSize: 13,
  },
  youtubeButton: {
    flex: 1,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  youtubeButtonText: {
    color: "#B91C1C",
    fontWeight: "700",
    fontSize: 13,
  },
  listItem: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 6,
  },
  statRow: {
    marginTop: 8,
    fontSize: 13,
  },
  empty: {
    fontSize: 14,
    color: "#627D98",
  },
  entryCard: {
    borderRadius: 10,
    borderWidth: 1,
    padding: 10,
    marginBottom: 8,
  },
  entryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  entryScore: {
    fontSize: 14,
    fontWeight: "700",
  },
  entryDate: {
    fontSize: 12,
    flexShrink: 1,
    textAlign: "right",
  },
  entryNotes: {
    marginTop: 4,
    fontSize: 13,
  },
  primaryButton: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
