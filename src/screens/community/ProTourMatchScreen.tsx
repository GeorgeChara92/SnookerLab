import React, { useEffect, useMemo } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useProTourStore, subscribeProTourLive } from "../../store/proTourStore";
import {
  dayLabel,
  formatTime,
  headToHead,
  kickoff,
  matchStatus,
  parseFrameScores,
  playerName,
  roundInfo,
  roundTitle,
  seasonRecord,
  sessionTimesKnown,
  sessionsLabel,
  sideUndecided,
  streamName,
  tournamentKey,
  tournamentName,
  type ProTourMatch,
  type SeasonRecord,
} from "../../features/tour/liveScores";
import { LiveDot, PlayerAvatar, SectionTitle, playerPhotoUrl } from "../../components/tour/ProTourUI";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";
/** One match: the scoreboard, where to watch, frame by frame, the head-to-head and both players' form. */
export const ProTourMatchScreen = () => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { matchId } = useRoute<RouteProp<CommunityStackParamList, "ProTourMatch">>().params;
  const { matchDetails, matches, events, rounds, players, playerProfiles, photos, playerMatches, loadPlayer } = useProTourStore(
    useShallow((state) => ({
      matchDetails: state.matchDetails,
      matches: state.matches,
      events: state.events,
      rounds: state.rounds,
      players: state.players,
      playerProfiles: state.playerProfiles,
      photos: state.photos,
      playerMatches: state.playerMatches,
      loadPlayer: state.loadPlayer,
    }))
  );
  useEffect(() => subscribeProTourLive(undefined, undefined, matchId), [matchId]);

  const detail = matchDetails[matchId];
  const match = detail?.match ?? matches.find((m) => m.id === matchId) ?? null;
  const p1 = match?.player1Id ?? null;
  const p2 = match?.player2Id ?? null;

  useEffect(() => {
    if (p1 && p2 && p1 !== p2) {
      void loadPlayer(p1);
      void loadPlayer(p2);
    }
  }, [p1, p2, loadPlayer]);

  const seasonEvents = useMemo(() => {
    const season = match ? events[match.eventId]?.season : null;
    if (season == null) return undefined;
    return new Set(Object.values(events).filter((e) => e.season === season).map((e) => e.id));
  }, [match, events]);

  if (!match) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        {detail ? <Text style={{ color: colors.textMuted }}>This match isn't available any more.</Text> : <ActivityIndicator color={colors.primary} />}
      </View>
    );
  }

  const status = matchStatus(match);
  const info = roundInfo(rounds, match.eventId, match.round);
  const tid = tournamentKey(events[match.eventId], match.eventId);
  const tournament = tournamentName(events, tid, match.eventId);
  const round = roundTitle(info, match.round);
  const k = kickoff(match, sessionTimesKnown([match]));
  const when = k ? `${dayLabel(k.dayKey)}${k.timeKnown ? ` · ${formatTime(k.date)}` : " · time to be confirmed"}` : null;
  const sessions = match.laterSessions.length && match.scheduledAt ? sessionsLabel(new Date(match.scheduledAt), match.laterSessions) : null;
  const frames = parseFrameScores(match.frameScores);
  const decided = !sideUndecided(match, 1, players) && !sideUndecided(match, 2, players);
  const h2h = decided && detail?.h2h ? headToHead(detail.h2h, p1 as number) : null;
  const link = match.liveUrl || match.detailsUrl;

  const side = (id: number | null, score: number, otherScore: number, n: 1 | 2) => {
    const open = !sideUndecided(match, n, players);
    const name = open ? playerName(players, id) : "To be decided";
    const won = status === "finished" && match.winnerId === id;
    const lost = status === "finished" && !won;
    const ahead = status === "live" && score > otherScore;
    return (
      <View style={styles.sideRow}>
        <Pressable
          style={styles.sideWho}
          disabled={!open || id == null}
          onPress={() => id != null && navigation.navigate("ProTourPlayer", { playerId: id })}
          accessibilityRole={open ? "button" : undefined}
        >
          <PlayerAvatar name={name} photo={open ? playerPhotoUrl(photos, playerProfiles, id) : null} size={48} ring={won || ahead ? colors.boardRule : undefined} />
          <View style={{ flex: 1 }}>
            <Text numberOfLines={2} style={[styles.sideName, { color: lost || !open ? colors.boardMuted : colors.boardText }]}>
              {name}
            </Text>
            {open && id != null && playerProfiles[id]?.nationality ? (
              <Text style={[styles.sideSub, { color: colors.boardMuted }]}>{playerProfiles[id]?.nationality}</Text>
            ) : null}
          </View>
        </Pressable>
        {status !== "upcoming" ? (
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sideScore, { color: lost ? colors.boardMuted : colors.boardText }]}>
            {score}
          </Text>
        ) : null}
      </View>
    );
  };

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <View style={[styles.board, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <Pressable onPress={() => navigation.navigate("ProTourTournament", { tournamentId: tid })} accessibilityRole="button" style={styles.boardHead}>
          <Text numberOfLines={1} style={[styles.boardEvent, { color: colors.boardMuted }]}>
            {tournament} · {round}
            {info?.bestOf ? ` · Best of ${info.bestOf}` : ""}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.boardMuted} />
        </Pressable>
        <View style={styles.statusRow}>
          {status === "live" ? (
            <View style={[styles.livePill, { backgroundColor: colors.danger }]}>
              <Text style={styles.livePillText}>{match.onBreak ? "INTERVAL" : "LIVE"}</Text>
            </View>
          ) : (
            <Text style={[styles.statusText, { color: status === "finished" ? colors.boardRule : colors.boardText }]}>
              {status === "finished" ? "RESULT" : when ?? "Time to be confirmed"}
            </Text>
          )}
          {sessions && status !== "finished" ? <Text style={[styles.sessions, { color: colors.boardMuted }]}>Sessions {sessions}</Text> : null}
        </View>
        {side(p1, match.score1, match.score2, 1)}
        <View style={[styles.boardRule, { backgroundColor: colors.boardRaised }]} />
        {side(p2, match.score2, match.score1, 2)}
        {match.videoUrl || link ? (
          <View style={styles.actions}>
            {match.videoUrl ? (
              <Pressable onPress={() => void Linking.openURL(match.videoUrl as string)} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="link">
                <MaterialCommunityIcons name="play" size={18} color={colors.onPrimary} />
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Watch on {streamName(match.videoUrl)}</Text>
              </Pressable>
            ) : null}
            {link ? (
              <Pressable onPress={() => void Linking.openURL(link)} style={[styles.ghostButton, { borderColor: colors.boardRule }]} accessibilityRole="link">
                <MaterialCommunityIcons name="chart-box-outline" size={16} color={colors.boardText} />
                <Text style={[styles.ghostText, { color: colors.boardText }]}>WST match centre</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {frames.length ? (
        <View style={styles.block}>
          <SectionTitle title="Frame by frame" />
          {frames.map((session, si) => (
            <View key={si} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {session.label ? <Text style={[styles.cardKicker, { color: colors.textMuted }]}>{session.label.toUpperCase()}</Text> : null}
              <View style={styles.frames}>
                {session.frames.map((f, fi) => {
                  const firstWon = f.p1 > f.p2;
                  return (
                    <View key={fi} style={[styles.frame, { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={[styles.frameScore, { color: colors.text }]}>
                        <Text style={{ color: firstWon ? colors.primary : colors.textMuted }}>{f.p1}</Text>
                        <Text style={{ color: colors.textSubtle }}>–</Text>
                        <Text style={{ color: firstWon ? colors.textMuted : colors.primary }}>{f.p2}</Text>
                      </Text>
                      {f.breaks ? <Text numberOfLines={1} style={[styles.frameBreak, { color: colors.textSubtle }]}>{f.breaks}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {decided ? (
        <View style={styles.block}>
          <SectionTitle title="Head to head" />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {!h2h ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>{detail ? "Their head-to-head record is on its way." : "Loading..."}</Text>
            ) : !h2h.meetings.length ? (
              <Text style={[styles.muted, { color: colors.textMuted }]}>First meeting on the tour.</Text>
            ) : (
              <>
                <View style={styles.h2hTop}>
                  <Text style={[styles.h2hName, { color: colors.text }]} numberOfLines={1}>{playerName(players, p1)}</Text>
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.h2hScore, { color: colors.text }]}>
                    {h2h.winsA}–{h2h.winsB}
                  </Text>
                  <Text style={[styles.h2hName, styles.right, { color: colors.text }]} numberOfLines={1}>{playerName(players, p2)}</Text>
                </View>
                <View style={[styles.h2hBar, { backgroundColor: colors.surfaceMuted }]}>
                  <View style={{ flex: Math.max(h2h.winsA, 0.001), backgroundColor: colors.primary }} />
                  <View style={{ flex: Math.max(h2h.winsB, 0.001), backgroundColor: colors.accent }} />
                </View>
                {h2h.meetings.slice(0, 6).map((m, i) => (
                  <View key={i} style={[styles.meeting, { borderTopColor: colors.border }]}>
                    <Text style={[styles.meetingWhen, { color: colors.textMuted }]} numberOfLines={1}>
                      {[m.date ? new Date(m.date).getFullYear() : null, events[m.eventId]?.name].filter(Boolean).join(" · ") || "Earlier meeting"}
                    </Text>
                    <Text style={[styles.meetingScore, { color: colors.text }]}>
                      <Text style={{ color: m.winnerId === p1 ? colors.primary : colors.textMuted }}>{m.scoreA}</Text>–
                      <Text style={{ color: m.winnerId === p2 ? colors.accent : colors.textMuted }}>{m.scoreB}</Text>
                    </Text>
                  </View>
                ))}
              </>
            )}
          </View>
        </View>
      ) : null}

      {decided ? (
        <View style={styles.block}>
          <SectionTitle title="Form this season" />
          <View style={styles.formRow}>
            {[p1, p2].map((id) => (
              <FormCard
                key={id as number}
                name={playerName(players, id)}
                record={seasonRecord(playerMatches[id as number] ?? [], id as number, seasonEvents)}
                onPress={() => id != null && navigation.navigate("ProTourPlayer", { playerId: id })}
              />
            ))}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
};

/** A player's season in a glance: won-lost, frames and the last five results. */
export const FormCard = ({ name, record, onPress }: { name: string; record: SeasonRecord; onPress?: () => void }) => {
  const { colors } = useAppTheme();
  const played = record.won + record.lost;
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={[styles.formCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.formName, { color: colors.text }]}>{name}</Text>
      {played ? (
        <>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.formRecord, { color: colors.text }]}>
            {record.won}–{record.lost}
          </Text>
          <Text style={[styles.formSub, { color: colors.textMuted }]}>
            {Math.round((record.won / played) * 100)}% won · frames {record.framesWon}–{record.framesLost}
          </Text>
          <View style={styles.formDots}>
            {record.form.map((r, i) => (
              <View key={i} style={[styles.formDot, { backgroundColor: r === "W" ? colors.primary : colors.danger }]}>
                <Text style={styles.formDotText}>{r}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <Text style={[styles.formSub, { color: colors.textMuted }]}>No results yet this season.</Text>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl * 2, gap: SPACING.xl },
  board: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  boardHead: { flexDirection: "row", alignItems: "center", gap: 4 },
  boardEvent: { flex: 1, fontSize: 13, fontWeight: "700" },
  statusRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flexWrap: "wrap" },
  livePill: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 3 },
  livePillText: { color: "#fff", fontFamily: FONTS.board, fontSize: 12, letterSpacing: 1 },
  statusText: { fontFamily: FONTS.board, fontSize: 16, letterSpacing: 0.4 },
  sessions: { fontSize: 12, fontWeight: "700" },
  sideRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  sideWho: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.md },
  sideName: { fontSize: 19, fontWeight: "800", letterSpacing: -0.2 },
  sideSub: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  sideScore: { fontFamily: FONTS.boardHeavy, fontSize: 44, lineHeight: 48, fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "right" },
  boardRule: { height: 1 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  primaryButton: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: RADIUS.pill, paddingHorizontal: 16, minHeight: 40 },
  primaryText: { fontSize: 14, fontWeight: "800" },
  ghostButton: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 14, minHeight: 40 },
  ghostText: { fontSize: 14, fontWeight: "700" },
  block: { gap: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  cardKicker: { fontSize: 11, fontWeight: "800", letterSpacing: 0.6 },
  frames: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  frame: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 6, minWidth: 64, alignItems: "center" },
  frameScore: { fontFamily: FONTS.board, fontSize: 15, fontVariant: ["tabular-nums"] },
  frameBreak: { fontSize: 10, fontWeight: "600", marginTop: 1, maxWidth: 90 },
  muted: { fontSize: 14 },
  h2hTop: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  h2hName: { flex: 1, fontSize: 14, fontWeight: "700" },
  right: { textAlign: "right" },
  h2hScore: { fontFamily: FONTS.boardHeavy, fontSize: 28, fontVariant: ["tabular-nums"] },
  h2hBar: { flexDirection: "row", height: 6, borderRadius: 3, overflow: "hidden" },
  meeting: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: StyleSheet.hairlineWidth, paddingTop: SPACING.sm },
  meetingWhen: { flex: 1, fontSize: 13, fontWeight: "600" },
  meetingScore: { fontFamily: FONTS.board, fontSize: 16, fontVariant: ["tabular-nums"] },
  formRow: { flexDirection: "row", gap: SPACING.sm },
  formCard: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  formName: { fontSize: 14, fontWeight: "800" },
  formRecord: { fontFamily: FONTS.boardHeavy, fontSize: 26, fontVariant: ["tabular-nums"] },
  formSub: { fontSize: 12, fontWeight: "600" },
  formDots: { flexDirection: "row", gap: 4, marginTop: 4 },
  formDot: { width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  formDotText: { color: "#fff", fontSize: 10, fontWeight: "800" },
});
