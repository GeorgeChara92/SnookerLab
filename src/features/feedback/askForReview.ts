import { Linking, Platform } from "react-native";
import type * as StoreReviewModule from "expo-store-review";
import { safeStorage } from "../../utils/storage";

/**
 * Asking for an App Store (or Play) rating, the way Apple and Google want it done: their own
 * review sheet, in the app, which sends the stars and review straight to the store. Apple shows it
 * at most three times a year per person and decides itself whether to show it at all, and a custom
 * "rate us" prompt (or one that only passes happy people on) breaks both stores' rules - so this
 * only chooses good moments, and leaves the rest to the system.
 *
 * Good moments are just after something went well: a match won, a coaching report read. On top
 * of the system's own limit it waits until the player has had a few of them, has had the app at
 * least a few days, and hasn't been asked in the last four months.
 */

const MOMENTS_KEY = "review-good-moments";
const ASKED_KEY = "review-last-asked";
const MOMENTS_NEEDED = 3;
const MIN_ACCOUNT_AGE_MS = 4 * 86_400_000;
const BETWEEN_ASKS_MS = 120 * 86_400_000;

/**
 * The review module is native, and builds made before it was added don't have it. Loaded lazily
 * so an over-the-air update carrying this code doesn't crash those builds - it just never asks.
 */
const storeReview = (): typeof StoreReviewModule | null => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-store-review") as typeof StoreReviewModule;
  } catch {
    return null;
  }
};

/** App Store id, for the "Rate Snookered" link in Settings. */
const APP_STORE_ID = "6761587574";

/** Counts a good moment and, if it's time, asks for a rating. Never throws. */
export const goodMomentForReview = async (accountCreatedAt?: string | null): Promise<void> => {
  try {
    const moments = Number((await safeStorage.getItem(MOMENTS_KEY)) ?? "0") + 1;
    await safeStorage.setItem(MOMENTS_KEY, String(moments));
    if (moments < MOMENTS_NEEDED) return;

    const created = accountCreatedAt ? new Date(accountCreatedAt).getTime() : NaN;
    if (Number.isFinite(created) && Date.now() - created < MIN_ACCOUNT_AGE_MS) return;

    const lastAsked = Number((await safeStorage.getItem(ASKED_KEY)) ?? "0");
    if (lastAsked && Date.now() - lastAsked < BETWEEN_ASKS_MS) return;

    const StoreReview = storeReview();
    if (!StoreReview || !(await StoreReview.isAvailableAsync()) || !(await StoreReview.hasAction())) return;
    await safeStorage.setItem(ASKED_KEY, String(Date.now()));
    await safeStorage.setItem(MOMENTS_KEY, "0");
    await StoreReview.requestReview();
  } catch (error) {
    console.warn("review prompt failed", error);
  }
};

/** The store's own write-a-review page, for anyone who goes looking for it in Settings. */
export const openStoreReviewPage = async (): Promise<void> => {
  const url =
    Platform.OS === "ios"
      ? `itms-apps://itunes.apple.com/app/id${APP_STORE_ID}?action=write-review`
      : (storeReview()?.storeUrl() ?? null);
  if (!url) return;
  await Linking.openURL(url).catch(() => undefined);
};
