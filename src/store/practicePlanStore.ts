import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { supabase } from "../api/supabase";
import { safeStorage } from "../utils/storage";
import {
  cleanPlan,
  EMPTY_PLAN,
  newGoalId,
  type PlannedDay,
  type PracticePlan,
  type RoutineGoal,
  type Weekday,
} from "../features/practice/plan";

/**
 * The player's practice plan, kept with their account.
 *
 * Changes are instant on the phone and sent straight after. If that fails (no signal at the
 * club) the plan is marked unsent and goes the next time the store loads. The whole plan is one
 * row, so whichever copy was changed last wins.
 */

type PracticePlanState = {
  ownerId: string | null;
  plan: PracticePlan;
  unsent: boolean;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  /** Plans a day (a preset, or null for any practice), or clears it with undefined. */
  setDay: (day: Weekday, templateId: string | null | undefined) => void;
  setWeeklyTarget: (target: number) => void;
  addGoal: (goal: Omit<RoutineGoal, "id" | "createdAt">) => void;
  removeGoal: (id: string) => void;
};

export const usePracticePlanStore = create<PracticePlanState>()(
  persist(
    (set, get) => {
      const push = async () => {
        const { ownerId, plan, unsent } = get();
        if (!ownerId || !unsent) return;
        const { error } = await supabase
          .from("practice_plans")
          .upsert({ user_id: ownerId, plan, updated_at: plan.updatedAt }, { onConflict: "user_id" });
        if (error) {
          console.warn("Practice plan not saved to the account yet:", error.message);
          return;
        }
        // Only mark it sent if nothing changed while it was on its way.
        if (get().plan === plan && get().ownerId === ownerId) set({ unsent: false });
      };

      const change = (update: (plan: PracticePlan) => Partial<PracticePlan>) => {
        const plan = get().plan;
        set({ plan: { ...plan, ...update(plan), updatedAt: new Date().toISOString() }, unsent: true });
        void push();
      };

      return {
        ownerId: null,
        plan: EMPTY_PLAN,
        unsent: false,

        setOwner: (userId) => {
          if (get().ownerId === userId) return;
          set({ ownerId: userId, plan: EMPTY_PLAN, unsent: false });
        },

        hydrate: async (userId) => {
          const { data, error } = await supabase
            .from("practice_plans")
            .select("plan, updated_at")
            .eq("user_id", userId)
            .maybeSingle();
          if (get().ownerId !== userId) return;
          if (error) {
            console.warn("Could not load the practice plan:", error.message);
            return;
          }
          const server = data ? cleanPlan({ ...(data.plan as object), updatedAt: data.updated_at }) : null;
          const local = get().plan;
          // A change made here and not yet sent stays, unless the account has a newer one.
          if (server && !(get().unsent && local.updatedAt > server.updatedAt)) {
            set({ plan: server, unsent: false });
            return;
          }
          if (get().unsent) await push();
        },

        setDay: (day, templateId) =>
          change((plan) => {
            const others = plan.days.filter((item) => item.day !== day);
            const days: PlannedDay[] =
              templateId === undefined ? others : [...others, { day, templateId }].sort((a, b) => a.day - b.day);
            return { days };
          }),

        setWeeklyTarget: (target) => change(() => ({ weeklyTarget: Math.min(7, Math.max(1, Math.round(target))) })),

        addGoal: (goal) =>
          change((plan) => ({
            goals: [...plan.goals, { ...goal, id: newGoalId(), createdAt: new Date().toISOString() }],
          })),

        removeGoal: (id) => change((plan) => ({ goals: plan.goals.filter((goal) => goal.id !== id) })),
      };
    },
    {
      name: "practice-plan-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ ownerId: state.ownerId, plan: state.plan, unsent: state.unsent }),
      merge: (persisted, current) => {
        const saved = (persisted ?? {}) as Partial<PracticePlanState>;
        return { ...current, ...saved, plan: cleanPlan(saved.plan) };
      },
    }
  )
);
