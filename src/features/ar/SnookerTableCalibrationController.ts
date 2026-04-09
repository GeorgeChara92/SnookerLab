import { useMemo, useRef, useState } from "react";
import type { ARTrackingState } from "./ARConfidenceState";
import { buildARConfidenceStatus } from "./ARConfidenceState";
import {
  applyAlignmentAdjustments,
  buildVirtualCalibration,
  computeCalibrationFromBlackPinkBlue,
  getCalibrationGuidance,
  getCalibrationQualityBand,
  type AlignmentAdjustments,
  type CameraPose,
  type GroundPoint,
  type SnookerTableCalibration,
  worldFromNorm,
} from "./snookerTableCalibration";
import { SNOOKER_TABLE_GEOMETRY } from "./snookerTableGeometry";

export type CalibrationStep = "scan_plane" | "align_black" | "align_pink" | "align_blue" | "confirm" | "ready";
export type ReticleState = "searching" | "close" | "alignable" | "locked" | "low_confidence";

const JITTER_WINDOW = 12;

const averagePoint = (points: GroundPoint[]): GroundPoint => {
  const totals = points.reduce(
    (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y, z: acc.z + point.z }),
    { x: 0, y: 0, z: 0 }
  );
  return {
    x: totals.x / points.length,
    y: totals.y / points.length,
    z: totals.z / points.length,
  };
};

const jitterOf = (points: GroundPoint[]) => {
  if (points.length < 3) return 0;
  const avg = averagePoint(points);
  const total = points.reduce((sum, point) => {
    return sum + Math.hypot(point.x - avg.x, point.y - avg.y, point.z - avg.z);
  }, 0);
  return total / points.length;
};

export const useSnookerTableCalibrationController = () => {
  const [step, setStep] = useState<CalibrationStep>("scan_plane");
  const [crosshairPoint, setCrosshairPointState] = useState<GroundPoint | null>(null);
  const [cameraPose, setCameraPose] = useState<CameraPose | null>(null);
  const [trackingState, setTrackingState] = useState<ARTrackingState>("limited");
  const [blackPoint, setBlackPoint] = useState<GroundPoint | null>(null);
  const [pinkPoint, setPinkPoint] = useState<GroundPoint | null>(null);
  const [bluePoint, setBluePoint] = useState<GroundPoint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adjustments, setAdjustments] = useState<AlignmentAdjustments>({
    offsetAlong: 0,
    offsetAcross: 0,
    rotationDeg: 0,
    scaleFactor: 1,
  });

  const pointWindowRef = useRef<GroundPoint[]>([]);

  const setCrosshairPoint = (point: GroundPoint | null) => {
    setCrosshairPointState(point);
    if (!point) {
      pointWindowRef.current = [];
      return;
    }
    pointWindowRef.current = [...pointWindowRef.current.slice(-(JITTER_WINDOW - 1)), point];
    if (step === "scan_plane") {
      setStep("align_black");
    }
  };

  const rawCalibration = useMemo(
    () => (blackPoint && pinkPoint && bluePoint ? computeCalibrationFromBlackPinkBlue(blackPoint, pinkPoint, bluePoint) : null),
    [blackPoint, pinkPoint, bluePoint]
  );

  const calibration = useMemo(() => {
    if (!rawCalibration) return null;
    return applyAlignmentAdjustments(rawCalibration, adjustments);
  }, [rawCalibration, adjustments]);

  const jitterMeters = jitterOf(pointWindowRef.current);

  const confidence = useMemo(
    () =>
      buildARConfidenceStatus({
        trackingState,
        calibrationQuality: rawCalibration?.scanQuality ?? null,
        jitterMeters,
        hasCalibration: Boolean(rawCalibration),
      }),
    [trackingState, rawCalibration, jitterMeters]
  );

  const calibrationBand = getCalibrationQualityBand(rawCalibration?.scanQuality ?? 0);
  const calibrationHint = getCalibrationGuidance(rawCalibration?.scanQuality ?? 0);

  const reticleState: ReticleState = useMemo(() => {
    if (!crosshairPoint) return "searching";
    if (trackingState === "unavailable") return "low_confidence";
    if (trackingState === "limited" && jitterMeters > 0.02) return "low_confidence";
    if (jitterMeters < 0.005) return "locked";
    if (jitterMeters < 0.015) return "alignable";
    return "close";
  }, [crosshairPoint, trackingState, jitterMeters]);

  const reticleHint = useMemo(() => {
    if (!crosshairPoint) return "Move over table cloth to detect placement plane";
    if (reticleState === "low_confidence") return "Tracking is unstable. Hold steady and re-center.";
    if (step === "align_black") return reticleState === "locked" ? "Black spot locked" : "Aim at black spot";
    if (step === "align_pink") return reticleState === "locked" ? "Pink spot locked" : "Aim at pink spot";
    if (step === "align_blue") return reticleState === "locked" ? "Blue spot locked" : "Aim at blue spot";
    if (step === "confirm") return "Review table outline and fine-tune before confirming";
    if (step === "ready") return "Calibration locked";
    return "Move slowly across the table";
  }, [crosshairPoint, reticleState, step]);

  const captureReference = () => {
    if (!crosshairPoint) {
      setError("No valid table point detected yet.");
      return;
    }
    if (step === "align_black") {
      setBlackPoint(crosshairPoint);
      setStep("align_pink");
      setError(null);
      return;
    }
    if (step === "align_pink") {
      setPinkPoint(crosshairPoint);
      setStep("align_blue");
      setError(null);
      return;
    }
    if (step === "align_blue") {
      const solved = blackPoint && pinkPoint ? computeCalibrationFromBlackPinkBlue(blackPoint, pinkPoint, crosshairPoint) : null;
      if (!solved) {
        setError("Calibration failed. Re-capture black, pink, and blue with a stable reticle lock.");
        return;
      }
      setBluePoint(crosshairPoint);
      setStep("confirm");
      setError(null);
      return;
    }
  };

  const confirmCalibration = () => {
    if (!calibration) {
      setError("Calibration is incomplete.");
      return;
    }
    if (confidence.state === "poor" || confidence.state === "drift") {
      setError("Calibration confidence is low. Re-lock references before entering placement mode.");
      return;
    }
    setStep("ready");
    setError(null);
  };

  const relockFromDrift = () => {
    setStep("confirm");
    setError("Tracking drift detected. Confirm alignment again before placing.");
  };

  const resetCalibration = () => {
    setStep("scan_plane");
    setCrosshairPointState(null);
    setBlackPoint(null);
    setPinkPoint(null);
    setBluePoint(null);
    setError(null);
    pointWindowRef.current = [];
    setAdjustments({ offsetAlong: 0, offsetAcross: 0, rotationDeg: 0, scaleFactor: 1 });
  };

  const startDevPreview = () => {
    const preview = buildVirtualCalibration(cameraPose, 1);
    if (!preview) {
      setError("Move the camera first, then tap Dev Preview.");
      return { ok: false } as const;
    }

    const black = worldFromNorm(preview, SNOOKER_TABLE_GEOMETRY.blackSpot.xNorm, SNOOKER_TABLE_GEOMETRY.blackSpot.yNorm);
    const pink = worldFromNorm(preview, SNOOKER_TABLE_GEOMETRY.pinkSpot.xNorm, SNOOKER_TABLE_GEOMETRY.pinkSpot.yNorm);
    const blue = worldFromNorm(preview, SNOOKER_TABLE_GEOMETRY.blueSpot.xNorm, SNOOKER_TABLE_GEOMETRY.blueSpot.yNorm);

    setBlackPoint(black);
    setPinkPoint(pink);
    setBluePoint(blue);
    setAdjustments({ offsetAlong: 0, offsetAcross: 0, rotationDeg: 0, scaleFactor: 1 });
    setStep("ready");
    setError(null);
    pointWindowRef.current = [];

    return { ok: true } as const;
  };

  return {
    step,
    crosshairPoint,
    cameraPose,
    trackingState,
    blackPoint,
    pinkPoint,
    bluePoint,
    rawCalibration,
    calibration,
    adjustments,
    jitterMeters,
    confidence,
    calibrationBand,
    calibrationHint,
    reticleState,
    reticleHint,
    error,
    setCrosshairPoint,
    setCameraPose,
    setTrackingState,
    setAdjustments,
    captureReference,
    confirmCalibration,
    relockFromDrift,
    resetCalibration,
    startDevPreview,
    setStep,
    setError,
  };
};
