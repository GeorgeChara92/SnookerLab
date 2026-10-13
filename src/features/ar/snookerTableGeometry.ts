import { TABLE } from "../scanSnooker/table";

export type SnookerSpotId = "yellow" | "green" | "brown" | "blue" | "pink" | "black";

export type SnookerSpot = {
  id: SnookerSpotId;
  label: string;
  xNorm: number;
  yNorm: number;
};

export type SnookerTableGeometry = {
  playingLengthM: number;
  playingWidthM: number;
  blackDistanceFromTopCushionM: number;
  blueSpot: { xNorm: number; yNorm: number };
  pinkSpot: { xNorm: number; yNorm: number };
  blackSpot: { xNorm: number; yNorm: number };
  spots: Record<SnookerSpotId, SnookerSpot>;
};

// Derived from `table.ts`'s TABLE constant - the one geometry every other part of the app (the
// diagram, scan-snooker, the AR calibration) already trusts - rather than a separate standalone
// figure, so a routine's normalized position and a scanned ball's table-millimetre position agree
// on the same real table instead of two slightly different "standard" sizes.
const PLAYING_LENGTH_M = TABLE.length / 1000;
const PLAYING_WIDTH_M = TABLE.width / 1000;
const BLACK_FROM_TOP_M = TABLE.blackFromTop / 1000;
const PINK_FROM_TOP_M = TABLE.length / 4 / 1000;
const BAULK_FROM_BOTTOM_M = TABLE.baulkFromBottom / 1000;
const D_RADIUS_M = TABLE.dRadius / 1000;

const BLACK_Y_NORM = BLACK_FROM_TOP_M / PLAYING_LENGTH_M;
const BLUE_Y_NORM = 0.5;
const PINK_Y_NORM = PINK_FROM_TOP_M / PLAYING_LENGTH_M;
const BAULK_Y_NORM = (PLAYING_LENGTH_M - BAULK_FROM_BOTTOM_M) / PLAYING_LENGTH_M;
const D_X_OFFSET_NORM = D_RADIUS_M / PLAYING_WIDTH_M;

export const SNOOKER_TABLE_GEOMETRY: SnookerTableGeometry = {
  playingLengthM: PLAYING_LENGTH_M,
  playingWidthM: PLAYING_WIDTH_M,
  blackDistanceFromTopCushionM: BLACK_FROM_TOP_M,
  blueSpot: { xNorm: 0.5, yNorm: BLUE_Y_NORM },
  pinkSpot: { xNorm: 0.5, yNorm: PINK_Y_NORM },
  blackSpot: { xNorm: 0.5, yNorm: BLACK_Y_NORM },
  // Seen from baulk, the way a player breaks off (table.ts's own convention, its tests pin this
  // down): yellow is on the right of the D, green on the left. These were previously swapped here
  // - a confirmed, real bug from before this file was unified with table.ts, not a guess.
  spots: {
    yellow: { id: "yellow", label: "Yellow", xNorm: 0.5 + D_X_OFFSET_NORM, yNorm: BAULK_Y_NORM },
    green: { id: "green", label: "Green", xNorm: 0.5 - D_X_OFFSET_NORM, yNorm: BAULK_Y_NORM },
    brown: { id: "brown", label: "Brown", xNorm: 0.5, yNorm: BAULK_Y_NORM },
    blue: { id: "blue", label: "Blue", xNorm: 0.5, yNorm: BLUE_Y_NORM },
    pink: { id: "pink", label: "Pink", xNorm: 0.5, yNorm: PINK_Y_NORM },
    black: { id: "black", label: "Black", xNorm: 0.5, yNorm: BLACK_Y_NORM },
  },
};
