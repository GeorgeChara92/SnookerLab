import React, { useState } from "react";
import { createVideoPlayer } from "expo-video";
import { View, StyleSheet, Text, ActivityIndicator, TextInput, Pressable, ScrollView } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as ImagePicker from "expo-image-picker";
import * as FileSystemLegacy from "expo-file-system/legacy";
import { AppButton } from "../../components/ui/AppButton";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAIAnalysesStore } from "../../store";
import { supabase } from "../../api/supabase";
import { useConsentStore } from "../../store/consentStore";
import { Linking } from "react-native";
import type { AICoachStackParamList, AnalysisType } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";
import {
  ANALYSIS_TYPES as ANALYSIS_TYPE_INFO,
  ANALYSIS_TYPE_ORDER,
  CONTEXT_TAGS,
} from "../../features/ai/analysisLabels";

// One vocabulary for the whole AI Coach, so what you pick here is what the report calls it.
const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snookeredapp.com/privacy";

const ANALYSIS_TYPES: { label: string; value: AnalysisType }[] = ANALYSIS_TYPE_ORDER.map((value) => ({
  value,
  label: ANALYSIS_TYPE_INFO[value].label,
}));

/** The longest clip the coach watches. The picker, the trimmer and the check below all use it. */
const MAX_CLIP_SECONDS = 20;

const ENABLE_AI_STORAGE_UPLOAD = process.env.EXPO_PUBLIC_ENABLE_AI_STORAGE_UPLOAD !== "0";
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const STORAGE_UPLOAD_TIMEOUT_BASE_MS = 60000;
const STORAGE_UPLOAD_TIMEOUT_PER_MB_MS = 2000;
const STORAGE_UPLOAD_TIMEOUT_MAX_MS = 180000;

const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v"];

// The ai-videos bucket only accepts video types, so never fall back to octet-stream.
const inferContentType = (ext: string, mimeType?: string) => {
  if (mimeType && VIDEO_CONTENT_TYPES.includes(mimeType)) return mimeType;
  if (ext === "mov") return "video/quicktime";
  if (ext === "m4v") return "video/x-m4v";
  return "video/mp4";
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

/**
 * How long a clip really is, read from the file itself.
 *
 * The picker's own figure cannot be trusted after a trim: iOS hands back the trimmed video but
 * reports the length of the original, so a 6-second cut of a 76-second video reads as 76. The
 * video is loaded (not played) just long enough to read its duration. Returns null if it cannot
 * be read in time, and the picker's figure is used instead.
 */
const measureClipSeconds = (uri: string): Promise<number | null> =>
  new Promise((resolve) => {
    let player: ReturnType<typeof createVideoPlayer> | null = null;
    let settled = false;
    const subscriptions: Array<{ remove: () => void }> = [];

    const finish = (seconds: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscriptions.forEach((subscription) => subscription.remove());
      try {
        player?.release();
      } catch {
        // Already released.
      }
      resolve(seconds && seconds > 0 && Number.isFinite(seconds) ? seconds : null);
    };

    const timer = setTimeout(() => finish(null), 5000);

    try {
      player = createVideoPlayer({ uri });
      subscriptions.push(player.addListener("sourceLoad", ({ duration }) => finish(duration)));
      subscriptions.push(
        player.addListener("statusChange", ({ status }) => {
          if (status === "readyToPlay") finish(player?.duration ?? null);
          if (status === "error") finish(null);
        })
      );
    } catch {
      finish(null);
    }
  });

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
  const dialog = useDialog();
  const coachAnalysisAt = useConsentStore((state) => state.coachAnalysisAt);
  const allowCoachAnalysis = useConsentStore((state) => state.allowCoachAnalysis);
  const subscription = useSubscriptionAccess();
  const { createAnalysis, runAnalysis } = useAIAnalysesStore();

  const validateClipLength = (asset: any) => {
    const seconds = getDurationSeconds(asset?.duration);
    if (!seconds) {
      dialog.alert({
        title: "Clip could not be read",
        message: "We could not work out how long that clip is. Choose another video and try again.",
        tone: "danger",
        icon: "video-off-outline",
      });
      return false;
    }

    if (seconds > MAX_CLIP_SECONDS + 0.5) {
      dialog.alert({
        title: "That clip is too long",
        message: `It runs for ${Math.round(seconds)} seconds. The coach watches up to ${MAX_CLIP_SECONDS}, so trim it down to the shot you want looked at and try again.`,
        icon: "timer-outline",
      });
      return false;
    }

    return true;
  };

  /** The picked clip, with its duration (in ms, as the picker gives it) read from the file. */
  const withMeasuredLength = async (asset: any) => {
    const measured = asset?.uri ? await measureClipSeconds(asset.uri) : null;
    return measured ? { ...asset, duration: Math.round(measured * 1000) } : asset;
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
      dialog.alert({
        title: "Library access needed",
        message: "Allow access to your photo library in Settings, then choose a clip.",
        icon: "image-multiple-outline",
      });
      return;
    }

    // Telling the picker the limit is what makes the iOS trimmer useful: it opens with a
    // 20-second window you slide along the clip, rather than letting you keep nearly all of it.
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: MAX_CLIP_SECONDS,
      // This has to be something other than the default "passthrough". With passthrough, the
      // picker copies the original video out of the photo library and throws the trim away, so a
      // 6-second cut of a 76-second video came back 76 seconds long. Any export preset makes it
      // use the trimmed file instead; 720p shows a cue action clearly and uploads quickly.
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = await withMeasuredLength(result.assets[0]);
      if (!validateClipLength(selected)) return;
      setVideo(selected);
    }
  };

  const recordVideo = async () => {
    if (!checkLimit()) return;
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      dialog.alert({
        title: "Camera access needed",
        message: "Allow access to your camera in Settings, then record your clip.",
        icon: "camera-outline",
      });
      return;
    }

    // The camera stops on its own at the limit, so a recording can never come back too long.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["videos"],
      allowsEditing: true,
      videoMaxDuration: MAX_CLIP_SECONDS,
      // 720p shows a cue action clearly and uploads in a fraction of the time 4K takes.
      videoQuality: ImagePicker.UIImagePickerControllerQualityType.IFrame1280x720,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const selected = await withMeasuredLength(result.assets[0]);
      if (!validateClipLength(selected)) return;
      setVideo(selected);
    }
  };

  /** Clips are analysed by Google's Gemini API, so the first one asks before it is sent. */
  const askToSend = () =>
    new Promise<boolean>((resolve) => {
      if (coachAnalysisAt) {
        resolve(true);
        return;
      }
      dialog.confirm({
        title: "Send clips for analysis?",
        message:
          "Your clip is uploaded to your Snookered account and sent to Google's Gemini API, which watches it and writes the report. Only you can see your clips and reports in the app. The Privacy Policy explains what is kept and for how long.",
        icon: "robot-outline",
        confirmLabel: "Send clips",
        onConfirm: () => {
          allowCoachAnalysis();
          resolve(true);
        },
        onCancel: () => resolve(false),
      });
    });

  const uploadVideo = async () => {
    if (!video) return;
    if (!checkLimit()) return;
    if (!validateClipLength(video)) return;
    if (!(await askToSend())) return;

    const authUser = (await supabase.auth.getUser()).data.user;
    if (!authUser) {
      dialog.alert({
        title: "Sign in to continue",
        message: "Sign in to your account before sending a clip for analysis.",
        icon: "account-outline",
      });
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
      setProgressLabel("The coach is watching your clip...");
      const leave = () => {
        setVideo(null);
        setNotes("");
        setSelectedTags([]);
        navigation.replace("AnalysisDetail", { analysisId });
      };
      try {
        await runAnalysis(analysisId);
      } catch {
        // The clip is saved. Its page says why it failed and offers Try again on the same clip,
        // rather than a fresh upload that would count as another analysis.
        leave();
        return;
      }
      setProgress(1);
      setProgressLabel("Report ready");
      leave();
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
        setUploading(false);
        setProgress(0);
        setProgressLabel("");
        return;
      }

      const message = safeErrorMessage(error);
      dialog.alert({
        title: "Upload failed",
        message: "Could not upload your clip. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
        confirmLabel: "Try again",
      });
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
        <Text style={[styles.title, { color: colors.text }]}>New analysis</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Upload a clip of one shot, up to 20 seconds, for personalised coaching.
        </Text>
        <Text style={[styles.metaText, { color: colors.textMuted }]}>
          {subscription.tierLabel} · {remainingText} this month
        </Text>
      </View>

      {!video ? (
        <View style={[styles.uploadCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <AppButton label="Choose from your library" onPress={pickVideo} />
          <View style={styles.buttonSpacer} />
          <AppButton label="Record a clip" onPress={recordVideo} variant="secondary" />
          <Text style={[styles.hintText, { color: colors.textMuted }]}>
            Choose a clip of up to 20 seconds
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>What should the coach look at?</Text>
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
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Tags</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Optional. They help the coach focus.</Text>
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
              <Text style={[styles.privacyNote, { color: colors.textMuted }]}>
                Your clip is sent to Google&apos;s Gemini API to be analysed. Only you see your clips and reports.{" "}
                <Text
                  style={[styles.privacyLink, { color: colors.primary }]}
                  accessibilityRole="link"
                  onPress={() => void Linking.openURL(PRIVACY_URL)}
                >
                  Privacy Policy
                </Text>
              </Text>
              <AppButton label="Send for analysis" onPress={uploadVideo} />
            </View>
          )}
        </>
      )}

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="Snookered Coach Monthly Limit"
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
  privacyNote: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  privacyLink: { fontSize: 12, textDecorationLine: "underline" },
});