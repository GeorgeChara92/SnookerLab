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

/** A calibration marker's corrected position, reported whenever ARKit refines its anchor. */
export type ARMarkerMoved = ARVec3 & { id: string };

/** The table for Record a Snooker's lap, in metres. Leave it out and no looking for balls runs. */
export type ARLapTable = {
  originX: number;
  originZ: number;
  angle: number;
  /** The height of a ball's centre. */
  ballHeight: number;
  scale: number;
  width: number;
  length: number;
};

/** The colour the camera saw, as it comes off the sensor. */
export type ARLapColour = { y: number; cb: number; cr: number };

/** Something ball-shaped and ball-sized on the cloth, seen from one place. */
export type ARLapSighting = ARLapColour & {
  origin: ARVec3;
  direction: ARVec3;
  /** Metres from the camera. */
  distance: number;
  /** Its size against what a ball should be from there: 1 is exactly right. */
  fit: number;
};

/** One look at the table during a lap. No `cloth` means too little of the table was in view. */
export type ARLapFrame = {
  camera: ARVec3;
  cloth?: ARLapColour;
  sightings: ARLapSighting[];
  /** How long the phone took to look at this frame. */
  ms: number;
  /** Frames passed over since the last one because the phone was turning too fast. */
  blurred?: number;
};

export type SnookerARViewProps = ViewProps & {
  balls?: ARBallProp[];
  lines?: ARLineProp[];
  paused?: boolean;
  lapTable?: ARLapTable | null;
  onTracking?: (event: { nativeEvent: ARTracking }) => void;
  onPlane?: (event: { nativeEvent: { count: number } }) => void;
  onAim?: (event: { nativeEvent: ARAim }) => void;
  onTapPoint?: (event: { nativeEvent: ARAim }) => void;
  /** A calibration marker ARKit has just corrected - see `SnookerARView.swift`'s `setBalls`. */
  onMarkerMoved?: (event: { nativeEvent: ARMarkerMoved }) => void;
  /** What the camera found on this look at the table, a few times a second while `lapTable` is set. */
  onLapFrame?: (event: { nativeEvent: ARLapFrame }) => void;
};

/** `supportsLap` is missing on a development build made before Record a Snooker. */
type NativeModule = { isSupported(): boolean; hasLiDAR(): boolean; supportsLap?(): boolean };

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

/** Whether Record a Snooker's lap can run: the camera view, in a build new enough to have it. */
export const lapAvailable = () => {
  if (!native || !SnookerARView) return false;
  try {
    return native.supportsLap?.() ?? false;
  } catch {
    return false;
  }
};
