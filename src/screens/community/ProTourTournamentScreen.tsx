import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, LayoutAnimation, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import { ProTourFreshness } from "../../components/tour/ProTourFreshness";
import {
  dayLabel,
  drawRounds,
  formatDateRange,
  groupStageName,
  formatMoney,
  groupByDay,
  kickoff,
  longDayLabel,
  matchKey,
  matchStatus,
  playerName,
  prizeMoney,
  roundInfo,
  roundShortTitle,
  roundTitle,
  sessionTimesKnown,
  slotLabel,
  tournamentKey,
  tournamentName,
  tournamentStatus,
  type ProTourMatch,
} from "../../features/tour/liveScores";
import { ProTourBracket } from "../../components/tour/ProTourBracket";
import { useProTourFollowStore } from "../../store/proTourFollowStore";
import { FixtureRow, LiveMatchCard, Pill, SectionTitle, SessionBlock, playerPhotoUrl } from "../../components/tour/ProTourUI";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
/**
 * A tournament: where and when, who's defending it and what it pays, then its draw a round at a
 * time - each round's fixtures by day and session, in the device's own time zone.
 */
export const ProTourTournamentScreen = () => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { tournamentId } = useRoute<RouteProp<CommunityStackParamList, "ProTourTournament">>().params;
  const { events, players, playerProfiles, photos, rounds, tournaments, feed } = useProTourStore(
    useShallow((state) => ({
      feed: state.matches,
      events: state.events,
      players: state.players,
      playerProfiles: state.playerProfiles,
      photos: state.photos,
      rounds: state.rounds,
      tournaments: state.tournaments,
    }))
  );
  const following = useProTourFollowStore((state) => state.ids);
  useFocusEffect(useCallback(() => subscribeProTourLive(tournamentId), [tournamentId]));

  const detail = tournaments[tournamentId];
  // Until the whole draw arrives, the tournament's matches already on the phone (the live feed: today,
  // the last few days and what's coming up) - so it opens on today's scores, not a spinner.
  const feedMatches = useMemo(
    () => (detail ? [] : feed.filter((m) => tournamentKey(events[m.eventId], m.eventId) === tournamentId)),
    [detail, feed, events, tournamentId]
  );
  const matches = detail?.matches ?? feedMatches;
  const event = events[tournamentId] ?? events[matches[0]?.eventId];
  const name = tournamentName(events, tournamentId, matches[0]?.eventId);
  const live = matches.filter((m) => matchStatus(m) === "live");
  const status = tournamentStatus(event, live.length > 0);

  const eventIds = useMemo(() => {
    const ids = new Set<number>([tournamentId]);
    for (const e of Object.values(events)) if (tournamentKey(e, e.id) === tournamentId) ids.add(e.id);
    for (const m of matches) ids.add(m.eventId);
    return ids;
  }, [events, matches, tournamentId]);

  // The draw, in playing order and with no gaps: see drawRounds.
  const roundList = useMemo(
    () =>
      drawRounds(matches, Object.values(rounds).filter((r) => eventIds.has(r.eventId)), tournamentId, (id) =>
        id === tournamentId ? null : groupStageName(events[id]?.name)
      ),
    [matches, rounds, eventIds, tournamentId, events]
  );
  // The main event's knockout rounds down to the final - what the bracket draws.
  const bracketRounds = useMemo(() => {
    const ko = roundList.filter((r) => r.eventId === tournamentId && r.numLeft != null);
    return ko.length >= 2 && ko[ko.length - 1].numLeft === 2 ? ko : [];
  }, [roundList, tournamentId]);
  const [view, setView] = useState<"fixtures" | "bracket">("fixtures");
  const showBracket = view === "bracket" && bracketRounds.length > 0;

  // "Winner of Xiao v Craigie" for a slot the draw links say who's coming through.
  const labelFor = useMemo(() => {
    const byKey = new Map(matches.map((m) => [matchKey(m.eventId, m.round, m.number), m]));
    const links = detail?.links ?? undefined;
    return (m: ProTourMatch, side: 1 | 2) => slotLabel(m, side, links, byKey, players);
  }, [matches, detail?.links, players]);

  const defaultKey = useMemo(() => {
    const withLive = roundList.find((r) => r.matches.some((m) => matchStatus(m) === "live"));
    const next = roundList.find((r) => r.matches.some((m) => matchStatus(m) === "upcoming" && !!m.player1Id && m.player1Id !== m.player2Id));
    const anyNext = roundList.find((r) => r.matches.some((m) => matchStatus(m) === "upcoming"));
    const last = [...roundList].reverse().find((r) => r.matches.length);
    return (withLive ?? next ?? anyNext ?? last ?? roundList[0])?.key ?? null;
  }, [roundList]);
  const [selected, setSelected] = useState<string | null>(null);
  const current = roundList.find((r) => r.key === (selected ?? defaultKey));
  const playedAlready = !!current && !current.matches.length && roundList.some((r) => r.round > current.round && r.matches.length > 0);
  const fixtures = useMemo(() => (current ? (current.matches.length ? current.matches : current.placeholders) : []), [current]);
  const days = useMemo(() => groupByDay(fixtures, events), [fixtures, events]);
  const undated = fixtures.filter((m) => !m.scheduledAt && matchStatus(m) !== "live");

  const prizes = useMemo(() => prizeMoney(Object.values(rounds).filter((r) => eventIds.has(r.eventId))), [rounds, eventIds]);
  const winnerPrize = prizes?.lines.find((line) => line.label === "Winner");
  const champion = event?.defendingChampionId ? playerName(players, event.defendingChampionId) : null;
  const place = [event?.venue, event?.city, event?.country].filter(Boolean).join(", ");
  const [prizeOpen, setPrizeOpen] = useState(false);

  // The organiser's own page: for an event scored on snookerscores.net (the Australian Women's
  // Open), the only place its live scores are - snooker.org's feed carries them as 0-0 until later.
  const officialLink = useMemo(() => {
    const urls = [...eventIds].map((id) => events[id]?.url).filter((url): url is string => !!url);
    const scoreboard = urls.find((url) => /snookerscores\.net/i.test(url));
    if (scoreboard) return { url: scoreboard, label: status.tone === "live" ? "Live scores" : "Scoreboard", icon: "scoreboard-outline" as const };
    const own = event?.url || urls[0];
    return own ? { url: own, label: "Official site", icon: "open-in-new" as const } : null;
  }, [eventIds, events, event?.url, status.tone]);

  const roundDates = useMemo(() => {
    if (!current?.matches.length) return null;
    const known = sessionTimesKnown(current.matches);
    const keys = [...new Set(current.matches.map((m) => kickoff(m, known)?.dayKey).filter((k): k is string => !!k))].sort();
    if (!keys.length) return null;
    return keys.length === 1 ? dayLabel(keys[0]) : `${dayLabel(keys[0])} – ${dayLabel(keys[keys.length - 1])}`;
  }, [current]);
  const roundMatchCount = current?.info?.numMatches || current?.matches.length || current?.placeholders.length || 0;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <ProTourFreshness />
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <View style={styles.heroPills}>
          {event?.type ? <Pill label={`${event.type} event`.toUpperCase()} tone="accent" /> : null}
          {status.label ? <Pill label={status.label.toUpperCase()} tone={status.tone} /> : null}
        </View>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.heroName, { color: colors.boardText }]}>
          {name}
        </Text>
        <View style={styles.heroLines}>
          {event ? <HeroLine icon="calendar-blank-outline" text={formatDateRange(event.startDate, event.endDate) ?? ""} /> : null}
          {place ? <HeroLine icon="map-marker-outline" text={place} /> : null}
        </View>

        <View style={[styles.stats, { borderTopColor: colors.boardRaised }]}>
          <Stat value={event?.numCompetitors ? String(event.numCompetitors) : "–"} label="Players" />
          <Stat value={winnerPrize ? formatMoney(winnerPrize.amount, winnerPrize.currency) : "–"} label="Winner" accent={!!winnerPrize} />
          <Stat
            value={champion && champion !== "TBD" ? champion : "–"}
            label="Defending champion"
            onPress={event?.defendingChampionId ? () => navigation.navigate("ProTourPlayer", { playerId: event.defendingChampionId as number }) : undefined}
          />
        </View>

        {prizes ? (
          <View style={[styles.prizeBox, { borderTopColor: colors.boardRaised }]}>
            <Pressable
              onPress={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setPrizeOpen((open) => !open);
              }}
              accessibilityRole="button"
              accessibilityState={{ expanded: prizeOpen }}
              style={styles.prizeHead}
            >
              <MaterialCommunityIcons name="cash-multiple" size={18} color={colors.accent} />
              <Text style={[styles.prizeHeadLabel, { color: colors.boardText }]}>Prize fund</Text>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.prizeHeadValue, { color: colors.accent }]}>
                {formatMoney(prizes.total, prizes.currency)}
              </Text>
              <MaterialCommunityIcons name={prizeOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.boardMuted} />
            </Pressable>
            {prizeOpen ? (
              <View style={styles.prizeList}>
                {prizes.lines.map((line) => (
                  <View key={line.label} style={styles.prizeRow}>
                    <Text style={[styles.prizeLabel, { color: colors.boardMuted }]}>{line.label}</Text>
                    <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.prizeAmount, { color: colors.boardText }]}>
                      {formatMoney(line.amount, line.currency)}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {event?.sponsor || event?.wikipediaUrl || officialLink ? (
          <View style={styles.heroFoot}>
            {event?.sponsor ? <Text style={[styles.sponsor, { color: colors.boardMuted }]}>Sponsored by {event.sponsor}</Text> : <View />}
            <View style={styles.heroLinks}>
              {officialLink ? (
                <Pressable
                  onPress={() => void Linking.openURL(officialLink.url)}
                  accessibilityRole="link"
                  hitSlop={8}
                  style={[styles.wiki, officialLink.label === "Live scores" ? [styles.livePill, { backgroundColor: colors.danger }] : null]}
                >
                  <MaterialCommunityIcons
                    name={officialLink.icon}
                    size={13}
                    color={officialLink.label === "Live scores" ? "#fff" : colors.boardMuted}
                  />
                  <Text style={[styles.wikiText, { color: officialLink.label === "Live scores" ? "#fff" : colors.boardMuted }]}>{officialLink.label}</Text>
                </Pressable>
              ) : null}
              {event?.wikipediaUrl ? (
                <Pressable onPress={() => void Linking.openURL(event.wikipediaUrl as string)} accessibilityRole="link" hitSlop={8} style={styles.wiki}>
                  <Text style={[styles.wikiText, { color: colors.boardMuted }]}>Wikipedia</Text>
                  <MaterialCommunityIcons name="open-in-new" size={13} color={colors.boardMuted} />
                </Pressable>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>

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
                photoFor={(id) => playerPhotoUrl(photos, playerProfiles, id)}
                tournament={name}
                round={roundTitle(info, m.round)}
                bestOf={info?.bestOf ?? null}
              />
            );
          })}
        </View>
      ) : null}

      <View style={styles.block}>
        <View style={styles.drawHead}>
          <Text style={[styles.drawTitle, { color: colors.text }]}>Draw</Text>
          {bracketRounds.length ? (
            <View style={[styles.switch, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              {(["fixtures", "bracket"] as const).map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setView(v)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: view === v }}
                  style={[styles.switchItem, view === v && { backgroundColor: colors.primary }]}
                >
                  <MaterialCommunityIcons name={v === "fixtures" ? "format-list-bulleted" : "tournament"} size={14} color={view === v ? colors.onPrimary : colors.textMuted} />
                  <Text style={[styles.switchText, { color: view === v ? colors.onPrimary : colors.textMuted }]}>{v === "fixtures" ? "Fixtures" : "Bracket"}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
        {showBracket ? <ProTourBracket rounds={bracketRounds} links={detail?.links} players={players} following={following} /> : null}
        {!showBracket && roundList.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rounds}>
            {roundList.map((r) => {
              const on = r.key === current?.key;
              const hasLive = r.matches.some((m) => matchStatus(m) === "live");
              return (
                <Pressable
                  key={r.key}
                  onPress={() => setSelected(r.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={r.title}
                  style={[styles.roundPill, { backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.border }]}
                >
                  {hasLive ? <View style={[styles.liveDot, { backgroundColor: colors.danger }]} /> : null}
                  <Text style={[styles.roundPillText, { color: on ? colors.onPrimary : colors.text }]}>{roundShortTitle(r.title)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {!showBracket && current ? (
          <View style={[styles.roundSummary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.roundName, { color: colors.text }]}>{current.title}</Text>
            <View style={styles.roundFacts}>
              {current.info?.bestOf ? <Fact icon="numeric" text={`Best of ${current.info.bestOf}`} /> : null}
              {roundMatchCount ? <Fact icon="account-multiple-outline" text={`${roundMatchCount} ${roundMatchCount === 1 ? "match" : "matches"}`} /> : null}
              {roundDates ? <Fact icon="calendar-blank-outline" text={roundDates} /> : null}
              {current.info?.money ? (
                <Fact
                  icon="cash"
                  text={
                    current.info.numLeft === 2
                      ? `Runner-up ${formatMoney(current.info.money, current.info.currency ?? "GBP")}`
                      : `${formatMoney(current.info.money, current.info.currency ?? "GBP")} if knocked out`
                  }
                />
              ) : null}
            </View>
          </View>
        ) : null}

        {showBracket ? null : !detail && !matches.length ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.lg }} />
        ) : !roundList.length ? (
          <Empty icon="calendar-clock" title="No draw yet" note="Fixtures appear here as soon as snooker.org publishes the draw." />
        ) : playedAlready ? (
          <Empty icon="tournament" title="Results coming soon" note="This round has been played. Its results are being added." />
        ) : (
          <>
            {days.map((day) => (
              <View key={day.dayKey} style={styles.day}>
                <Text style={[styles.dayHeading, { color: colors.textMuted }]}>{longDayLabel(day.dayKey)}</Text>
                {day.tournaments.flatMap((t) =>
                  t.sessions.map((s) => (
                    <SessionBlock key={`${t.tournamentId}-${s.key}`} label={s.label} estimated={s.estimated} live={s.key === "live"}>
                      {s.matches.map((m, i) => (
                        <FixtureRow key={m.id} match={m} players={players} labelFor={labelFor} first={i === 0} />
                      ))}
                    </SessionBlock>
                  ))
                )}
              </View>
            ))}
            {undated.length ? (
              <SessionBlock label="Date to be confirmed">
                {undated.map((m, i) => (
                  <FixtureRow key={m.id} match={m} players={players} labelFor={labelFor} first={i === 0} />
                ))}
              </SessionBlock>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
};

const HeroLine = ({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; text: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.heroLine}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.boardMuted} />
      <Text style={[styles.heroLineText, { color: colors.boardMuted }]}>{text}</Text>
    </View>
  );
};

const Stat = ({ value, label, accent, onPress }: { value: string; label: string; accent?: boolean; onPress?: () => void }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable disabled={!onPress} onPress={onPress} style={styles.stat} accessibilityRole={onPress ? "button" : undefined}>
      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} numberOfLines={2} style={[styles.statValue, { color: accent ? colors.accent : colors.boardText }]}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.boardMuted }]}>{label}</Text>
    </Pressable>
  );
};

const Fact = ({ icon, text }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; text: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.fact}>
      <MaterialCommunityIcons name={icon} size={15} color={colors.primary} />
      <Text style={[styles.factText, { color: colors.textMuted }]}>{text}</Text>
    </View>
  );
};

const Empty = ({ icon, title, note }: { icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"]; title: string; note: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={26} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.note, { color: colors.textMuted }]}>{note}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2, gap: SPACING.xl },
  hero: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  heroPills: { flexDirection: "row", gap: SPACING.sm, flexWrap: "wrap" },
  heroName: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6, lineHeight: 32 },
  heroLines: { gap: 6 },
  heroLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  heroLineText: { fontSize: 14, fontWeight: "600", flexShrink: 1 },
  stats: { flexDirection: "row", gap: SPACING.md, borderTopWidth: 1, paddingTop: SPACING.md },
  stat: { flex: 1, gap: 2 },
  statValue: { fontFamily: FONTS.board, fontSize: 19 },
  statLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3, textTransform: "uppercase" },
  prizeBox: { borderTopWidth: 1, paddingTop: SPACING.md, gap: SPACING.sm },
  prizeHead: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: 32 },
  prizeHeadLabel: { flex: 1, fontSize: 15, fontWeight: "700" },
  prizeHeadValue: { fontFamily: FONTS.board, fontSize: 19, fontVariant: ["tabular-nums"] },
  prizeList: { gap: 8, paddingLeft: 26 },
  prizeRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  prizeLabel: { fontSize: 14, fontWeight: "600" },
  prizeAmount: { fontFamily: FONTS.board, fontSize: 16, fontVariant: ["tabular-nums"] },
  heroFoot: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sponsor: { fontSize: 12, fontWeight: "600" },
  wiki: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroLinks: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  livePill: { borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 4 },
  wikiText: { fontSize: 12, fontWeight: "700" },
  block: { gap: SPACING.md },
  drawHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.md },
  drawTitle: { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  switch: { flexDirection: "row", borderWidth: 1, borderRadius: RADIUS.pill, padding: 3 },
  switchItem: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 30 },
  switchText: { fontSize: 13, fontWeight: "700" },
  rounds: { gap: SPACING.sm, paddingRight: SPACING.lg },
  roundPill: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 38 },
  roundPillText: { fontSize: 14, fontWeight: "700" },
  liveDot: { width: 6, height: 6, borderRadius: 3 },
  roundSummary: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  roundName: { fontSize: 18, fontWeight: "800" },
  roundFacts: { flexDirection: "row", flexWrap: "wrap", columnGap: SPACING.md, rowGap: 6 },
  fact: { flexDirection: "row", alignItems: "center", gap: 5 },
  factText: { fontSize: 13, fontWeight: "600" },
  day: { gap: SPACING.md },
  dayHeading: { fontSize: 13, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  empty: { alignItems: "center", gap: SPACING.xs, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  note: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
