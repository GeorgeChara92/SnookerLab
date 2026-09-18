export type ARPoint3D = {
  x: number;
  y: number;
  z: number;
};

export type BallColour = "white" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

export type CapturedBall = {
  id: string;
  colour: BallColour;
  xMm: number;
  yMm: number;
  radiusMm: 26.25;
  confidence: number;
};

export type ARTableSnapshot = {
  id: string;
  createdAt: string;
  tableDimensions: {
    widthMm: 1778;
    lengthMm: 3569;
  };
  cornersWorld: {
    baulkLeft: ARPoint3D;
    baulkRight: ARPoint3D;
    blackRight: ARPoint3D;
    blackLeft: ARPoint3D;
  };
  balls: CapturedBall[];
};

export const TABLE_WIDTH_MM = 1778;
export const TABLE_LENGTH_MM = 3569;
