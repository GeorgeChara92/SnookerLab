import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { formatMoney, playerName, type ProTourRankingRow } from "../../features/tour/liveScores";
import type { CommunityStackParamList } from "../../types";
import { PlayerAvatar, playerPhotoUrl } from "./ProTourUI";
import { useProTourFollowStore } from "../../store/proTourFollowStore";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const seasonLabel = (season: number) => `${season}/${String((season + 1) % 100).padStart(2, "0")}`;

/** The money rankings: the top three on a podium, then everyone else, searchable. */
export const ProTourRankingsTab = () => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { players, playerProfiles, photos, rankingsBySeason, rankingsUpdatedAt, loading, failed } = useProTourStore(
    useShallow((state) => ({
      players: state.players,
      playerProfiles: state.playerProfiles,
      photos: state.photos,
      rankingsBySeason: state.rankingsBySeason,
      rankingsUpdatedAt: state.rankingsUpdatedAt,
      loading: state.loading,
      failed: state.failed,
    }))
  );
  useEffect(() => subscribeProTourLive(), []);
  const followed = useProTourFollowStore((state) => state.ids);

  const seasons = useMemo(() => Object.keys(rankingsBySeason).map(Number).sort((a, b) => b - a), [rankingsBySeason]);
  const [season, setSeason] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const active = season ?? seasons[0] ?? null;
  const all = active != null ? rankingsBySeason[active] ?? [] : [];
  const q = query.trim().toLowerCase();
  const rows = q ? all.filter((row) => playerName(players, row.playerId).toLowerCase().includes(q)) : all;
  const podium = !q && rows.length >= 3 ? rows.slice(0, 3) : [];
  const list = podium.length ? rows.slice(3) : rows;
  const updated = active != null && rankingsUpdatedAt[active]
    ? new Date(rankingsUpdatedAt[active]).toLocaleDateString(undefined, { day: "numeric", month: "short" })
    : null;
  const open = (playerId: number) => navigation.navigate("ProTourPlayer", { playerId });
  const medal = [colors.accent, "#B8C2C7", "#C08457"];

  const header = (
    <View style={styles.header}>
      <View style={styles.titleRow}>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Money rankings</Text>
          {updated ? <Text style={[styles.sub, { color: colors.textMuted }]}>Updated {updated}</Text> : null}
        </View>
        {seasons.length > 1 ? (
          <View style={[styles.seasons, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {seasons.slice(0, 3).map((value) => {
              const on = value === active;
              return (
                <Pressable key={value} onPress={() => setSeason(value)} style={[styles.season, on && { backgroundColor: colors.primary }]}>
                  <Text style={[styles.seasonText, { color: on ? colors.onPrimary : colors.textMuted }]}>{seasonLabel(value)}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : active != null ? (
          <Text style={[styles.sub, { color: colors.textMuted }]}>{seasonLabel(active)}</Text>
        ) : null}
      </View>

      <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <MaterialCommunityIcons name="magnify" size={18} color={colors.textMuted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Find a player"
          placeholderTextColor={colors.textSubtle}
          style={[styles.searchInput, { color: colors.text }]}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={16} color={colors.textSubtle} />
          </Pressable>
        ) : null}
      </View>

      {podium.length ? (
        <View style={styles.podium}>
          {[podium[1], podium[0], podium[2]].map((row) => {
            const first = row.position === 1;
            const name = playerName(players, row.playerId);
            return (
              <Pressable
                key={row.playerId}
                onPress={() => open(row.playerId)}
                style={({ pressed }) => [
                  styles.podiumCard,
                  {
                    backgroundColor: first ? colors.board : colors.surface,
                    borderColor: first ? colors.boardRule : colors.border,
                    paddingTop: first ? SPACING.xl : SPACING.lg,
                    opacity: pressed ? 0.9 : 1,
                  },
                ]}
              >
                <PlayerAvatar name={name} photo={playerPhotoUrl(photos, playerProfiles, row.playerId)} size={first ? 64 : 52} ring={medal[row.position - 1]} />
                <View style={[styles.medal, { backgroundColor: medal[row.position - 1] }]}>
                  <Text style={styles.medalText}>{row.position}</Text>
                </View>
                <Text numberOfLines={2} style={[styles.podiumName, { color: first ? colors.boardText : colors.text }]}>
                  {name}
                </Text>
                {row.sum != null ? (
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.podiumSum, { color: first ? colors.accent : colors.textMuted }]}>
                    {formatMoney(row.sum)}
                  </Text>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={list}
      keyExtractor={(row) => String(row.playerId)}
      extraData={followed}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }: { item: ProTourRankingRow; index: number }) => {
        const name = playerName(players, item.playerId);
        const profile = playerProfiles[item.playerId];
        return (
          <Pressable
            onPress={() => open(item.playerId)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
                borderColor: colors.border,
                borderTopLeftRadius: index === 0 ? RADIUS.lg : 0,
                borderTopRightRadius: index === 0 ? RADIUS.lg : 0,
                borderBottomLeftRadius: index === list.length - 1 ? RADIUS.lg : 0,
                borderBottomRightRadius: index === list.length - 1 ? RADIUS.lg : 0,
                borderTopWidth: index === 0 ? 1 : 0,
              },
            ]}
          >
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.position, { color: colors.textMuted }]}>
              {item.position}
            </Text>
            <PlayerAvatar name={name} photo={playerPhotoUrl(photos, playerProfiles, item.playerId)} size={40} />
            <View style={styles.rowBody}>
              <View style={styles.nameLine}>
                <Text numberOfLines={1} style={[styles.rowName, { color: colors.text, flexShrink: 1 }]}>
                  {name}
                </Text>
                {followed.includes(item.playerId) ? (
                  <MaterialCommunityIcons name="bell-check" size={14} color={colors.accent} accessibilityLabel="Following" />
                ) : null}
              </View>
              {profile?.nationality ? (
                <Text numberOfLines={1} style={[styles.rowSub, { color: colors.textSubtle }]}>
                  {profile.nationality}
                </Text>
              ) : null}
            </View>
            {item.sum != null ? (
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sum, { color: colors.text }]}>
                {formatMoney(item.sum)}
              </Text>
            ) : null}
          </Pressable>
        );
      }}
      ListFooterComponent={
        list.length ? (
          <Text style={[styles.footnote, { color: colors.textSubtle }]}>
            Prize money from snooker.org. Player photos from Wikimedia Commons, credited on each player's page.
          </Text>
        ) : null
      }
      ListEmptyComponent={
        loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
        ) : q ? (
          <Text style={[styles.sub, { color: colors.textMuted, textAlign: "center" }]}>No ranked player matches "{query}".</Text>
        ) : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name={failed ? "wifi-off" : "trophy-outline"} size={28} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>{failed ? "Could not load rankings" : "Rankings aren't in yet"}</Text>
          </View>
        )
      }
    />
  );
};

const styles = StyleSheet.create({
  nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2 },
  header: { gap: SPACING.lg, marginBottom: SPACING.lg },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  title: { fontSize: 24, fontWeight: "800", letterSpacing: -0.4 },
  sub: { fontSize: 13, marginTop: 2 },
  seasons: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.pill, padding: 3 },
  season: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 6 },
  seasonText: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 0.3 },
  search: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: SPACING.sm },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm },
  podiumCard: { flex: 1, alignItems: "center", borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.sm, paddingBottom: SPACING.md, gap: 6 },
  medal: { marginTop: -16, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  medalText: { fontFamily: FONTS.boardHeavy, fontSize: 14, color: "#1a1404" },
  podiumName: { fontSize: 14, fontWeight: "800", textAlign: "center", minHeight: 36 },
  podiumSum: { fontFamily: FONTS.board, fontSize: 16, fontVariant: ["tabular-nums"] },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingVertical: 10, paddingHorizontal: SPACING.md, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1 },
  position: { width: 30, fontFamily: FONTS.board, fontSize: 17, fontVariant: ["tabular-nums"], textAlign: "right" },
  rowBody: { flex: 1 },
  rowName: { fontSize: 15, fontWeight: "700" },
  rowSub: { fontSize: 12, marginTop: 1 },
  sum: { fontFamily: FONTS.board, fontSize: 16, fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  footnote: { fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: SPACING.lg },
});
