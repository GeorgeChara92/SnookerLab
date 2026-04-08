import React, { useState } from "react";
import { View, StyleSheet, Text, Alert, ActivityIndicator, TextInput, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { AppButton } from "../../components/ui/AppButton";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAIAnalysesStore } from "../../store";
import { supabase } from "../../api/supabase";
import type { AICoachStackParamList, AnalysisType } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";

const ANALYSIS_TYPES: { label: string; value: AnalysisType }[] = [
  { label: "Shot", value: "shot" },
  { label: "Stance", value: "stance" },
  { label: "Technique", value: "technique" },
  { label: "Tactical", value: "tactical" },
  { label: "Full Session", value: "full_session" },
];

const CONTEXT_TAGS = [
  { value: "practice", label: "Practice" },
  { value: "match", label: "Match" },
  { value: "break-building", label: "Break Building" },
  { value: "safety", label: "Safety" },
  { value: "long-pot", label: "Long Pot" },
  { value: "cue-action", label: "Cue Action" },
];

const ENABLE_AI_STORAGE_UPLOAD = process.env.EXPO_PUBLIC_ENABLE_AI_STORAGE_UPLOAD !== "0";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const STORAGE_UPLOAD_TIMEOUT_BASE_MS = 60000;
const STORAGE_UPLOAD_TIMEOUT_PER_MB_MS = 2000;
const STORAGE_UPLOAD_TIMEOUT_MAX_MS = 180000;

const inferContentType = (ext: string, mimeType?: string) => {
  if (mimeType) return mimeType;
  if (ext === "mov") return "video/quicktime";
  if (ext === "mp4") return "video/mp4";
  return "application/octet-stream";
};

const safeErrorMessage = (error: any) => {
  const message = typeof error?.message === "string" ? error.message : "Unknown error";
  return message.length > 180 ? `${message.slice(0, 180)}...` : message;
};

const withTimeout = async <T,>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
};

const formatDurationSeconds = (rawDuration?: number) => {
  if (!rawDuration || Number.isNaN(rawDuration) || rawDuration <= 0) return "Unknown";
  const seconds = rawDuration > 1000 ? rawDuration / 1000 : rawDuration;
  return `${seconds.toFixed(1)}s`;
};

const getDurationSeconds = (rawDuration?: number) => {
  if (!rawDuration || Number.isNaN(rawDuration) || rawDuration <= 0) return 0;
  return rawDuration > 1000 ? rawDuration / 1000 : rawDuration;
};

const getUploadTimeoutMs = (fileSizeBytes?: number) => {
  const mb = Math.max(0, Math.ceil((fileSizeBytes ?? 0) / 1024 / 1024));
  const computed = STORAGE_UPLOAD_TIMEOUT_BASE_MS + mb * STORAGE_UPLOAD_TIMEOUT_PER_MB_MS;
  return Math.min(STORAGE_UPLOAD_TIMEOUT_MAX_MS, computed);
};

export const VideoUploadScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [video, setVideo] = useState<any>(null);
  const [analysisType, setAnalysisType] = useState<AnalysisType>("technique");
  const [notes, setNotes] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { createAnalysis, runAnalysis } = useAIAnalysesStore();

  const validateClipLength = (asset: any) => {
    const seconds = getDurationSeconds(asset?.duration);
    if (!seconds) {
      Alert.alert("Invalid clip", "We could not read the clip duration. Please choose another video.");
      return false;
    }

    if (seconds < 10 || seconds > 20) {
      Alert.alert("Clip length required", "Please upload a clip between 10 and 20 seconds for best analysis quality.");
      return false;
    }

    return true;
  };

  const checkLimit = () => {
    if (!subscription.canUseAI) {
      setShowPaywall(true);
      return false;
    }

    return true;
  };

  const pickVideo = async () => {
    if (!checkLimit()) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant permission to access your media library.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      if (!validateClipLength(selected)) return;
      setVideo(selected);
    }
  };

  const recordVideo = async () => {
    if (!checkLimit()) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please grant permission to access your camera.");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = result.assets[0];
      if (!validateClipLength(selected)) return;
      setVideo(selected);
    }
  };

  const uploadVideo = async () => {
    if (!video) return;
    if (!checkLimit()) return;
    if (!validateClipLength(video)) return;

    const authUser = (await supabase.auth.getUser()).data.user;
    if (!authUser) {
      Alert.alert("Sign in required", "Please sign in before uploading AI analysis videos.");
      return;
    }

    setUploading(true);
    setProgress(0.05);
    setProgressLabel("Preparing upload...");

    try {
      const ext = (video.fileName?.split(".").pop() || video.uri.split(".").pop() || "mp4").toLowerCase();
      const path = `${authUser.id}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;

      if (!ENABLE_AI_STORAGE_UPLOAD) {
        throw new Error("Clip uploads are temporarily unavailable in this build.");
      }

      setProgress(0.2);
      setProgressLabel("Uploading clip...");
      const session = (await supabase.auth.getSession()).data.session;
      if (!session?.access_token) {
        throw new Error("Auth session missing for upload.");
      }
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        throw new Error("Upload service is not fully configured.");
      }

      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/ai-videos/${encodeURIComponent(path)}`;
      const uploadResult = await withTimeout(
        FileSystemLegacy.uploadAsync(uploadUrl, video.uri, {
          httpMethod: "POST",
          uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: SUPABASE_ANON_KEY,
            "Content-Type": inferContentType(ext, video.mimeType),
            "x-upsert": "false",
          },
        }),
        getUploadTimeoutMs(video.fileSize),
        "Storage upload timed out"
      );

      if (uploadResult.status < 200 || uploadResult.status >= 300) {
        throw new Error(`Storage upload failed with status ${uploadResult.status}`);
      }

      const persistedVideoPath = path;
      setProgress(0.55);
      setProgressLabel("Upload complete");

      setProgress(0.68);
      setProgressLabel("Creating analysis record...");
      const analysisId = await createAnalysis({
        videoPath: persistedVideoPath,
        analysisType,
        contextTags: selectedTags,
        userNotes: notes.trim() || undefined,
      });

      setProgress(0.82);
      setProgressLabel("AI is analyzing your clip...");
      await runAnalysis(analysisId);
      setProgress(1);
      setProgressLabel("Analysis complete");

      setVideo(null);
      setNotes("");
      setSelectedTags([]);
      navigation.replace("AnalysisDetail", { analysisId });
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
        setUploading(false);
        setProgress(0);
        setProgressLabel("");
        return;
      }

      const message = safeErrorMessage(error);
      Alert.alert("Upload failed", `Could not start analysis. ${message}`);
      console.warn("AI upload failed:", message);
    } finally {
      setUploading(false);
      setProgress(0);
      setProgressLabel("");
    }
  };

  const remaining = subscription.remaining.aiAnalyses ?? Infinity;
  const remainingText = remaining === Infinity ? "Unlimited" : `${remaining} remaining`;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <View style={[styles.headerCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>New Analysis</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Upload a 10-20 second clip for personalised coaching feedback.
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {subscription.tierLabel} · {remainingText} this month
        </Text>
      </View>

      {!video ? (
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <AppButton label="Upload from Library" onPress={pickVideo} />
          <View style={styles.buttonSpacer} />
          <AppButton label="Record Video" onPress={recordVideo} variant="secondary" />
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Select a 10-20 second clip
          </Text>
        </View>
      ) : (
        <>
          <View style={[styles.videoCard, { backgroundColor: colors.surface, borderColor: colors.primary }]}> 
            <View style={styles.videoHeader}>
              <Text style={[styles.videoLabel, { color: colors.primary }]}>CLIP READY</Text>
              <Pressable onPress={() => setVideo(null)}>
                <Text style={[styles.changeButton, { color: colors.primary }]}>Change</Text>
              </Pressable>
            </View>
            <Text style={[styles.videoInfo, { color: colors.text }]}>
              {formatDurationSeconds(video.duration)} · {((video.fileSize ?? 0) / 1024 / 1024).toFixed(1)} MB
            </Text>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Analysis Type</Text>
            <View style={styles.chipsRow}>
              {ANALYSIS_TYPES.slice(0, 3).map((item) => {
                const selected = analysisType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setAnalysisType(item.value)}
                    style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : colors.surfaceMuted }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.chipsRow}>
              {ANALYSIS_TYPES.slice(3).map((item) => {
                const selected = analysisType === item.value;
                return (
                  <Pressable
                    key={item.value}
                    onPress={() => setAnalysisType(item.value)}
                    style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : colors.surfaceMuted }]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.primary : colors.text }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Context Tags</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Optional · helps focus the analysis</Text>
            <View style={styles.chipsRow}>
              {CONTEXT_TAGS.slice(0, 3).map((tag) => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <Pressable
                    key={tag.value}
                    onPress={() => setSelectedTags((prev) => (prev.includes(tag.value) ? prev.filter((t) => t !== tag.value) : [...prev, tag.value]))}
                    style={[styles.chipSmall, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : "transparent" }]}
                  >
                    <Text style={[styles.chipSmallText, { color: selected ? colors.primary : colors.textMuted }]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.chipsRow}>
              {CONTEXT_TAGS.slice(3).map((tag) => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <Pressable
                    key={tag.value}
                    onPress={() => setSelectedTags((prev) => (prev.includes(tag.value) ? prev.filter((t) => t !== tag.value) : [...prev, tag.value]))}
                    style={[styles.chipSmall, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary + "15" : "transparent" }]}
                  >
                    <Text style={[styles.chipSmallText, { color: selected ? colors.primary : colors.textMuted }]}>{tag.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <Pressable style={[styles.notesToggle, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => setShowNotes(!showNotes)}>
            <Text style={[styles.notesToggleText, { color: colors.text }]}>
              {showNotes ? "Hide notes" : "Add notes (optional)"}
            </Text>
          </Pressable>

          {showNotes && (
            <View style={[styles.sectionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <TextInput
                style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                placeholder="e.g. Please check my cue action on long pots"
                placeholderTextColor={colors.textMuted}
                value={notes}
                onChangeText={setNotes}
                multiline
                textAlignVertical="top"
              />
            </View>
          )}

          {uploading ? (
            <View style={[styles.progressCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={[styles.progressLabel, { color: colors.text }]}>{progressLabel || "Working..."}</Text>
              <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` }]} />
              </View>
              <Text style={[styles.progressPercent, { color: colors.textMuted }]}>{Math.max(5, Math.round(progress * 100))}%</Text>
            </View>
          ) : (
            <View style={styles.uploadActions}>
              <AppButton label="Upload for Analysis" onPress={uploadVideo} />
            </View>
          )}
        </>
      )}

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
  content: { padding: 16, paddingBottom: 32 },
  headerCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 4 },
  subtitle: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  metaText: { fontSize: 12 },
  uploadCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  buttonSpacer: { height: 12 },
  hintText: { fontSize: 12, marginTop: 12, textAlign: "center" },
  videoCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 12,
  },
  videoHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  videoLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  videoInfo: { fontSize: 14 },
  changeButton: { fontSize: 13, fontWeight: "600" },
  sectionCard: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  sectionHint: { fontSize: 12, marginBottom: 12 },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  chip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: "600" },
  chipSmall: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  chipSmallText: { fontSize: 12, fontWeight: "500" },
  notesToggle: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    marginBottom: 12,
    alignItems: "center",
  },
  notesToggleText: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 80,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
  },
  progressCard: {
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  progressLabel: { fontSize: 14, marginTop: 12, marginBottom: 12, textAlign: "center" },
  progressTrack: { height: 6, borderRadius: 3, overflow: "hidden", width: "100%" },
  progressFill: { height: "100%", borderRadius: 3 },
  progressPercent: { marginTop: 8, fontSize: 12, fontWeight: "600" },
  uploadActions: { marginTop: 8 },
});