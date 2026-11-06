import { Routine, RoutineCategory } from "../types";
import { getYoutubeWatchUrl } from "../utils/youtube";
import { EXTRA_CATEGORIES, EXTRA_ROUTINES } from "./routineDrills";
import routineData from "./routines.data.json";

type VideoMeta = {
  id: string;
  title: string;
  channel: string;
};

const now = new Date().toISOString();

const withYouTube = (primary: VideoMeta, alternate?: VideoMeta) => ({
  youtube_video_id: primary.id,
  youtube_url: getYoutubeWatchUrl(primary.id),
  youtube_title: primary.title,
  youtube_channel: primary.channel,
  youtube_alt_video_id: alternate?.id,
  youtube_alt_url: alternate ? getYoutubeWatchUrl(alternate.id) : undefined,
  youtube_alt_title: alternate?.title,
  youtube_alt_channel: alternate?.channel,
});

export const DEFAULT_CATEGORIES: RoutineCategory[] = [
  {
    id: "cat-basics",
    name: "Fundamentals Library",
    description: "Detailed technique guides on grip, stance, bridge, cue action and aiming. Use them as building blocks, then adapt for your own body and natural cueing style.",
    icon: "🎯",
    color: "#0F766E",
    order_index: 1,
    created_at: now,
  },
  {
    id: "cat-break-building",
    name: "Break Building & Colours",
    description: "Pattern drills and colour-clearance routines for building scoring visits.",
    icon: "🔥",
    color: "#B45309",
    order_index: 2,
    created_at: now,
  },
  {
    id: "cat-safety",
    name: "Safety & Escapes",
    description: "Containment, snookers and escape routines for tactical control.",
    icon: "🛡️",
    color: "#1D4ED8",
    order_index: 3,
    created_at: now,
  },
  {
    id: "cat-straight-cueing",
    name: "Cue Delivery & Straight Cueing",
    description: "Straight cueing, strike quality, and delivery consistency drills.",
    icon: "🎱",
    color: "#334155",
    order_index: 4,
    created_at: now,
  },
  {
    id: "cat-cue-ball-control",
    name: "Cue Ball Control & Spin",
    description: "Stun, screw, follow, and side drills for precise position play.",
    icon: "📈",
    color: "#7C3AED",
    order_index: 5,
    created_at: now,
  },
  {
    id: "cat-long-potting",
    name: "Long Potting & Starters",
    description: "Distance potting and opening-red confidence from match-like positions.",
    icon: "🏆",
    color: "#BE123C",
    order_index: 6,
    created_at: now,
  },
  // EXTRA_CATEGORIES (in routineDrills.ts) only group EXTRA_ROUTINES, paused below for the same
  // reason - bring both back together.
];

/**
 * Every routine's write-up lives in routines.data.json, not here, so the admin dashboard
 * (apps/admin, Routines) can show, edit and add them. Edit them there, not by hand.
 *
 * Only routines marked inApp reach players; the rest are drafts written in the dashboard.
 * builtIn marks the routines the app shipped with: other code refers to them by id (the routine
 * order in routinesStore, AI coach suggestions), so the dashboard won't take them out or delete
 * them. Videos are stored as { id, title, channel } and the YouTube links are built from the id.
 *
 * EXTRA_ROUTINES (39 more, in routineDrills.ts) are paused for now while these routines get real
 * ball-position data and reference-checked content - none of the 39 have that yet, and showing
 * them alongside ones that do made the routine list look inconsistent. Bring back with
 * `...EXTRA_ROUTINES` once they've had the same treatment.
 */
type StoredVideo = { id: string; title: string; channel: string };
type StoredRoutine = Omit<
  Routine,
  | "is_system_routine"
  | "created_at"
  | "updated_at"
  | "youtube_video_id"
  | "youtube_url"
  | "youtube_title"
  | "youtube_channel"
  | "youtube_alt_video_id"
  | "youtube_alt_url"
  | "youtube_alt_title"
  | "youtube_alt_channel"
> & { inApp: boolean; builtIn?: boolean; video?: StoredVideo; altVideo?: StoredVideo };

export const DEFAULT_ROUTINES: Routine[] = (routineData.routines as unknown as StoredRoutine[])
  .filter((routine) => routine.inApp)
  .map(({ inApp: _inApp, builtIn: _builtIn, video, altVideo, ...routine }) => ({
    ...routine,
    is_system_routine: true,
    created_at: now,
    updated_at: now,
    ...(video ? withYouTube(video, altVideo) : {}),
  }));
