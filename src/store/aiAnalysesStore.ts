import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { AIAnalysis, AnalysisType } from "../types";
import { supabase } from "../api/supabase";

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const decodeJwtPayload = (token: string) => {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error(`Access token is not JWT format (parts=${parts.length})`);
  }

  const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4 || 4)) % 4);
  const json = globalThis.atob ? globalThis.atob(padded) : "";
  if (!json) throw new Error("Failed to decode JWT payload");
  return JSON.parse(json) as { iss?: string; sub?: string; exp?: number };
};

interface AIAnalysesState {
  ownerUserId: string | null;
  analyses: AIAnalysis[];
  isLoading: boolean;
  setOwnerUserId: (userId: string | null) => void;
  hydrateAnalysesForUser: (userId: string) => Promise<void>;
  createAnalysis: (input: {
    videoPath: string;
    thumbnailPath?: string;
    analysisType: AnalysisType;
    contextTags?: string[];
    userNotes?: string;
  }) => Promise<string>;
  runAnalysis: (analysisId: string) => Promise<void>;
  deleteAnalysis: (analysisId: string) => Promise<void>;
}

const mapRow = (row: any): AIAnalysis => ({
  id: row.id,
  user_id: row.user_id,
  video_url: row.video_path,
  video_thumbnail_url: row.thumbnail_path ?? undefined,
  analysis_type: row.analysis_type,
  status: row.status,
  context_tags: row.context_tags ?? [],
  user_notes: row.user_notes ?? undefined,
  feedback: row.feedback ?? undefined,
  recommendations: row.recommendations ?? undefined,
  error_message: row.error_message ?? undefined,
  report_json: row.report_json ?? undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

/** A failure the server has already explained and recorded on the row. */
class CoachReportedError extends Error {}

export const useAIAnalysesStore = create<AIAnalysesState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      analyses: [],
      isLoading: false,

      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return { ownerUserId: userId, analyses: [], isLoading: !!userId };
        });
      },

      hydrateAnalysesForUser: async (userId) => {
        set({ isLoading: true });
        try {
          const { data, error } = await supabase
            .from("ai_analyses")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false });
          if (error) throw error;
          set({ analyses: (data ?? []).map(mapRow), isLoading: false });
        } catch (error) {
          console.warn("Failed to hydrate analyses:", error);
          set({ isLoading: false });
        }
      },

      createAnalysis: async ({ videoPath, thumbnailPath, analysisType, contextTags, userNotes }) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to upload for AI analysis.");

        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("ai_analyses")
          .insert({
            user_id: authUser.id,
            video_path: videoPath,
            thumbnail_path: thumbnailPath ?? null,
            analysis_type: analysisType,
            status: "pending",
            context_tags: contextTags ?? [],
            user_notes: userNotes ?? null,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();
        if (error) throw error;

        const analysis = mapRow(data);
        set((state) => ({ analyses: [analysis, ...state.analyses] }));
        return analysis.id;
      },

      runAnalysis: async (analysisId) => {
        const processingAt = new Date().toISOString();

        set((state) => ({
          analyses: state.analyses.map((item) =>
            item.id === analysisId
              ? { ...item, status: "processing", error_message: undefined, updated_at: processingAt }
              : item
          ),
        }));

        // Only the server moves the row to "processing": it claims the row in one step so the
        // same clip is never analysed (and billed) twice. Doing it here first made that claim
        // fail, because the server only picks up rows that are not already processing.
        const refresh = async () => {
          const { data: row } = await supabase.from("ai_analyses").select("*").eq("id", analysisId).single();
          if (!row) return null;
          const fresh = mapRow(row);
          set((state) => ({ analyses: state.analyses.map((item) => (item.id === analysisId ? fresh : item)) }));
          return fresh;
        };

        try {
          const initialSession = (await supabase.auth.getSession()).data.session;
          const refreshedSession = (await supabase.auth.refreshSession()).data.session;
          const accessToken = refreshedSession?.access_token ?? initialSession?.access_token;

          if (!accessToken) {
            throw new Error("Missing user access token for Edge Function call");
          }
          if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error("Missing Supabase env vars for Edge Function call");
          }

          const payload = decodeJwtPayload(accessToken);
          const expectedIssuerPrefix = `${SUPABASE_URL}/auth/v1`;
          if (payload.iss && !payload.iss.startsWith(expectedIssuerPrefix)) {
            throw new Error(`JWT issuer mismatch. token iss=${payload.iss} expected prefix=${expectedIssuerPrefix}`);
          }

          const authProbe = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              apikey: SUPABASE_ANON_KEY,
            },
          });

          if (!authProbe.ok) {
            const probeBody = (await authProbe.text()).slice(0, 300);
            throw new Error(`Auth probe failed (${authProbe.status}): ${probeBody}`);
          }

          const response = await fetch(`${SUPABASE_URL}/functions/v1/ai-analyze-clip`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ analysis_id: analysisId }),
          });

          const rawBody = await response.text();
          let data: any = null;
          try {
            data = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            data = null;
          }

          // Already being analysed (a second tap, or another device): nothing has failed.
          if (response.status === 409) {
            await refresh();
            return;
          }

          if (!response.ok || !data?.ok) {
            // The server has already marked the row failed with a reason the player can read.
            throw new CoachReportedError(data?.error || "The coach could not analyse this clip.");
          }

          await refresh();
        } catch (error: any) {
          if (error instanceof CoachReportedError) {
            const fresh = await refresh().catch(() => null);
            if (!fresh || fresh.status !== "failed") {
              set((state) => ({
                analyses: state.analyses.map((item) =>
                  item.id === analysisId ? { ...item, status: "failed", error_message: error.message } : item
                ),
              }));
            }
            throw error;
          }

          // The connection failed, so the server may or may not have the clip. Only a row it never
          // picked up is marked failed; one it is working on is left to finish and sync back,
          // so Try again cannot start a second, billed run of the same clip.
          console.warn("Edge analysis request failed:", error);
          const message = "Could not reach the coach. Check your connection, then tap Try again.";
          await supabase
            .from("ai_analyses")
            .update({ status: "failed", error_message: message, updated_at: new Date().toISOString() })
            .eq("id", analysisId)
            .eq("status", "pending");
          const fresh = await refresh().catch(() => null);
          if (!fresh) {
            set((state) => ({
              analyses: state.analyses.map((item) =>
                item.id === analysisId ? { ...item, status: "failed", error_message: message } : item
              ),
            }));
          }
          throw new Error(message);
        }
      },

      deleteAnalysis: async (analysisId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to delete analyses.");

        const analysis = get().analyses.find((item) => item.id === analysisId);

        const { error } = await supabase.from("ai_analyses").delete().eq("id", analysisId).eq("user_id", authUser.id);
        if (error) throw error;

        // Storage is not covered by the row delete, so remove the clip too rather than
        // leaving the user's video behind.
        const videoPath = analysis?.video_url;
        if (videoPath && !videoPath.startsWith("demo://")) {
          const { error: storageError } = await supabase.storage.from("ai-videos").remove([videoPath]);
          if (storageError) console.warn("Could not remove analysis video:", storageError.message);
        }

        set((state) => ({
          analyses: state.analyses.filter((item) => item.id !== analysisId),
        }));
      },
    }),
    {
      name: "ai-analyses-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      migrate: () => ({ ownerUserId: null, analyses: [], isLoading: false }),
    }
  )
);
