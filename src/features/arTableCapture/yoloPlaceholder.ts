import type { BallColour } from "./types";

export type DetectedBall = {
  colour: BallColour;
  centerX: number;
  centerY: number;
  confidence: number;
};

// Future integration point:
// - Run YOLO/TFLite on camera frame
// - Get bbox center in image space
// - Raycast center onto calibrated AR table plane
// - Convert resulting world point to xMm/yMm via worldToTableMm
export const detectBallsFromFrame = async (_frame: unknown): Promise<DetectedBall[]> => {
  return [];
};
