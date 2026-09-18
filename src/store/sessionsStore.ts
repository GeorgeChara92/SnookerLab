import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { SessionLog, SessionLogResult, SessionTemplate } from "../types";
import { supabase } from "../api/supabase";
import { todayKey } from "../utils/date";

interface SessionsState {
  ownerUserId: string | null;
  templates: SessionTemplate[];
  logs: SessionLog[];
  activeTemplateId: string | null;
  activeDate: string;
  activeResults: SessionLogResult[];
  createTemplate: (input: { name: string; notes?: string; routineIds: string[] }) => Promise<string>;
  updateTemplate: (templateId: string, input: { name: string; notes?: string; routineIds: string[] }) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
  getTemplateById: (templateId: string) => SessionTemplate | undefined;
  getLogsForTemplate: (templateId: string) => SessionLog[];
  startSession: (templateId: string, date?: string) => void;
  updateActiveResult: (routineId: string, updates: Partial<SessionLogResult>) => void;
  saveActiveSession: () => Promise<void>;
  deleteSessionLog: (logId: string) => Promise<void>;
  setOwnerUserId: (userId: string | null) => void;
  hydrateSessionsForUser: (userId: string) => Promise<void>;
}

const mapTemplate = (row: any): SessionTemplate => ({
  id: row.id,
  name: row.name,
  notes: row.notes ?? undefined,
  routine_ids: row.routine_ids ?? [],
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const useSessionsStore = create<SessionsState>()(
  persist(
    (set, get) => ({
      ownerUserId: null,
      templates: [],
      logs: [],
      activeTemplateId: null,
      activeDate: todayKey(),
      activeResults: [],

      createTemplate: async ({ name, notes, routineIds }) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to create a template.");

        const now = new Date().toISOString();
        const { data, error } = await supabase
          .from("session_templates")
          .insert({
            user_id: authUser.id,
            name: name.trim(),
            notes: notes?.trim() || null,
            routine_ids: routineIds,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (error) throw error;

        const template = mapTemplate(data);
        set((state) => ({ templates: [template, ...state.templates] }));
        return template.id;
      },

      updateTemplate: async (templateId, { name, notes, routineIds }) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to update a template.");

        const { data, error } = await supabase
          .from("session_templates")
          .update({
            name: name.trim(),
            notes: notes?.trim() || null,
            routine_ids: routineIds,
            updated_at: new Date().toISOString(),
          })
          .eq("id", templateId)
          .eq("user_id", authUser.id)
          .select()
          .single();

        if (error) throw error;

        const updated = mapTemplate(data);
        set((state) => ({
          templates: state.templates.map((template) => (template.id === templateId ? updated : template)),
        }));
      },

      deleteTemplate: async (templateId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to delete a template.");

        const { error } = await supabase.from("session_templates").delete().eq("id", templateId).eq("user_id", authUser.id);
        if (error) throw error;

        set((state) => ({
          templates: state.templates.filter((template) => template.id !== templateId),
          logs: state.logs.filter((log) => log.template_id !== templateId),
          activeTemplateId: state.activeTemplateId === templateId ? null : state.activeTemplateId,
          activeResults: state.activeTemplateId === templateId ? [] : state.activeResults,
        }));
      },

      getTemplateById: (templateId) => get().templates.find((template) => template.id === templateId),

      getLogsForTemplate: (templateId) =>
        get()
          .logs.filter((log) => log.template_id === templateId)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),

      startSession: (templateId, date) => {
        const template = get().templates.find((item) => item.id === templateId);
        if (!template) return;

        const seededResults: SessionLogResult[] = template.routine_ids.map((routineId) => ({
          routine_id: routineId,
          score: "",
          notes: "",
        }));

        set({
          activeTemplateId: templateId,
          activeDate: date ?? todayKey(),
          activeResults: seededResults,
        });
      },

      updateActiveResult: (routineId, updates) => {
        set((state) => ({
          activeResults: state.activeResults.map((result) =>
            result.routine_id === routineId ? { ...result, ...updates } : result
          ),
        }));
      },

      saveActiveSession: async () => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to save sessions.");

        const { activeTemplateId, activeResults, activeDate, templates } = get();
        if (!activeTemplateId) return;

        const template = templates.find((item) => item.id === activeTemplateId);
        if (!template) return;

        const now = new Date().toISOString();
        const { data: logRow, error: logError } = await supabase
          .from("session_logs")
          .insert({
            user_id: authUser.id,
            template_id: template.id,
            template_name: template.name,
            date: activeDate,
            recorded_at: now,
            created_at: now,
            updated_at: now,
          })
          .select()
          .single();

        if (logError) throw logError;

        const resultsPayload = activeResults.map((result) => ({
          log_id: logRow.id,
          routine_id: result.routine_id,
          score: result.score,
          notes: result.notes || null,
          created_at: now,
        }));

        const { error: resultsError } = await supabase.from("session_log_results").insert(resultsPayload);
        if (resultsError) throw resultsError;

        const log: SessionLog = {
          id: logRow.id,
          template_id: template.id,
          template_name: template.name,
          date: activeDate,
          recorded_at: logRow.recorded_at,
          results: activeResults,
        };

        set((state) => ({
          logs: [log, ...state.logs],
          activeTemplateId: null,
          activeResults: [],
        }));
      },

      deleteSessionLog: async (logId) => {
        const authUser = (await supabase.auth.getUser()).data.user;
        if (!authUser) throw new Error("You need to be signed in to delete sessions.");

        const { error } = await supabase.from("session_logs").delete().eq("id", logId).eq("user_id", authUser.id);
        if (error) throw error;

        set((state) => ({ logs: state.logs.filter((log) => log.id !== logId) }));
      },

      setOwnerUserId: (userId) => {
        set((state) => {
          if (state.ownerUserId === userId) return state;
          return {
            ownerUserId: userId,
            templates: [],
            logs: [],
            activeTemplateId: null,
            activeDate: todayKey(),
            activeResults: [],
          };
        });
      },

      hydrateSessionsForUser: async (userId) => {
        const [{ data: templateRows, error: templateError }, { data: logRows, error: logError }] = await Promise.all([
          supabase.from("session_templates").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
          supabase.from("session_logs").select("*").eq("user_id", userId).order("recorded_at", { ascending: false }),
        ]);

        if (templateError) throw templateError;
        if (logError) throw logError;

        const logIds = (logRows ?? []).map((row) => row.id);
        let resultsRows: any[] = [];

        if (logIds.length) {
          const { data, error } = await supabase
            .from("session_log_results")
            .select("*")
            .in("log_id", logIds)
            .order("created_at", { ascending: true });

          if (error) throw error;
          resultsRows = data ?? [];
        }

        const resultsByLogId = new Map<string, SessionLogResult[]>();
        resultsRows.forEach((row) => {
          const list = resultsByLogId.get(row.log_id) ?? [];
          list.push({ routine_id: row.routine_id, score: row.score, notes: row.notes ?? undefined });
          resultsByLogId.set(row.log_id, list);
        });

        const logs: SessionLog[] = (logRows ?? []).map((row) => ({
          id: row.id,
          template_id: row.template_id,
          template_name: row.template_name,
          date: row.date,
          recorded_at: row.recorded_at,
          results: resultsByLogId.get(row.id) ?? [],
        }));

        set({
          templates: (templateRows ?? []).map(mapTemplate),
          logs,
        });
      },
    }),
    {
      name: "sessions-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 3,
      migrate: () => ({
        ownerUserId: null,
        templates: [],
        logs: [],
        activeTemplateId: null,
        activeDate: todayKey(),
        activeResults: [],
      }),
    }
  )
);
