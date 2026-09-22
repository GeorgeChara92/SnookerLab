import { useEffect, useRef } from "react";
import { useMatchesStore } from "../../store";
import { useAchievementsStore } from "../../store/achievementsStore";
import { useActivityStore } from "../../store/activityStore";
import { useCommunityStore } from "../../store/communityStore";
import { ACHIEVEMENTS } from "../../constants/achievements";
import { usePlayerProgress } from "../profile/playerProgress";
import { bestOfFor } from "../matches/bestOf";
import { matchCard } from "../matches/breaks";
import { matchHighlights } from "../matches/highlights";
import {
  achievementActivity,
  beats,
  levelActivity,
  matchActivity,
  matchFinished,
  personalBestActivity,
  type ActivityDraft,
} from "./activityItems";
import { postActivity } from "./groupFeed";
import { useRoutineBests } from "./useLeaderboardSync";

/** Straight after sign in the numbers fill in over a few seconds; nothing then is news. */
const QUIET_AFTER_LOAD_MS = 8000;

/**
 * Posts the player's moments to the feed as they happen: a finished match worth telling (a win,
 * a century, a maximum, a new high break), a new best on a routine with a leaderboard, a new
 * level, and the hardest achievements. Nothing from before this phone started posting, and
 * nothing at all if the player has turned sharing off.
 */
export const useActivitySync = (userId: string | null) => {
  const loaded = useCommunityStore((state) => state.loaded);
  const hasHandle = useCommunityStore((state) => Boolean(state.me?.handle));
  const sharing = useCommunityStore((state) => state.shareActivity);
  const hydrated = useAchievementsStore((state) => state.hydrated);
  const hydratedAt = useAchievementsStore((state) => state.hydratedAt);
  const unlocked = useAchievementsStore((state) => state.unlocked);
  const matches = useMatchesStore((state) => state.matches);
  const liveFramesByMatch = useMatchesStore((state) => state.liveFramesByMatch);
  const bests = useRoutineBests();
  const { level } = usePlayerProgress();
  const store = useActivityStore();
  const sending = useRef(new Set<string>());
  // After a failed post (offline, or the feed not switched on yet), wait before trying again.
  const failedAt = useRef(0);

  const ready = Boolean(userId && loaded && hasHandle && hydrated);

  // The first time this player is seen here: note where things stand, and post nothing.
  useEffect(() => {
    if (!ready || !userId || store.ownerId === userId) return;
    store.start(userId, Object.fromEntries(bests.map((row) => [row.routine_key, row.best])), level.level);
  }, [bests, level.level, ready, store, userId]);

  useEffect(() => {
    if (!ready || !userId || store.ownerId !== userId || !store.since) return;
    const quiet = Date.now() - hydratedAt < QUIET_AFTER_LOAD_MS;
    const drafts: ActivityDraft[] = [];

    // Bests and the level only ever move up here, so a dip while data loads is not news later.
    bests.forEach((row) => {
      const previous = store.bests[row.routine_key];
      if (previous === undefined || beats(row.best, previous, row.kind)) {
        store.setBest(row.routine_key, row.best);
        if (previous !== undefined && !quiet) {
          drafts.push(personalBestActivity(row.routine_key, row.name, row.best_raw));
        }
      }
    });
    if (store.level === null || level.level > store.level) {
      if (store.level !== null && !quiet) drafts.push(levelActivity(level.level));
      store.setLevel(level.level);
    }

    const since = store.since;
    Object.entries(unlocked).forEach(([id, at]) => {
      if (at < since) return;
      const achievement = ACHIEVEMENTS.find((item) => item.id === id);
      const draft = achievement ? achievementActivity(achievement) : null;
      if (draft) drafts.push(draft);
    });

    matches
      .filter((match) => (match.updated_at ?? match.created_at) >= since && matchFinished(match))
      .forEach((match) => {
        const bestOf = bestOfFor(match);
        const highlights = matchHighlights(
          match,
          matches,
          liveFramesByMatch,
          bestOf ? Math.floor(bestOf / 2) + 1 : undefined
        );
        const draft = matchActivity(match, highlights, matchCard(liveFramesByMatch[match.id] ?? []).highUser);
        if (draft) drafts.push(draft);
      });

    const fresh = drafts.filter(
      (draft) => !store.posted.includes(draft.dedupeKey) && !sending.current.has(draft.dedupeKey)
    );
    if (!fresh.length || !sharing) {
      // With sharing off, moments are passed over for good rather than posted later.
      if (fresh.length) store.markPosted(fresh.map((draft) => draft.dedupeKey));
      return;
    }
    if (Date.now() - failedAt.current < 60_000) return;
    fresh.forEach((draft) => sending.current.add(draft.dedupeKey));
    void postActivity(userId, fresh).then((ok) => {
      fresh.forEach((draft) => sending.current.delete(draft.dedupeKey));
      if (ok) store.markPosted(fresh.map((draft) => draft.dedupeKey));
      else failedAt.current = Date.now();
    });
  }, [bests, hydratedAt, level.level, liveFramesByMatch, matches, ready, sharing, store, unlocked, userId]);
};
