import type { Routine } from "../../types";

export type SpotId = "spot-black" | "spot-pink" | "spot-blue" | "spot-brown" | "spot-green" | "spot-yellow";

export type BallColor = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "white";

export type NormalizedBallPlacement = {
  id: string;
  color: BallColor;
  x: number;
  y: number;
  label?: string;
};

export type RoutineLayoutDefinition = {
  routineId: string;
  displayName: string;
  category: "fundamentals" | "break-building" | "safety" | "cueing" | "cue-ball-control" | "spin" | "long-potting";
  anchorSystem: "black_pink";
  spotMarkers: SpotId[];
  ballPlacements: NormalizedBallPlacement[];
  referenceImage?: any;
  notes?: string;
};

const TABLE_WIDTH_M = 1.778;
const TABLE_LENGTH_M = 3.569;
const BALL_DIAMETER_M = 0.0525;
const STEP_X = BALL_DIAMETER_M / TABLE_WIDTH_M;
const STEP_Y = BALL_DIAMETER_M / TABLE_LENGTH_M;
const D_OFFSET_X = 0.292 / TABLE_WIDTH_M;

export const SPOT_COORDS: Record<SpotId, { x: number; y: number; color: BallColor; label: string }> = {
  "spot-black": { x: 0.5, y: 0.0908, color: "black", label: "Black" },
  "spot-pink": { x: 0.5, y: 0.25, color: "pink", label: "Pink" },
  "spot-blue": { x: 0.5, y: 0.5, color: "blue", label: "Blue" },
  "spot-brown": { x: 0.5, y: 0.7935, color: "brown", label: "Brown" },
  "spot-green": { x: 0.5 + D_OFFSET_X, y: 0.7935, color: "green", label: "Green" },
  "spot-yellow": { x: 0.5 - D_OFFSET_X, y: 0.7935, color: "yellow", label: "Yellow" },
};

const allSpots: SpotId[] = ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"];
const PINK_X = SPOT_COORDS["spot-pink"].x;
const PINK_Y = SPOT_COORDS["spot-pink"].y;

const lineY = (idPrefix: string, color: BallColor, x: number, startY: number, count: number, step = STEP_Y): NormalizedBallPlacement[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}-${index + 1}`,
    color,
    x,
    y: startY + index * step,
  }));

const lineX = (idPrefix: string, color: BallColor, y: number, startX: number, count: number, step = STEP_X): NormalizedBallPlacement[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `${idPrefix}-${index + 1}`,
    color,
    x: startX + index * step,
    y,
  }));

const layoutDefinitions: RoutineLayoutDefinition[] = [
  {
    routineId: "routine-bridge-grip-stance",
    displayName: "Stance and Balance Basics",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/stance_image.png"),
  },
  {
    routineId: "routine-pre-shot-routine",
    displayName: "Grip Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/grip_image.png"),
  },
  {
    routineId: "routine-bridge-fundamentals",
    displayName: "Bridge Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/bridge_image.png"),
  },
  {
    routineId: "routine-rest-shot-fundamentals",
    displayName: "Alignment and Sighting Basics",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/alignment.png"),
  },
  {
    routineId: "routine-potting-fundamentals",
    displayName: "Cueing Action and Potting Basics",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "fund-cue", color: "white", x: 0.36, y: 0.57 }],
    referenceImage: require("../../../assets/routines/fundamentals/cue_action.png"),
  },
  {
    routineId: "routine-head-position-fundamentals",
    displayName: "Head Position Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/head_postion.png"),
  },
  {
    routineId: "routine-cue-ball-control-fundamentals-guide",
    displayName: "Cue Ball Control Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "cbc-cue", color: "white", x: 0.5, y: 0.56 }],
    referenceImage: require("../../../assets/routines/fundamentals/cue_ball_control.png"),
  },
  {
    routineId: "routine-pre-shot-system-fundamentals",
    displayName: "Pre-Shot Routine Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/pre_shot.png"),
  },
  {
    routineId: "routine-straight-cueing-fundamentals-guide",
    displayName: "Straight Cueing Fundamentals",
    category: "fundamentals",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [],
    referenceImage: require("../../../assets/routines/fundamentals/straight_cueing.png"),
  },
  {
    routineId: "routine-line-up",
    displayName: "The Snooker Line Up",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: lineY("line-red", "red", 0.5, 0.11, 15),
    referenceImage: require("../../../assets/routines/the-line-up.png"),
    notes: "Single center line of 15 reds based on reference diagram.",
  },
  {
    routineId: "routine-t-routine",
    displayName: "The Snooker T Line Up",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      // Top horizontal bar around the pink (symmetrical, no red on pink spot).
      { id: "t-bar-left-4", color: "red" as const, x: PINK_X - STEP_X * 4, y: PINK_Y },
      { id: "t-bar-left-3", color: "red" as const, x: PINK_X - STEP_X * 3, y: PINK_Y },
      { id: "t-bar-left-2", color: "red" as const, x: PINK_X - STEP_X * 2, y: PINK_Y },
      { id: "t-bar-left-1", color: "red" as const, x: PINK_X - STEP_X * 1, y: PINK_Y },
      { id: "t-bar-right-1", color: "red" as const, x: PINK_X + STEP_X * 1, y: PINK_Y },
      { id: "t-bar-right-2", color: "red" as const, x: PINK_X + STEP_X * 2, y: PINK_Y },
      { id: "t-bar-right-3", color: "red" as const, x: PINK_X + STEP_X * 3, y: PINK_Y },
      { id: "t-bar-right-4", color: "red" as const, x: PINK_X + STEP_X * 4, y: PINK_Y },

      // Vertical stem below the bar, centered, constrained to pink-black channel.
      { id: "t-stem-1", color: "red" as const, x: PINK_X, y: 0.228 },
      { id: "t-stem-2", color: "red" as const, x: PINK_X, y: 0.206 },
      { id: "t-stem-3", color: "red" as const, x: PINK_X, y: 0.184 },
      { id: "t-stem-4", color: "red" as const, x: PINK_X, y: 0.162 },
      { id: "t-stem-5", color: "red" as const, x: PINK_X, y: 0.14 },
      { id: "t-stem-6", color: "red" as const, x: PINK_X, y: 0.118 },
      { id: "t-stem-7", color: "red" as const, x: PINK_X, y: 0.096 },
    ],
    referenceImage: require("../../../assets/routines/the-snooker-t-line-up.png"),
    notes: "T shape from reference: vertical stem plus left arm through pink lane.",
  },
  {
    routineId: "routine-around-colours",
    displayName: "Around The Colours",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: [{ id: "around-cue", color: "white", x: 0.46, y: 0.73 }],
    referenceImage: require("../../../assets/routines/mastering_the_coours.png"),
  },
  {
    routineId: "routine-3-reds-colours",
    displayName: "3 Reds + Colours",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: lineY("3r", "red", 0.5, 0.34, 3),
  },
  {
    routineId: "routine-break-building-foundations",
    displayName: "Break Building Foundations",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: lineY("bbf", "red", 0.5, 0.28, 7),
  },
  {
    routineId: "routine-pink-ball-routine",
    displayName: "Pink Ball Pattern",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-pink", "spot-blue", "spot-brown"],
    ballPlacements: [{ id: "pink-cue", color: "white", x: 0.54, y: 0.58 }],
  },
  {
    routineId: "routine-baulk-safety",
    displayName: "Snooker Safety Shots off Reds",
    category: "safety",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      ...lineX("safety-red", "red", 0.93, 0.1, 6),
      { id: "safety-cue", color: "white", x: 0.18, y: 0.19 },
    ],
    referenceImage: require("../../../assets/routines/Snooker-Safety-Shots-off-Reds-1.jpg"),
  },
  {
    routineId: "routine-escape-science",
    displayName: "Escape Science",
    category: "safety",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [{ id: "escape-cue", color: "white", x: 0.5, y: 0.78 }],
  },
  {
    routineId: "routine-two-cushion-escape",
    displayName: "Two Cushion Escape",
    category: "safety",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [{ id: "two-cushion-cue", color: "white", x: 0.2, y: 0.82 }],
  },
  {
    routineId: "routine-three-cushion-escape",
    displayName: "Three Cushion Escape",
    category: "safety",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [{ id: "three-cushion-cue", color: "white", x: 0.8, y: 0.82 }],
  },
  {
    routineId: "routine-straight-cueing-line",
    displayName: "Straight Potting Reds",
    category: "cueing",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: lineX("straight-red", "red", 0.62, 0.5 - 7 * STEP_X, 15),
    referenceImage: require("../../../assets/routines/straight-potting-reds-1-510x269.png"),
  },
  {
    routineId: "routine-long-blue-straight-cue",
    displayName: "Potting Long Blues",
    category: "long-potting",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "long-blue-cue", color: "white", x: 0.64, y: 0.62 }],
    referenceImage: require("../../../assets/routines/long-blues.png"),
  },
  {
    routineId: "routine-cueing-secret-session",
    displayName: "Loosen Your Snooker Arm",
    category: "cueing",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: lineX("loosen-red", "red", 0.62, 0.5 - 7 * STEP_X, 15),
    referenceImage: require("../../../assets/routines/loosen-your-snooker-arm.png"),
  },
  {
    routineId: "routine-cue-ball-control",
    displayName: "Cue Ball Control",
    category: "cue-ball-control",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "cue-control-cue", color: "white", x: 0.5, y: 0.56 }],
    referenceImage: require("../../../assets/routines/Cue-Ball-Control-1.jpg"),
  },
  {
    routineId: "routine-stun-run-through",
    displayName: "Stun Run Through",
    category: "cue-ball-control",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "stun-cue", color: "white", x: 0.5, y: 0.56 }],
  },
  {
    routineId: "routine-top-spin-control",
    displayName: "Top Spin Control",
    category: "spin",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "top-spin-cue", color: "white", x: 0.53, y: 0.58 }],
  },
  {
    routineId: "routine-side-spin-control",
    displayName: "Side Spin Control",
    category: "spin",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "side-spin-cue", color: "white", x: 0.57, y: 0.58 }],
  },
  {
    routineId: "routine-stun-line",
    displayName: "Stun Line",
    category: "spin",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "stun-line-cue", color: "white", x: 0.5, y: 0.6 }],
  },
  {
    routineId: "routine-screw-back",
    displayName: "Screw Back",
    category: "spin",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "screw-cue", color: "white", x: 0.5, y: 0.6 }],
  },
  {
    routineId: "routine-deep-screw",
    displayName: "Deep Screw",
    category: "spin",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [{ id: "deep-screw-cue", color: "white", x: 0.5, y: 0.64 }],
  },
  {
    routineId: "routine-long-potting-classic",
    displayName: "Potting Long Reds",
    category: "long-potting",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      { id: "long-red-a", color: "red", x: 0.42, y: 0.36 },
      { id: "long-red-b", color: "red", x: 0.58, y: 0.48 },
      { id: "long-red-cue", color: "white", x: 0.64, y: 0.64 },
    ],
    referenceImage: require("../../../assets/routines/door-openers-1.png"),
  },
  {
    routineId: "routine-black-off-spot",
    displayName: "Potting The Black Ball",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black"],
    ballPlacements: [
      ...lineX("black-angle-top", "white", 0.2, 0.24, 5),
      ...lineX("black-angle-bottom", "white", 0.33, 0.24, 5),
    ],
    referenceImage: require("../../../assets/routines/potting-the-black-ball.png"),
  },
  {
    routineId: "routine-blue-ball-control",
    displayName: "Potting Multiple Blue Balls",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      ...lineX("blue-red", "red", 0.5, 0.5 - 2.5 * STEP_X, 6),
      { id: "blue-cue", color: "white", x: 0.62, y: 0.58 },
    ],
    referenceImage: require("../../../assets/routines/Potting-Blue-Balls.jpg"),
  },
];

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
