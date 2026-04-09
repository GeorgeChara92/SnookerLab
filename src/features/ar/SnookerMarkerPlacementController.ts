import { useMemo, useState } from "react";
import { clampNormPoint } from "./SnookerARAnchorManager";
import type { SnookerTableCalibration } from "./snookerTableCalibration";
import { normFromWorld, worldFromNorm, type GroundPoint } from "./snookerTableCalibration";
import type { SnookerBallColor, SnookerMarker } from "../../store/snookerScanStore";

type MarkerStore = {
  markers: SnookerMarker[];
  selectedBallColor: SnookerBallColor;
  addMarker: (marker: Omit<SnookerMarker, "id" | "createdAt">) => void;
  updateMarker: (id: string, updates: Partial<SnookerMarker>) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  setSelectedBallColor: (color: SnookerBallColor) => void;
};

const nudgeDistanceNorm = 0.004;
const ballDiameterM = 0.0525;

export const useSnookerMarkerPlacementController = (
  calibration: SnookerTableCalibration | null,
  crosshairPoint: GroundPoint | null,
  store: MarkerStore
) => {
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);

  const positionedMarkers = useMemo(() => {
    if (!calibration) return [];
    return store.markers.map((marker) => {
      const world = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      return {
        ...marker,
        x: world.x,
        y: world.y,
        z: world.z,
      };
    });
  }, [calibration, store.markers]);

  const selectedMarker = store.markers.find((marker) => marker.id === selectedMarkerId) ?? null;

  const hasCollisionAtNorm = (
    candidateNorm: { xNorm: number; yNorm: number },
    ignoreMarkerId?: string
  ) => {
    if (!calibration) return false;
    const candidateWorld = worldFromNorm(calibration, candidateNorm.xNorm, candidateNorm.yNorm);

    for (const marker of store.markers) {
      if (ignoreMarkerId && marker.id === ignoreMarkerId) continue;
      const world = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      const distance = Math.hypot(world.x - candidateWorld.x, world.z - candidateWorld.z);
      if (distance < ballDiameterM) {
        return true;
      }
    }

    return false;
  };

  const placeMarker = () => {
    if (!calibration || !crosshairPoint) return { ok: false, reason: "No valid calibration point." } as const;

    const norm = clampNormPoint(normFromWorld(calibration, crosshairPoint));
    if (norm.xNorm < 0 || norm.xNorm > 1 || norm.yNorm < 0 || norm.yNorm > 1) {
      return { ok: false, reason: "Point is outside table bounds." } as const;
    }

    if (hasCollisionAtNorm(norm)) {
      return { ok: false, reason: "Too close to another ball marker." } as const;
    }

    store.addMarker({
      color: store.selectedBallColor,
      xNorm: norm.xNorm,
      yNorm: norm.yNorm,
    });
    return { ok: true } as const;
  };

  const selectNearestMarkerToCrosshair = () => {
    if (!calibration || !crosshairPoint || !store.markers.length) return;

    let nearest: { id: string; distance: number } | null = null;
    for (const marker of store.markers) {
      const world = worldFromNorm(calibration, marker.xNorm, marker.yNorm);
      const distance = Math.hypot(world.x - crosshairPoint.x, world.z - crosshairPoint.z);
      if (!nearest || distance < nearest.distance) {
        nearest = { id: marker.id, distance };
      }
    }

    if (nearest && nearest.distance < 0.18) {
      setSelectedMarkerId(nearest.id);
    }
  };

  const moveSelectedToCrosshair = () => {
    if (!calibration || !crosshairPoint || !selectedMarkerId) return;
    const norm = clampNormPoint(normFromWorld(calibration, crosshairPoint));
    if (hasCollisionAtNorm(norm, selectedMarkerId)) {
      return { ok: false, reason: "Too close to another ball marker." } as const;
    }
    store.updateMarker(selectedMarkerId, { xNorm: norm.xNorm, yNorm: norm.yNorm });
    return { ok: true } as const;
  };

  const nudgeSelected = (dxNorm: number, dyNorm: number) => {
    if (!selectedMarker) return;
    const next = clampNormPoint({ xNorm: selectedMarker.xNorm + dxNorm, yNorm: selectedMarker.yNorm + dyNorm });
    if (hasCollisionAtNorm(next, selectedMarker.id)) {
      return { ok: false, reason: "Too close to another ball marker." } as const;
    }
    store.updateMarker(selectedMarker.id, next);
    return { ok: true } as const;
  };

  const nudgeSelectedUp = () => nudgeSelected(0, -nudgeDistanceNorm);
  const nudgeSelectedDown = () => nudgeSelected(0, nudgeDistanceNorm);
  const nudgeSelectedLeft = () => nudgeSelected(-nudgeDistanceNorm, 0);
  const nudgeSelectedRight = () => nudgeSelected(nudgeDistanceNorm, 0);

  const removeSelected = () => {
    if (!selectedMarker) return;
    store.removeMarker(selectedMarker.id);
    setSelectedMarkerId(null);
  };

  return {
    positionedMarkers,
    selectedMarkerId,
    selectedMarker,
    setSelectedMarkerId,
    placeMarker,
    selectNearestMarkerToCrosshair,
    moveSelectedToCrosshair,
    nudgeSelectedUp,
    nudgeSelectedDown,
    nudgeSelectedLeft,
    nudgeSelectedRight,
    removeSelected,
    clearAll: store.clearMarkers,
    setSelectedBallColor: store.setSelectedBallColor,
  };
};
