import React from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Polygon } from "react-native-svg";
import type { Point, TableCorners } from "../../features/tableCapture/ballTypes";

type CornerKey = keyof TableCorners;

type Props = {
  width: number;
  height: number;
  corners: TableCorners;
  setCorner: (key: CornerKey, point: Point) => void;
  onConfirm: () => void;
};

const CORNER_KEYS: CornerKey[] = ["topLeft", "topRight", "bottomRight", "bottomLeft"];

export const CornerCalibrationOverlay: React.FC<Props> = ({ width, height, corners, setCorner, onConfirm }) => {
  const tablePoints = `${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`;

  return (
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
        <Polygon points={tablePoints} fill="none" stroke="rgba(16,185,129,0.9)" strokeWidth={3} />
      </Svg>

      <View style={styles.instructionWrap} pointerEvents="none">
        <Text style={styles.instructionTitle}>Align inner cushion corners</Text>
        <Text style={styles.instructionText}>Drag each marker so all 4 inner corners match the table edges.</Text>
      </View>

      {CORNER_KEYS.map((key) => {
        const point = corners[key];
        const responder = PanResponder.create({
          onMoveShouldSetPanResponder: () => true,
          onPanResponderMove: (_, gesture) => {
            setCorner(key, {
              x: Math.max(0, Math.min(width, point.x + gesture.dx)),
              y: Math.max(0, Math.min(height, point.y + gesture.dy)),
            });
          },
        });

        return (
          <View
            key={key}
            {...responder.panHandlers}
            style={[styles.cornerHandle, { left: point.x - 16, top: point.y - 16 }]}
          />
        );
      })}

      <View style={styles.bottomActions}>
        <Pressable style={styles.button} onPress={onConfirm}>
          <Text style={styles.buttonText}>Confirm Table</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  instructionWrap: {
    marginTop: 56,
    marginHorizontal: 16,
    backgroundColor: "rgba(2,6,23,0.78)",
    borderRadius: 12,
    padding: 12,
  },
  instructionTitle: { color: "#F8FAFC", fontWeight: "800", fontSize: 16, marginBottom: 4 },
  instructionText: { color: "#CBD5E1", fontSize: 13 },
  cornerHandle: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderColor: "#10B981",
    borderWidth: 3,
    backgroundColor: "rgba(16,185,129,0.35)",
  },
  bottomActions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 34,
  },
  button: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonText: { color: "#052E2B", fontWeight: "800", fontSize: 15 },
});
