import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { RADIUS, SPACING } from "../../constants";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useOutboxStore, type SyncScope } from "../../sync";

/**
 * Says, quietly, that something is saved on this phone but not yet on the server. It shows only
 * when there is something waiting, so most of the time it is not there at all.
 */
export const SyncBanner = ({ scope, noun = "change" }: { scope: SyncScope; noun?: string }) => {
  const { colors } = useAppTheme();
  const waiting = useOutboxStore((state) => state.jobs.filter((job) => job.scope === scope).length);

  if (!waiting) return null;

  return (
    <View
      style={[styles.banner, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
      accessibilityRole="summary"
      accessibilityLabel={`${waiting} ${waiting === 1 ? noun : `${noun}s`} saved on this device, waiting for a connection`}
    >
      <MaterialCommunityIcons name="cloud-upload-outline" size={16} color={colors.textMuted} />
      <Text style={[styles.text, { color: colors.textMuted }]}>
        {waiting === 1 ? `1 ${noun} is` : `${waiting} ${noun}s are`} saved on this phone, waiting for a connection.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    lineHeight: 16,
  },
});
