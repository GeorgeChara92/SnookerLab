import React from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { BALL_COLOUR_HEX, type CapturedBall } from "../../features/tableCapture/ballTypes";
import { clamp01 } from "../../features/tableCapture/tableGeometry";

type Props = {
  balls: CapturedBall[];
  onChange: (balls: CapturedBall[]) => void;
};

export const SnookerTableTopDownView: React.FC<Props> = ({ balls, onChange }) => {
  const [size, setSize] = React.useState({ width: 1, height: 1 });

  return (
      <View style={styles.wrap} onLayout={(event) => setSize(event.nativeEvent.layout)}>
      <Svg width={size.width} height={size.height} style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={size.width} height={size.height} fill="#0E5039" />
        {balls.map((ball) => (
          <Circle
            key={`${ball.id}-ghost`}
            cx={ball.x * size.width}
            cy={ball.y * size.height}
            r={8}
            fill={BALL_COLOUR_HEX[ball.colour]}
            opacity={0.75}
          />
        ))}
      </Svg>

      {balls.map((ball) => {
        const responder = PanResponder.create({
          onMoveShouldSetPanResponder: () => true,
          onPanResponderMove: (_, gesture) => {
            const nextX = clamp01((ball.x * size.width + gesture.dx) / size.width);
            const nextY = clamp01((ball.y * size.height + gesture.dy) / size.height);
            onChange(balls.map((b) => (b.id === ball.id ? { ...b, x: nextX, y: nextY } : b)));
          },
        });

        return (
          <View
            key={`${ball.id}-edit`}
            {...responder.panHandlers}
            style={{
              position: "absolute",
              left: ball.x * size.width - 14,
              top: ball.y * size.height - 14,
              width: 28,
              height: 28,
              borderRadius: 14,
              borderWidth: 2,
              borderColor: "#FFFFFF",
              backgroundColor: "rgba(255,255,255,0.08)",
            }}
          />
        );
      })}

      <View style={styles.helper}>
        <Text style={styles.helperText}>Restore map: drag ghost balls to fine-tune positions.</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    height: 280,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#1E3A31",
    backgroundColor: "#0E5039",
  },
  helper: {
    position: "absolute",
    left: 10,
    right: 10,
    bottom: 10,
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(2,6,23,0.65)",
  },
  helperText: { color: "#E2E8F0", fontSize: 12 },
});
