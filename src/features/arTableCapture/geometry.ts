import { TABLE_LENGTH_MM, TABLE_WIDTH_MM, type ARPoint3D } from "./types";

type Vec3 = ARPoint3D;

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const add = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const scale = (v: Vec3, k: number): Vec3 => ({ x: v.x * k, y: v.y * k, z: v.z * k });
const dot = (a: Vec3, b: Vec3) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (v: Vec3) => Math.sqrt(dot(v, v));
const normalize = (v: Vec3): Vec3 => {
  const l = len(v);
  if (l < 1e-8) return { x: 0, y: 0, z: 0 };
  return scale(v, 1 / l);
};

export type TableFrame = {
  origin: Vec3;
  xAxis: Vec3;
  yAxis: Vec3;
  widthM: number;
  lengthM: number;
};

export const buildTableFrame = (corners: {
  baulkLeft: Vec3;
  baulkRight: Vec3;
  blackRight: Vec3;
  blackLeft: Vec3;
}): TableFrame => {
  const origin = corners.baulkLeft;
  const right = normalize(sub(corners.baulkRight, corners.baulkLeft));
  const leftRail = normalize(sub(corners.blackLeft, corners.baulkLeft));
  const rightRail = normalize(sub(corners.blackRight, corners.baulkRight));
  const yAxis = normalize(add(leftRail, rightRail));

  const widthM = (len(sub(corners.baulkRight, corners.baulkLeft)) + len(sub(corners.blackRight, corners.blackLeft))) / 2;
  const lengthM = (len(sub(corners.blackLeft, corners.baulkLeft)) + len(sub(corners.blackRight, corners.baulkRight))) / 2;

  return { origin, xAxis: right, yAxis, widthM, lengthM };
};

export const worldToTableMm = (frame: TableFrame, point: Vec3) => {
  const rel = sub(point, frame.origin);
  const xM = dot(rel, frame.xAxis);
  const yM = dot(rel, frame.yAxis);
  const xMm = Math.max(0, Math.min(TABLE_WIDTH_MM, Math.round((xM / frame.widthM) * TABLE_WIDTH_MM)));
  const yMm = Math.max(0, Math.min(TABLE_LENGTH_MM, Math.round((yM / frame.lengthM) * TABLE_LENGTH_MM)));
  return { xMm, yMm };
};

export const tableMmToWorld = (frame: TableFrame, xMm: number, yMm: number): Vec3 => {
  const xM = (Math.max(0, Math.min(TABLE_WIDTH_MM, xMm)) / TABLE_WIDTH_MM) * frame.widthM;
  const yM = (Math.max(0, Math.min(TABLE_LENGTH_MM, yMm)) / TABLE_LENGTH_MM) * frame.lengthM;
  return add(frame.origin, add(scale(frame.xAxis, xM), scale(frame.yAxis, yM)));
};

export const validateCornerShape = (frame: TableFrame) => {
  const ratio = frame.widthM > 0 ? frame.lengthM / frame.widthM : 0;
  const targetRatio = TABLE_LENGTH_MM / TABLE_WIDTH_MM;
  const ratioError = Math.abs(ratio - targetRatio) / targetRatio;
  const isReasonable = frame.widthM > 0.5 && frame.lengthM > 1.5 && ratioError < 0.2;
  return {
    isReasonable,
    ratio,
    ratioError,
    warning: isReasonable ? null : "Table shape looks unrealistic. Re-mark corners and keep all inner cushions visible.",
  };
};
