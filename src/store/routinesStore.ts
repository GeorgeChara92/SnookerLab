import { create } from "zustand";
import { Routine, RoutineCategory } from "../types";
import { DEFAULT_CATEGORIES, DEFAULT_ROUTINES } from "../constants";

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
  getRoutinesByCategory: (categoryId) => get().routines.filter((routine) => routine.category_id === categoryId),
  getRoutineById: (id) => get().routines.find((routine) => routine.id === id),
  loadRoutines: async () => {
    set({ isLoading: true });
    set({ routines: DEFAULT_ROUTINES, categories: DEFAULT_CATEGORIES, isLoading: false });
  },
}));
