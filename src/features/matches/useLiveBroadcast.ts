import { useEffect, useRef } from "react";
import type { LiveFrameRecord, Match } from "../../types";
import { useCommunityStore } from "../../store/communityStore";
import { useSharePrefsStore } from "../../store/sharePrefsStore";
import type { LiveFrameState } from "./liveFrameEngine";
import { postLive, snapshot, stopLive, type LiveRow } from "./liveShare";

/** At most one post in this long; the last change always goes. */
const EVERY_MS = 1200;

/**
 * Posts the match in progress for others to follow, while the player is in the community and
 * has live sharing on. Turning it off mid-match takes the match down.
 */
export const useLiveBroadcast = ({
  match,
  frame,
  records,
  bestOf,
  finished,
}: {
  match: Match | undefined;
  frame: LiveFrameState;
  records: LiveFrameRecord[];
  bestOf: number | null;
  finished: boolean;
}) => {
  const joined = useCommunityStore((state) => Boolean(state.me?.handle));
  const enabled = useSharePrefsStore((state) => state.liveSharing);
  const on = Boolean(match && joined && enabled && !match.linked_by);
  const sent = useRef("");
  const latest = useRef<LiveRow | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasOn = useRef(false);

  useEffect(() => {
    if (!on || !match) return;
    const row = snapshot(match, frame, records, bestOf, finished);
    const key = JSON.stringify(row);
    if (key === sent.current) return;
    latest.current = row;
    if (timer.current) return;
    const send = async () => {
      const next = latest.current;
      if (!next) return;
      const nextKey = JSON.stringify(next);
      if (await postLive(next)) sent.current = nextKey;
    };
    void send();
    timer.current = setTimeout(() => {
      timer.current = null;
      if (latest.current && JSON.stringify(latest.current) !== sent.current) void send();
    }, EVERY_MS);
  }, [bestOf, finished, frame, match, on, records]);

  useEffect(() => {
    if (wasOn.current && !on && match) {
      void stopLive(match.id);
      sent.current = "";
    }
    wasOn.current = on;
  }, [match, on]);

  // Leaving the screen (as it does the moment the match is won) still sends the last change.
  useEffect(
    () => () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      timer.current = null;
      if (latest.current && JSON.stringify(latest.current) !== sent.current) void postLive(latest.current);
    },
    []
  );

  return { available: Boolean(match && joined && !match.linked_by), sharing: on };
};
