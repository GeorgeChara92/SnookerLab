import * as FileSystemLegacy from "expo-file-system/legacy";
import { supabase } from "../../api/supabase";

/**
 * A coach's own photo gallery: work with professionals, at events, whatever helps a prospective
 * client decide. Stored in the public coach-gallery-photos bucket (one folder per coach), unlike
 * coach-group-media, since Find a Coach shows this to anyone browsing, not just a group's members.
 */

export type CoachGalleryPhoto = { id: string; coachId: string; path: string; createdAt: string };

const BUCKET = "coach-gallery-photos";
const GALLERY_COLUMNS = "id, coach_id, path, created_at";
export const GALLERY_LIMIT = 6;

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

type Result = { ok: true } | { ok: false; message: string };

const explain = (error: { message?: string } | null): string => {
  if (error?.message?.includes("at most 6")) return "A gallery can hold up to 6 photos - remove one first.";
  return error?.message ?? "Something went wrong. Try again.";
};

const fromRow = (row: any): CoachGalleryPhoto => ({
  id: row.id,
  coachId: row.coach_id,
  path: row.path,
  createdAt: row.created_at,
});

/** A public, permanent link to a gallery photo - the bucket is public, so no signing needed. */
export const galleryPhotoUrl = (path: string): string => supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

export const listGalleryPhotos = async (coachId: string): Promise<CoachGalleryPhoto[]> => {
  const { data, error } = await supabase
    .from("coach_gallery_photos")
    .select(GALLERY_COLUMNS)
    .eq("coach_id", coachId)
    .order("created_at");
  if (error || !data) return [];
  return data.map(fromRow);
};

export const uploadGalleryPhoto = async (coachId: string, photoUri: string): Promise<Result> => {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return { ok: false, message: "Upload service is not fully configured." };
  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) return { ok: false, message: "You need to be signed in." };

  // fetch(uri).blob() silently produces a truncated or empty file for a local photo library URI on
  // React Native - direct-to-storage via FileSystem's own uploadAsync avoids that, the same as
  // coach-group-media's upload.
  const extension = (photoUri.split(".").pop() || "jpg").toLowerCase();
  const path = `${coachId}/${Date.now()}-${Math.random().toString(16).slice(2)}.${extension}`;
  const contentType = extension === "png" ? "image/png" : extension === "heic" ? "image/heic" : "image/jpeg";
  const uploadUrl = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${encodeURIComponent(path)}`;

  try {
    const result = await FileSystemLegacy.uploadAsync(uploadUrl, photoUri, {
      httpMethod: "POST",
      uploadType: FileSystemLegacy.FileSystemUploadType.BINARY_CONTENT,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
    });
    if (result.status < 200 || result.status >= 300) return { ok: false, message: `Upload failed (status ${result.status}).` };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }

  const { error } = await supabase.from("coach_gallery_photos").insert({ coach_id: coachId, path });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    return { ok: false, message: explain(error) };
  }
  return { ok: true };
};

export const deleteGalleryPhoto = async (photo: CoachGalleryPhoto): Promise<Result> => {
  const { error } = await supabase.from("coach_gallery_photos").delete().eq("id", photo.id);
  if (error) return { ok: false, message: explain(error) };
  await supabase.storage.from(BUCKET).remove([photo.path]);
  return { ok: true };
};
