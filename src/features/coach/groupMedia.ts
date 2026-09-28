import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../../api/supabase";
import type { CoachGroupMediaType } from "./types";

/**
 * Uploads a picked file straight into the private coach-group-media bucket, the same
 * direct-to-storage pattern the AI Coach clip upload uses. The path is "<groupId>/<file>" so the
 * bucket's own RLS can tell which group a file belongs to without a database lookup.
 */

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const CONTENT_TYPE: Record<CoachGroupMediaType, string[]> = {
  image: ["image/jpeg", "image/png", "image/heic"],
  video: ["video/mp4", "video/quicktime", "video/x-m4v"],
  pdf: ["application/pdf"],
};

const inferContentType = (mediaType: CoachGroupMediaType, ext: string, mimeType?: string) => {
  if (mimeType && CONTENT_TYPE[mediaType].includes(mimeType)) return mimeType;
  if (mediaType === "pdf") return "application/pdf";
  if (mediaType === "video") return ext === "mov" ? "video/quicktime" : "video/mp4";
  return ext === "png" ? "image/png" : "image/jpeg";
};

export const uploadGroupMedia = async (
  groupId: string,
  file: { uri: string; fileName?: string | null; mimeType?: string | null },
  mediaType: CoachGroupMediaType
): Promise<{ ok: true; path: string } | { ok: false; message: string }> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, message: "Upload service is not fully configured." };
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, message: "You need to be signed in." };

  const fallbackExt = mediaType === "pdf" ? "pdf" : mediaType === "video" ? "mp4" : "jpg";
  const ext = (file.fileName?.split(".").pop() || file.uri.split(".").pop() || fallbackExt).toLowerCase();
  const path = `${groupId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${ext}`;
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/coach-group-media/${encodeURIComponent(path)}`;

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
      // Surface the storage service's own reason (e.g. a rejected mime type) instead of just the
      // status code, so a failure here says what actually went wrong rather than leaving a guess.
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

/** A short-lived link to view a piece of group media - the bucket is private, so every viewer
 * needs their own signed URL rather than a public one. */
export const groupMediaUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage.from("coach-group-media").createSignedUrl(path, 60 * 30);
  if (error) return null;
  return data?.signedUrl ?? null;
};
