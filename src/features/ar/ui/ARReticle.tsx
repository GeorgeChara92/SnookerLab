import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

type ARReticleState = "searching" | "close" | "alignable" | "locked" | "low_confidence";

type ARReticleProps = {
  visible: boolean;
  state: ARReticleState;
  label?: string;
};

const stateColor: Record<ARReticleState, string> = {
  searching: "rgba(226,232,240,0.8)",
  close: "rgba(250,204,21,0.92)",
  alignable: "rgba(96,165,250,0.95)",
  locked: "rgba(16,185,129,0.98)",
  low_confidence: "rgba(244,63,94,0.98)",
};

export const ARReticle: React.FC<ARReticleProps> = ({ visible, state, label }) => {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    if (state === "locked") {
      Animated.sequence([
        Animated.timing(scale, { toValue: 1.12, duration: 130, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(scale, { toValue: 1, duration: 180, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      ]).start();
      return;
    }

    if (state === "alignable") {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scale, { toValue: 1.04, duration: 420, useNativeDriver: true }),
          Animated.timing(scale, { toValue: 1, duration: 420, useNativeDriver: true }),
        ])
      ).start();
      return () => scale.stopAnimation();
    }

    scale.setValue(1);
  }, [scale, state, visible]);

  if (!visible) return null;

  const color = stateColor[state];

  return (
    <View pointerEvents="none" style={styles.wrap}>
      <Animated.View style={[styles.ring, { borderColor: color, transform: [{ scale }] }]}> 
        <View style={[styles.dot, { backgroundColor: color }]} />
      </Animated.View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    width: 62,
    height: 62,
    borderRadius: 999,
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 14, 24, 0.88)",
  },
  dot: { width: 8, height: 8, borderRadius: 999 },
  label: {
    marginTop: 8,
    color: "#E5E7EB",
    fontSize: 11,
    fontWeight: "700",
    backgroundColor: "rgba(2,6,13,0.62)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
});
