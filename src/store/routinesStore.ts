import { create } from "zustand";
import { Routine, RoutineCategory } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../constants";

const CUE_BALL_CONTROL_ORDER = [
  "routine-cue-ball-control",
  "routine-top-spin-control",
  "routine-stun-line",
  "routine-stun-run-through",
  "routine-screw-back",
  "routine-deep-screw",
  "routine-side-spin-control",
];

interface RoutinesState {
  routines: Routine[];
  categories: RoutineCategory[];
  isLoading: boolean;
  getRoutinesByCategory: (categoryId: string) => Routine[];
  getRoutineById: (id: string) => Routine | undefined;
  loadRoutines: () => Promise<void>;
}

export const useRoutinesStore = create<RoutinesState>()((set, get) => ({
  routines: DEFAULT_ROUTINES,
  categories: DEFAULT_CATEGORIES,
  isLoading: false,
  getRoutinesByCategory: (categoryId) => {
    const routines = get().routines.filter((routine) => routine.category_id === categoryId);
    if (categoryId !== "cat-cue-ball-control") return routines;

    const order = new Map(CUE_BALL_CONTROL_ORDER.map((id, index) => [id, index]));
    return [...routines].sort((a, b) => {
      const ai = order.get(a.id);
      const bi = order.get(b.id);
      if (ai === undefined && bi === undefined) return 0;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  },
  getRoutineById: (id) => get().routines.find((routine) => routine.id === id),
  loadRoutines: async () => {
    set({ isLoading: true });
    set({ routines: DEFAULT_ROUTINES, categories: DEFAULT_CATEGORIES, isLoading: false });
  },
}));
