import React from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useAppTheme } from "../../hooks/useAppTheme";
import { NEWS_SOURCES, type NewsItem } from "../../features/tour/news";
import { timeAgo } from "../community/FeedItemRow";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

const SHORT: Record<NewsItem["source"], string> = { wst: "WST", bbc: "BBC SPORT" };

export const openStory = (item: NewsItem) => void Linking.openURL(item.link);

/** "WST · 3h": who published it and when, in the scoreboard's lettering. */
const Kicker = ({ item, colour }: { item: NewsItem; colour: string }) => (
  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colour }]} numberOfLines={1}>
    {SHORT[item.source]} · {timeAgo(item.publishedAt).toUpperCase()}
  </Text>
);

/** The top story: its picture across the card, the headline over it. */
export const LeadStory = ({ item, height = 210 }: { item: NewsItem; height?: number }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => openStory(item)}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${NEWS_SOURCES[item.source].name}. Opens their website.`}
      style={({ pressed }) => [styles.lead, { height, backgroundColor: colors.board, opacity: pressed ? 0.9 : 1 }]}
    >
      {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
      <LinearGradient
        colors={["rgba(8,20,16,0)", "rgba(8,20,16,0.55)", "rgba(8,20,16,0.95)"]}
        locations={[0.2, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.leadText}>
        <Kicker item={item} colour={colors.boardRule} />
        <Text style={styles.leadTitle} numberOfLines={3}>
          {item.title}
        </Text>
      </View>
    </Pressable>
  );
};

/** One story in a list: thumbnail, publisher and time, headline, and a line of summary. */
export const NewsRow = ({ item, summary = true }: { item: NewsItem; summary?: boolean }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={() => openStory(item)}
      accessibilityRole="link"
      accessibilityLabel={`${item.title}. ${NEWS_SOURCES[item.source].name}. Opens their website.`}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.75 : 1 }]}
    >
      <View style={[styles.thumb, { backgroundColor: colors.surfaceMuted }]}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : (
          <MaterialCommunityIcons name="newspaper-variant-outline" size={22} color={colors.textMuted} />
        )}
      </View>
      <View style={styles.rowText}>
        <Kicker item={item} colour={colors.textMuted} />
        <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {summary && item.summary ? (
          <Text style={[styles.rowSummary, { color: colors.textMuted }]} numberOfLines={2}>
            {item.summary}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.1 },
  lead: { borderRadius: RADIUS.lg, overflow: "hidden", justifyContent: "flex-end" },
  leadText: { padding: SPACING.md, gap: 4 },
  leadTitle: { color: "#F4F1E8", fontSize: 20, lineHeight: 25, fontWeight: "800" },
  row: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  thumb: {
    width: 92,
    height: 64,
    borderRadius: RADIUS.sm,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  rowSummary: { fontSize: 13, lineHeight: 18 },
});
