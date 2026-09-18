import { safeStorage } from "../../utils/storage";
import type { LiveFrameState } from "./liveFrameEngine";

// The frame in progress lives in component state, so keep a local copy that survives the
// OS killing the app mid-frame (phone call, low memory, long time in the background).
const keyFor = (matchId: string) => `live_frame_in_progress:${matchId}`;

export const loadLiveFrame = async (matchId: string): Promise<LiveFrameState | null> => {
  const raw = await safeStorage.getItem(keyFor(matchId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LiveFrameState;
  } catch {
    return null;
  }
};

export const saveLiveFrame = (matchId: string, frame: LiveFrameState) =>
  safeStorage.setItem(keyFor(matchId), JSON.stringify(frame));

export const clearLiveFrame = (matchId: string) => safeStorage.removeItem(keyFor(matchId));
