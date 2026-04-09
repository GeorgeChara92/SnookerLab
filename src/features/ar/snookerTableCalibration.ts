import { SNOOKER_TABLE_GEOMETRY } from "./snookerTableGeometry";

export type GroundPoint = { x: number; y: number; z: number };

export type CameraPose = {
  positionX: number;
  positionY: number;
  positionZ: number;
  forwardX: number;
  forwardZ: number;
};

export type SnookerTableCalibration = {
  topCenter: GroundPoint;
  axis: GroundPoint;
  perpendicular: GroundPoint;
  tableLengthM: number;
  tableWidthM: number;
  tableY: number;
  scanQuality: number;
  referenceErrorM?: number;
};

export type AlignmentAdjustments = {
  offsetAlong: number;
  offsetAcross: number;
  rotationDeg: number;
  scaleFactor: number;
};

export type CalibrationQualityBand = "poor" | "usable" | "good" | "locked";

export const computeCalibrationFromBlackPink = (
  black: GroundPoint | null,
  pink: GroundPoint | null
): SnookerTableCalibration | null => {
  if (!black || !pink) return null;

  const vectorX = pink.x - black.x;
  const vectorZ = pink.z - black.z;
  const blackPinkDistance = Math.hypot(vectorX, vectorZ);
  if (blackPinkDistance < 0.2) return null;

  const axisX = vectorX / blackPinkDistance;
  const axisZ = vectorZ / blackPinkDistance;
  const perpendicularX = -axisZ;
  const perpendicularZ = axisX;

  const normDistance =
    SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm - SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm;

  const tableLengthM = blackPinkDistance / normDistance;
  const tableWidthM =
    tableLengthM * (SNOOKER_TABLE_GEOMETRY.playingWidthM / SNOOKER_TABLE_GEOMETRY.playingLengthM);
  const tableY = (black.y + pink.y) / 2;

  const topCenter = {
    x: black.x - axisX * (SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm * tableLengthM),
    y: tableY,
    z: black.z - axisZ * (SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm * tableLengthM),
  };

  const expectedBlackPink = SNOOKER_TABLE_GEOMETRY.playingLengthM * normDistance;
  const deviation = Math.abs(blackPinkDistance - expectedBlackPink) / expectedBlackPink;

  return {
    topCenter,
    axis: { x: axisX, y: 0, z: axisZ },
    perpendicular: { x: perpendicularX, y: 0, z: perpendicularZ },
    tableLengthM,
    tableWidthM,
    tableY,
    scanQuality: Math.max(0, Math.round((1 - deviation) * 100)),
  };
};

export const computeCalibrationFromBlackPinkBlue = (
  black: GroundPoint | null,
  pink: GroundPoint | null,
  blue: GroundPoint | null
): SnookerTableCalibration | null => {
  if (!black || !pink || !blue) return null;

  const vectorX = pink.x - black.x;
  const vectorZ = pink.z - black.z;
  const blackPinkDistance = Math.hypot(vectorX, vectorZ);
  if (blackPinkDistance < 0.2) return null;

  const axisX = vectorX / blackPinkDistance;
  const axisZ = vectorZ / blackPinkDistance;
  const perpendicularX = -axisZ;
  const perpendicularZ = axisX;

  const normDistanceBlackPink =
    SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm - SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm;
  const normDistanceBlackBlue =
    SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm - SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm;

  const vectorBlackBlueX = blue.x - black.x;
  const vectorBlackBlueZ = blue.z - black.z;
  const blackBlueDistance = Math.hypot(vectorBlackBlueX, vectorBlackBlueZ);
  if (blackBlueDistance < 0.2) return null;

  const tableLengthFromBP = blackPinkDistance / normDistanceBlackPink;
  const tableLengthFromBB = blackBlueDistance / normDistanceBlackBlue;
  const tableLengthM = (tableLengthFromBP * 0.6) + (tableLengthFromBB * 0.4);
  const tableWidthM =
    tableLengthM * (SNOOKER_TABLE_GEOMETRY.playingWidthM / SNOOKER_TABLE_GEOMETRY.playingLengthM);
  const tableY = (black.y + pink.y + blue.y) / 3;

  const topCenter = {
    x: black.x - axisX * (SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm * tableLengthM),
    y: tableY,
    z: black.z - axisZ * (SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm * tableLengthM),
  };

  const calibration: SnookerTableCalibration = {
    topCenter,
    axis: { x: axisX, y: 0, z: axisZ },
    perpendicular: { x: perpendicularX, y: 0, z: perpendicularZ },
    tableLengthM,
    tableWidthM,
    tableY,
    scanQuality: 100,
  };

  const expectedBlue = worldFromNorm(calibration, SNOOKER_TABLE_GEOMETRY.blueSpot.xNorm, SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm);
  const blueError = Math.hypot(expectedBlue.x - blue.x, expectedBlue.z - blue.z);

  const expectedBlackPink = SNOOKER_TABLE_GEOMETRY.playingLengthM * normDistanceBlackPink;
  const scaleDeviation = Math.abs(blackPinkDistance - expectedBlackPink) / expectedBlackPink;
  const quality = Math.max(0, Math.round(100 - scaleDeviation * 100 - Math.min(35, blueError * 1000)));

  return {
    ...calibration,
    scanQuality: quality,
    referenceErrorM: Number(blueError.toFixed(4)),
  };
};

export const buildVirtualCalibration = (
  pose: CameraPose | null,
  scale: number
): SnookerTableCalibration | null => {
  if (!pose) return null;

  const tableLengthM = SNOOKER_TABLE_GEOMETRY.playingLengthM * scale;
  const tableWidthM = SNOOKER_TABLE_GEOMETRY.playingWidthM * scale;
  const center = {
    x: pose.positionX + pose.forwardX * 1.4,
    y: Math.max(0.05, pose.positionY - 0.75),
    z: pose.positionZ + pose.forwardZ * 1.4,
  };

  return {
    topCenter: {
      x: center.x - pose.forwardX * (tableLengthM / 2),
      y: center.y,
      z: center.z - pose.forwardZ * (tableLengthM / 2),
    },
    axis: { x: pose.forwardX, y: 0, z: pose.forwardZ },
    perpendicular: { x: -pose.forwardZ, y: 0, z: pose.forwardX },
    tableLengthM,
    tableWidthM,
    tableY: center.y,
    scanQuality: 100,
  };
};

export const applyAlignmentAdjustments = (
  calibration: SnookerTableCalibration,
  adjustments: AlignmentAdjustments
): SnookerTableCalibration => {
  const radians = (adjustments.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  const axis = {
    x: calibration.axis.x * cos - calibration.axis.z * sin,
    y: 0,
    z: calibration.axis.x * sin + calibration.axis.z * cos,
  };

  const perpendicular = {
    x: calibration.perpendicular.x * cos - calibration.perpendicular.z * sin,
    y: 0,
    z: calibration.perpendicular.x * sin + calibration.perpendicular.z * cos,
  };

  return {
    ...calibration,
    axis,
    perpendicular,
    topCenter: {
      x:
        calibration.topCenter.x +
        axis.x * adjustments.offsetAlong +
        perpendicular.x * adjustments.offsetAcross,
      y: calibration.topCenter.y,
      z:
        calibration.topCenter.z +
        axis.z * adjustments.offsetAlong +
        perpendicular.z * adjustments.offsetAcross,
    },
    tableLengthM: calibration.tableLengthM * adjustments.scaleFactor,
    tableWidthM: calibration.tableWidthM * adjustments.scaleFactor,
  };
};

export const worldFromNorm = (
  calibration: SnookerTableCalibration,
  xNorm: number,
  yNorm: number
): GroundPoint => {
  const along = yNorm * calibration.tableLengthM;
  const across = (xNorm - 0.5) * calibration.tableWidthM;

  return {
    x: calibration.topCenter.x + calibration.axis.x * along + calibration.perpendicular.x * across,
    y: calibration.tableY,
    z: calibration.topCenter.z + calibration.axis.z * along + calibration.perpendicular.z * across,
  };
};

export const normFromWorld = (
  calibration: SnookerTableCalibration,
  point: GroundPoint
): { xNorm: number; yNorm: number } => {
  const dx = point.x - calibration.topCenter.x;
  const dz = point.z - calibration.topCenter.z;

  const axisMag = Math.hypot(calibration.axis.x, calibration.axis.z);
  const perpMag = Math.hypot(calibration.perpendicular.x, calibration.perpendicular.z);

  if (axisMag < 0.0001 || perpMag < 0.0001) return { xNorm: 0.5, yNorm: 0.5 };

  const along = (dx * calibration.axis.x + dz * calibration.axis.z) / axisMag;
  const across = (dx * calibration.perpendicular.x + dz * calibration.perpendicular.z) / perpMag;

  return {
    yNorm: along / calibration.tableLengthM,
    xNorm: across / calibration.tableWidthM + 0.5,
  };
};

export const getCalibrationQualityBand = (scanQuality: number): CalibrationQualityBand => {
  if (scanQuality >= 90) return "locked";
  if (scanQuality >= 75) return "good";
  if (scanQuality >= 58) return "usable";
  return "poor";
};

export const getCalibrationGuidance = (scanQuality: number): string => {
  const band = getCalibrationQualityBand(scanQuality);
  if (band === "locked") return "Locked. You can place markers precisely.";
  if (band === "good") return "Good lock. Minor manual tuning may improve fit.";
  if (band === "usable") return "Usable. Check table outline and tune before placing.";
  return "Poor lock. Re-scan black and pink with a flatter viewing angle.";
};
