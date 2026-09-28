import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../../api/supabase";

/**
 * An image, video or PDF sent in a chat, uploaded straight into the private chat-media bucket -
 * the same direct-to-storage pattern coach group posts use. The path is "<conversationId>/<file>"
 * so the bucket's own RLS (can_post_conversation/can_read_conversation) can tell whether this
 * device belongs to that conversation without a separate database lookup.
 */

export type ChatMediaType = "image" | "video" | "pdf";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
const BUCKET = "chat-media";

const CONTENT_TYPE: Record<ChatMediaType, string[]> = {
  image: ["image/jpeg", "image/png", "image/heic", "image/webp"],
  video: ["video/mp4", "video/quicktime", "video/x-m4v"],
  pdf: ["application/pdf"],
};

const inferContentType = (mediaType: ChatMediaType, ext: string, mimeType?: string) => {
  if (mimeType && CONTENT_TYPE[mediaType].includes(mimeType)) return mimeType;
  if (mediaType === "pdf") return "application/pdf";
  if (mediaType === "video") return ext === "mov" ? "video/quicktime" : "video/mp4";
  return ext === "png" ? "image/png" : "image/jpeg";
};

export const uploadChatMedia = async (
  conversationId: string,
  file: { uri: string; fileName?: string | null; mimeType?: string | null },
  mediaType: ChatMediaType
): Promise<{ ok: true; path: string } | { ok: false; message: string }> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, message: "Upload service is not fully configured." };
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, message: "You need to be signed in." };

  const fallbackExt = mediaType === "pdf" ? "pdf" : mediaType === "video" ? "mp4" : "jpg";
  const ext = (file.fileName?.split(".").pop() || file.uri.split(".").pop() || fallbackExt).toLowerCase();
  const path = `${conversationId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`;

  try {
    const result = await FileSystemLegacy.uploadAsync(uploadUrl, file.uri, {
      httpMethod: "POST",
      uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": inferContentType(mediaType, ext, file.mimeType ?? undefined),
        "x-upsert": "false",
      },
    });
    if (result.status < 200 || result.status >= 300) {
      let detail = "";
      try {
        detail = JSON.parse(result.body)?.message ?? "";
      } catch {
        detail = result.body?.slice(0, 200) ?? "";
      }
      return { ok: false, message: detail ? `Upload failed: ${detail}` : `Upload failed (status ${result.status}).` };
    }
    return { ok: true, path };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
};

/** A short-lived link to view a chat attachment - the bucket is private, so every viewer needs
 * their own signed URL rather than a public one. */
export const chatMediaUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
};
