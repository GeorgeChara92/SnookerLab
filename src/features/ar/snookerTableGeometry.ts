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

const PLAYING_LENGTH_M = 3.569;
const PLAYING_WIDTH_M = 1.778;
const BLACK_FROM_TOP_M = 0.324;

const BLACK_Y_NORM = BLACK_FROM_TOP_M / PLAYING_LENGTH_M;
const BLUE_Y_NORM = 0.5;
const PINK_Y_NORM = (BLUE_Y_NORM + BLACK_Y_NORM) / 2;

export const SNOOKER_TABLE_GEOMETRY: SnookerTableGeometry = {
  playingLengthM: PLAYING_LENGTH_M,
  playingWidthM: PLAYING_WIDTH_M,
  blackDistanceFromTopCushionM: BLACK_FROM_TOP_M,
  blueSpot: { xNorm: 0.5, yNorm: BLUE_Y_NORM },
  pinkSpot: { xNorm: 0.5, yNorm: PINK_Y_NORM },
  blackSpot: { xNorm: 0.5, yNorm: BLACK_Y_NORM },
  spots: {
    yellow: { id: "yellow", label: "Yellow", xNorm: 0.2, yNorm: 0.825 },
    green: { id: "green", label: "Green", xNorm: 0.8, yNorm: 0.825 },
    brown: { id: "brown", label: "Brown", xNorm: 0.5, yNorm: 0.825 },
    blue: { id: "blue", label: "Blue", xNorm: 0.5, yNorm: BLUE_Y_NORM },
    pink: { id: "pink", label: "Pink", xNorm: 0.5, yNorm: PINK_Y_NORM },
    black: { id: "black", label: "Black", xNorm: 0.5, yNorm: BLACK_Y_NORM },
  },
};
