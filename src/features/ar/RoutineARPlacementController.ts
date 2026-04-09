import { useMemo, useState } from "react";
import { SPOT_COORDS, type BallColor, type RoutineLayoutDefinition } from "./routineLayouts";
import type { SnookerTableCalibration } from "./snookerTableCalibration";
import { worldFromNorm } from "./snookerTableCalibration";

export type RoutineViewMode = "full" | "sequence";

export type RoutinePlacementMarker = {
  id: string;
  color: BallColor;
  xNorm: number;
  yNorm: number;
  label: string;
};

const humanizeColor = (color: BallColor) => `${color.slice(0, 1).toUpperCase()}${color.slice(1)}`;

export const useRoutineARPlacementController = (layout: RoutineLayoutDefinition, calibration: SnookerTableCalibration | null) => {
  const [viewMode, setViewMode] = useState<RoutineViewMode>("sequence");
  const [activeIndex, setActiveIndex] = useState(0);

  const allMarkers = useMemo<RoutinePlacementMarker[]>(() => {
    const spots = layout.spotMarkers.map((spotId) => ({
      id: spotId,
      color: SPOT_COORDS[spotId].color,
      xNorm: SPOT_COORDS[spotId].x,
      yNorm: SPOT_COORDS[spotId].y,
      label: SPOT_COORDS[spotId].label,
    }));

    const routineBalls = layout.ballPlacements.map((placement, index) => ({
      id: placement.id,
      color: placement.color,
      xNorm: placement.x,
      yNorm: placement.y,
      label: placement.label ?? `${humanizeColor(placement.color)} ${index + 1}`,
    }));

    return [...spots, ...routineBalls];
  }, [layout]);

  const boundedActiveIndex = Math.max(0, Math.min(activeIndex, Math.max(0, allMarkers.length - 1)));

  const visibleMarkers = useMemo(() => {
    if (!calibration) return [];
    const source = viewMode === "full" ? allMarkers : allMarkers[boundedActiveIndex] ? [allMarkers[boundedActiveIndex]] : [];
    return source.map((marker) => {
      const world = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      return { ...marker, x: world.x, y: world.y, z: world.z };
    });
  }, [allMarkers, boundedActiveIndex, calibration, viewMode]);

  const activeMarker = allMarkers[boundedActiveIndex] ?? null;

  const nextMarker = () => setActiveIndex((prev) => Math.min(prev + 1, Math.max(0, allMarkers.length - 1)));
  const previousMarker = () => setActiveIndex((prev) => Math.max(prev - 1, 0));

  return {
    viewMode,
    setViewMode,
    activeMarker,
    activeIndex: boundedActiveIndex,
    markerCount: allMarkers.length,
    visibleMarkers,
    nextMarker,
    previousMarker,
  };
};
