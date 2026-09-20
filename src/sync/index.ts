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

const onAppStateChange = (status: AppStateStatus) => {
  if (status !== "active") return;
  // Back in the hand: send what is waiting, then catch up on anything missed while away.
  void flushOutbox().then(() => refreshEverything());
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
