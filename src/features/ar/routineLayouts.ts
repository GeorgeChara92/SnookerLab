import type { Routine } from "../../types";
import { TABLE, type BallColour, type Point } from "../scanSnooker/table";
import type { PlacedBall } from "../scanSnooker/position";
import { SNOOKER_TABLE_GEOMETRY } from "./snookerTableGeometry";
import layoutData from "./routineLayouts.data.json";

export type SpotId = "spot-black" | "spot-pink" | "spot-blue" | "spot-brown" | "spot-green" | "spot-yellow";

export type BallColor = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "white";

export type NormalizedBallPlacement = {
  id: string;
  color: BallColor;
  x: number;
  y: number;
  label?: string;
};

/** An arrow drawn on a routine's table, as shares of the table like the balls. */
export type NormalizedArrow = { id: string; x1: number; y1: number; x2: number; y2: number; dashed?: boolean };

/** An arrow ready to draw, in table millimetres. */
export type TableArrow = { id: string; from: Point; to: Point; dashed?: boolean };

export type RoutineLayoutDefinition = {
  routineId: string;
  displayName: string;
  category: "fundamentals" | "break-building" | "safety" | "cueing" | "cue-ball-control" | "spin" | "long-potting";
  anchorSystem: "black_pink";
  spotMarkers: SpotId[];
  ballPlacements: NormalizedBallPlacement[];
  arrows?: NormalizedArrow[];
  referenceImage?: any;
  notes?: string;
};

export const SPOT_COORDS: Record<SpotId, { x: number; y: number; color: BallColor; label: string }> = {
  "spot-black": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm, color: "black", label: "Black" },
  "spot-pink": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm, color: "pink", label: "Pink" },
  "spot-blue": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm, color: "blue", label: "Blue" },
  "spot-brown": { x: SNOOKER_TABLE_GEOMETRY.spots.brown.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.brown.yNorm, color: "brown", label: "Brown" },
  "spot-green": { x: SNOOKER_TABLE_GEOMETRY.spots.green.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.green.yNorm, color: "green", label: "Green" },
  "spot-yellow": { x: SNOOKER_TABLE_GEOMETRY.spots.yellow.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.yellow.yNorm, color: "yellow", label: "Yellow" },
};

const allSpots: SpotId[] = ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"];

/**
 * Each routine's ball layout lives in routineLayouts.data.json, not here, so the routine builder
 * in the admin dashboard (apps/admin, Routines) can save straight into it. Edit layouts there,
 * not by hand. Reference images stay here because the app needs a static require() for each.
 */
type StoredLayout = Omit<RoutineLayoutDefinition, "anchorSystem" | "referenceImage">;

const REFERENCE_IMAGES: Record<string, any> = {
  "routine-bridge-grip-stance": require("../../../assets/routines/fundamentals/stance_image.png"),
  "routine-pre-shot-routine": require("../../../assets/routines/fundamentals/grip_image.png"),
  "routine-bridge-fundamentals": require("../../../assets/routines/fundamentals/bridge_image.png"),
  "routine-rest-shot-fundamentals": require("../../../assets/routines/fundamentals/alignment.png"),
  "routine-potting-fundamentals": require("../../../assets/routines/fundamentals/cue_action.png"),
  "routine-head-position-fundamentals": require("../../../assets/routines/fundamentals/head_postion.png"),
  "routine-cue-ball-control-fundamentals-guide": require("../../../assets/routines/fundamentals/cue_ball_control.png"),
  "routine-pre-shot-system-fundamentals": require("../../../assets/routines/fundamentals/pre_shot.png"),
  "routine-straight-cueing-fundamentals-guide": require("../../../assets/routines/fundamentals/straight_cueing.png"),
  "routine-line-up": require("../../../assets/routines/the-line-up.png"),
  "routine-t-routine": require("../../../assets/routines/the-snooker-t-line-up.png"),
  "routine-around-colours": require("../../../assets/routines/around-the-colours.png"),
  "routine-3-reds-colours": require("../../../assets/routines/3-reds-colours.png"),
  "routine-break-building-foundations": require("../../../assets/routines/break-building-foundations.png"),
  "routine-pink-ball-routine": require("../../../assets/routines/pink-ball-pattern.png"),
  "routine-baulk-safety": require("../../../assets/routines/snooker-safety-shots-off-reds.png"),
  "routine-straight-cueing-line": require("../../../assets/routines/straight-potting-reds.png"),
  "routine-long-blue-straight-cue": require("../../../assets/routines/potting-long-blues.png"),
  "routine-cueing-secret-session": require("../../../assets/routines/loosen-your-snooker-arm.png"),
  "routine-cue-ball-control": require("../../../assets/routines/cue-ball-control.png"),
  "routine-long-potting-classic": require("../../../assets/routines/door-openers-1.png"),
  "routine-black-off-spot": require("../../../assets/routines/potting-the-black-ball.png"),
  "routine-blue-ball-control": require("../../../assets/routines/potting-multiple-blue-balls.png"),
};

const layoutDefinitions: RoutineLayoutDefinition[] = (layoutData.routines as StoredLayout[]).map((layout) => ({
  ...layout,
  anchorSystem: "black_pink",
  referenceImage: REFERENCE_IMAGES[layout.routineId],
}));

const byRoutineId = new Map(layoutDefinitions.map((definition) => [definition.routineId, definition]));

export const getRoutineLayoutDefinition = (routine: Routine | undefined): RoutineLayoutDefinition => {
  if (routine) {
    const matched = byRoutineId.get(routine.id);
    if (matched) return matched;
  }

  return {
    routineId: routine?.id ?? "fallback",
    displayName: routine?.name ?? "Unknown Routine",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: [],
  };
};

export const getRoutineReferenceImageByRoutineId = (routineId: string): any | undefined => {
  return byRoutineId.get(routineId)?.referenceImage;
};

export const isRoutineAREnabled = (routine: Routine | undefined): boolean => {
  if (!routine) return false;
  const definition = byRoutineId.get(routine.id);
  return Boolean(definition?.referenceImage);
};

export const isRoutineARBadgeVisible = (routine: Routine | undefined): boolean => {
  if (!routine) return false;
  const definition = byRoutineId.get(routine.id);
  if (!definition?.referenceImage) return false;
  return definition.category !== "fundamentals";
};

/** routineLayouts' "white" cue ball to table.ts's "cue" - the only name that differs. */
const toBallColour = (color: BallColor): BallColour => (color === "white" ? "cue" : color);

/**
 * A routine's ball layout, in the same table-millimetre `PlacedBall`s the diagram, scan-snooker
 * and the custom routine builder all already use - so a library routine's diagram is drawn by the
 * exact same renderer, not a separate one-off image. Null when a routine has no real layout yet
 * (just a lone cue-ball placeholder, or nothing) - callers fall back to its reference image or
 * video thumbnail instead of drawing a diagram with nothing on it.
 */
export const getRoutinePlacedBalls = (routine: Routine | undefined): PlacedBall[] | null => {
  if (!routine) return null;
  // A technique guide is taught from its photo. A stray placeholder ball in its layout used to
  // draw an empty table in place of the photo (Cueing Action, Cue Ball Control: 2026-11-12).
  if (routine.content_type === "guide") return null;
  const definition = byRoutineId.get(routine.id);
  if (!definition || definition.ballPlacements.length === 0) return null;
  const balls: PlacedBall[] = definition.ballPlacements.map((placement) => ({
    id: placement.id,
    colour: toBallColour(placement.color),
    x: placement.x * TABLE.width,
    y: placement.y * TABLE.length,
  }));
  // The colours on their own spots complete the table for every routine that only lists the red
  // balls that move - a routine's own placements override a spot only if it lists that colour too
  // (a handful do, for a colour that starts somewhere other than its spot). Only a colour whose
  // spot is in the routine's own `spotMarkers` gets auto-filled - some drills (straight potting,
  // loosening-up lines) are reds only by design and showing colours on top of them that the
  // routine's own data never placed was confirmed wrong by the user, not just unused clutter.
  const already = new Set(balls.map((ball) => ball.colour));
  const onSpot = (colour: Exclude<BallColour, "cue" | "red">, point: Point): PlacedBall | null =>
    already.has(colour) || !definition.spotMarkers.includes(`spot-${colour}` as SpotId)
      ? null
      : { id: `spot-${colour}`, colour, x: point.x, y: point.y };
  const spotBalls = (
    [
      onSpot("yellow", { x: SPOT_COORDS["spot-yellow"].x * TABLE.width, y: SPOT_COORDS["spot-yellow"].y * TABLE.length }),
      onSpot("green", { x: SPOT_COORDS["spot-green"].x * TABLE.width, y: SPOT_COORDS["spot-green"].y * TABLE.length }),
      onSpot("brown", { x: SPOT_COORDS["spot-brown"].x * TABLE.width, y: SPOT_COORDS["spot-brown"].y * TABLE.length }),
      onSpot("blue", { x: SPOT_COORDS["spot-blue"].x * TABLE.width, y: SPOT_COORDS["spot-blue"].y * TABLE.length }),
      onSpot("pink", { x: SPOT_COORDS["spot-pink"].x * TABLE.width, y: SPOT_COORDS["spot-pink"].y * TABLE.length }),
      onSpot("black", { x: SPOT_COORDS["spot-black"].x * TABLE.width, y: SPOT_COORDS["spot-black"].y * TABLE.length }),
    ] as const
  ).filter((ball): ball is PlacedBall => ball !== null);
  return [...balls, ...spotBalls];
};

/** The arrows drawn on a routine's table, if it has any. Guides are taught from a photo, so none. */
export const getRoutineArrows = (routine: Routine | undefined): TableArrow[] => {
  if (!routine || routine.content_type === "guide") return [];
  const definition = byRoutineId.get(routine.id);
  return (definition?.arrows ?? []).map((arrow) => ({
    id: arrow.id,
    from: { x: arrow.x1 * TABLE.width, y: arrow.y1 * TABLE.length },
    to: { x: arrow.x2 * TABLE.width, y: arrow.y2 * TABLE.length },
    ...(arrow.dashed ? { dashed: true } : {}),
  }));
};
