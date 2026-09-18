import React from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Polygon } from "react-native-svg";
import { BALL_COLOUR_HEX, BALL_COLOURS, type BallColour, type Point, type TableCorners } from "../../features/tableCapture/ballTypes";
import { isPointInsideTable, normalizedToScreen, screenToNormalized } from "../../features/tableCapture/tableGeometry";

type WorkingBall = {
  id: string;
  colour: BallColour;
  position: Point;
};

type Props = {
  width: number;
  height: number;
  corners: TableCorners;
  balls: WorkingBall[];
  setBalls: (balls: WorkingBall[]) => void;
  selectedColour: BallColour;
  setSelectedColour: (colour: BallColour) => void;
  onSave: () => void;
  onBack: () => void;
};

export const BallPlacementOverlay: React.FC<Props> = ({
  width,
  height,
  corners,
  balls,
  setBalls,
  selectedColour,
  setSelectedColour,
  onSave,
  onBack,
}) => {
  const addBallAt = (screenPoint: Point) => {
    if (!isPointInsideTable(corners, screenPoint)) return;
    const normalized = screenToNormalized(corners, screenPoint);
    const clampedScreen = normalizedToScreen(corners, normalized);
    setBalls([
      ...balls,
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        colour: selectedColour,
        position: clampedScreen,
      },
    ]);
  };

  const tablePoints = `${corners.topLeft.x},${corners.topLeft.y} ${corners.topRight.x},${corners.topRight.y} ${corners.bottomRight.x},${corners.bottomRight.y} ${corners.bottomLeft.x},${corners.bottomLeft.y}`;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={(event) => addBallAt({ x: event.nativeEvent.locationX, y: event.nativeEvent.locationY })}>
        <Svg width={width} height={height} style={StyleSheet.absoluteFill}>
          <Polygon points={tablePoints} fill="none" stroke="rgba(16,185,129,0.92)" strokeWidth={3} />
          {balls.map((ball) => (
            <Circle key={ball.id} cx={ball.position.x} cy={ball.position.y} r={8} fill={BALL_COLOUR_HEX[ball.colour]} />
          ))}
        </Svg>
      </Pressable>

      {balls.map((ball) => {
        const responder = PanResponder.create({
          onMoveShouldSetPanResponder: () => true,
          onPanResponderMove: (_, gesture) => {
            const nextPos = {
              x: Math.max(0, Math.min(width, ball.position.x + gesture.dx)),
              y: Math.max(0, Math.min(height, ball.position.y + gesture.dy)),
            };
            const normalized = screenToNormalized(corners, nextPos);
            const clamped = normalizedToScreen(corners, normalized);
            setBalls(balls.map((b) => (b.id === ball.id ? { ...b, position: clamped } : b)));
          },
          onPanResponderRelease: (_, gesture) => {
            if (Math.abs(gesture.dx) < 2 && Math.abs(gesture.dy) < 2) {
              setBalls(balls.filter((b) => b.id !== ball.id));
            }
          },
        });

        return <View key={`${ball.id}-handle`} {...responder.panHandlers} style={[styles.ballHandle, { left: ball.position.x - 14, top: ball.position.y - 14 }]} />;
      })}

      <View style={styles.topCard} pointerEvents="none">
        <Text style={styles.title}>Ball placement mode</Text>
        <Text style={styles.subtitle}>Tap table to add a ball. Drag to adjust. Tap a ball to remove.</Text>
      </View>

      <View style={styles.colourRow}>
        {BALL_COLOURS.map((colour) => (
          <Pressable
            key={colour}
            onPress={() => setSelectedColour(colour)}
            style={[
              styles.colourChip,
              { borderColor: selectedColour === colour ? "#FFFFFF" : "rgba(255,255,255,0.35)", backgroundColor: BALL_COLOUR_HEX[colour] },
            ]}
          >
            <Text style={[styles.colourText, { color: colour === "white" || colour === "yellow" ? "#0F172A" : "#FFFFFF" }]}>{colour[0].toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.bottomActions}>
        <Pressable style={[styles.actionBtn, styles.secondaryBtn]} onPress={onBack}>
          <Text style={styles.secondaryBtnText}>Recalibrate Corners</Text>
        </Pressable>
        <Pressable style={[styles.actionBtn, styles.primaryBtn]} onPress={onSave}>
          <Text style={styles.primaryBtnText}>Save Position</Text>
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ballHandle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  topCard: {
    marginTop: 56,
    marginHorizontal: 16,
    backgroundColor: "rgba(2,6,23,0.78)",
    borderRadius: 12,
    padding: 12,
  },
  title: { color: "#F8FAFC", fontWeight: "800", fontSize: 16, marginBottom: 4 },
  subtitle: { color: "#CBD5E1", fontSize: 12 },
  colourRow: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 104,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  colourChip: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  colourText: { fontSize: 12, fontWeight: "800" },
  bottomActions: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 30,
    flexDirection: "row",
    gap: 10,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  primaryBtn: { backgroundColor: "#10B981" },
  secondaryBtn: { backgroundColor: "rgba(15,23,42,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  primaryBtnText: { color: "#042F2E", fontWeight: "800", fontSize: 14 },
  secondaryBtnText: { color: "#F8FAFC", fontWeight: "700", fontSize: 13 },
});
