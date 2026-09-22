/**
 * Professional snooker news, from the World Snooker Tour's own feed and BBC Sport's snooker
 * feed. Only the headline, a line of summary and the picture are shown; the story itself opens
 * on the publisher's site. Parsing is kept pure so it can be tested on saved feeds.
 */

export type NewsSource = "wst" | "bbc";

export type NewsItem = {
  id: string;
  source: NewsSource;
  title: string;
  summary: string;
  link: string;
  image: string | null;
  publishedAt: string;
};

export const NEWS_SOURCES: Record<NewsSource, { name: string; url: string }> = {
  wst: { name: "World Snooker Tour", url: "https://www.wst.tv/rss.xml" },
  bbc: { name: "BBC Sport", url: "https://feeds.bbci.co.uk/sport/snooker/rss.xml" },
};

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&rsquo;": "’",
  "&lsquo;": "‘",
  "&ldquo;": "“",
  "&rdquo;": "”",
  "&ndash;": "–",
  "&mdash;": "—",
};

const decode = (text: string) =>
  text
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#39;/g, (entity) => ENTITIES[entity] ?? entity);

/** A tag's text, with any CDATA wrapper taken off. */
const tag = (xml: string, name: string) => {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  if (!match) return "";
  return match[1]
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
};

const stripHtml = (html: string) =>
  decode(html.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .trim();

const clip = (text: string, max: number) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(" ") > max * 0.6 ? cut.lastIndexOf(" ") : max).trim()}…`;
};

/** The stories in one feed, newest first as the feed gives them. Anything unreadable is skipped. */
export const parseFeed = (xml: string, source: NewsSource): NewsItem[] => {
  const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((item): NewsItem | null => {
      const title = stripHtml(tag(item, "title"));
      const link = decode(tag(item, "link")).trim();
      const published = new Date(tag(item, "pubDate"));
      if (!title || !/^https:\/\//.test(link) || Number.isNaN(published.getTime())) return null;
      const description = tag(item, "description");

      // WST puts the picture and the story's paragraphs in the description; the BBC gives a
      // one-line description and a thumbnail, which comes in a larger size too.
      const firstParagraph = description.match(/<p>([\s\S]*?)<\/p>/i)?.[1];
      const summary = clip(stripHtml(firstParagraph ?? description), 180);
      let image =
        description.match(/<img[^>]+src="([^"]+)"/i)?.[1] ??
        item.match(/<media:thumbnail[^>]+url="([^"]+)"/i)?.[1] ??
        item.match(/<enclosure[^>]+url="([^"]+)"/i)?.[1] ??
        null;
      if (image) {
        image = decode(image).replace(/^http:\/\//, "https://");
        if (source === "bbc") image = image.replace("/standard/240/", "/standard/480/");
      }
      return {
        id: `${source}:${link.replace(/\?.*$/, "")}`,
        source,
        title,
        summary,
        link,
        image,
        publishedAt: published.toISOString(),
      };
    })
    .filter((item): item is NewsItem => item !== null);
};

/** Both feeds together, newest first, without the same story twice. */
export const mergeFeeds = (lists: NewsItem[][], limit = 40): NewsItem[] => {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
    .filter((item) => {
      const key = item.title.toLowerCase();
      if (seen.has(item.id) || seen.has(key)) return false;
      seen.add(item.id);
      seen.add(key);
      return true;
    })
    .slice(0, limit);
};

/** Fetches every feed; one failing still gives the other's stories. Null if both fail. */
export const fetchNews = async (): Promise<NewsItem[] | null> => {
  const results = await Promise.all(
    (Object.keys(NEWS_SOURCES) as NewsSource[]).map(async (source) => {
      try {
        const response = await fetch(NEWS_SOURCES[source].url, { headers: { Accept: "application/rss+xml" } });
        if (!response.ok) return null;
        return parseFeed(await response.text(), source);
      } catch {
        return null;
      }
    })
  );
  const lists = results.filter((list): list is NewsItem[] => list !== null);
  return lists.length ? mergeFeeds(lists) : null;
};
