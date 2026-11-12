import React from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getRoutineReferenceImageByRoutineId } from "../../features/ar/routineLayouts";
import { getYoutubeThumbnailUrl, getYoutubeWatchUrl } from "../../utils/youtube";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";
import type { Routine } from "../../types";

/**
 * A technique guide (stance, grip, cueing...), laid out from exactly what's written for it in the
 * admin dashboard: the photo, the summary, About, Before you start, the steps, how you'll know
 * it's working, what it builds and the videos. Nothing here is written in code, so an edit in the
 * dashboard is what players see (before 2026-11-12 the page showed fixed text instead).
 */
export const GuideDetail = ({ routine, categoryName }: { routine: Routine; categoryName?: string }) => {
  const { colors } = useAppTheme();
  const photo = getRoutineReferenceImageByRoutineId(routine.id);
  const videos = [
    { id: routine.youtube_video_id, title: routine.youtube_title, channel: routine.youtube_channel },
    { id: routine.youtube_alt_video_id, title: routine.youtube_alt_title, channel: routine.youtube_alt_channel },
  ].filter((video): video is { id: string; title: string | undefined; channel: string | undefined } => Boolean(video.id));

  const kicker = [categoryName ?? "Fundamentals", routine.estimated_duration_minutes ? `${routine.estimated_duration_minutes} min` : null]
    .filter(Boolean)
    .join(" · ")
    .toUpperCase();

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      {photo ? (
        <Image
          source={photo}
          style={[styles.photo, { backgroundColor: colors.surfaceMuted }]}
          contentFit="cover"
          accessibilityLabel={`${routine.name}: reference photo`}
        />
      ) : null}

      <View style={styles.head}>
        <Text style={[styles.kicker, { color: colors.primary }]}>{kicker}</Text>
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {routine.icon ? `${routine.icon}  ` : ""}
          {routine.name}
        </Text>
        {routine.summary ? <Text style={[styles.summary, { color: colors.textMuted }]}>{routine.summary}</Text> : null}
        {routine.improves?.length ? (
          <View style={styles.chips} accessibilityLabel={`Builds: ${routine.improves.join(", ")}`}>
            {routine.improves.map((item) => (
              <View key={item} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.chipText, { color: colors.text }]}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>

      {routine.description ? (
        <Section title="About">
          <WriteUp text={routine.description} />
        </Section>
      ) : null}

      {routine.setup_instructions ? (
        <BoardPanel kicker="BEFORE YOU START">
          <WriteUp text={routine.setup_instructions} onBoard />
        </BoardPanel>
      ) : null}

      {routine.steps?.length ? (
        <Section title="Step by step">
          <View>
            {routine.steps.map((step, index) => {
              const last = index === routine.steps!.length - 1;
              return (
                <View key={index} style={styles.step}>
                  <View style={styles.stepRail}>
                    <View style={[styles.stepNumber, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
                      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.stepNumberText, { color: colors.boardText }]}>
                        {index + 1}
                      </Text>
                    </View>
                    {last ? null : <View style={[styles.stepLine, { backgroundColor: colors.border }]} />}
                  </View>
                  <View style={[styles.stepBody, last ? null : styles.stepBodyGap]}>
                    <WriteUp text={step} leadIn />
                  </View>
                </View>
              );
            })}
          </View>
        </Section>
      ) : null}

      {routine.success_criteria ? (
        <View style={[styles.check, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.checkHead}>
            <MaterialCommunityIcons name="check-decagram-outline" size={22} color={colors.primary} />
            <Text accessibilityRole="header" style={[styles.checkTitle, { color: colors.text }]}>
              How you'll know it's working
            </Text>
          </View>
          <WriteUp text={routine.success_criteria} />
        </View>
      ) : null}

      {videos.length ? (
        <Section title="Watch it done">
          <View style={styles.videos}>
            {videos.map((video) => (
              <Pressable
                key={video.id}
                onPress={() => void Linking.openURL(getYoutubeWatchUrl(video.id))}
                accessibilityRole="link"
                accessibilityLabel={`Watch ${video.title ?? "the video"} on YouTube`}
                style={({ pressed }) => [
                  styles.video,
                  { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <View>
                  <Image source={{ uri: getYoutubeThumbnailUrl(video.id) }} style={styles.videoThumb} cachePolicy="memory-disk" />
                  <View style={styles.play}>
                    <MaterialCommunityIcons name="play" size={26} color="#FFFFFF" />
                  </View>
                </View>
                <View style={styles.videoText}>
                  {video.title ? (
                    <Text style={[styles.videoTitle, { color: colors.text }]} numberOfLines={2}>
                      {video.title}
                    </Text>
                  ) : null}
                  {video.channel ? <Text style={[styles.videoChannel, { color: colors.textMuted }]}>{video.channel}</Text> : null}
                </View>
              </Pressable>
            ))}
          </View>
        </Section>
      ) : null}

      <View style={[styles.note, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="account-cog-outline" size={20} color={colors.textMuted} />
        <Text style={[styles.noteText, { color: colors.textMuted }]}>
          Make it yours. Keep the principles, then adjust the details to your height, build and what feels natural.
        </Text>
      </View>
    </ScrollView>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.sectionTitle, { color: colors.text }]}>
        {title}
      </Text>
      {children}
    </View>
  );
};

/** "Find your balance: keep..." - a short title before a colon reads as the step's own heading. */
const LEAD_IN = /^([^:\n]{2,42}):\s+([\s\S]*)$/;

/**
 * Text as written in the dashboard: a blank line starts a new paragraph, and lines starting with
 * "- " are a list. With `leadIn`, a short phrase before a colon at the start is set in bold, and
 * so is one at the start of each list item ("Right-handed players: ...").
 */
const WriteUp = ({ text, leadIn = false, onBoard = false }: { text: string; leadIn?: boolean; onBoard?: boolean }) => {
  const { colors } = useAppTheme();
  const body = onBoard ? colors.boardText : colors.text;
  const muted = onBoard ? colors.boardMuted : colors.textMuted;

  let rest = text.trim();
  let lead: string | null = null;
  if (leadIn) {
    const match = LEAD_IN.exec(rest);
    if (match) {
      lead = match[1].trim();
      rest = match[2].trim();
    }
  }

  const withLead = (line: string, colour: string) => {
    const match = LEAD_IN.exec(line);
    return match ? (
      <Text style={[styles.body, { color: colour }]}>
        <Text style={[styles.bold, { color: body }]}>{match[1].trim()}: </Text>
        {match[2]}
      </Text>
    ) : (
      <Text style={[styles.body, { color: colour }]}>{line}</Text>
    );
  };

  const blocks = rest.split(/\n\s*\n/).map((block) => block.split("\n").map((line) => line.trim()).filter(Boolean));

  return (
    <View style={styles.writeUp}>
      {lead ? <Text style={[styles.lead, { color: body }]}>{lead}</Text> : null}
      {blocks.map((lines, index) => (
        <View key={index} style={styles.block}>
          {lines.map((line, lineIndex) => {
            const bullet = /^[-•]\s+/.test(line);
            return bullet ? (
              <View key={lineIndex} style={styles.bulletRow}>
                <View style={[styles.bulletDot, { backgroundColor: onBoard ? colors.boardRule : colors.primary }]} />
                <View style={styles.bulletText}>{withLead(line.replace(/^[-•]\s+/, ""), muted)}</View>
              </View>
            ) : (
              <View key={lineIndex}>{withLead(line, lead || leadIn ? muted : body)}</View>
            );
          })}
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.xl },
  photo: { width: "100%", aspectRatio: 16 / 10, borderRadius: RADIUS.xl },
  head: { gap: SPACING.sm },
  kicker: { fontSize: 12, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: "800" },
  summary: { fontSize: 16, lineHeight: 23 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: "700" },
  section: { gap: SPACING.md },
  sectionTitle: { fontSize: 19, fontWeight: "800" },
  writeUp: { gap: SPACING.md },
  block: { gap: SPACING.sm },
  lead: { fontSize: 16, lineHeight: 22, fontWeight: "800" },
  body: { fontSize: 15, lineHeight: 23 },
  bold: { fontWeight: "800" },
  bulletRow: { flexDirection: "row", gap: SPACING.sm, paddingRight: SPACING.xs },
  bulletDot: { width: 6, height: 6, borderRadius: 3, marginTop: 9 },
  bulletText: { flex: 1 },
  step: { flexDirection: "row", gap: SPACING.md },
  stepRail: { alignItems: "center", width: 34 },
  stepNumber: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumberText: { fontFamily: FONTS.board, fontSize: 18 },
  stepLine: { flex: 1, width: 2, marginVertical: 4, borderRadius: 1 },
  stepBody: { flex: 1, paddingTop: 5 },
  stepBodyGap: { paddingBottom: SPACING.xl },
  check: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  checkHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  checkTitle: { flex: 1, fontSize: 17, fontWeight: "800" },
  videos: { gap: SPACING.md },
  video: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  videoThumb: { width: "100%", aspectRatio: 16 / 9 },
  play: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 52,
    height: 52,
    marginLeft: -26,
    marginTop: -26,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  videoText: { padding: SPACING.md, gap: 2 },
  videoTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  videoChannel: { fontSize: 13 },
  note: { flexDirection: "row", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
