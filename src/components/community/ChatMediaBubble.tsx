import React from "react";
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { MediaShare } from "../../features/community/chatShare";
import { RADIUS, SPACING } from "../../constants";

const SIZE = 220;

/** An image, video or PDF sent in a chat. A video is a tap-to-play thumbnail rather than a live
 * player, the same reason a coach group's feed does not load every video at once. */
export const ChatMediaBubble = ({ share, url, onExpand }: { share: MediaShare; url: string | null; onExpand: () => void }) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();

  if (!url) {
    return (
      <View style={[styles.box, styles.centre, { backgroundColor: colors.surfaceMuted }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (share.mediaType === "image") {
    return (
      <Pressable onPress={onExpand} accessibilityRole="imagebutton" accessibilityLabel="Expand image">
        <Image source={{ uri: url }} style={styles.box} resizeMode="cover" />
      </Pressable>
    );
  }

  if (share.mediaType === "video") {
    return (
      <Pressable
        onPress={onExpand}
        accessibilityRole="button"
        accessibilityLabel="Play video"
        style={[styles.box, styles.centre, { backgroundColor: colors.board }]}
      >
        <View style={[styles.playButton, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
          <MaterialCommunityIcons name="play" size={26} color="#FFFFFF" />
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={() => navigation.navigate("PdfViewer", { url, title: share.fileName ?? undefined })}
      accessibilityRole="button"
      accessibilityLabel={share.fileName ? `Open ${share.fileName}` : "Open document"}
      style={[styles.pdfCard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
    >
      <View style={[styles.pdfThumb, { backgroundColor: colors.board }]}>
        <MaterialCommunityIcons name="file-pdf-box" size={40} color={colors.boardRule} />
      </View>
      <Text style={[styles.pdfName, { color: colors.text }]} numberOfLines={2}>
        {share.fileName || "Document"}
      </Text>
      <Text style={[styles.pdfOpen, { color: colors.textMuted }]}>Open document</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  box: { width: SIZE, height: Math.round(SIZE * 0.75), borderRadius: RADIUS.md },
  centre: { alignItems: "center", justifyContent: "center" },
  playButton: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  pdfCard: { width: 200, alignItems: "center", borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, gap: 4 },
  pdfThumb: { width: 64, height: 64, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginBottom: SPACING.xs },
  pdfName: { fontSize: 14, fontWeight: "700", textAlign: "center" },
  pdfOpen: { fontSize: 12 },
});
