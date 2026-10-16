import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import type { CommunityStackParamList } from "../../types";
import { useTourNewsStore } from "../../store/tourNewsStore";
import { useProTourStore } from "../../store/proTourStore";
import { LeadStory, NewsRow } from "../../components/tour/NewsRow";
import { ProTourLiveTab } from "../../components/tour/ProTourLiveTab";
import { ProTourRankingsTab } from "../../components/tour/ProTourRankingsTab";
import type { NewsSource } from "../../features/tour/news";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const FILTERS: Array<{ value: NewsSource | "all"; label: string }> = [
  { value: "all", label: "ALL" },
  { value: "wst", label: "WST" },
  { value: "bbc", label: "BBC SPORT" },
];

const SEGMENTS: Array<{ value: "news" | "live" | "rankings"; label: string }> = [
  { value: "news", label: "News" },
  { value: "live", label: "Live & results" },
  { value: "rankings", label: "Rankings" },
];

/**
 * The pro tour: news from the World Snooker Tour and BBC Sport on one segment, live scores,
 * upcoming fixtures and recent results from snooker.org on the second, the money rankings on
 * the third.
 */
export const TourNewsScreen = () => {
  const { colors } = useAppTheme();
  const route = useRoute<RouteProp<CommunityStackParamList, "TourNews">>();
  const [segment, setSegment] = useState<"news" | "live" | "rankings">(route.params?.segment ?? "news");
  // Start reading the tour while the news is up, so Live & results and Rankings are ready when tapped.
  useEffect(() => {
    void useProTourStore.getState().refresh();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.segmentsWrap, { backgroundColor: colors.board }]}>
        <View style={[styles.segments, { backgroundColor: colors.boardRaised }]} accessibilityRole="tablist">
          {SEGMENTS.map((option) => {
            const selected = option.value === segment;
            return (
              <Pressable
                key={option.value}
                onPress={() => setSegment(option.value)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                style={[styles.segment, selected && { backgroundColor: colors.primary }]}
              >
                <Text
                  maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                  numberOfLines={1}
                  style={[styles.segmentText, { color: selected ? colors.onPrimary : colors.boardMuted }]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {segment === "news" ? <TourNewsList /> : segment === "live" ? <ProTourLiveTab onBrowseRankings={() => setSegment("rankings")} /> : <ProTourRankingsTab />}
    </View>
  );
};

const TourNewsList = () => {
  const { colors } = useAppTheme();
  const { items, loading, failed, refresh } = useTourNewsStore(
    useShallow((state) => ({ items: state.items, loading: state.loading, failed: state.failed, refresh: state.refresh }))
  );
  const [filter, setFilter] = useState<NewsSource | "all">("all");

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const shown = useMemo(
    () => (filter === "all" ? items : items.filter((item) => item.source === filter)),
    [filter, items]
  );
  const [lead, ...rest] = shown;

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={rest}
      keyExtractor={(item) => item.id}
      refreshControl={
        <RefreshControl
          refreshing={loading && items.length > 0}
          onRefresh={() => refresh(true)}
          tintColor={colors.primary}
        />
      }
      ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: colors.border }]} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <View style={styles.filters} accessibilityRole="tablist">
            {FILTERS.map((option) => {
              const selected = option.value === filter;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setFilter(option.value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected }}
                  style={[
                    styles.filter,
                    {
                      backgroundColor: selected ? colors.board : colors.surface,
                      borderColor: selected ? colors.boardRule : colors.border,
                    },
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.filterText, { color: selected ? colors.boardText : colors.text }]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {lead ? <LeadStory item={lead} /> : null}
          {!items.length && loading ? <ActivityIndicator color={colors.primary} style={styles.loading} /> : null}
          {!items.length && !loading && failed ? (
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialCommunityIcons name="wifi-off" size={28} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.text }]}>Could not load the news</Text>
              <Text style={[styles.note, { color: colors.textMuted }]}>
                Check your connection and pull to try again.
              </Text>
            </View>
          ) : null}
        </View>
      }
      renderItem={({ item }) => <NewsRow item={item} />}
      ListFooterComponent={
        items.length ? (
          <Text style={[styles.note, styles.footer, { color: colors.textSubtle }]}>
            Stories from World Snooker Tour and BBC Sport. Tap one to read it on their website.
          </Text>
        ) : null
      }
    />
  );
};

const styles = StyleSheet.create({
  segmentsWrap: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  segments: { flexDirection: "row", borderRadius: RADIUS.pill, padding: 4 },
  segment: { flex: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, minHeight: 36, alignItems: "center", justifyContent: "center" },
  segmentText: { fontSize: 14, fontWeight: "700" },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  header: { gap: SPACING.md, marginBottom: SPACING.lg },
  filters: { flexDirection: "row", gap: SPACING.sm },
  filter: {
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    minHeight: 36,
    justifyContent: "center",
  },
  filterText: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1 },
  loading: { marginTop: SPACING.xl },
  divider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.md },
  empty: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyText: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 18, textAlign: "center" },
  footer: { marginTop: SPACING.xl },
});
