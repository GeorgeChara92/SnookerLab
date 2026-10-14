import React, { useEffect, useMemo } from "react";
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { groupMatches } from "../../features/tour/liveScores";
import { ProTourMatchRow } from "../../components/tour/ProTourMatchRow";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

const PHOTO_SIZE = 96;

const formatBorn = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

/**
 * A professional player: their snooker.org bio, current ranking, and recent/upcoming tour
 * matches, framed the same way the player cam and name graphic break the top of a broadcast's
 * scoreboard panel - the profile IS the scoreboard, not a different kind of page underneath it.
 */
export const ProTourPlayerScreen = () => {
  const { colors } = useAppTheme();
  const route = useRoute<RouteProp<CommunityStackParamList, "ProTourPlayer">>();
  const { playerId } = route.params;
  const { matches, players, playerProfiles, rankingsBySeason, roundNames } = useProTourStore();

  useEffect(() => subscribeProTourLive(), []);

  const profile = playerProfiles[playerId];
  const born = formatBorn(profile?.born ?? null);

  const ranking = useMemo(() => {
    const seasons = Object.keys(rankingsBySeason).map(Number);
    if (!seasons.length) return null;
    const latest = Math.max(...seasons);
    return rankingsBySeason[latest]?.find((row) => row.playerId === playerId) ?? null;
  }, [rankingsBySeason, playerId]);

  const playerMatches = useMemo(
    () => matches.filter((match) => match.player1Id === playerId || match.player2Id === playerId),
    [matches, playerId]
  );
  const { live, upcoming, finished } = groupMatches(playerMatches);

  const name = profile?.name ?? players[playerId] ?? `Player ${playerId}`;
  const stats = [
    ranking ? { label: "Ranking", value: `#${ranking.position}` } : null,
    profile?.numRankingTitles != null ? { label: "Titles", value: String(profile.numRankingTitles) } : null,
    profile?.numMaximums != null ? { label: "147s", value: String(profile.numMaximums) } : null,
    profile?.firstSeasonAsPro ? { label: "Pro since", value: String(profile.firstSeasonAsPro) } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={styles.heroWrap}>
        <BoardPanel kicker={profile?.nationality ?? undefined} aside={born ? `Born ${born}` : undefined} style={styles.hero}>
          <Text
            maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
            numberOfLines={2}
            style={[styles.name, { color: colors.boardText }]}
          >
            {name.toUpperCase()}
          </Text>

          {stats.length ? (
            <View style={[styles.statRow, { borderTopColor: colors.boardRaised }]}>
              {stats.map((stat) => (
                <View key={stat.label} style={styles.stat}>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.statValue, { color: colors.boardRule }]}>
                    {stat.value}
                  </Text>
                  <Text style={[styles.statLabel, { color: colors.boardMuted }]}>{stat.label.toUpperCase()}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {profile?.wikipediaUrl || profile?.bioPage ? (
            <View style={styles.links}>
              {profile.wikipediaUrl ? (
                <Pressable onPress={() => void Linking.openURL(profile.wikipediaUrl as string)} accessibilityRole="link">
                  <Text style={[styles.link, { color: colors.boardMuted }]}>WIKIPEDIA</Text>
                </Pressable>
              ) : null}
              {profile?.bioPage ? (
                <Pressable onPress={() => void Linking.openURL(profile.bioPage as string)} accessibilityRole="link">
                  <Text style={[styles.link, { color: colors.boardMuted }]}>SNOOKER.ORG BIO</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </BoardPanel>

        <View style={[styles.photoWrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.background }]}>
          {profile?.photo ? (
            <Image source={{ uri: profile.photo }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          ) : (
            <MaterialCommunityIcons name="account" size={44} color={colors.textMuted} />
          )}
        </View>
      </View>

      {[
        { title: "LIVE NOW", data: live },
        { title: "UPCOMING", data: upcoming.slice(0, 10) },
        { title: "RECENT RESULTS", data: finished.slice(0, 10) },
      ]
        .filter((section) => section.data.length > 0)
        .map((section) => (
          <View key={section.title} style={styles.section}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
              {section.title}
            </Text>
            <View style={[styles.matchList, { backgroundColor: colors.board }]}>
              {section.data.map((match) => (
                <ProTourMatchRow key={match.id} match={match} players={players} roundNames={roundNames} />
              ))}
            </View>
          </View>
        ))}

      {!playerMatches.length ? (
        <Text style={[styles.note, { color: colors.textMuted }]}>No cached tour matches for this player yet.</Text>
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { paddingHorizontal: SPACING.lg, paddingTop: PHOTO_SIZE / 2 + SPACING.sm, paddingBottom: SPACING.xl * 2, gap: SPACING.lg },
  heroWrap: { alignItems: "center" },
  hero: { width: "100%", alignItems: "center", paddingTop: PHOTO_SIZE / 2 + SPACING.sm },
  photoWrap: {
    position: "absolute",
    top: -PHOTO_SIZE / 2,
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: PHOTO_SIZE / 2,
    borderWidth: 3,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  name: { fontFamily: FONTS.boardHeavy, fontSize: 24, letterSpacing: 1, textAlign: "center", marginBottom: SPACING.md },
  statRow: { flexDirection: "row", justifyContent: "space-around", width: "100%", paddingTop: SPACING.md, borderTopWidth: 1 },
  stat: { alignItems: "center", gap: 2 },
  statValue: { fontFamily: FONTS.board, fontSize: 22, fontVariant: ["tabular-nums"] },
  statLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  links: { flexDirection: "row", justifyContent: "center", gap: SPACING.lg, marginTop: SPACING.md },
  link: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 0.8 },
  section: { gap: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  matchList: { gap: 1, borderRadius: 6, overflow: "hidden" },
  note: { fontSize: 13, textAlign: "center" },
});
