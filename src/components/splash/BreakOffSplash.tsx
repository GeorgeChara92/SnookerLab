import React, { useEffect, useMemo, useRef } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { FONTS } from "../../constants";

/**
 * The opening shot: the break-off. The cue ball rolls up the table into the pack, the fifteen
 * reds scatter, and the name settles in before the app shows through. About two seconds, and a
 * tap skips it. With Reduce Motion on, the table simply fades out.
 *
 * It runs on the phone's own animation driver, so it keeps its pace while the app loads behind.
 */

const BAIZE = "#0E2A21";
const BAIZE_LIGHT = "#15402F";
const CUSHION = "#0A1F18";
const RED = "#C8102E";
const RED_SHADE = "#8E0B20";
const CUE = "#F5F2E7";
const CUE_SHADE = "#C9C4B4";
const TEXT = "#F4F1E8";
const RULE = "#C9A44C";

/** When each part of the shot happens, in milliseconds from the start. */
const T = {
  settle: 250,
  strike: 420,
  contact: 780,
  scatter: 900,
  name: 1250,
  leave: 2050,
  fade: 380,
};

/** A fixed spread, so the break looks the same every time and never lands balls on each other. */
const jitter = (index: number, salt: number) => {
  const x = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

type Props = {
  /** The wordmark waits for the scoreboard face; until then it uses the system font. */
  fontsReady: boolean;
  onFinish: () => void;
};

export const BreakOffSplash = ({ fontsReady, onFinish }: Props) => {
  const { width, height } = useWindowDimensions();
  const finished = useRef(false);

  // ---------------------------------------------------------------- the table
  const d = Math.min(Math.round(width * 0.06), 26); // ball diameter
  const cx = width / 2;
  const apexY = height * 0.36; // the front red, nearest the cue ball
  const cueStartY = height * 0.88; // in the D, where a break is played from
  const contactY = apexY + d; // where the cue ball meets the front red

  // Five rows, apex towards the cue ball: 1 + 2 + 3 + 4 + 5 = 15 reds.
  const reds = useMemo(() => {
    const rack: Array<{ x: number; y: number; row: number }> = [];
    for (let row = 0; row < 5; row += 1) {
      for (let i = 0; i <= row; i += 1) {
        rack.push({ x: cx + (i - row / 2) * d * 1.02, y: apexY - row * d * 0.9, row });
      }
    }

    // Where they come to rest: spread over the whole table, apart from each other, and clear of
    // the name and the cue ball's path home.
    const spots: Array<{ x: number; y: number }> = [];
    const nameTop = height * 0.5;
    const nameBottom = height * 0.66;
    for (let k = 0; spots.length < rack.length && k < 600; k += 1) {
      const x = width * (0.07 + 0.86 * jitter(k, 7));
      const y = height * (0.05 + 0.78 * jitter(k, 8));
      if (y > nameTop && y < nameBottom) continue;
      if (Math.abs(x - cx) < d * 1.6 && y > contactY && y < nameTop) continue;
      if (spots.some((spot) => Math.hypot(spot.x - x, spot.y - y) < d * 2.4)) continue;
      spots.push({ x, y });
    }

    // Each red goes to the spot lying in its own direction from the contact, so the pack still
    // bursts outwards from where it was hit.
    const angleFrom = (x: number, y: number) => Math.atan2(y - (apexY + d / 2), x - cx);
    const byAngle = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      angleFrom(a.x, a.y) - angleFrom(b.x, b.y);
    const rackOrder = rack.map((ball, index) => ({ ...ball, index })).sort(byAngle);
    const spotOrder = [...spots].sort(byAngle);

    const balls = rack.map((ball) => ({ ...ball, toX: ball.x, toY: ball.y, delay: 0 }));
    rackOrder.forEach((ball, order) => {
      const spot = spotOrder[order] ?? { x: ball.x, y: ball.y };
      balls[ball.index] = {
        ...ball,
        toX: spot.x,
        toY: spot.y,
        // The back of the pack moves a touch after the front, as the hit travels through it.
        delay: ball.row * 28 + jitter(ball.index, 4) * 40,
      };
    });
    return balls;
  }, [apexY, contactY, cx, d, height, width]);

  // ---------------------------------------------------------------- the motion
  const table = useRef(new Animated.Value(0)).current;
  const cueTravel = useRef(new Animated.Value(0)).current;
  const cueRecoil = useRef(new Animated.Value(0)).current;
  const ripple = useRef(new Animated.Value(0)).current;
  const scatter = useRef(reds.map(() => new Animated.Value(0))).current;
  const name = useRef(new Animated.Value(0)).current;
  const leave = useRef(new Animated.Value(1)).current;

  const finish = () => {
    if (finished.current) return;
    finished.current = true;
    Animated.timing(leave, { toValue: 0, duration: T.fade, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(
      () => onFinish()
    );
  };

  useEffect(() => {
    let cancelled = false;

    AccessibilityInfo.isReduceMotionEnabled()
      .catch(() => false)
      .then((reduce) => {
        if (cancelled) return;
        if (reduce) {
          table.setValue(1);
          name.setValue(1);
          setTimeout(finish, 600);
          return;
        }

        const timed = (value: Animated.Value, duration: number, easing: (t: number) => number, delay = 0) =>
          Animated.timing(value, { toValue: 1, duration, easing, delay, useNativeDriver: true });

        Animated.parallel([
          timed(table, T.settle, Easing.out(Easing.quad)),
          // A struck ball is quickest just after the tip leaves it, then slows as it runs.
          timed(cueTravel, T.contact - T.strike, Easing.out(Easing.quad), T.strike),
          // Cue ball checks and drifts off after the contact.
          timed(cueRecoil, 700, Easing.out(Easing.cubic), T.contact),
          timed(ripple, 450, Easing.out(Easing.quad), T.contact),
          ...scatter.map((value, index) =>
            timed(value, 720 + jitter(index, 5) * 260, Easing.out(Easing.cubic), T.contact + reds[index].delay)
          ),
          timed(name, 420, Easing.out(Easing.back(1.4)), T.name),
        ]).start();

        setTimeout(finish, T.leave);
      });

    return () => {
      cancelled = true;
    };
    // Plays once, on first mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------- drawing
  const cueX = Animated.add(
    cx,
    cueRecoil.interpolate({ inputRange: [0, 1], outputRange: [0, d * 1.4] })
  );
  const cueY = Animated.add(
    cueTravel.interpolate({ inputRange: [0, 1], outputRange: [cueStartY, contactY + d * 0.02] }),
    cueRecoil.interpolate({ inputRange: [0, 1], outputRange: [0, d * 1.2] })
  );

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: leave }]}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={finish}
        accessibilityRole="button"
        accessibilityLabel="Snooker Lab. Tap to skip the opening."
      >
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: table }]}>
          {/* The baize, with a softer light over the middle where the table lamp would be. */}
          <View style={[StyleSheet.absoluteFill, { backgroundColor: BAIZE }]} />
          <View
            style={[
              styles.lamp,
              {
                width: width * 1.3,
                height: width * 1.3,
                borderRadius: width * 0.65,
                left: cx - width * 0.65,
                top: apexY - width * 0.55,
                backgroundColor: BAIZE_LIGHT,
              },
            ]}
          />
          {/* The baulk line and the D, faint, so it reads as a snooker table rather than pool. */}
          <View style={[styles.baulk, { top: height * 0.86, backgroundColor: CUSHION }]} />
          <View
            style={[
              styles.dee,
              {
                width: width * 0.36,
                height: width * 0.36,
                borderRadius: width * 0.18,
                left: cx - width * 0.18,
                top: height * 0.86 - width * 0.18,
                borderTopColor: CUSHION,
              },
            ]}
          />

          {/* The contact: a quick ring where the cue ball meets the pack. */}
          <Animated.View
            pointerEvents="none"
            style={[
              styles.ripple,
              {
                width: d * 2,
                height: d * 2,
                borderRadius: d,
                left: cx - d,
                top: apexY + d / 2 - d,
                opacity: ripple.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.55, 0] }),
                transform: [{ scale: ripple.interpolate({ inputRange: [0, 1], outputRange: [0.4, 3.2] }) }],
              },
            ]}
          />

          {reds.map((ball, index) => (
            <Animated.View
              key={index}
              style={[
                styles.ball,
                {
                  width: d,
                  height: d,
                  borderRadius: d / 2,
                  left: ball.x - d / 2,
                  top: ball.y - d / 2,
                  backgroundColor: RED,
                  borderColor: RED_SHADE,
                  transform: [
                    { translateX: scatter[index].interpolate({ inputRange: [0, 1], outputRange: [0, ball.toX - ball.x] }) },
                    { translateY: scatter[index].interpolate({ inputRange: [0, 1], outputRange: [0, ball.toY - ball.y] }) },
                  ],
                },
              ]}
            >
              <View style={[styles.shine, { width: d * 0.3, height: d * 0.3, borderRadius: d * 0.15 }]} />
            </Animated.View>
          ))}

          <Animated.View
            style={[
              styles.ball,
              {
                width: d,
                height: d,
                borderRadius: d / 2,
                left: -d / 2,
                top: -d / 2,
                backgroundColor: CUE,
                borderColor: CUE_SHADE,
                transform: [{ translateX: cueX }, { translateY: cueY }],
              },
            ]}
          >
            <View style={[styles.shine, { width: d * 0.3, height: d * 0.3, borderRadius: d * 0.15 }]} />
          </Animated.View>
        </Animated.View>

        {/* The name, set like the scoreboard. */}
        <Animated.View
          pointerEvents="none"
          style={[
            styles.nameBlock,
            {
              top: height * 0.56,
              opacity: name,
              transform: [{ translateY: name.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
            },
          ]}
        >
          <Text
            style={[styles.name, fontsReady ? { fontFamily: FONTS.boardHeavy } : styles.nameFallback]}
            accessibilityElementsHidden
          >
            SNOOKER LAB
          </Text>
          <View style={styles.rule} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: BAIZE, zIndex: 100, elevation: 100 },
  lamp: { position: "absolute", opacity: 0.55 },
  baulk: { position: "absolute", left: 0, right: 0, height: 2, opacity: 0.8 },
  dee: {
    position: "absolute",
    borderWidth: 2,
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    transform: [{ rotate: "180deg" }],
    opacity: 0.8,
  },
  ripple: { position: "absolute", borderWidth: 2, borderColor: "#FFFFFF" },
  ball: {
    position: "absolute",
    borderWidth: 1,
    shadowColor: "#000000",
    shadowOpacity: 0.45,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  shine: { position: "absolute", top: "16%", left: "20%", backgroundColor: "rgba(255,255,255,0.55)" },
  nameBlock: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  name: { color: TEXT, fontSize: 40, letterSpacing: 5 },
  nameFallback: { fontWeight: "900", fontSize: 34 },
  rule: { width: 64, height: 3, borderRadius: 2, backgroundColor: RULE, marginTop: 10 },
});
