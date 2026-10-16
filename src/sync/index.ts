/**
 * Starting and stopping the two halves of sync: listening for changes from other devices, and
 * sending anything the phone could not send at the time.
 */

import { AppState, type AppStateStatus } from "react-native";
import { flushOutbox, setSyncOwner, useOutboxStore } from "./outbox";
import { refreshEverything, startRealtime, stopRealtime } from "./realtime";

export * from "./outbox";
export { refreshEverything, startRealtime, stopRealtime } from "./realtime";

/** Slow enough not to drum on the network, often enough that a walk outside clears the queue. */
const RETRY_MS = 30_000;

let appStateSubscription: { remove: () => void } | null = null;
let retryTimer: ReturnType<typeof setInterval> | null = null;
let unsubscribeQueue: (() => void) | null = null;

const startRetryTimer = () => {
  if (retryTimer) return;
  retryTimer = setInterval(() => {
    void flushOutbox();
  }, RETRY_MS);
};

const stopRetryTimer = () => {
  if (!retryTimer) return;
  clearInterval(retryTimer);
  retryTimer = null;
};

/** How long in the background before coming back re-reads everything. Shorter trips are covered by
 *  live sync, which also catches up by itself if its connection dropped while away. */
const CATCH_UP_AFTER_MS = 30_000;
let backgroundedAt: number | null = null;

const onAppStateChange = (status: AppStateStatus) => {
  if (status === "background") {
    backgroundedAt = Date.now();
    return;
  }
  if (status !== "active") return;
  // "active" also follows a photo picker, a permission prompt, Face ID or a pull of Notification
  // Centre - none of which is time away. Only a real trip to the background earns a full re-read.
  const away = backgroundedAt == null ? 0 : Date.now() - backgroundedAt;
  backgroundedAt = null;
  // Back in the hand: send what is waiting, then catch up on anything missed while away.
  void flushOutbox().then(() => (away >= CATCH_UP_AFTER_MS ? refreshEverything() : undefined));
};

export const startSync = (userId: string) => {
  setSyncOwner(userId);
  startRealtime(userId);

  if (!appStateSubscription) {
    appStateSubscription = AppState.addEventListener("change", onAppStateChange);
  }

  if (!unsubscribeQueue) {
    // The timer only runs while something is actually waiting to go.
    unsubscribeQueue = useOutboxStore.subscribe((state) => {
      if (state.jobs.length) startRetryTimer();
      else stopRetryTimer();
    });
  }

  if (useOutboxStore.getState().jobs.length) {
    startRetryTimer();
    void flushOutbox();
  }
};

export const stopSync = () => {
  setSyncOwner(null);
  stopRealtime();
  stopRetryTimer();

  appStateSubscription?.remove();
  appStateSubscription = null;

  unsubscribeQueue?.();
  unsubscribeQueue = null;
};
