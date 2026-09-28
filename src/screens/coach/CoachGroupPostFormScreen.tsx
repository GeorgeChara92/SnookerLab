import React, { useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { createGroupPost } from "../../features/coach/groups";
import { uploadGroupMedia } from "../../features/coach/groupMedia";
import type { CoachGroupMediaType } from "../../features/coach/types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const CAPTION_LIMIT = 500;

type PickedFile = { uri: string; fileName?: string | null; mimeType?: string | null; label: string };

/** A real preview of the picked clip before posting - just the one instance here, unlike the
 * group's feed, where many at once is what a static thumbnail avoids. */
const VideoPreview = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer({ uri }, (instance) => {
    instance.loop = false;
  });
  return <VideoView player={player} style={styles.previewImage} nativeControls contentFit="cover" />;
};

/** Posting a routine video, an image, or a PDF to a group - everyone in it sees it once it's up. */
export const CoachGroupPostFormScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { groupId } = route.params as { groupId: string };
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const [mediaType, setMediaType] = useState<CoachGroupMediaType>("image");
  const [file, setFile] = useState<PickedFile | null>(null);
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);

  const pick = async (type: CoachGroupMediaType) => {
    setMediaType(type);
    if (type === "pdf") {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setFile({ uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType, label: asset.name });
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      dialog.alert({ title: "Library access needed", message: "Allow access to your photo library in Settings, then choose a file." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: type === "video" ? ["videos"] : ["images"],
      allowsEditing: false,
      videoMaxDuration: type === "video" ? 60 : undefined,
    });
    if (result.canceled || !result.assets?.length) return;
    const asset = result.assets[0];
    setFile({ uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType, label: type === "video" ? "Video selected" : "Image selected" });
  };

  const post = async () => {
    if (!me || !file) return;
    setUploading(true);
    const uploaded = await uploadGroupMedia(groupId, file, mediaType);
    if (!uploaded.ok) {
      setUploading(false);
      dialog.alert({ title: "Upload failed", message: uploaded.message, tone: "danger" });
      return;
    }
    const result = await createGroupPost(groupId, me, uploaded.path, mediaType, caption, file.fileName);
    setUploading(false);
    if (result.ok) navigation.goBack();
    else dialog.alert({ title: "Could not post that", message: result.message, tone: "danger" });
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
      <Text style={[styles.label, { color: colors.textMuted }]}>What are you sharing?</Text>
      <View style={styles.typeRow}>
        {(["image", "video", "pdf"] as const).map((type) => {
          const selected = mediaType === type;
          return (
            <Pressable
              key={type}
              onPress={() => {
                setFile(null);
                void pick(type);
              }}
              accessibilityRole="button"
              style={[
                styles.typeButton,
                { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : colors.surface },
              ]}
            >
              <MaterialCommunityIcons
                name={type === "image" ? "image-outline" : type === "video" ? "video-outline" : "file-pdf-box"}
                size={22}
                color={selected ? colors.primary : colors.text}
              />
              <Text style={[styles.typeText, { color: selected ? colors.primary : colors.text }]}>
                {type === "image" ? "Image" : type === "video" ? "Video" : "PDF"}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {file ? (
        <View style={[styles.filePreview, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {mediaType === "image" ? (
            <Image source={{ uri: file.uri }} style={styles.previewImage} resizeMode="cover" />
          ) : mediaType === "video" ? (
            <VideoPreview uri={file.uri} />
          ) : (
            <View style={styles.fileRow}>
              <MaterialCommunityIcons name="file-pdf-box" size={24} color={colors.primary} />
              <Text style={[styles.fileLabel, { color: colors.text }]} numberOfLines={1}>
                {file.label}
              </Text>
            </View>
          )}
          <Pressable onPress={() => void pick(mediaType)} accessibilityRole="button">
            <Text style={[styles.change, { color: colors.primary }]}>Change</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => void pick(mediaType)} accessibilityRole="button" style={[styles.pickButton, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="tray-arrow-up" size={22} color={colors.primary} />
          <Text style={[styles.pickText, { color: colors.primary }]}>Choose a file</Text>
        </Pressable>
      )}

      <Text style={[styles.label, styles.captionLabel, { color: colors.textMuted }]}>Caption (optional)</Text>
      <TextInput
        value={caption}
        onChangeText={(text) => setCaption(text.slice(0, CAPTION_LIMIT))}
        placeholder="What should they do with this?"
        placeholderTextColor={colors.textMuted}
        multiline
        textAlignVertical="top"
        style={[styles.captionInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />

      <Pressable
        onPress={post}
        disabled={uploading || !file}
        accessibilityRole="button"
        style={[styles.post, { backgroundColor: colors.primary, opacity: uploading || !file ? 0.5 : 1 }]}
      >
        {uploading ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.postText, { color: colors.onPrimary }]}>Post to group</Text>}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.sm },
  label: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  captionLabel: { marginTop: SPACING.md },
  typeRow: { flexDirection: "row", gap: SPACING.sm },
  typeButton: { flex: 1, alignItems: "center", gap: 4, borderWidth: 1, borderRadius: RADIUS.md, paddingVertical: SPACING.sm },
  typeText: { fontSize: 13, fontWeight: "700" },
  pickButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 30,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
    marginTop: SPACING.sm,
  },
  pickText: { fontSize: 15, fontWeight: "700" },
  filePreview: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden", marginTop: SPACING.sm },
  previewImage: { width: "100%", height: 180 },
  fileRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, padding: SPACING.md },
  fileLabel: { flex: 1, fontSize: 14, fontWeight: "600" },
  change: { fontSize: 14, fontWeight: "700", textAlign: "center", paddingVertical: SPACING.sm },
  captionInput: { minHeight: 90, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 15, lineHeight: 20 },
  post: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginTop: SPACING.md },
  postText: { fontSize: 16, fontWeight: "800" },
});
