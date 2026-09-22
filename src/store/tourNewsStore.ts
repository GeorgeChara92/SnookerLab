import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";
import { fetchNews, type NewsItem } from "../features/tour/news";

/** Fresh enough not to fetch again when a screen opens. */
const FRESH_MS = 15 * 60_000;

/** The latest tour news, kept so it shows at once (and offline) and refreshed now and then. */
type TourNewsState = {
  items: NewsItem[];
  fetchedAt: number;
  loading: boolean;
  failed: boolean;
  refresh: (force?: boolean) => Promise<void>;
};

export const useTourNewsStore = create<TourNewsState>()(
  persist(
    (set, get) => ({
      items: [],
      fetchedAt: 0,
      loading: false,
      failed: false,
      refresh: async (force = false) => {
        const { loading, fetchedAt } = get();
        if (loading || (!force && Date.now() - fetchedAt < FRESH_MS)) return;
        set({ loading: true });
        const items = await fetchNews();
        set(items ? { items, fetchedAt: Date.now(), loading: false, failed: false } : { loading: false, failed: true });
      },
    }),
    {
      name: "tour-news-storage",
      storage: createJSONStorage(() => safeStorage),
      version: 1,
      partialize: (state) => ({ items: state.items, fetchedAt: state.fetchedAt }),
    }
  )
);
