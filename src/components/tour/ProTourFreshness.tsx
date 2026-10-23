import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore } from "../../store/proTourStore";
import { useShallow } from "zustand/react/shallow";
import { RADIUS, SPACING } from "../../constants";

/** How old the scores can be, with the last refresh failed, before the screen says so. */
const STALE_AFTER_MS = 60_000;

const ago = (at: number, now: number) => {
  const minutes = Math.max(1, Math.round((now - at) / 60_000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(at).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

/**
 * Says so when the scores on screen may be out of date - the last refresh failed and the last good
 * one was a while ago - with when they were last updated and a way to try again. Without it, a
 * backend that couldn't be reached (23 Oct 2026) left a finished match showing a live score that
 * looked current. Shows nothing while everything's fine.
 */
export const ProTourFreshness = () => {
  const { colors } = useAppTheme();
  const { failed, fetchedAt, loading, refresh } = useProTourStore(
    useShallow((state) => ({ failed: state.failed, fetchedAt: state.fetchedAt, loading: state.loading, refresh: state.refresh }))
  );
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  if (!failed || (fetchedAt && now - fetchedAt < STALE_AFTER_MS)) return null;

  return (
    <View style={[styles.banner, { backgroundColor: colors.surface, borderColor: colors.warning }]} accessibilityRole="alert">
      <MaterialCommunityIcons name="cloud-alert-outline" size={20} color={colors.warning} />
      <View style={styles.text}>
        <Text style={[styles.title, { color: colors.text }]}>Couldn't update the scores</Text>
        <Text style={[styles.detail, { color: colors.textMuted }]}>
          {fetchedAt ? `Showing scores from ${ago(fetchedAt, now)}.` : "Showing the last scores saved on this phone."} They may be out of date.
        </Text>
      </View>
      <Pressable
        onPress={() => refresh(true)}
        disabled={loading}
        accessibilityRole="button"
        accessibilityLabel="Try updating the scores again"
        hitSlop={8}
        style={({ pressed }) => [styles.retry, { borderColor: colors.border, opacity: pressed ? 0.7 : 1 }]}
      >
        {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={[styles.retryText, { color: colors.primary }]}>Try again</Text>}
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: "800" },
  detail: { fontSize: 13, lineHeight: 18 },
  retry: { borderWidth: 1, borderRadius: RADIUS.sm, paddingHorizontal: 10, minHeight: 34, minWidth: 74, alignItems: "center", justifyContent: "center" },
  retryText: { fontSize: 13, fontWeight: "800" },
});
