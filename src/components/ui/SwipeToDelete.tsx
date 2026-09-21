import React, { useEffect, useMemo, useRef } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { RADIUS } from "../../constants";

/**
 * Swipe a row left to show a Delete button behind it, the way iOS lists work.
 *
 * Built on React Native's own touch handling rather than a gesture library, so it needs no new
 * native build. It only takes over a touch once the finger is clearly moving sideways, so the
 * list still scrolls normally. Only one row is open at a time, and screen readers get a Delete
 * action on the row instead of the swipe.
 */

const ACTION_WIDTH = 88;
/** How far a drag has to go before letting go leaves the row open. */
const OPEN_THRESHOLD = ACTION_WIDTH / 2;

// The row that is open now, so opening another closes it.
let closeOpenRow: (() => void) | null = null;

type Props = {
  children: React.ReactNode;
  /** Called when Delete is tapped. Return false (or throw) to close the row again, e.g. on cancel. */
  onDelete: () => void;
  /** Spoken to screen readers, e.g. "Delete the match against John". */
  deleteLabel: string;
  /** Match the rounding of the row it sits behind. */
  radius?: number;
  /** The row's own bottom margin, so the red stops where the row does rather than below it. */
  gapBelow?: number;
};

export const SwipeToDelete = ({ children, onDelete, deleteLabel, radius = RADIUS.lg, gapBelow = 0 }: Props) => {
  const { colors } = useAppTheme();
  const translateX = useRef(new Animated.Value(0)).current;
  const offset = useRef(0);
  const isOpen = useRef(false);
  const [open, setOpen] = React.useState(false);

  const settle = (to: number) => {
    offset.current = to;
    isOpen.current = to !== 0;
    setOpen(to !== 0);
    Animated.spring(translateX, { toValue: to, useNativeDriver: true, bounciness: 0, speed: 20 }).start();
  };

  const close = () => settle(0);

  useEffect(
    () => () => {
      if (closeOpenRow === close) closeOpenRow = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const responder = useMemo(
    () =>
      PanResponder.create({
        // Only a clearly sideways drag belongs to the row; anything else is the list scrolling.
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 10 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.5,
        onPanResponderGrant: () => {
          if (closeOpenRow && closeOpenRow !== close) closeOpenRow();
          closeOpenRow = close;
        },
        onPanResponderMove: (_, gesture) => {
          const next = Math.min(0, Math.max(-ACTION_WIDTH * 1.25, offset.current + gesture.dx));
          translateX.setValue(next);
        },
        onPanResponderRelease: (_, gesture) => {
          const position = offset.current + gesture.dx;
          settle(position < -OPEN_THRESHOLD || gesture.vx < -0.5 ? -ACTION_WIDTH : 0);
        },
        onPanResponderTerminate: () => settle(offset.current),
        onPanResponderTerminationRequest: () => false,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <View
      style={styles.wrap}
      accessible={false}
      accessibilityActions={[{ name: "delete", label: deleteLabel }]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === "delete") onDelete();
      }}
    >
      <View style={[styles.action, { backgroundColor: colors.danger, borderRadius: radius, bottom: gapBelow }]}>
        <Pressable
          onPress={() => {
            close();
            onDelete();
          }}
          accessibilityRole="button"
          accessibilityLabel={deleteLabel}
          style={styles.actionButton}
        >
          <MaterialCommunityIcons name="trash-can-outline" size={22} color={colors.onDanger} />
          <Text style={[styles.actionText, { color: colors.onDanger }]}>Delete</Text>
        </Pressable>
      </View>

      {/* The page colour behind the row covers the red wherever the row itself is see-through. */}
      <Animated.View
        style={{ transform: [{ translateX }], backgroundColor: colors.background }}
        {...responder.panHandlers}
      >
        {children}
        {/* While open, a tap on the row closes it rather than opening whatever it links to. */}
        {open ? <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close" /> : null}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: "relative" },
  action: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  actionButton: {
    width: ACTION_WIDTH,
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  actionText: { fontSize: 13, fontWeight: "800" },
});
