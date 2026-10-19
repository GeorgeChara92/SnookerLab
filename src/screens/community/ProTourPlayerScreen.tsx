import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRoute, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import {
  formatMoney,
  formatTime,
  groupMatches,
  kickoff,
  dayLabel,
  roundInfo,
  roundTitle,
  seasonRecord,
  sessionTimesKnown,
  tournamentKey,
  tournamentName,
  type ProTourMatch,
} from "../../features/tour/liveScores";
import { FixtureRow, LiveMatchCard, PlayerAvatar, SectionTitle, playerPhotoUrl } from "../../components/tour/ProTourUI";
import { FormCard } from "./ProTourMatchScreen";
import { useProTourFollowStore } from "../../store/proTourFollowStore";
import { useProTourBioStore } from "../../store/proTourBioStore";
import { useAuthStore } from "../../store/authStore";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
const formatBorn = (iso: string | null) => {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" });
};

/** A professional player: their bio and ranking, then live, upcoming and recent matches. */
export const ProTourPlayerScreen = () => {
  const { colors } = useAppTheme();
  const { playerId } = useRoute<RouteProp<CommunityStackParamList, "ProTourPlayer">>().params;
  const { matches, playerMatches, players, playerProfiles, photos, rankingsBySeason, events, rounds } = useProTourStore(
    useShallow((state) => ({
      matches: state.matches,
      playerMatches: state.playerMatches,
      players: state.players,
      playerProfiles: state.playerProfiles,
      photos: state.photos,
      rankingsBySeason: state.rankingsBySeason,
      events: state.events,
      rounds: state.rounds,
    }))
  );
  useFocusEffect(useCallback(() => subscribeProTourLive(undefined, playerId), [playerId]));
  const following = useProTourFollowStore((state) => state.ids.includes(playerId));
  const toggleFollow = useProTourFollowStore((state) => state.toggle);
  const signedIn = useAuthStore((state) => !!state.user);
  const [followNote, setFollowNote] = useState<string | null>(null);
  const bio = useProTourBioStore((state) => state.bios[playerId]);
  const loadBio = useProTourBioStore((state) => state.load);
  const [bioOpen, setBioOpen] = useState(false);
  const onFollow = async () => {
    const result = await toggleFollow(playerId);
    setFollowNote(
      !result.following
        ? null
        : !signedIn
          ? "Pinned to the top of Live & results. Sign in to get a notification when their matches start and finish."
          : result.notifications
            ? "You'll get a notification when their matches start and finish."
            : "Pinned to the top of Live & results. Turn on notifications in Settings to hear when their matches start."
    );
  };

  const profile = playerProfiles[playerId];
  const name = profile?.name ?? players[playerId] ?? "Player";
  useEffect(() => {
    if (profile) void loadBio(playerId, profile.name, profile.wikipediaUrl ?? null);
  }, [playerId, profile, loadBio]);
  const born = formatBorn(profile?.born ?? null);

  const ranking = useMemo(() => {
    const seasons = Object.keys(rankingsBySeason).map(Number);
    if (!seasons.length) return null;
    return rankingsBySeason[Math.max(...seasons)]?.find((row) => row.playerId === playerId) ?? null;
  }, [rankingsBySeason, playerId]);

  const mine = useMemo(() => {
    const byId = new Map<number, ProTourMatch>();
    for (const m of playerMatches[playerId] ?? []) byId.set(m.id, m);
    for (const m of matches) if (m.player1Id === playerId || m.player2Id === playerId) byId.set(m.id, m);
    return [...byId.values()];
  }, [matches, playerMatches, playerId]);
  const { live, upcoming, finished } = groupMatches(mine);
  const timesKnown = useMemo(() => sessionTimesKnown(mine), [mine]);

  const context = (m: ProTourMatch) => {
    const t = tournamentName(events, tournamentKey(events[m.eventId], m.eventId), m.eventId);
    const r = roundTitle(roundInfo(rounds, m.eventId, m.round), m.round);
    const k = kickoff(m, timesKnown);
    const when = k ? `${dayLabel(k.dayKey)}${k.timeKnown ? ` · ${formatTime(k.date)}` : ""}` : "";
    return [t, r, when].filter(Boolean).join(" · ");
  };

  // This season: the season of the most recent event that has started.
  const season = useMemo(() => {
    const now = Date.now();
    const started = Object.values(events).filter((e) => e.season != null && e.startDate && new Date(e.startDate).getTime() <= now);
    if (!started.length) return null;
    return Math.max(...started.map((e) => e.season as number));
  }, [events]);
  const record = useMemo(() => {
    if (season == null) return null;
    const ids = new Set(Object.values(events).filter((e) => e.season === season).map((e) => e.id));
    return seasonRecord(mine, playerId, ids);
  }, [mine, playerId, events, season]);

  const stats = [
    ranking ? { label: "Ranking", value: `#${ranking.position}` } : null,
    ranking?.sum != null ? { label: "Prize money", value: formatMoney(ranking.sum) } : null,
    profile?.numRankingTitles != null ? { label: "Ranking titles", value: String(profile.numRankingTitles) } : null,
    profile?.numMaximums != null ? { label: "147s", value: String(profile.numMaximums) } : null,
    profile?.firstSeasonAsPro ? { label: "Pro since", value: String(profile.firstSeasonAsPro) } : null,
  ].filter((stat): stat is { label: string; value: string } => stat !== null);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <PlayerAvatar name={name} photo={playerPhotoUrl(photos, playerProfiles, playerId)} size={112} ring={colors.boardRule} />
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.name, { color: colors.boardText }]}>
          {name}
        </Text>
        {profile?.nationality || born ? (
          <Text style={[styles.sub, { color: colors.boardMuted }]}>{[profile?.nationality, born ? `Born ${born}` : null].filter(Boolean).join(" · ")}</Text>
        ) : null}
        <Pressable
          onPress={() => void onFollow()}
          accessibilityRole="button"
          accessibilityState={{ selected: following }}
          style={[styles.follow, following ? { backgroundColor: colors.boardRaised, borderColor: colors.boardRule } : { backgroundColor: colors.boardRule, borderColor: colors.boardRule }]}
        >
          <MaterialCommunityIcons name={following ? "bell-check" : "bell-plus-outline"} size={16} color={following ? colors.boardRule : colors.board} />
          <Text style={[styles.followText, { color: following ? colors.boardRule : colors.board }]}>{following ? "Following" : "Follow"}</Text>
        </Pressable>
        {followNote && following ? <Text style={[styles.followNote, { color: colors.boardMuted }]}>{followNote}</Text> : null}
        {stats.length ? (
          <View style={[styles.stats, { borderTopColor: colors.boardRaised }]}>
            {stats.slice(0, 4).map((stat) => (
              <View key={stat.label} style={styles.stat}>
                <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} numberOfLines={1} style={[styles.statValue, { color: colors.boardText }]}>
                  {stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: colors.boardMuted }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {profile?.wikipediaUrl || profile?.bioPage ? (
          <View style={styles.links}>
            {profile.wikipediaUrl ? <LinkChip label="Wikipedia" url={profile.wikipediaUrl} /> : null}
            {profile.bioPage ? <LinkChip label="Full profile" url={profile.bioPage} /> : null}
          </View>
        ) : null}
      </View>

      {photos[playerId] ? (
        <Pressable
          disabled={!photos[playerId].sourceUrl}
          onPress={() => void Linking.openURL(photos[playerId].sourceUrl as string)}
          accessibilityRole="link"
          style={{ marginTop: -SPACING.lg }}
        >
          <Text style={[styles.credit, { color: colors.textSubtle }]}>
            Photo: {[photos[playerId].credit, photos[playerId].license].filter(Boolean).join(", ")}, via Wikimedia Commons
          </Text>
        </Pressable>
      ) : null}

      {bio ? (
        <View style={styles.block}>
          <SectionTitle title="About" />
          <View style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.bioText, { color: colors.text }]} numberOfLines={bioOpen ? undefined : 5}>
              {bioOpen ? bio.text.replace(/\n/g, "\n\n") : bio.text.replace(/\n/g, " ")}
            </Text>
            <View style={styles.bioFoot}>
              <Pressable onPress={() => setBioOpen((open) => !open)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.bioMore, { color: colors.primary }]}>{bioOpen ? "Show less" : "Read more"}</Text>
              </Pressable>
              <Pressable onPress={() => void Linking.openURL(bio.url)} accessibilityRole="link" hitSlop={8} style={styles.bioCredit}>
                <Text style={[styles.credit, { color: colors.textSubtle }]}>From Wikipedia · CC BY-SA 4.0</Text>
                <MaterialCommunityIcons name="open-in-new" size={12} color={colors.textSubtle} />
              </Pressable>
            </View>
          </View>
        </View>
      ) : null}

      {record && record.won + record.lost > 0 && season != null ? (
        <View style={styles.block}>
          <SectionTitle title="This season" />
          <FormCard name={`${season}/${String((season + 1) % 100).padStart(2, "0")} season`} record={record} />
        </View>
      ) : null}

      {live.length ? (
        <View style={styles.block}>
          <SectionTitle title="Live now" />
          {live.map((m) => {
            const info = roundInfo(rounds, m.eventId, m.round);
            return (
              <LiveMatchCard
                key={m.id}
                match={m}
                players={players}
                tournament={tournamentName(events, tournamentKey(events[m.eventId], m.eventId), m.eventId)}
                round={roundTitle(info, m.round)}
                bestOf={info?.bestOf ?? null}
              />
            );
          })}
        </View>
      ) : null}

      {[
        { title: "Coming up", data: upcoming.slice(0, 8) },
        { title: "Recent results", data: finished.slice(0, 12) },
      ]
        .filter((section) => section.data.length)
        .map((section) => (
          <View key={section.title} style={styles.block}>
            <SectionTitle title={section.title} />
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {section.data.map((m, i) => (
                <FixtureRow key={m.id} match={m} players={players} context={context(m)} first={i === 0} />
              ))}
            </View>
          </View>
        ))}

      {!mine.length ? <Text style={[styles.note, { color: colors.textMuted }]}>No tour matches for this player yet.</Text> : null}
    </ScrollView>
  );
};

const LinkChip = ({ label, url }: { label: string; url: string }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable onPress={() => void Linking.openURL(url)} accessibilityRole="link" style={[styles.linkChip, { borderColor: colors.boardRule }]}>
      <Text style={[styles.linkText, { color: colors.boardText }]}>{label}</Text>
      <MaterialCommunityIcons name="open-in-new" size={13} color={colors.boardMuted} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2, gap: SPACING.xl },
  hero: { alignItems: "center", borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.sm },
  name: { fontSize: 26, fontWeight: "800", letterSpacing: -0.5, textAlign: "center", marginTop: SPACING.xs },
  sub: { fontSize: 13, fontWeight: "600", textAlign: "center" },
  stats: { flexDirection: "row", alignSelf: "stretch", justifyContent: "space-around", borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.sm },
  stat: { alignItems: "center", gap: 2, flex: 1 },
  statValue: { fontFamily: FONTS.board, fontSize: 20, fontVariant: ["tabular-nums"] },
  statLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase", textAlign: "center" },
  follow: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 16, minHeight: 36, marginTop: SPACING.xs },
  followText: { fontSize: 14, fontWeight: "800" },
  followNote: { fontSize: 12, fontWeight: "600", textAlign: "center", paddingHorizontal: SPACING.md },
  links: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  linkChip: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 32 },
  linkText: { fontSize: 13, fontWeight: "700" },
  block: { gap: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  note: { fontSize: 13, textAlign: "center" },
  credit: { fontSize: 11, textAlign: "center" },
  bioCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  bioText: { fontSize: 15, lineHeight: 22 },
  bioFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  bioMore: { fontSize: 14, fontWeight: "800" },
  bioCredit: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
});
