import { SNOOKER_TABLE_GEOMETRY, type SnookerSpotId } from "./snookerTableGeometry";
import type { GroundPoint, SnookerTableCalibration } from "./snookerTableCalibration";
import { worldFromNorm } from "./snookerTableCalibration";

export type SnookerReferenceAnchor = {
  id: SnookerSpotId;
  label: string;
  xNorm: number;
  yNorm: number;
};

export const SNOOKER_REFERENCE_ANCHORS: SnookerReferenceAnchor[] = [
  { id: "black", label: "Black Spot", xNorm: SNOOKER_TABLE_GEOMETRY.blackSpot.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm },
  { id: "pink", label: "Pink Spot", xNorm: SNOOKER_TABLE_GEOMETRY.pinkSpot.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm },
  { id: "blue", label: "Blue Spot", xNorm: SNOOKER_TABLE_GEOMETRY.blueSpot.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm },
  { id: "brown", label: "Brown Spot", xNorm: SNOOKER_TABLE_GEOMETRY.spots.brown.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.spots.brown.yNorm },
  { id: "green", label: "Green Spot", xNorm: SNOOKER_TABLE_GEOMETRY.spots.green.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.spots.green.yNorm },
  { id: "yellow", label: "Yellow Spot", xNorm: SNOOKER_TABLE_GEOMETRY.spots.yellow.xNorm, yNorm: SNOOKER_TABLE_GEOMETRY.spots.yellow.yNorm },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const clampNorm = (value: number) => clamp(value, 0, 1);

export const clampNormPoint = (point: { xNorm: number; yNorm: number }) => ({
  xNorm: clampNorm(point.xNorm),
  yNorm: clampNorm(point.yNorm),
});

export const distanceBetweenGroundPoints = (a: GroundPoint, b: GroundPoint) => {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
};

export const resolveReferenceAnchorWorldPoints = (calibration: SnookerTableCalibration) => {
  return SNOOKER_REFERENCE_ANCHORS.map((anchor) => {
    const world = worldFromNorm(calibration, anchor.xNorm, anchor.yNorm);
    return {
      ...anchor,
      world,
    };
  });
};
