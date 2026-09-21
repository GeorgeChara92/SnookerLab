/**
 * The outbox.
 *
 * A write that cannot reach Supabase used to be thrown away: the score came off the screen and
 * the player entered it again later. Club cellars being what they are, that is the wrong answer.
 * A failed write is parked here instead, kept on the phone, and sent the next time the app can
 * reach the server.
 *
 * Jobs run in the order they were queued and a failure stops the run, so two edits to the same
 * fixture cannot land the wrong way round.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { safeStorage } from "../utils/storage";

/** Which part of the app a job belongs to, so a stale refresh cannot overwrite it. */
export type SyncScope = "tournaments" | "matches" | "sessions" | "routines" | "ai" | "customRoutines";

export type OutboxJob = {
  id: string;
  /** Names the handler that knows how to send this job. */
  kind: string;
  scope: SyncScope;
  payload: unknown;
  /** Shown to the player, e.g. "Result in Tuesday League". */
  description: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  /** Who queued it. A job cannot be sent under someone else's sign-in, so it waits. */
  userId?: string;
};

type Handler = (payload: any) => Promise<void>;

const handlers = new Map<string, Handler>();

/**
 * Stores register how to send each kind of job. The handler is the same code the store runs
 * when it is online, so a queued write and a live one take exactly the same path.
 */
export const registerSyncHandler = (kind: string, handler: Handler) => {
  handlers.set(kind, handler);
};

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

let syncOwnerId: string | null = null;

/** Told by startSync who is signed in, so queued work is stamped and matched to its owner. */
export const setSyncOwner = (userId: string | null) => {
  syncOwnerId = userId;
};

/** Past this many tries something is wrong beyond a bad connection, so stop the timer retrying. */
const MAX_AUTOMATIC_ATTEMPTS = 8;

interface OutboxState {
  jobs: OutboxJob[];
  isFlushing: boolean;
  lastSyncedAt: string | null;
  enqueue: (job: Pick<OutboxJob, "kind" | "scope" | "payload" | "description">) => void;
  flush: (options?: { force?: boolean }) => Promise<{ sent: number; stalled: boolean }>;
  hasPending: (scope: SyncScope) => boolean;
  discard: (jobId: string) => void;
}

export const useOutboxStore = create<OutboxState>()(
  persist(
    (set, get) => ({
      jobs: [],
      isFlushing: false,
      lastSyncedAt: null,

      enqueue: (job) => {
        set((state) => ({
          jobs: [
            ...state.jobs,
            {
              ...job,
              id: makeId(),
              queuedAt: new Date().toISOString(),
              attempts: 0,
              userId: syncOwnerId ?? undefined,
            },
          ],
        }));
      },

      /**
       * @param force ignores the attempt cap, for when the player asks for it by hand.
       */
      flush: async ({ force = false } = {}) => {
        if (get().isFlushing) return { sent: 0, stalled: false };

        const queued = get().jobs;
        if (!queued.length) return { sent: 0, stalled: false };

        set({ isFlushing: true });
        let sent = 0;
        let stalled = false;

        try {
          for (const job of queued) {
            const handler = handlers.get(job.kind);

            if (job.userId && syncOwnerId && job.userId !== syncOwnerId) {
              // Someone else's work, waiting for them to sign back in. Step over it rather
              // than stopping, or their queue would block this player's.
              continue;
            }

            if (!handler) {
              // A job from an older build that nothing can send any more.
              console.warn("Dropping a queued job with no handler:", job.kind);
              set((state) => ({ jobs: state.jobs.filter((item) => item.id !== job.id) }));
              continue;
            }

            if (!force && job.attempts >= MAX_AUTOMATIC_ATTEMPTS) {
              stalled = true;
              break;
            }

            try {
              await handler(job.payload);
              sent += 1;
              set((state) => ({
                jobs: state.jobs.filter((item) => item.id !== job.id),
                lastSyncedAt: new Date().toISOString(),
              }));
            } catch (error: any) {
              // Order matters, so stop here and keep the rest for the next run.
              set((state) => ({
                jobs: state.jobs.map((item) =>
                  item.id === job.id
                    ? { ...item, attempts: item.attempts + 1, lastError: error?.message ?? "Could not reach the server" }
                    : item
                ),
              }));
              stalled = true;
              break;
            }
          }
        } finally {
          set({ isFlushing: false });
        }

        return { sent, stalled };
      },

      hasPending: (scope) => get().jobs.some((job) => job.scope === scope),

      discard: (jobId) => {
        set((state) => ({ jobs: state.jobs.filter((job) => job.id !== jobId) }));
      },
    }),
    {
      name: "snooker-outbox",
      storage: createJSONStorage(() => safeStorage),
      partialize: (state) => ({ jobs: state.jobs, lastSyncedAt: state.lastSyncedAt }),
    }
  )
);

/** Queue a write that could not be sent. */
export const queueWrite = (job: Pick<OutboxJob, "kind" | "scope" | "payload" | "description">) =>
  useOutboxStore.getState().enqueue(job);

/** Try to send everything waiting. Safe to call often: it does nothing when the queue is empty. */
export const flushOutbox = (options?: { force?: boolean }) => useOutboxStore.getState().flush(options);

export const hasPendingWrites = (scope: SyncScope) => useOutboxStore.getState().hasPending(scope);
