import { create } from "zustand";
import { Routine, RoutineCategory } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../constants";
import { useCustomRoutinesStore } from "./customRoutinesStore";
import { toRoutine } from "../features/customRoutines/customRoutine";

const ROUTINE_ORDER_BY_CATEGORY: Record<string, string[]> = {
  "cat-basics": [
    "routine-bridge-grip-stance",
    "routine-pre-shot-routine",
    "routine-bridge-fundamentals",
    "routine-rest-shot-fundamentals",
    "routine-potting-fundamentals",
    "routine-head-position-fundamentals",
    "routine-feathering-delivery-fundamentals",
    "routine-follow-through-fundamentals",
    "routine-straight-cueing-fundamentals-guide",
    "routine-cue-ball-control-fundamentals-guide",
    "routine-pre-shot-system-fundamentals",
    "routine-mental-commitment-fundamentals",
  ],
  "cat-break-building": [
    "routine-break-building-foundations",
    "routine-3-reds-colours",
    "routine-around-colours",
    "routine-pink-ball-routine",
    "routine-line-up",
    "routine-t-routine",
    "routine-black-off-spot",
    "routine-blue-ball-control",
  ],
  "cat-safety": [
    "routine-baulk-safety",
    "routine-escape-science",
    "routine-two-cushion-escape",
    "routine-three-cushion-escape",
  ],
  "cat-straight-cueing": ["routine-straight-cueing-line", "routine-cueing-secret-session"],
  "cat-cue-ball-control": [
    "routine-cue-ball-control",
    "routine-top-spin-control",
    "routine-stun-line",
    "routine-stun-run-through",
    "routine-screw-back",
    "routine-deep-screw",
    "routine-side-spin-control",
  ],
  "cat-long-potting": ["routine-long-potting-classic", "routine-long-blue-straight-cue"],
};

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
    const orderList = ROUTINE_ORDER_BY_CATEGORY[categoryId];
    if (!orderList) return routines;

    const order = new Map(orderList.map((id, index) => [id, index]));
    return [...routines].sort((a, b) => {
      const ai = order.get(a.id);
      const bi = order.get(b.id);
      if (ai === undefined && bi === undefined) return 0;
      if (ai === undefined) return 1;
      if (bi === undefined) return -1;
      return ai - bi;
    });
  },
  // Built-in routines first, then the player's own, so scores, sessions and history work for both.
  getRoutineById: (id) => {
    const builtIn = get().routines.find((routine) => routine.id === id);
    if (builtIn) return builtIn;
    const custom = useCustomRoutinesStore.getState().getById(id);
    return custom ? toRoutine(custom) : undefined;
  },
  loadRoutines: async () => {
    set({ isLoading: true });
    set({ routines: DEFAULT_ROUTINES, categories: DEFAULT_CATEGORIES, isLoading: false });
  },
}));
