import React from "react";
import { PanResponder, StyleSheet, View } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { TABLE_LENGTH_MM, TABLE_WIDTH_MM, type CapturedBall } from "../../features/arTableCapture/types";

const COLORS: Record<string, string> = {
  white: "#F8FAFC",
  red: "#C53030",
  yellow: "#F6E05E",
  green: "#2F855A",
  brown: "#8B5E3C",
  blue: "#2B6CB0",
  pink: "#D53F8C",
  black: "#111827",
};

type Props = {
  balls: CapturedBall[];
  onChange: (balls: CapturedBall[]) => void;
};

export const ARTableTopDownView: React.FC<Props> = ({ balls, onChange }) => {
  const [size, setSize] = React.useState({ width: 1, height: 1 });
  const height = Math.max(180, Math.min(420, (size.width * TABLE_LENGTH_MM) / TABLE_WIDTH_MM));

  return (
    <View style={styles.wrap} onLayout={(e) => setSize(e.nativeEvent.layout)}>
      <View style={{ width: "100%", height }}>
        <Svg width={size.width} height={height}>
          <Rect x={0} y={0} width={size.width} height={height} fill="#0E5039" />
          {balls.map((ball) => {
            const cx = (ball.xMm / TABLE_WIDTH_MM) * size.width;
            const cy = (ball.yMm / TABLE_LENGTH_MM) * height;
            const r = (52.5 / TABLE_WIDTH_MM) * size.width * 0.5;
            return <Circle key={ball.id} cx={cx} cy={cy} r={Math.max(5, r)} fill={COLORS[ball.colour]} opacity={0.82} />;
          })}
        </Svg>

        {balls.map((ball) => {
          const cx = (ball.xMm / TABLE_WIDTH_MM) * size.width;
          const cy = (ball.yMm / TABLE_LENGTH_MM) * height;
          const responder = PanResponder.create({
            onMoveShouldSetPanResponder: () => true,
            onPanResponderMove: (_, g) => {
              const xPx = Math.max(0, Math.min(size.width, cx + g.dx));
              const yPx = Math.max(0, Math.min(height, cy + g.dy));
              const xMm = Math.round((xPx / size.width) * TABLE_WIDTH_MM);
              const yMm = Math.round((yPx / height) * TABLE_LENGTH_MM);
              onChange(balls.map((b) => (b.id === ball.id ? { ...b, xMm, yMm } : b)));
            },
          });
          return <View key={`${ball.id}-h`} {...responder.panHandlers} style={[styles.handle, { left: cx - 14, top: cy - 14 }]} />;
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: "100%", borderRadius: 12, overflow: "hidden", borderWidth: 1, borderColor: "#1E3A31" },
  handle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
});
