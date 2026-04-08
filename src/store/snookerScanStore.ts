import { create } from "zustand";

export type SnookerBallColor = "white" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "red";

export type SnookerMarker = {
  id: string;
  color: SnookerBallColor;
  xNorm: number;
  yNorm: number;
  label?: string;
  createdAt: number;
};

export type SnookerCalibration = {
  topCenter: { x: number; y: number; z: number };
  axis: { x: number; y: number; z: number };
  perpendicular: { x: number; y: number; z: number };
  tableLengthM: number;
  tableWidthM: number;
  tableY: number;
  scanQuality: number;
};

export type SnookerScanState = {
  isActive: boolean;
  matchId: string | null;
  frameNumber: number | null;
  calibration: SnookerCalibration | null;
  markers: SnookerMarker[];
  selectedBallColor: SnookerBallColor;
  scanNotes: string;
};

type SnookerScanActions = {
  startScan: (matchId: string, frameNumber: number) => void;
  setCalibration: (calibration: SnookerCalibration) => void;
  addMarker: (marker: Omit<SnookerMarker, "id" | "createdAt">) => void;
  updateMarker: (id: string, updates: Partial<SnookerMarker>) => void;
  removeMarker: (id: string) => void;
  clearMarkers: () => void;
  setSelectedBallColor: (color: SnookerBallColor) => void;
  setScanNotes: (notes: string) => void;
  endScan: () => void;
  hasActiveScan: () => boolean;
};

export type SnookerScanStore = SnookerScanState & SnookerScanActions;

const initialState: SnookerScanState = {
  isActive: false,
  matchId: null,
  frameNumber: null,
  calibration: null,
  markers: [],
  selectedBallColor: "white",
  scanNotes: "",
};

export const useSnookerScanStore = create<SnookerScanStore>((set, get) => ({
  ...initialState,

  startScan: (matchId: string, frameNumber: number) => {
    set({
      isActive: true,
      matchId,
      frameNumber,
      calibration: null,
      markers: [],
      selectedBallColor: "white",
      scanNotes: "",
    });
  },

  setCalibration: (calibration: SnookerCalibration) => {
    set({ calibration });
  },

  addMarker: (markerData) => {
    const marker: SnookerMarker = {
      ...markerData,
      id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    set((state) => ({ markers: [...state.markers, marker] }));
  },

  updateMarker: (id: string, updates: Partial<SnookerMarker>) => {
    set((state) => ({
      markers: state.markers.map((m) => (m.id === id ? { ...m, ...updates } : m)),
    }));
  },

  removeMarker: (id: string) => {
    set((state) => ({
      markers: state.markers.filter((m) => m.id !== id),
    }));
  },

  clearMarkers: () => {
    set({ markers: [] });
  },

  setSelectedBallColor: (color: SnookerBallColor) => {
    set({ selectedBallColor: color });
  },

  setScanNotes: (notes: string) => {
    set({ scanNotes: notes });
  },

  endScan: () => {
    set(initialState);
  },

  hasActiveScan: () => {
    const state = get();
    return state.isActive && state.matchId !== null && state.frameNumber !== null;
  },
}));