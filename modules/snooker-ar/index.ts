import type React from "react";
import type { ViewProps } from "react-native";
import { requireNativeView, requireOptionalNativeModule } from "expo";

/**
 * The camera view for Scan Snooker (iOS, ARKit). On Android, on phones without ARKit, and on a
 * development build made before this module existed, `SnookerARView` is null and `arSupport`
 * reports it, so the app falls back to the diagram rather than crashing.
 */

export type ARVec3 = { x: number; y: number; z: number };

/** Where the camera is pointing: a ray, and where it meets the cloth if it does. */
export type ARAim = {
  ok: boolean;
  screenX: number;
  screenY: number;
  origin?: ARVec3;
  direction?: ARVec3;
  hit?: ARVec3;
};

export type ARTracking = {
  state: "normal" | "limited" | "unavailable" | "unsupported" | "failed";
  reason: string;
};

/** "ghost" and "tag" are placed at a ball's centre; "marker" on the cloth. */
export type ARBallProp = {
  id: string;
  colour: string;
  x: number;
  y: number;
  z: number;
  kind: "ghost" | "tag" | "marker";
  highlighted?: boolean;
};

export type ARLineProp = { points: ARVec3[]; colour: string };

export type SnookerARViewProps = ViewProps & {
  balls?: ARBallProp[];
  lines?: ARLineProp[];
  paused?: boolean;
  onTracking?: (event: { nativeEvent: ARTracking }) => void;
  onPlane?: (event: { nativeEvent: { count: number } }) => void;
  onAim?: (event: { nativeEvent: ARAim }) => void;
  onTapPoint?: (event: { nativeEvent: ARAim }) => void;
};

type NativeModule = { isSupported(): boolean; hasLiDAR(): boolean };

const native = requireOptionalNativeModule<NativeModule>("SnookerAR");

export const SnookerARView: React.ComponentType<SnookerARViewProps> | null = native
  ? requireNativeView<SnookerARViewProps>("SnookerAR")
  : null;

/** Whether the camera view can run here, and whether it has LiDAR for the most precise placing. */
export const arSupport = (): { available: boolean; lidar: boolean } => {
  if (!native || !SnookerARView) return { available: false, lidar: false };
  try {
    return { available: native.isSupported(), lidar: native.hasLiDAR() };
  } catch {
    return { available: false, lidar: false };
  }
};
