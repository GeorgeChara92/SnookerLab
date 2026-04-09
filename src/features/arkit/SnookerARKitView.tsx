import React from "react";
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

export type ARMode = "live" | "virtual";

export type GroundPoint = { x: number; y: number; z: number };

export type CameraPose = {
  positionX: number;
  positionY: number;
  positionZ: number;
  forwardX: number;
  forwardZ: number;
};

export type ARKitCalibration = {
  topCenter: { x: number; y: number; z: number };
  axis: { x: number; y: number; z: number };
  perpendicular: { x: number; y: number; z: number };
  tableLengthM: number;
  tableWidthM: number;
  tableY: number;
  scanQuality: number;
};

export type ARKitMarker = {
  id: string;
  color: "white" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "red";
  x: number;
  y: number;
  z: number;
};

export type SnookerARKitViewProps = {
  style?: StyleProp<ViewStyle>;
  arMode: ARMode;
  showGrid: boolean;
  showReticle: boolean;
  showCalibrationMarkers: boolean;
  calibration: ARKitCalibration | null;
  crosshairPoint: GroundPoint | null;
  blackPoint: GroundPoint | null;
  pinkPoint: GroundPoint | null;
  bluePoint?: GroundPoint | null;
  positionedMarkers: ARKitMarker[];
  selectedMarkerId?: string | null;
  onCrosshairPoint?: (point: GroundPoint | null) => void;
  onCameraPose?: (pose: CameraPose) => void;
  onTrackingState?: (state: "normal" | "limited" | "unavailable") => void;
};

export const hasNativeARKitView = Platform.OS === "ios" ? false : false;
export const isNativeARKitViewAvailable = () => false;

export const SnookerARKitView: React.FC<SnookerARKitViewProps> = ({ style }) => {
  return <View style={[styles.fallback, style]} />;
};

const styles = StyleSheet.create({
  fallback: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#050A12",
  },
});
