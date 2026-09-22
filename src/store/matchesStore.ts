import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { LiveFrameRecord, Match } from "../types";
import { supabase } from "../api/supabase";
import { flushOutbox, queueWrite, registerSyncHandler } from "../sync/outbox";

interface MatchesState {
  ownerUserId: string | null;
  matches: Match[];
  liveFramesByMatch: Record<string, LiveFrameRecord[]>;
  isLoading: boolean;
  addMatch: (match: Omit<Match, "id" | "created_at" | "updated_at">) => Promise<Match>;
  updateMatch: (id: string, updates: Partial<Match>) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  saveFrameRecord: (matchId: string, frame: Omit<LiveFrameRecord, "id" | "match_id" | "created_at">) => Promise<void>;
  getFrameRecordsByMatchId: (matchId: string) => LiveFrameRecord[];
  getNextFrameNumber: (matchId: string) => number;
  getMatches: () => Match[];
  getMatchById: (id: string) => Match | undefined;
  getOpponents: () => string[];
  setOwnerUserId: (userId: string | null) => void;
  hydrateMatchesForUser: (userId: string) => Promise<void>;
}

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const deriveMatchSummaryFromFrames = (frames: LiveFrameRecord[]) => {
  const userWins = frames.filter((frame) => frame.winner === "user").length;
  const opponentWins = frames.filter((frame) => frame.winner === "opponent").length;
  const result: Match["result"] = userWins > opponentWins ? "win" : userWins < opponentWins ? "loss" : "draw";

  return {
    user_score: userWins,
    opponent_score: opponentWins,
    frames_played: frames.length,
    result,
  };
};

const mapDbMatch = (row: any): Match => ({
  id: row.id,
  user_id: row.user_id,
  opponent_name: row.opponent_name,
  opponent_id: row.opponent_id ?? undefined,
  date: row.date,
  location: row.location ?? undefined,
  match_type: row.match_type,
  format: row.format,
  target_frames: row.target_frames ?? undefined,
  frames_played: row.frames_played,
  user_score: row.user_score,
  opponent_score: row.opponent_score,
  result: row.result,
  notes: row.notes ?? undefined,
  recording_mode: row.recording_mode ?? undefined,
  sync_status: "synced",
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapDbFrame = (row: any): LiveFrameRecord => ({
  id: row.id,
  match_id: row.match_id,
  frame_number: row.frame_number,
  user_score: row.user_score,
  opponent_score: row.opponent_score,
  winner: row.winner,
  highest_break_user: row.highest_break_user ?? 0,
  highest_break_opponent: row.highest_break_opponent ?? 0,
  breaks: Array.isArray(row.breaks) ? row.breaks : [],
  events: Array.isArray(row.events) ? row.events : [],
  abandoned: !!row.abandoned,
  created_at: row.created_at,
});

const groupFramesByMatch = (frames: LiveFrameRecord[]): Record<string, LiveFrameRecord[]> => {
  return frames.reduce<Record<string, LiveFrameRecord[]>>((acc, frame) => {
    const existing = acc[frame.match_id] ?? [];
    acc[frame.match_id] = [...existing, frame].sort((a, b) => a.frame_number - b.frame_number);
    return acc;
  }, {});
};

/**
 * The signed-in player's id, read from the session already on the phone. getUser() asks the
 * server, which is exactly what a write cannot rely on when there is no signal.
 */
const currentUserId = async () => {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
};

const isMissingTableError = (error: any) => error?.code === "42P01";

/**
 * The writes behind a saved frame, an edited match and a deleted one, each in a shape that can
 * be written to disk and sent later. The store runs these directly; the outbox runs the same
 * ones when the phone could not reach Supabase at the time.
 */
type FrameSync = {
  matchId: string;
  frame: Record<string, any>;
  summary: { user_score: number; opponent_score: number; frames_played: number; result: Match["result"] };
  updatedAt: string;
  userId: string;
};

const pushFrameSync = async (job: FrameSync) => {
  const { error: frameError } = await supabase
    .from("match_frames")
    .upsert(job.frame, { onConflict: "match_id,frame_number" });

  if (frameError) {
    if (isMissingTableError(frameError)) {
      throw new Error("Live frame table missing. Run supabase/schema.sql to create public.match_frames.");
    }
    throw frameError;
  }

  const { error } = await supabase
    .from("matches")
    .update({
      user_score: job.summary.user_score,
      opponent_score: job.summary.opponent_score,
      frames_played: job.summary.frames_played,
      result: job.summary.result,
      recording_mode: "live",
      updated_at: job.updatedAt,
    })
    .eq("id", job.matchId)
    .eq("user_id", job.userId);

  if (error) throw error;
};

const pushMatchUpdate = async (job: { matchId: string; payload: Record<string, any>; userId: string }) => {
  const { error } = await supabase.from("matches").update(job.payload).eq("id", job.matchId).eq("user_id", job.userId);
  if (error) throw error;
};

const pushMatchDelete = async (job: { matchId: string; userId: string }) => {
  const { error } = await supabase.from("matches").delete().eq("id", job.matchId).eq("user_id", job.userId);
  if (error) throw error;
};

registerSyncHandler("match.frame", pushFrameSync);
registerSyncHandler("match.update", pushMatchUpdate);
registerSyncHandler("match.delete", pushMatchDelete);

export const useMatchesStore = create<MatchesState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      matches: [],
      liveFramesByMatch: {},
      isLoading: false,

      addMatch: async (matchData) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to add a match.");

        const now = new Date().toISOString();
        const payload = {
          user_id: authUser.id,
          opponent_name: matchData.opponent_name,
          opponent_id: matchData.opponent_id ?? null,
          date: matchData.date,
          location: matchData.location ?? null,
          match_type: matchData.match_type,
          format: matchData.format,
          target_frames: matchData.target_frames ?? null,
          frames_played: matchData.frames_played,
          user_score: matchData.user_score,
          opponent_score: matchData.opponent_score,
          result: matchData.result,
          notes: matchData.notes ?? null,
          recording_mode: matchData.recording_mode ?? null,
          created_at: now,
          updated_at: now,
        };

        const { data, error } = await supabase.from("matches").insert(payload).select().single();
        if (error) throw error;

        const match = mapDbMatch(data);
        set((state) => ({ matches: [match, ...state.matches] }));
        return match;
      },

      updateMatch: async (id, updates) => {
        const userId = await currentUserId();
        if (!userId) throw new Error("You need to be signed in to update a match.");

        const updatedAt = new Date().toISOString();
        const payload: Record<string, any> = { updated_at: updatedAt };

        const keys: (keyof Match)[] = [
          "opponent_name",
          "opponent_id",
          "date",
          "location",
          "match_type",
          "format",
          "target_frames",
          "frames_played",
          "user_score",
          "opponent_score",
          "result",
          "notes",
          "recording_mode",
        ];

        keys.forEach((key) => {
          if (updates[key] !== undefined) {
            payload[key] = updates[key] ?? null;
          }
        });

        set((state) => ({
          matches: state.matches.map((match) =>
            match.id === id ? { ...match, ...updates, updated_at: updatedAt } : match
          ),
        }));

        const job = { matchId: id, payload, userId };

        try {
          await pushMatchUpdate(job);
          void flushOutbox();
        } catch (error) {
          const match = get().matches.find((item) => item.id === id);
          queueWrite({
            kind: "match.update",
            scope: "matches",
            payload: job,
            description: match ? `Changes to the match with ${match.opponent_name}` : "Changes to a match",
          });
        }
      },

      deleteMatch: async (id) => {
        const userId = await currentUserId();
        if (!userId) throw new Error("You need to be signed in to delete a match.");

        const match = get().matches.find((item) => item.id === id);

        set((state) => ({
          matches: state.matches.filter((m) => m.id !== id),
          liveFramesByMatch: Object.fromEntries(
            Object.entries(state.liveFramesByMatch).filter(([matchId]) => matchId !== id)
          ),
        }));

        const job = { matchId: id, userId };

        try {
          await pushMatchDelete(job);
          void flushOutbox();
        } catch (error) {
          queueWrite({
            kind: "match.delete",
            scope: "matches",
            payload: job,
            description: match ? `Deleting the match with ${match.opponent_name}` : "Deleting a match",
          });
        }
      },

      saveFrameRecord: async (matchId, frameData) => {
        const userId = await currentUserId();
        if (!userId) throw new Error("You need to be signed in to save a frame.");

        const nowIso = new Date().toISOString();
        const nextFrame: LiveFrameRecord = {
          ...frameData,
          id: makeId(),
          match_id: matchId,
          created_at: nowIso,
        };

        const framePayload = {
          user_id: userId,
          match_id: matchId,
          frame_number: frameData.frame_number,
          user_score: frameData.user_score,
          opponent_score: frameData.opponent_score,
          winner: frameData.winner,
          highest_break_user: frameData.highest_break_user,
          highest_break_opponent: frameData.highest_break_opponent,
          breaks: frameData.breaks,
          events: frameData.events,
          abandoned: frameData.abandoned ?? false,
          updated_at: nowIso,
        };

        // The frame the player just played is built here rather than read back from the
        // server, so the scoreboard moves on the tap and the write can follow at its leisure.
        const current = get().liveFramesByMatch[matchId] ?? [];
        const withoutCurrent = current.filter((frame) => frame.frame_number !== nextFrame.frame_number);
        const mergedFrames = [...withoutCurrent, nextFrame].sort((a, b) => a.frame_number - b.frame_number);
        const summary = deriveMatchSummaryFromFrames(mergedFrames);

        set((state) => ({
          liveFramesByMatch: {
            ...state.liveFramesByMatch,
            [matchId]: mergedFrames,
          },
          matches: state.matches.map((match) =>
            match.id === matchId
              ? {
                  ...match,
                  user_score: summary.user_score,
                  opponent_score: summary.opponent_score,
                  frames_played: summary.frames_played,
                  result: summary.result,
                  recording_mode: "live",
                  updated_at: nowIso,
                }
              : match
          ),
        }));

        const job: FrameSync = {
          matchId,
          frame: framePayload,
          summary,
          updatedAt: nowIso,
          userId,
        };

        try {
          await pushFrameSync(job);
          void flushOutbox();
        } catch (error: any) {
          // A missing table is a setup problem, not a bad connection, and queueing it would
          // only hide it.
          if (typeof error?.message === "string" && error.message.includes("Live frame table missing")) {
            throw error;
          }

          const match = get().matches.find((item) => item.id === matchId);
          queueWrite({
            kind: "match.frame",
            scope: "matches",
            payload: job,
            description: match
              ? `Frame ${frameData.frame_number} against ${match.opponent_name}`
              : `Frame ${frameData.frame_number}`,
          });
        }
      },

      getFrameRecordsByMatchId: (matchId) => get().liveFramesByMatch[matchId] ?? [],

      getNextFrameNumber: (matchId) => {
        const frames = get().liveFramesByMatch[matchId] ?? [];
        if (frames.length === 0) return 1;
        return Math.max(...frames.map((frame) => frame.frame_number)) + 1;
      },

      getMatches: () => get().matches,
      getMatchById: (id) => get().matches.find((m) => m.id === id),
      getOpponents: () => {
        const opponents = new Set(get().matches.map((m) => m.opponent_name));
        return Array.from(opponents);
      },

      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return { ownerUserId: userId, matches: [], liveFramesByMatch: {}, isLoading: !!userId };
        });
      },

      hydrateMatchesForUser: async (userId) => {
        set({ isLoading: true });
        try {
          const { data: matchRows, error: matchesError } = await supabase
            .from("matches")
            .select("*")
            .eq("user_id", userId)
            .order("date", { ascending: false });

          if (matchesError) throw matchesError;

          const { data: frameRows, error: framesError } = await supabase
            .from("match_frames")
            .select("*")
            .eq("user_id", userId)
            .order("frame_number", { ascending: true });

          if (framesError && !isMissingTableError(framesError)) throw framesError;

          const frames = (frameRows ?? []).map(mapDbFrame);

          set({
            matches: (matchRows ?? []).map(mapDbMatch),
            liveFramesByMatch: groupFramesByMatch(frames),
            isLoading: false,
          });
        } catch (error) {
          console.warn("Failed to hydrate matches:", error);
          set({ isLoading: false });
        }
      },
    }),
    {
      name: "matches-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 3,
      migrate: () => ({
        ownerUserId: null,
        matches: [],
        liveFramesByMatch: {},
        isLoading: false,
      }),
    }
  )
);
