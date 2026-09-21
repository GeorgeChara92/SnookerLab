import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useAppTheme } from "../../hooks/useAppTheme";
import { FONTS } from "../../constants";

/** A red and the six colours, as on the sign-in screen. */
const BALLS = ["#D0142F", "#F2C230", "#1F8A4C", "#7A4B2A", "#1B6FD0", "#F29AC0", "#1A1E20"];

/**
 * Shown for the moment after signing in while the player's matches, practice and progress
 * arrive from their account, so the app opens with everything in place rather than empty.
 * The balls light up in turn, like the colours being potted.
 */
export const LoadingPlayerScreen = () => {
  const { colors } = useAppTheme();
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: BALLS.length, duration: BALLS.length * 220, easing: Easing.linear, useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.board }]} accessibilityLabel="Loading your matches and practice">
      <StatusBar style="light" />
      <Text style={[styles.wordmark, { color: colors.boardText }]}>SNOOKER LAB</Text>
      <View style={styles.balls}>
        {BALLS.map((colour, index) => (
          <Animated.View
            key={colour}
            style={[
              styles.ball,
              {
                backgroundColor: colour,
                borderColor: index === BALLS.length - 1 ? colors.boardMuted : "transparent",
                opacity: pulse.interpolate({
                  inputRange: [index - 1, index, index + 1, index + 2],
                  outputRange: [0.35, 1, 0.35, 0.35],
                  extrapolate: "clamp",
                }),
                transform: [
                  {
                    scale: pulse.interpolate({
                      inputRange: [index - 1, index, index + 1],
                      outputRange: [1, 1.25, 1],
                      extrapolate: "clamp",
                    }),
                  },
                ],
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.caption, { color: colors.boardMuted }]}>RACKING UP YOUR FRAMES</Text>
    </View>
  );
};

const BALL = 16;

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", gap: 22 },
  wordmark: { fontFamily: FONTS.boardHeavy, fontSize: 40, letterSpacing: 4 },
  balls: { flexDirection: "row", gap: 12 },
  ball: { width: BALL, height: BALL, borderRadius: BALL / 2, borderWidth: 1 },
  caption: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 2 },
});
