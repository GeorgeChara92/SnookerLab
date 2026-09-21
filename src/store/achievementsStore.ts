import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../api/supabase";

/**
 * The achievements a player has unlocked, kept with their account.
 *
 * They used to live only in the phone's storage, which signing out clears, so a player who
 * signed back in started again at level 1. Now each unlock is saved to Supabase as it happens and
 * loaded back on sign in. Unlocks that could not be saved (no signal) are kept per player on the
 * phone and sent the next time the store loads.
 */

/** The old, phone-only list. Read once so nobody loses what they had before this change. */
const LEGACY_KEY = "seen_achievements";
const pendingKey = (userId: string) => `achievements_pending:${userId}`;

type AchievementsState = {
  ownerId: string | null;
  /** Achievement id to when it was unlocked (ISO). */
  unlocked: Record<string, string>;
  /** True once this player's achievements have been read from their account. */
  hydrated: boolean;
  /** When the store finished loading, so unlocks found while data is still arriving stay quiet. */
  hydratedAt: number;
  setOwner: (userId: string | null) => void;
  hydrate: (userId: string) => Promise<void>;
  /** Records new unlocks here and on the account. Returns the ids that were actually new. */
  unlock: (ids: string[]) => string[];
};

const readPending = async (userId: string): Promise<Record<string, string>> => {
  try {
    const raw = await AsyncStorage.getItem(pendingKey(userId));
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
};

const writePending = (userId: string, pending: Record<string, string>) =>
  AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending)).catch(() => undefined);

/** Sends unlocks to the account; whatever fails stays pending for next time. */
const send = async (userId: string, items: Record<string, string>) => {
  const rows = Object.entries(items).map(([achievement_id, unlocked_at]) => ({
    user_id: userId,
    achievement_id,
    unlocked_at,
  }));
  if (!rows.length) return;

  const pending = { ...(await readPending(userId)), ...items };
  const { error } = await supabase
    .from("user_achievements")
    .upsert(rows, { onConflict: "user_id,achievement_id", ignoreDuplicates: true });
  if (error) {
    console.warn("Could not save achievements yet:", error.message);
    await writePending(userId, pending);
    return;
  }
  rows.forEach((row) => delete pending[row.achievement_id]);
  await writePending(userId, pending);
};

export const useAchievementsStore = create<AchievementsState>()((set, get) => ({
  ownerId: null,
  unlocked: {},
  hydrated: false,
  hydratedAt: 0,

  setOwner: (userId) => {
    if (get().ownerId === userId) return;
    set({ ownerId: userId, unlocked: {}, hydrated: false, hydratedAt: 0 });
  },

  hydrate: async (userId) => {
    const pending = await readPending(userId);

    // A player's first load after this change: bring across what the phone remembered.
    let legacy: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(LEGACY_KEY);
      legacy = raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
      legacy = [];
    }

    const { data, error } = await supabase
      .from("user_achievements")
      .select("achievement_id, unlocked_at")
      .eq("user_id", userId);

    if (get().ownerId !== userId) return; // signed out or switched while loading

    const unlocked: Record<string, string> = {};
    (data ?? []).forEach((row: { achievement_id: string; unlocked_at: string }) => {
      unlocked[row.achievement_id] = row.unlocked_at;
    });
    Object.assign(unlocked, pending);

    const now = new Date().toISOString();
    const fromLegacy: Record<string, string> = {};
    legacy.forEach((id) => {
      if (!unlocked[id]) fromLegacy[id] = now;
    });
    Object.assign(unlocked, fromLegacy);

    set({ unlocked, hydrated: true, hydratedAt: Date.now() });

    if (error) {
      console.warn("Could not load achievements:", error.message);
      return;
    }
    // Send anything the account does not have yet, then retire the phone-only list.
    await send(userId, { ...pending, ...fromLegacy });
    if (legacy.length) await AsyncStorage.removeItem(LEGACY_KEY).catch(() => undefined);
  },

  unlock: (ids) => {
    const { ownerId, unlocked, hydrated } = get();
    if (!ownerId || !hydrated) return [];
    const fresh = ids.filter((id) => !unlocked[id]);
    if (!fresh.length) return [];

    const now = new Date().toISOString();
    const added = Object.fromEntries(fresh.map((id) => [id, now]));
    set({ unlocked: { ...unlocked, ...added } });
    void send(ownerId, added);
    return fresh;
  },
}));
