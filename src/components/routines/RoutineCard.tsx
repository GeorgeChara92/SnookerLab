import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Routine } from "../../types";
import { getYoutubeThumbnailUrl } from "../../utils/youtube";
import { useAppTheme } from "../../hooks/useAppTheme";

interface RoutineCardProps {
  routine: Routine;
  categoryName: string;
  categoryColor?: string;
  onPress: () => void;
}

export const RoutineCard = ({ routine, categoryName, categoryColor, onPress }: RoutineCardProps) => {
  const videoId = routine.youtube_video_id ?? routine.youtube_alt_video_id;
  const thumbnail = videoId ? getYoutubeThumbnailUrl(videoId) : undefined;
  const { colors } = useAppTheme();

  return (
    <Pressable style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={onPress}>
      {thumbnail ? (
        <View>
          <Image source={{ uri: thumbnail }} style={styles.previewImage} />
          <View style={styles.playBadge}>
            <Text style={styles.playText}>▶</Text>
          </View>
        </View>
      ) : null}
      <View style={styles.topRow}>
        <View style={styles.leftMeta}>
            <Text style={styles.icon}>{routine.icon ?? "🎱"}</Text>
            <View>
              <Text style={[styles.title, { color: colors.text }]}>{routine.name}</Text>
              <Text style={[styles.category, { color: categoryColor ?? "#0F766E" }]}>{categoryName}</Text>
            </View>
          </View>
        <Text style={[styles.difficulty, { backgroundColor: colors.surfaceMuted, color: colors.textMuted }]}>{routine.difficulty}</Text>
      </View>
      <Text style={[styles.summary, { color: colors.textMuted }]}>{routine.summary ?? routine.description ?? "Structured snooker drill."}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  previewImage: {
    width: "100%",
    height: 130,
    borderRadius: 10,
    marginBottom: 10,
    backgroundColor: "#E2E8F0",
  },
  playBadge: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(16,42,67,0.82)",
    alignItems: "center",
    justifyContent: "center",
  },
  playText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  leftMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  icon: {
    fontSize: 22,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  category: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  difficulty: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    textTransform: "capitalize",
    overflow: "hidden",
  },
  summary: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
  },
});
