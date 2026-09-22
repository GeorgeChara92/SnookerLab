import React, { useEffect, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View, Image } from "react-native";
import { useRoute, useNavigation, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useRoutinesStore, useRoutineScoresStore } from "../../store";
import type { PracticeStackParamList, ScoringType } from "../../types";
import { getYoutubeThumbnailUrl, getYoutubeWatchUrl } from "../../utils/youtube";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getRoutineReferenceImageByRoutineId } from "../../features/ar/routineLayouts";
import { getGuidePlaybookByRoutineId } from "../../features/guides/guidePlaybooks";
import { RoutineProgressCard } from "../../components/routines/RoutineProgressCard";
import { RoutineLeaderboardCard } from "../../components/community/RoutineLeaderboardCard";
import { openSendToChat } from "../../navigation/navigationRef";

const scoringTypeLabel = (type: ScoringType): string => {
  switch (type) {
    case "points":
      return "Points";
    case "percentage":
      return "Percentage";
    case "count":
      return "Count";
    case "time":
      return "Time";
    default:
      return "Score";
  }
};

const scoringRecordingHint = (type: ScoringType): string => {
  switch (type) {
    case "points":
      return "Log your total points scored in this session.";
    case "percentage":
      return "Log either a percentage (e.g. 72%) or made/attempts (e.g. 18/25).";
    case "count":
      return "Log your completed count for this session.";
    case "time":
      return "Log your completion time in mm:ss format.";
    default:
      return "Log the result value for this routine.";
  }
};

export const RoutineDetailScreen = () => {
  const route = useRoute<RouteProp<PracticeStackParamList, "RoutineDetail">>();
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const [selectedGuide, setSelectedGuide] = useState<"image" | "primary" | "alt">("primary");
  const { colors } = useAppTheme();

  const { routineId } = route.params;
  const { getRoutineById, categories } = useRoutinesStore();
  const { getEntriesForRoutine } = useRoutineScoresStore();

  const routine = getRoutineById(routineId);
  const categoryName = categories.find((c) => c.id === routine?.category_id)?.name;
  const entries = getEntriesForRoutine(routineId).slice(0, 4);

  const isGuide = routine?.content_type === "guide";
  const primaryVideoId = routine?.youtube_video_id;
  const altVideoId = routine?.youtube_alt_video_id;
  const hasPrimary = Boolean(primaryVideoId);
  const hasAlt = Boolean(altVideoId);
  const referenceImage = routine ? getRoutineReferenceImageByRoutineId(routine.id) : undefined;
  const hasImageGuide = !isGuide && Boolean(referenceImage);
  const guidePlaybook = routine && isGuide ? getGuidePlaybookByRoutineId(routine.id) : undefined;

  useEffect(() => {
    if (hasImageGuide) {
      setSelectedGuide("image");
      return;
    }

    if (!hasPrimary && hasAlt) {
      setSelectedGuide("alt");
      return;
    }

    setSelectedGuide("primary");
  }, [routineId, hasImageGuide, hasPrimary, hasAlt]);

  const activeVideoId = selectedGuide === "alt" ? (altVideoId ?? primaryVideoId) : (primaryVideoId ?? altVideoId);

  const activeTitle =
    selectedGuide === "alt"
      ? (routine?.youtube_alt_title ?? routine?.youtube_title)
      : (routine?.youtube_title ?? routine?.youtube_alt_title);

  const activeChannel =
    selectedGuide === "alt"
      ? (routine?.youtube_alt_channel ?? routine?.youtube_channel)
      : (routine?.youtube_channel ?? routine?.youtube_alt_channel);

  const thumbnail =
    selectedGuide === "image" ? undefined : activeVideoId ? getYoutubeThumbnailUrl(activeVideoId) : undefined;
  const youtubeUrl = activeVideoId
    ? getYoutubeWatchUrl(activeVideoId)
    : selectedGuide === "alt"
      ? routine?.youtube_alt_url
      : routine?.youtube_url;
  if (!routine) {
    return (
      <View style={styles.container}>
        <Text style={styles.empty}>Routine not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <View style={[styles.heroCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.heroTopRow}>
          <View style={[styles.iconChip, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={styles.icon}>{routine.icon ?? "🎱"}</Text>
          </View>
          <View style={styles.metaPillsRow}>
            <View style={[styles.metaPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.metaPillText, { color: colors.textMuted }]}>{categoryName ?? "Practice"}</Text>
            </View>
            <View style={[styles.metaPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <Text style={[styles.metaPillText, { color: colors.textMuted }]}>
                {isGuide ? "guide" : routine.difficulty}
              </Text>
            </View>
          </View>
        </View>
        <Text style={[styles.title, { color: colors.text }]}>{routine.name}</Text>
        <Text style={[styles.summary, { color: colors.textMuted }]}>{routine.summary ?? routine.description}</Text>
      </View>

      <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Guides & Reference</Text>

        {hasPrimary || hasAlt ? (
          <View style={styles.videoPickerRow}>
            {hasPrimary ? (
              <Pressable
                style={[styles.videoPickerButton, selectedGuide === "primary" && styles.videoPickerButtonActive]}
                onPress={() => setSelectedGuide("primary")}
              >
                <Text
                  style={[
                    styles.videoPickerButtonText,
                    selectedGuide === "primary" && styles.videoPickerButtonTextActive,
                  ]}
                >
                  {isGuide ? "Video Tutorial" : "Main Video"}
                </Text>
              </Pressable>
            ) : null}

            {hasAlt ? (
              <Pressable
                style={[styles.videoPickerButton, selectedGuide === "alt" && styles.videoPickerButtonActive]}
                onPress={() => setSelectedGuide("alt")}
              >
                <Text
                  style={[styles.videoPickerButtonText, selectedGuide === "alt" && styles.videoPickerButtonTextActive]}
                >
                  Alt Video
                </Text>
              </Pressable>
            ) : null}

            {!isGuide && hasImageGuide ? (
              <Pressable
                style={[styles.videoPickerButton, selectedGuide === "image" && styles.videoPickerButtonActive]}
                onPress={() => setSelectedGuide("image")}
              >
                <Text
                  style={[
                    styles.videoPickerButtonText,
                    selectedGuide === "image" && styles.videoPickerButtonTextActive,
                  ]}
                >
                  Setup Image
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {selectedGuide === "image" && referenceImage && !isGuide ? (
          <Image source={referenceImage} style={styles.thumbnail} resizeMode="contain" />
        ) : thumbnail ? (
          <Pressable style={styles.thumbnailWrap} onPress={() => youtubeUrl && Linking.openURL(youtubeUrl)}>
            <Image source={{ uri: thumbnail }} style={styles.thumbnail} />
            <View style={styles.playOverlay}>
              <Text style={styles.playOverlayText}>▶</Text>
            </View>
          </Pressable>
        ) : null}

        {selectedGuide !== "image" ? (
          <>
            {activeTitle ? <Text style={[styles.videoMetaTitle, { color: colors.text }]}>{activeTitle}</Text> : null}
            {activeChannel ? (
              <Text style={[styles.videoMetaChannel, { color: colors.textMuted }]}>Channel: {activeChannel}</Text>
            ) : null}
            <View style={styles.videoActions}>
              {youtubeUrl ? (
                <Pressable style={styles.youtubeButton} onPress={() => Linking.openURL(youtubeUrl)}>
                  <Text style={styles.youtubeButtonText}>Open in YouTube</Text>
                </Pressable>
              ) : null}
            </View>
          </>
        ) : null}
      </View>

      {isGuide ? (
        <>
          <View style={[styles.guideLeadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.guideLeadTitle, { color: colors.text }]}>Start Here</Text>
            <Text style={[styles.guideLeadBody, { color: colors.textMuted }]}>
              {guidePlaybook?.intro ?? routine.setup_instructions}
            </Text>
            <View
              style={[styles.guideDisclaimer, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
            >
              <Text style={[styles.guideDisclaimerTitle, { color: colors.text }]}>Personal Fit Matters</Text>
              <Text style={[styles.guideDisclaimerBody, { color: colors.textMuted }]}>
                Fundamentals are your starting framework, not a fixed mold. Keep the core principles, then adapt details
                to your body type, flexibility, and natural timing.
              </Text>
            </View>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Why This Fundamental Matters</Text>
            {(guidePlaybook?.importance ?? []).map((item, index) => (
              <Text key={`${routine.id}-importance-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                • {item}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Where to Start</Text>
            {(guidePlaybook?.whereToStart ?? []).map((item, index) => (
              <Text key={`${routine.id}-start-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                {index + 1}. {item}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Step-by-Step Practice Plan</Text>
            {(guidePlaybook?.stepByStep ?? routine.steps ?? []).map((item, index) => (
              <Text key={`${routine.id}-detailed-step-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                {index + 1}. {item}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Progression Path</Text>
            {(guidePlaybook?.progression ?? []).map((item, index) => (
              <Text key={`${routine.id}-progression-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                • {item}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Common Technique Systems</Text>
            {(guidePlaybook?.commonTechniques ?? []).map((item, index) => (
              <Text key={`${routine.id}-systems-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                • {item}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What Goes Wrong If It Breaks Down</Text>
            {(guidePlaybook?.commonIssues ?? []).map((issue, index) => (
              <View key={`${routine.id}-issue-${index}`} style={[styles.issueRow, { borderColor: colors.border }]}>
                <Text style={styles.issueIcon}>⚠️</Text>
                <Text style={[styles.issueText, { color: colors.textMuted }]}>{issue}</Text>
              </View>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Build Your Own Version</Text>
            {(guidePlaybook?.adaptNotes ?? []).map((note, index) => (
              <Text key={`${routine.id}-adapt-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                • {note}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Session Blueprint</Text>
            <Text style={[styles.sectionContent, { color: colors.textMuted }]}>{routine.setup_instructions}</Text>
            {(guidePlaybook?.sessionPlan ?? []).map((step, index) => (
              <Text key={`${routine.id}-plan-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                {index + 1}. {step}
              </Text>
            ))}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Self-Check Checklist</Text>
            {(guidePlaybook?.checkpoints ?? []).map((point, index) => (
              <Text key={`${routine.id}-checkpoint-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                □ {point}
              </Text>
            ))}
            <Text style={[styles.sectionContent, { color: colors.textMuted }]}>{routine.success_criteria}</Text>
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What You'll Build</Text>
            {(routine.improves ?? []).map((tip, index) => (
              <Text key={`${routine.id}-tip-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                {tip}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <>
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
            <Text style={[styles.statRow, { color: colors.textMuted }]}>
              Scoring: {scoringTypeLabel(routine.scoring_type as ScoringType)}
            </Text>
            <Text style={[styles.statRow, { color: colors.textMuted }]}>
              {scoringRecordingHint(routine.scoring_type as ScoringType)}
            </Text>
            {routine.max_score ? (
              <Text style={[styles.statRow, { color: colors.textMuted }]}>Session cap: {routine.max_score}</Text>
            ) : null}
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What This Improves</Text>
            {(routine.improves ?? []).map((tip, index) => (
              <Text key={`${routine.id}-tip-${index}`} style={[styles.listItem, { color: colors.textMuted }]}>
                {tip}
              </Text>
            ))}
          </View>

          <RoutineProgressCard routine={routine} style={styles.progress} />

          <View style={styles.progress}>
            <RoutineLeaderboardCard
              routineKey={routine.id}
              onSeeAll={() =>
                (navigation as any).navigate("RoutineLeaderboard", { routineKey: routine.id, name: routine.name })
              }
              onOpenPlayer={(userId) =>
                (navigation as any).navigate("Community", { screen: "PlayerProfile", params: { userId } })
              }
            />
          </View>

          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Results</Text>
            {entries.length === 0 ? (
              <Text style={styles.empty}>No scores recorded yet. Add your first result below.</Text>
            ) : (
              entries.map((entry) => (
                <View
                  key={entry.id}
                  style={[styles.entryCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
                >
                  <View style={styles.entryHeader}>
                    <Text style={[styles.entryScore, { color: colors.text }]}>{entry.score}</Text>
                    <Text style={[styles.entryDate, { color: colors.textMuted }]}>
                      {new Date(entry.recorded_at).toLocaleString()}
                    </Text>
                  </View>
                  {entry.notes ? (
                    <Text style={[styles.entryNotes, { color: colors.textMuted }]}>{entry.notes}</Text>
                  ) : null}
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
          <Pressable
            style={[styles.primaryButton, styles.sendButton, { borderColor: colors.border }]}
            accessibilityRole="button"
            onPress={() =>
              openSendToChat({
                kind: "routine",
                name: routine.name,
                subtitle: routine.max_score ? `Up to ${routine.max_score}` : null,
                libraryId: routine.id,
              })
            }
          >
            <Text style={[styles.primaryButtonText, { color: colors.text }]}>Send in a chat</Text>
          </Pressable>
        </>
      )}
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
  progress: {
    marginBottom: 16,
  },
  heroCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 8,
  },
  iconChip: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: {
    fontSize: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  metaPillsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  metaPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  metaPillText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  summary: {
    fontSize: 14,
    lineHeight: 20,
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
  guideLeadCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  guideLeadTitle: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  guideLeadBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  guideDisclaimer: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    padding: 10,
  },
  guideDisclaimerTitle: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 4,
  },
  guideDisclaimerBody: {
    fontSize: 13,
    lineHeight: 19,
  },
  issueRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  issueIcon: {
    fontSize: 14,
    lineHeight: 19,
  },
  issueText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
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
  youtubeButton: {
    flex: 0,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 14,
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
  sendButton: {
    borderWidth: 1,
    marginTop: 10,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
