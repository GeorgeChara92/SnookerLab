import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { getYoutubeThumbnailUrl } from "../../utils/youtube";
import { getRoutineArrows, getRoutinePlacedBalls, getRoutineReferenceImageByRoutineId } from "../../features/ar/routineLayouts";
import { TableDiagram } from "../scanSnooker/TableDiagram";
import type { CustomRoutine } from "../../features/customRoutines/customRoutine";
import type { Routine } from "../../types";

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
}: {
  routine: Routine;
  custom?: CustomRoutine;
  style: any;
  onPress?: () => void;
  /** The wide preview box, not the small square one in a list row. */
  landscape?: boolean;
}) => {
  const { colors } = useAppTheme();
  const libraryBalls = custom ? null : getRoutinePlacedBalls(routine);
  if (custom || libraryBalls) {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={[style, styles.diagram, { backgroundColor: "#0F4A33" }]}>
        {custom ? (
          <TableDiagram balls={custom.balls} readOnly landscape={landscape} />
        ) : (
          <TableDiagram balls={libraryBalls!} arrows={getRoutineArrows(routine)} readOnly landscape={landscape} enlarge={landscape} />
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
