import React from "react";
import {
  Platform,
  UIManager,
  View,
  requireNativeComponent,
  type NativeSyntheticEvent,
  type StyleProp,
  type ViewStyle,
} from "react-native";

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

type PointEvent = NativeSyntheticEvent<GroundPoint | null>;
type PoseEvent = NativeSyntheticEvent<CameraPose>;
type TrackingEvent = NativeSyntheticEvent<{ state: "normal" | "limited" | "unavailable" }>;

type NativeProps = {
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
  onCrosshairPointChange?: (event: PointEvent) => void;
  onCameraPoseChange?: (event: PoseEvent) => void;
  onTrackingStateChange?: (event: TrackingEvent) => void;
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

const CANDIDATE_VIEW_NAMES = ["SnookerARKitView", "SnookerARKitViewManager"] as const;

const getRegisteredViewName = (): (typeof CANDIDATE_VIEW_NAMES)[number] | null => {
  if (Platform.OS !== "ios") return null;
  if (typeof UIManager.getViewManagerConfig !== "function") return null;

  for (const viewName of CANDIDATE_VIEW_NAMES) {
    if (UIManager.getViewManagerConfig(viewName)) {
      return viewName;
    }
  }

  return null;
};

export const resolvedNativeARKitViewName = getRegisteredViewName();
export const isNativeARKitViewAvailable = () => !!getRegisteredViewName();
export const hasNativeARKitView = isNativeARKitViewAvailable();
const NativeSnookerARKitView = resolvedNativeARKitViewName
  ? requireNativeComponent<NativeProps>(resolvedNativeARKitViewName)
  : null;

if (__DEV__) {
  const managerConfig = UIManager.getViewManagerConfig?.("SnookerARKitViewManager");
  const viewConfig = UIManager.getViewManagerConfig?.("SnookerARKitView");
  console.log("[SnookerARKit] UIManager configs", {
    SnookerARKitViewManager: Boolean(managerConfig),
    SnookerARKitView: Boolean(viewConfig),
    resolvedViewName: resolvedNativeARKitViewName,
  });
}

export const SnookerARKitView: React.FC<SnookerARKitViewProps> = ({
  style,
  arMode,
  showGrid,
  showReticle,
  showCalibrationMarkers,
  calibration,
  crosshairPoint,
  blackPoint,
  pinkPoint,
  bluePoint,
  positionedMarkers,
  selectedMarkerId,
  onCrosshairPoint,
  onCameraPose,
  onTrackingState,
}) => {
  if (!NativeSnookerARKitView) {
    return <View style={style} />;
  }

  return (
    <NativeSnookerARKitView
      style={style}
      arMode={arMode}
      showGrid={showGrid}
      showReticle={showReticle}
      showCalibrationMarkers={showCalibrationMarkers}
      calibration={calibration}
      crosshairPoint={crosshairPoint}
      blackPoint={blackPoint}
      pinkPoint={pinkPoint}
      bluePoint={bluePoint ?? null}
      positionedMarkers={positionedMarkers}
      selectedMarkerId={selectedMarkerId ?? null}
      onCrosshairPointChange={(event) => onCrosshairPoint?.(event.nativeEvent)}
      onCameraPoseChange={(event) => onCameraPose?.(event.nativeEvent)}
      onTrackingStateChange={(event) => onTrackingState?.(event.nativeEvent.state)}
    />
  );
};
