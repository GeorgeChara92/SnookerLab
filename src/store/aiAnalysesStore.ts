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

        await supabase
          .from("ai_analyses")
          .update({ status: "processing", error_message: null, updated_at: processingAt })
          .eq("id", analysisId);

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
          if (!response.ok) {
            throw new Error(`Edge function HTTP ${response.status}: ${rawBody.slice(0, 400)}`);
          }

          let data: any = null;
          try {
            data = rawBody ? JSON.parse(rawBody) : null;
          } catch {
            throw new Error("Edge function returned non-JSON response");
          }

          if (!data?.ok) throw new Error(data?.error || "AI analysis function failed");

          const { data: refreshedRow, error: refreshedError } = await supabase
            .from("ai_analyses")
            .select("*")
            .eq("id", analysisId)
            .single();

          if (refreshedError) throw refreshedError;

          const refreshed = mapRow(refreshedRow);
          set((state) => ({
            analyses: state.analyses.map((item) => (item.id === analysisId ? refreshed : item)),
          }));
        } catch (error: any) {
          const message = error instanceof Error ? error.message : "Unknown function invoke error";

          let details = "";
          const context = error?.context;
          if (context && typeof context.text === "function") {
            try {
              const raw = await context.text();
              details = typeof raw === "string" ? raw.slice(0, 500) : "";
            } catch {
              // Ignore context parse errors.
            }
          }

          const combinedMessage = details ? `${message} ${details}` : message;
          const failedAt = new Date().toISOString();

          await supabase
            .from("ai_analyses")
            .update({ status: "failed", error_message: combinedMessage.slice(0, 280), updated_at: failedAt })
            .eq("id", analysisId);

          set((state) => ({
            analyses: state.analyses.map((item) =>
              item.id === analysisId
                ? { ...item, status: "failed", error_message: combinedMessage.slice(0, 280), updated_at: failedAt }
                : item
            ),
          }));

          console.warn("Edge analysis failed:", combinedMessage);
          throw new Error(combinedMessage);
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
