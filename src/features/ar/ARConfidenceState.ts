import { getCalibrationQualityBand } from "./snookerTableCalibration";

export type ARTrackingState = "normal" | "limited" | "unavailable";

export type ARConfidenceState = "scanning" | "poor" | "usable" | "locked" | "drift";

export type ARConfidenceStatus = {
  state: ARConfidenceState;
  score: number;
  label: string;
  guidance: string;
  canPlacePrecisely: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export const buildARConfidenceStatus = (params: {
  trackingState: ARTrackingState;
  calibrationQuality: number | null;
  jitterMeters: number;
  hasCalibration: boolean;
}): ARConfidenceStatus => {
  const { trackingState, calibrationQuality, jitterMeters, hasCalibration } = params;

  if (!hasCalibration) {
    return {
      state: "scanning",
      score: 20,
      label: "Scanning",
      guidance: "Move slowly across the table surface to establish tracking.",
      canPlacePrecisely: false,
    };
  }

  const qualityBand = getCalibrationQualityBand(calibrationQuality ?? 0);
  const trackingPenalty = trackingState === "normal" ? 0 : trackingState === "limited" ? 18 : 35;
  const jitterPenalty = jitterMeters > 0.03 ? 25 : jitterMeters > 0.015 ? 12 : 0;
  const score = clamp((calibrationQuality ?? 0) - trackingPenalty - jitterPenalty, 0, 100);

  if (trackingState === "unavailable") {
    return {
      state: "drift",
      score,
      label: "Drift Detected",
      guidance: "Tracking lost. Re-lock on black and pink spots before placing.",
      canPlacePrecisely: false,
    };
  }

  if (trackingState === "limited" && score < 60) {
    return {
      state: "drift",
      score,
      label: "Unstable Tracking",
      guidance: "Hold the phone steady and point back at table references.",
      canPlacePrecisely: false,
    };
  }

  if (qualityBand === "poor" || score < 55) {
    return {
      state: "poor",
      score,
      label: "Low Confidence",
      guidance: "Re-scan references or tune alignment before placing markers.",
      canPlacePrecisely: false,
    };
  }

  if (qualityBand === "usable" || score < 80) {
    return {
      state: "usable",
      score,
      label: "Usable",
      guidance: "Placement is usable. Fine-tune alignment for match precision.",
      canPlacePrecisely: true,
    };
  }

  return {
    state: "locked",
    score,
    label: "Locked",
    guidance: "Precision lock established. You can place confidently.",
    canPlacePrecisely: true,
  };
};
