import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** A pro's biography: the introduction of their Wikipedia article (CC BY-SA, credited and linked
 *  wherever it's shown). */
export type ProBio = { text: string; title: string; url: string; fetchedAt: number };

const STALE_MS = 30 * 86_400_000;
const API = "https://en.wikipedia.org/w/api.php";
const HEADERS = { "Api-User-Agent": "Snookered/1.1 (https://snookerlab.app)" };

/** "Wu Yize (Chinese: 吴宜泽; pinyin: Wú Yízé; born 14 October 2003)" -> "Wu Yize (born 14 October 2003)":
 *  the pronunciation guide reads as noise in an app. Anything else in brackets is left alone. */
export const tidyIntro = (text: string): string =>
  text
    .replace(/\s*\(([^()]*(?:Chinese|pinyin|Thai|pronounced|IPA|Jyutping|Cantonese)[^()]*)\)/gi, (_, inner: string) => {
      const born = inner.match(/born [^;)]+/i)?.[0]?.trim();
      return born ? ` (${born})` : "";
    })
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();

const titleFromUrl = (url: string | null | undefined) => {
  const match = url?.match(/wikipedia\.org\/wiki\/([^?#]+)/i);
  return match ? decodeURIComponent(match[1]) : null;
};

type Page = { title?: string; extract?: string; missing?: string };

const fetchIntro = async (params: Record<string, string>): Promise<Page | null> => {
  const query = new URLSearchParams({
    action: "query",
    prop: "extracts",
    exintro: "1",
    explaintext: "1",
    redirects: "1",
    format: "json",
    origin: "*",
    ...params,
  });
  const response = await fetch(`${API}?${query}`, { headers: HEADERS });
  if (!response.ok) return null;
  const json = (await response.json()) as { query?: { pages?: Record<string, Page> } };
  return Object.values(json.query?.pages ?? {}).find((page) => page.extract && page.missing === undefined) ?? null;
};

type BioState = {
  bios: Record<number, ProBio | null>;
  /** Fetches the bio if it isn't cached (or is a month old). Never throws. */
  load: (playerId: number, name: string, wikipediaUrl: string | null) => Promise<void>;
};

const asked = new Set<number>();

export const useProTourBioStore = create<BioState>()(
  persist(
    (set, get) => ({
      bios: {},
      load: async (playerId, name, wikipediaUrl) => {
        const cached = get().bios[playerId];
        if (asked.has(playerId) || (cached && Date.now() - cached.fetchedAt < STALE_MS)) return;
        asked.add(playerId);
        try {
          // Their own article when snooker.org links it; otherwise the top search hit, kept only
          // if it's about a snooker player (a common name finds someone else).
          const title = titleFromUrl(wikipediaUrl);
          const page = title
            ? await fetchIntro({ titles: title })
            : await fetchIntro({ generator: "search", gsrsearch: `${name} snooker player`, gsrlimit: "1" });
          const text = page?.extract ? tidyIntro(page.extract) : "";
          const fits = !!page?.title && text.length > 80 && (title != null || /snooker/i.test(text));
          set((state) => ({
            bios: {
              ...state.bios,
              [playerId]: fits
                ? {
                    text,
                    title: page!.title!,
                    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(page!.title!.replace(/ /g, "_"))}`,
                    fetchedAt: Date.now(),
                  }
                : null,
            },
          }));
        } catch {
          // Offline or Wikipedia unreachable: try again next time the page opens.
          asked.delete(playerId);
        }
      },
    }),
    {
      name: "pro-tour-bios",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ bios: Object.fromEntries(Object.entries(state.bios).filter(([, bio]) => bio)) }),
    }
  )
);
