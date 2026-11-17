import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getYoutubeThumbnailUrl } from "../../utils/youtube";
import { getRoutineArrows, getRoutinePlacedBalls, getRoutineReferenceImageByRoutineId } from "../../features/ar/routineLayouts";
import { TableDiagram } from "../scanSnooker/TableDiagram";
import type { CustomRoutine } from "../../features/customRoutines/customRoutine";
import type { Routine } from "../../types";

/** The smallest a ball is drawn in a list thumbnail, in px: big enough to see its colour, small
 * enough that a pack of reds still reads as a pack on a ~100px table. */
const THUMB_MIN_BALL_PX = 4.5;

/** A library routine's photo or video thumbnail, for one with no table layout to draw. */
export const thumbnailFor = (routine: Routine) => {
  const reference = getRoutineReferenceImageByRoutineId(routine.id);
  if (reference) return reference;
  const videoId = routine.youtube_video_id ?? routine.youtube_alt_video_id;
  return videoId ? { uri: getYoutubeThumbnailUrl(videoId) } : null;
};

/** Whether a routine draws as a table diagram (a custom one, or a library one with a layout). */
export const hasDiagram = (routine: Routine, custom?: CustomRoutine) => Boolean(custom || getRoutinePlacedBalls(routine));

/**
 * A routine's preview, at whatever size it is given - the same picture the Practice tab's routine
 * cards show: the live table diagram for any routine with a layout (a custom one, or a library one
 * placed in the builder), and only otherwise its reference photo or video thumbnail.
 */
export const RoutineThumb = ({
  routine,
  custom,
  style,
  onPress,
  landscape,
  compact,
}: {
  routine: Routine;
  custom?: CustomRoutine;
  style: any;
  onPress?: () => void;
  /** The table on its side, for a wide box. */
  landscape?: boolean;
  /** A small list thumbnail: balls drawn smaller than in a full-size diagram, so they stay in
   * proportion to the table. Only the coach's thumbnails use this; the Practice tab is unchanged. */
  compact?: boolean;
}) => {
  const minBallPx = compact ? THUMB_MIN_BALL_PX : undefined;
  const { colors } = useAppTheme();
  const libraryBalls = custom ? null : getRoutinePlacedBalls(routine);
  if (custom || libraryBalls) {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={[style, styles.diagram, { backgroundColor: "#0F4A33" }]}>
        {custom ? (
          <TableDiagram balls={custom.balls} readOnly landscape={landscape} enlarge minBallPx={minBallPx} />
        ) : (
          <TableDiagram
            balls={libraryBalls!}
            arrows={getRoutineArrows(routine)}
            readOnly
            landscape={landscape}
            enlarge
            minBallPx={minBallPx}
          />
        )}
      </Pressable>
    );
  }
  const source = thumbnailFor(routine);
  if (!source) {
    return (
      <View style={[style, styles.fallback, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={styles.icon}>{routine.icon ?? "🎱"}</Text>
      </View>
    );
  }
  const image = <Image source={source} style={style} resizeMode={onPress ? "contain" : "cover"} />;
  return onPress ? <Pressable onPress={onPress}>{image}</Pressable> : image;
};

const styles = StyleSheet.create({
  // No centring here: the diagram fills its box (flex: 1) and centres the table itself. Centred, it
  // would shrink to no width at all and draw nothing but this box's green.
  diagram: { overflow: "hidden" },
  fallback: { alignItems: "center", justifyContent: "center" },
  icon: { fontSize: 22 },
});
