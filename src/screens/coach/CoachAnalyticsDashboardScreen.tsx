import React, { useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { nameOf } from "../../features/community/types";
import { clientsOf, coachStats, type CoachBooking } from "../../features/coach/types";
import { countByDay, lastDays, thisWeek } from "../../features/stats/activity";
import { WeekTrack } from "../../components/stats/WeekTrack";
import { RhythmBars } from "../../components/stats/RhythmBars";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const PAGES = [
  { key: "week", label: "This week" },
  { key: "clients", label: "Clients" },
  { key: "recent", label: "Recent" },
] as const;
type PageKey = (typeof PAGES)[number]["key"];

const RHYTHM_FROM = 320;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * A coach's own broader picture, kept apart from Agenda (requests and what's coming up): trends
 * over the week and month, who they see the most, and what happened in recent sessions - the same
 * "hero, numbers, swipeable pages" shape as the player's Home tab, reskinned for coaching. A
 * banner surfaces anything waiting so a coach checking trends doesn't miss it, but the actual
 * accept/decline/reschedule actions stay on Agenda rather than being duplicated here.
 */
export const CoachAnalyticsDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { bookingsAsCoach, sessionNotes, sessionRoutines, loaded } = useCoachStore();
  const { profiles } = useCommunityStore();

  const [pager, setPager] = useState({ width: 0, height: 0 });
  const [page, setPage] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const [rhythmWidth, setRhythmWidth] = useState(0);
  const listRef = useRef<FlatList>(null);

  const playerName = (booking: CoachBooking) => booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]);
  const clientName = (client: { playerId: string | null; guestName: string | null }) =>
    client.playerId ? nameOf(profiles[client.playerId]) : client.guestName ?? "Guest";

  const pendingCount = useMemo(
    () => bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach").length,
    [bookingsAsCoach]
  );

  const data = useMemo(() => {
    const accepted = bookingsAsCoach.filter((booking) => booking.status === "accepted");
    const now = new Date();
    const dayKeys = accepted.map((booking) => new Date(booking.startsAt).toISOString().slice(0, 10));
    const counts = countByDay(dayKeys);
    const clients = clientsOf(bookingsAsCoach);
    const next = accepted
      .filter((booking) => new Date(booking.endsAt) > now)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    const recent = accepted
      .filter((booking) => new Date(booking.endsAt) <= now)
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
      .slice(0, 12);
    return { ...coachStats(bookingsAsCoach, now), week: thisWeek(counts, now), month: lastDays(counts, 28, now), clients, next, recent };
  }, [bookingsAsCoach]);

  const goTo = (index: number) => {
    setPage(index);
    listRef.current?.scrollToOffset({ offset: index * pager.width, animated: true });
  };

  const fit = (rowHeight: number) => Math.max(2, Math.floor((pager.height + SPACING.sm) / (rowHeight + SPACING.sm)));

  const openClient = (clientId: string, clientName: string) =>
    navigation.getParent()?.navigate("CoachClients", { screen: "ClientDetail", params: { clientId, clientName } });
  const openSession = (bookingId: string) => navigation.getParent()?.navigate("LiveSession", { bookingId });

  const weekPage = () => (
    <View style={styles.pageGap}>
      <View style={[styles.board, { backgroundColor: colors.board, borderColor: colors.boardRaised }]}>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
          SESSIONS THIS WEEK
        </Text>
        <View onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}>
          {railWidth ? <WeekTrack days={data.week} width={railWidth} /> : null}
        </View>
      </View>
      {pager.height >= RHYTHM_FROM ? (
        <View style={[styles.rhythm, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.textMuted }]}>LAST 4 WEEKS</Text>
          <View onLayout={(event) => setRhythmWidth(event.nativeEvent.layout.width)}>
            {rhythmWidth ? <RhythmBars days={data.month} width={rhythmWidth} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );

  const clientsPage = () =>
    data.clients.length === 0 ? (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Clients you've had a session with show up here.</Text>
      </View>
    ) : (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {data.clients.slice(0, fit(56)).map((client, index) => (
          <Pressable
            key={client.key}
            onPress={() => openClient(client.key, clientName(client))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.recent,
              { height: 56, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
              index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
            ]}
          >
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                {clientName(client)}
              </Text>
              <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                {client.sessions} session{client.sessions === 1 ? "" : "s"}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        ))}
      </View>
    );

  const recentPage = () =>
    data.recent.length === 0 ? (
      <View style={[styles.empty, { borderColor: colors.border }]}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>Sessions you've run show up here once they're done.</Text>
      </View>
    ) : (
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {data.recent.slice(0, fit(56)).map((booking, index) => {
          const hasRecord = Boolean(sessionNotes[booking.id]?.trim() || sessionRoutines[booking.id]?.length);
          return (
            <Pressable
              key={booking.id}
              onPress={() => openSession(booking.id)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.recent,
                { height: 56, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null,
              ]}
            >
              {hasRecord ? <MaterialCommunityIcons name="note-text-outline" size={16} color={colors.primary} /> : null}
              <View style={styles.rowText}>
                <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                  {playerName(booking)}
                </Text>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                  {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
            </Pressable>
          );
        })}
      </View>
    );

  const renderPage = (key: PageKey) => (key === "week" ? weekPage() : key === "clients" ? clientsPage() : recentPage());

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingBottom: insets.bottom }]}>
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
          {data.next ? "NEXT SESSION" : "NOTHING BOOKED"}
        </Text>
        <Text
          maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
          style={[styles.heroTitle, { color: colors.boardText }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {data.next ? playerName(data.next) : "Open a slot to get booked"}
        </Text>
        {data.next ? (
          <Text style={[styles.heroSubtitle, { color: colors.boardMuted }]}>
            {formatDay(data.next.startsAt)} · {formatTime(data.next.startsAt)}
          </Text>
        ) : null}
      </View>

      {pendingCount ? (
        <Pressable
          onPress={() => navigation.navigate("CoachToday")}
          accessibilityRole="button"
          accessibilityLabel={`${pendingCount} request${pendingCount === 1 ? "" : "s"} waiting on you - review in Agenda`}
          style={[styles.requestsBanner, { backgroundColor: colors.surface, borderColor: colors.primary }]}
        >
          <MaterialCommunityIcons name="calendar-alert-outline" size={20} color={colors.primary} />
          <Text style={[styles.requestsBannerText, { color: colors.text }]}>
            {pendingCount} request{pendingCount === 1 ? "" : "s"} waiting on you
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
        </Pressable>
      ) : null}

      <View style={[styles.numbers, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.cell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.text }]}>
            {data.sessionsToday}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            TODAY
          </Text>
        </View>
        <View style={[styles.cellRule, { backgroundColor: colors.border }]} />
        <View style={styles.cell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.text }]}>
            {data.sessionsThisMonth}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            THIS MONTH
          </Text>
        </View>
        <View style={[styles.cellRule, { backgroundColor: colors.border }]} />
        <View style={styles.cell}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.text }]}>
            {data.clients.length}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.textMuted }]}>
            CLIENTS
          </Text>
        </View>
      </View>

      <View style={styles.tabs} accessibilityRole="tablist">
        {PAGES.map((item, index) => {
          const selected = index === page;
          return (
            <Pressable
              key={item.key}
              onPress={() => goTo(index)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.tab, selected ? { borderBottomColor: colors.boardRule } : null]}
            >
              <Text
                maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                style={[styles.tabText, { color: selected ? colors.text : colors.textMuted }]}
                numberOfLines={1}
              >
                {item.label.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View
        style={styles.pager}
        onLayout={(event) => setPager({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      >
        {pager.width ? (
          <FlatList
            ref={listRef}
            horizontal
            pagingEnabled
            data={PAGES as unknown as Array<(typeof PAGES)[number]>}
            keyExtractor={(item) => item.key}
            showsHorizontalScrollIndicator={false}
            extraData={[data, railWidth, rhythmWidth, pager.height]}
            getItemLayout={(_, index) => ({ length: pager.width, offset: pager.width * index, index })}
            onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / pager.width))}
            renderItem={({ item }) => <View style={{ width: pager.width, height: pager.height }}>{renderPage(item.key)}</View>}
          />
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  screen: { flex: 1, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.3 },
  label: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.2, marginBottom: 6 },
  hero: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  requestsBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: HIT_TARGET,
  },
  requestsBannerText: { flex: 1, fontSize: 15, fontWeight: "700" },
  heroTitle: { fontFamily: FONTS.boardHeavy, fontSize: 30, lineHeight: 34, letterSpacing: 0.3 },
  heroSubtitle: { fontSize: 14, marginTop: 2 },
  numbers: { flexDirection: "row", alignItems: "stretch", borderWidth: 1, borderRadius: RADIUS.lg },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4, paddingVertical: SPACING.sm, minHeight: 64 },
  cellRule: { width: StyleSheet.hairlineWidth, marginVertical: SPACING.sm },
  cellValue: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 28 },
  cellLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  tabs: { flexDirection: "row", gap: SPACING.md },
  tab: { paddingVertical: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontFamily: FONTS.board, fontSize: 14, letterSpacing: 1 },
  pager: { flex: 1, overflow: "hidden" },
  pageGap: { gap: SPACING.sm },
  board: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  rhythm: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  recent: { flexDirection: "row", alignItems: "center", gap: SPACING.md, paddingHorizontal: SPACING.md },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: RADIUS.lg, padding: SPACING.lg },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
});
