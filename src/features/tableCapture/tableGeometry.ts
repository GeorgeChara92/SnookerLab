import type { Point, TableCorners } from "./ballTypes";

export const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const bilinearPoint = (corners: TableCorners, u: number, v: number): Point => {
  const topX = lerp(corners.topLeft.x, corners.topRight.x, u);
  const topY = lerp(corners.topLeft.y, corners.topRight.y, u);
  const bottomX = lerp(corners.bottomLeft.x, corners.bottomRight.x, u);
  const bottomY = lerp(corners.bottomLeft.y, corners.bottomRight.y, u);
  return {
    x: lerp(topX, bottomX, v),
    y: lerp(topY, bottomY, v),
  };
};

export const normalizedToScreen = (corners: TableCorners, normalized: Point): Point => {
  return bilinearPoint(corners, clamp01(normalized.x), clamp01(normalized.y));
};

export const screenToNormalized = (corners: TableCorners, point: Point): Point => {
  // Iterative inversion of bilinear mapping.
  let u = 0.5;
  let v = 0.5;

  for (let i = 0; i < 10; i += 1) {
    const p = bilinearPoint(corners, u, v);
    const du = bilinearPoint(corners, clamp01(u + 0.001), v);
    const dv = bilinearPoint(corners, u, clamp01(v + 0.001));

    const j11 = (du.x - p.x) / 0.001;
    const j12 = (dv.x - p.x) / 0.001;
    const j21 = (du.y - p.y) / 0.001;
    const j22 = (dv.y - p.y) / 0.001;

    const ex = p.x - point.x;
    const ey = p.y - point.y;
    const det = j11 * j22 - j12 * j21;
    if (Math.abs(det) < 1e-8) break;

    const inv11 = j22 / det;
    const inv12 = -j12 / det;
    const inv21 = -j21 / det;
    const inv22 = j11 / det;

    const stepU = inv11 * ex + inv12 * ey;
    const stepV = inv21 * ex + inv22 * ey;

    u = clamp01(u - stepU);
    v = clamp01(v - stepV);
  }

  return { x: clamp01(u), y: clamp01(v) };
};

export const isPointInsideTable = (corners: TableCorners, point: Point): boolean => {
  const area = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const c1 = area(corners.topLeft, corners.topRight, point);
  const c2 = area(corners.topRight, corners.bottomRight, point);
  const c3 = area(corners.bottomRight, corners.bottomLeft, point);
  const c4 = area(corners.bottomLeft, corners.topLeft, point);
  const hasPos = c1 > 0 || c2 > 0 || c3 > 0 || c4 > 0;
  const hasNeg = c1 < 0 || c2 < 0 || c3 < 0 || c4 < 0;
  return !(hasPos && hasNeg);
};

export const createInitialCorners = (width: number, height: number): TableCorners => {
  const padX = Math.max(24, width * 0.1);
  const padY = Math.max(48, height * 0.18);
  return {
    topLeft: { x: padX, y: padY },
    topRight: { x: width - padX, y: padY },
    bottomRight: { x: width - padX, y: height - padY },
    bottomLeft: { x: padX, y: height - padY },
  };
};

// Placeholder for future native/OpenCV/ML auto-detection.
// This will later be replaced by frame processing and model inference.
export const detectTableAndBallsAutomatically = async () => {
  return {
    corners: null as TableCorners | null,
    balls: [],
  };
};
