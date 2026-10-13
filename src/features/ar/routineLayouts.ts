import type { Routine } from "../../types";
import { TABLE, type BallColour, type Point } from "../scanSnooker/table";
import type { PlacedBall } from "../scanSnooker/position";
import { SNOOKER_TABLE_GEOMETRY } from "./snookerTableGeometry";

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

export const SPOT_COORDS: Record<SpotId, { x: number; y: number; color: BallColor; label: string }> = {
  "spot-black": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm, color: "black", label: "Black" },
  "spot-pink": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm, color: "pink", label: "Pink" },
  "spot-blue": { x: 0.5, y: SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm, color: "blue", label: "Blue" },
  "spot-brown": { x: SNOOKER_TABLE_GEOMETRY.spots.brown.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.brown.yNorm, color: "brown", label: "Brown" },
  "spot-green": { x: SNOOKER_TABLE_GEOMETRY.spots.green.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.green.yNorm, color: "green", label: "Green" },
  "spot-yellow": { x: SNOOKER_TABLE_GEOMETRY.spots.yellow.xNorm, y: SNOOKER_TABLE_GEOMETRY.spots.yellow.yNorm, color: "yellow", label: "Yellow" },
};

const allSpots: SpotId[] = ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"];

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
    ballPlacements: [
      { id: "red-line-11", color: "red", x: 0.5, y: 0.02522 },
      { id: "red-line-12", color: "red", x: 0.5, y: 0.05744 },
      { id: "red-line-13", color: "red", x: 0.5, y: 0.11628 },
      { id: "red-line-14", color: "red", x: 0.5, y: 0.1457 },
      { id: "red-line-15", color: "red", x: 0.5, y: 0.17512 },
      { id: "red-line-16", color: "red", x: 0.5, y: 0.20454 },
      { id: "red-line-17", color: "red", x: 0.5, y: 0.27599 },
      { id: "red-line-18", color: "red", x: 0.5, y: 0.30541 },
      { id: "red-line-19", color: "red", x: 0.5, y: 0.33483 },
      { id: "red-line-20", color: "red", x: 0.5, y: 0.36425 },
      { id: "red-line-21", color: "red", x: 0.5, y: 0.39367 },
      { id: "red-line-22", color: "red", x: 0.5, y: 0.42309 },
      { id: "red-line-23", color: "red", x: 0.5, y: 0.45251 },
      { id: "red-line-27", color: "red", x: 0.5, y: 0.52115 },
      { id: "red-line-28", color: "red", x: 0.5, y: 0.55057 },
      { id: "cue-29", color: "white", x: 0.61305, y: 0.13589 },
      { id: "black-543", color: "black", x: 0.5, y: 0.09078 },
      { id: "pink-544", color: "pink", x: 0.5, y: 0.25 },
      { id: "blue-545", color: "blue", x: 0.5, y: 0.5 },
      { id: "yellow-546", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "brown-547", color: "brown", x: 0.5, y: 0.7935 },
      { id: "green-548", color: "green", x: 0.33577, y: 0.7935 },
    ],
    referenceImage: require("../../../assets/routines/the-line-up.png"),
    notes: "Hand-placed in the routine builder tool.",
  },
  {
    routineId: "routine-t-routine",
    displayName: "The Snooker T Line Up",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      { id: "red-line-35", color: "red", x: 0.5, y: 0.22695 },
      { id: "red-line-36", color: "red", x: 0.5, y: 0.19753 },
      { id: "red-line-37", color: "red", x: 0.5, y: 0.16811 },
      { id: "red-line-38", color: "red", x: 0.5, y: 0.13869 },
      { id: "red-line-39", color: "red", x: 0.5, y: 0.10927 },
      { id: "red-line-40", color: "red", x: 0.77615, y: 0.25 },
      { id: "red-line-41", color: "red", x: 0.7171, y: 0.25 },
      { id: "red-line-42", color: "red", x: 0.65804, y: 0.25 },
      { id: "red-line-43", color: "red", x: 0.59899, y: 0.25 },
      { id: "red-line-44", color: "red", x: 0.53993, y: 0.25 },
      { id: "red-line-45", color: "red", x: 0.44151, y: 0.25 },
      { id: "red-line-46", color: "red", x: 0.38245, y: 0.25 },
      { id: "red-line-47", color: "red", x: 0.3234, y: 0.25 },
      { id: "red-line-48", color: "red", x: 0.26434, y: 0.25 },
      { id: "red-line-49", color: "red", x: 0.20529, y: 0.25 },
      { id: "cue-51", color: "white", x: 0.53993, y: 0.2998 },
      { id: "pink-52", color: "pink", x: 0.5, y: 0.25 },
      { id: "black-53", color: "black", x: 0.5, y: 0.09078 },
      { id: "blue-54", color: "blue", x: 0.5, y: 0.5 },
      { id: "green-55", color: "green", x: 0.33577, y: 0.7935 },
      { id: "brown-56", color: "brown", x: 0.5, y: 0.7935 },
      { id: "yellow-57", color: "yellow", x: 0.66423, y: 0.7935 },
    ],
    referenceImage: require("../../../assets/routines/the-snooker-t-line-up.png"),
    notes: "Hand-placed in the routine builder tool.",
  },
  {
    routineId: "routine-around-colours",
    displayName: "Around The Colours",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: [
      { id: "around-cue", color: "white", x: 0.46, y: 0.73 },
      { id: "yellow-58", color: "yellow", x: 0.66648, y: 0.7935 },
      { id: "green-59", color: "green", x: 0.33577, y: 0.7935 },
      { id: "brown-61", color: "brown", x: 0.5, y: 0.7935 },
      { id: "blue-62", color: "blue", x: 0.5, y: 0.5 },
      { id: "pink-63", color: "pink", x: 0.5, y: 0.25 },
      { id: "black-64", color: "black", x: 0.49213, y: 0.09078 },
    ],
    referenceImage: require("../../../assets/routines/around-the-colours.png"),
  },
  {
    routineId: "routine-3-reds-colours",
    displayName: "3 Reds + Colours",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: [
      { id: "black-65", color: "black", x: 0.5, y: 0.09078 },
      { id: "yellow-66", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "brown-67", color: "brown", x: 0.5, y: 0.7935 },
      { id: "green-69", color: "green", x: 0.33577, y: 0.7935 },
      { id: "blue-70", color: "blue", x: 0.5, y: 0.5 },
      { id: "pink-71", color: "pink", x: 0.49775, y: 0.25 },
      { id: "red-line-73", color: "red", x: 0.5, y: 0.12048 },
      { id: "red-line-74", color: "red", x: 0.5, y: 0.1499 },
      { id: "red-line-75", color: "red", x: 0.5, y: 0.17932 },
    ],
    referenceImage: require("../../../assets/routines/3-reds-colours.png"),
  },
  {
    routineId: "routine-break-building-foundations",
    displayName: "Break Building Foundations",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: allSpots,
    ballPlacements: [
      { id: "black-76", color: "black", x: 0.5, y: 0.08826 },
      { id: "pink-77", color: "pink", x: 0.5, y: 0.25217 },
      { id: "blue-78", color: "blue", x: 0.5, y: 0.5 },
      { id: "green-79", color: "green", x: 0.34027, y: 0.7935 },
      { id: "brown-80", color: "brown", x: 0.5, y: 0.7935 },
      { id: "yellow-81", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "red-82", color: "red", x: 0.61305, y: 0.10787 },
      { id: "red-83", color: "red", x: 0.73397, y: 0.1513 },
      { id: "red-84", color: "red", x: 0.54837, y: 0.22415 },
      { id: "red-85", color: "red", x: 0.66423, y: 0.2886 },
      { id: "red-86", color: "red", x: 0.58211, y: 0.2886 },
      { id: "red-87", color: "red", x: 0.37402, y: 0.2886 },
      { id: "red-88", color: "red", x: 0.68054, y: 0.41748 },
      { id: "red-89", color: "red", x: 0.21372, y: 0.45111 },
      { id: "red-90", color: "red", x: 0.21372, y: 0.23396 },
      { id: "red-91", color: "red", x: 0.31496, y: 0.12749 },
    ],
    referenceImage: require("../../../assets/routines/break-building-foundations.png"),
  },
  {
    routineId: "routine-pink-ball-routine",
    displayName: "Pink Ball Pattern",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-pink", "spot-blue", "spot-brown"],
    ballPlacements: [
      { id: "black-93", color: "black", x: 0.5, y: 0.09078 },
      { id: "pink-94", color: "pink", x: 0.5, y: 0.24797 },
      { id: "blue-95", color: "blue", x: 0.5, y: 0.5 },
      { id: "yellow-96", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "brown-97", color: "brown", x: 0.5, y: 0.7935 },
      { id: "green-98", color: "green", x: 0.33577, y: 0.7935 },
      { id: "red-99", color: "red", x: 0.66423, y: 0.29 },
      { id: "red-100", color: "red", x: 0.33577, y: 0.29 },
      { id: "cue-line-110", color: "white", x: 0.46963, y: 0.38386 },
    ],
    referenceImage: require("../../../assets/routines/pink-ball-pattern.png"),
  },
  {
    routineId: "routine-baulk-safety",
    displayName: "Snooker Safety Shots off Reds",
    category: "safety",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black", "spot-pink", "spot-blue", "spot-brown", "spot-green", "spot-yellow"],
    ballPlacements: [
      { id: "red-line-211", color: "red", x: 0.08718, y: 0.25 },
      { id: "red-line-212", color: "red", x: 0.08718, y: 0.22058 },
      { id: "red-line-213", color: "red", x: 0.08718, y: 0.19116 },
      { id: "red-line-214", color: "red", x: 0.08718, y: 0.16174 },
      { id: "red-215", color: "red", x: 0.08718, y: 0.28159 },
      { id: "black-217", color: "black", x: 0.5, y: 0.08966 },
      { id: "pink-218", color: "pink", x: 0.5, y: 0.25 },
      { id: "blue-219", color: "blue", x: 0.5, y: 0.5 },
      { id: "yellow-220", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "brown-221", color: "brown", x: 0.5, y: 0.7935 },
      { id: "green-222", color: "green", x: 0.34027, y: 0.7935 },
      { id: "cue-223", color: "white", x: 0.5, y: 0.11768 },
    ],
    referenceImage: require("../../../assets/routines/snooker-safety-shots-off-reds.png"),
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
    ballPlacements: [
      { id: "red-line-392", color: "red", x: 0.07593, y: 0.62 },
      { id: "red-line-393", color: "red", x: 0.1378, y: 0.62 },
      { id: "red-line-394", color: "red", x: 0.19966, y: 0.62 },
      { id: "red-line-395", color: "red", x: 0.26153, y: 0.62 },
      { id: "red-line-396", color: "red", x: 0.3234, y: 0.62 },
      { id: "red-line-397", color: "red", x: 0.38526, y: 0.62 },
      { id: "red-line-398", color: "red", x: 0.44713, y: 0.62 },
      { id: "red-line-399", color: "red", x: 0.509, y: 0.62 },
      { id: "red-line-400", color: "red", x: 0.57087, y: 0.62 },
      { id: "red-line-401", color: "red", x: 0.63273, y: 0.62 },
      { id: "red-line-402", color: "red", x: 0.6946, y: 0.62 },
      { id: "red-line-403", color: "red", x: 0.75647, y: 0.62 },
      { id: "red-line-404", color: "red", x: 0.81834, y: 0.62 },
      { id: "red-line-405", color: "red", x: 0.8802, y: 0.62 },
      { id: "red-line-406", color: "red", x: 0.94207, y: 0.62 },
    ],
    referenceImage: require("../../../assets/routines/straight-potting-reds.png"),
  },
  {
    routineId: "routine-long-blue-straight-cue",
    displayName: "Potting Long Blues",
    category: "long-potting",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [
      { id: "blue-534", color: "blue", x: 0.5, y: 0.5 },
      { id: "cue-line-540", color: "white", x: 0.31435, y: 0.65035 },
    ],
    referenceImage: require("../../../assets/routines/potting-long-blues.png"),
  },
  {
    routineId: "routine-cueing-secret-session",
    displayName: "Loosen Your Snooker Arm",
    category: "cueing",
    anchorSystem: "black_pink",
    spotMarkers: [],
    ballPlacements: [
      { id: "red-line-501", color: "red", x: 0.5, y: 0.05324 },
      { id: "red-line-502", color: "red", x: 0.5, y: 0.09737 },
      { id: "red-line-503", color: "red", x: 0.5, y: 0.1415 },
      { id: "red-line-504", color: "red", x: 0.5, y: 0.18563 },
      { id: "red-line-505", color: "red", x: 0.5, y: 0.22976 },
      { id: "red-line-506", color: "red", x: 0.5, y: 0.27389 },
      { id: "red-line-507", color: "red", x: 0.5, y: 0.31802 },
      { id: "red-line-508", color: "red", x: 0.5, y: 0.36215 },
      { id: "red-line-509", color: "red", x: 0.5, y: 0.40628 },
      { id: "red-line-510", color: "red", x: 0.5, y: 0.45041 },
      { id: "red-line-511", color: "red", x: 0.5, y: 0.49454 },
      { id: "red-line-512", color: "red", x: 0.5, y: 0.53867 },
      { id: "red-line-513", color: "red", x: 0.5, y: 0.5828 },
      { id: "red-line-514", color: "red", x: 0.5, y: 0.62693 },
      { id: "red-line-515", color: "red", x: 0.5, y: 0.67106 },
    ],
    referenceImage: require("../../../assets/routines/loosen-your-snooker-arm.png"),
  },
  {
    routineId: "routine-cue-ball-control",
    displayName: "Cue Ball Control",
    category: "cue-ball-control",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-blue"],
    ballPlacements: [
      { id: "cue-518", color: "white", x: 0.26153, y: 0.5 },
      { id: "blue-523", color: "blue", x: 0.5, y: 0.42449 },
      { id: "black-524", color: "black", x: 0.90551, y: 0.42449 },
      { id: "pink-525", color: "pink", x: 0.75647, y: 0.42449 },
      { id: "brown-526", color: "brown", x: 0.61024, y: 0.42449 },
      { id: "green-530", color: "green", x: 0.31777, y: 0.42449 },
      { id: "red-532", color: "red", x: 0.5, y: 0.5 },
      { id: "yellow-533", color: "yellow", x: 0.1153, y: 0.42449 },
    ],
    referenceImage: require("../../../assets/routines/cue-ball-control.png"),
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
    // Measured directly from this routine's own reference image (same blob + pocket-calibration
    // technique as Potting The Black Ball) rather than left as the earlier guessed positions,
    // which put both reds and the cue on the wrong side of pink entirely (confirmed by the user,
    // 2026-10-01).
    ballPlacements: [
      { id: "long-red-on-line", color: "red", x: 0.62429, y: 0.32724 },
      { id: "long-red-off-line", color: "red", x: 0.36037, y: 0.32724 },
      { id: "long-red-cue", color: "white", x: 0.31437, y: 0.65077 },
    ],
    referenceImage: require("../../../assets/routines/door-openers-1.png"),
  },
  {
    routineId: "routine-black-off-spot",
    displayName: "Potting The Black Ball",
    category: "break-building",
    anchorSystem: "black_pink",
    spotMarkers: ["spot-black"],
    // Two diagonal fans of 5 rehearsal positions radiating away from the black spot at two
    // different angles - measured directly from this routine's own reference image (ball-blob
    // pixel positions converted to normalized table coordinates via the image's own pocket
    // corners as calibration landmarks), replacing two straight rows that only looked right in
    // the old portrait rendering and read as two odd vertical stacks once the diagram went
    // landscape (confirmed by the user, 2026-10-01).
    ballPlacements: [
      { id: "black-angle-a-1", color: "white", x: 0.62187, y: 0.17845 },
      { id: "black-angle-a-2", color: "white", x: 0.63721, y: 0.15522 },
      { id: "black-angle-a-3", color: "white", x: 0.65133, y: 0.1322 },
      { id: "black-angle-a-4", color: "white", x: 0.66303, y: 0.10938 },
      { id: "black-angle-a-5", color: "white", x: 0.67433, y: 0.08655 },
      { id: "black-angle-b-1", color: "white", x: 0.36844, y: 0.17763 },
      { id: "black-angle-b-2", color: "white", x: 0.35432, y: 0.15461 },
      { id: "black-angle-b-3", color: "white", x: 0.34019, y: 0.13158 },
      { id: "black-angle-b-4", color: "white", x: 0.32607, y: 0.10896 },
      { id: "black-angle-b-5", color: "white", x: 0.31033, y: 0.08655 },
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
      { id: "black-194", color: "black", x: 0.50337, y: 0.09078 },
      { id: "pink-195", color: "pink", x: 0.50337, y: 0.25 },
      { id: "blue-196", color: "blue", x: 0.50337, y: 0.5 },
      { id: "green-198", color: "green", x: 0.33577, y: 0.7935 },
      { id: "yellow-199", color: "yellow", x: 0.66423, y: 0.7935 },
      { id: "red-line-201", color: "red", x: 0.50337, y: 0.47212 },
      { id: "red-line-202", color: "red", x: 0.50337, y: 0.4427 },
      { id: "red-line-203", color: "red", x: 0.50337, y: 0.41328 },
      { id: "red-line-204", color: "red", x: 0.50337, y: 0.52956 },
      { id: "red-line-205", color: "red", x: 0.50337, y: 0.55898 },
      { id: "red-line-206", color: "red", x: 0.50337, y: 0.5884 },
      { id: "brown-208", color: "brown", x: 0.50337, y: 0.7935 },
    ],
    referenceImage: require("../../../assets/routines/potting-multiple-blue-balls.png"),
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
