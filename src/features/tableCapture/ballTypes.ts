export type Point = {
  x: number;
  y: number;
};

export type BallColour = "white" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

export type CapturedBall = {
  id: string;
  colour: BallColour;
  x: number;
  y: number;
  confidence: number;
};

export type TableCorners = {
  topLeft: Point;
  topRight: Point;
  bottomRight: Point;
  bottomLeft: Point;
};

export type TableSnapshot = {
  id: string;
  createdAt: string;
  corners: TableCorners;
  balls: CapturedBall[];
};

export const BALL_COLOURS: BallColour[] = ["white", "red", "yellow", "green", "brown", "blue", "pink", "black"];

export const BALL_COLOUR_HEX: Record<BallColour, string> = {
  white: "#F8FAFC",
  red: "#C53030",
  yellow: "#F6E05E",
  green: "#2F855A",
  brown: "#8B5E3C",
  blue: "#2B6CB0",
  pink: "#D53F8C",
  black: "#111827",
};
