import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { showOnboardingIfDue } from "../../components/onboarding/OnboardingHost";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { nameOf } from "../../features/community/types";
import { startDirect } from "../../features/community/chat";
import { clientKeyOf, clientsOf, coachStats, isSessionLive, type CoachBooking, type CoachReview } from "../../features/coach/types";
import { fetchCoachReviews } from "../../features/coach/reviews";
import { countByDay, thisWeek } from "../../features/stats/activity";
import { WeekTrack } from "../../components/stats/WeekTrack";
import {
  ClientAvatar,
  FocusChips,
  SectionLabel,
  Tag,
  agoLabel,
  lastRecapOf,
  needsRecap,
  relativeDay,
  timeOf,
  untilLabel,
} from "../../components/coach/CoachUI";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

import { useShallow } from "zustand/react/shallow";

/** How far back an unwritten session still asks for its recap. */
const RECAP_WINDOW_DAYS = 21;

/**
 * A coach's day at a glance: who's next and what they worked on last time, today's sessions, the
 * week, the sessions still waiting for a write-up, the clients they see most and what clients say.
 * The accept/decline actions stay on Agenda; a banner here points there when something's waiting.
 */
export const CoachAnalyticsDashboardScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { bookingsAsCoach, sessionNotes, sessionRoutines, sessionRecaps, homework, loaded } = useCoachStore(
    useShallow((state) => ({
      bookingsAsCoach: state.bookingsAsCoach,
      sessionNotes: state.sessionNotes,
      sessionRoutines: state.sessionRoutines,
      sessionRecaps: state.sessionRecaps,
      homework: state.homework,
      loaded: state.loaded,
    })),
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const me = useAuthStore((state) => state.user?.id ?? null);
  const coachSubscribed = useAuthStore((state) => state.user?.coach_subscription_active ?? false);
  const [railWidth, setRailWidth] = useState(0);
  const [reviews, setReviews] = useState<CoachReview[]>([]);
  const [messaging, setMessaging] = useState(false);

  useFocusEffect(
    useCallback(() => {
      // The coach tour and "what's new for coaches" belong here, the moment coach view is open.
      const timer = setTimeout(() => showOnboardingIfDue("coach"), 500);
      if (me) void fetchCoachReviews(me).then(setReviews);
      return () => clearTimeout(timer);
    }, [me]),
  );

  const nameFor = (booking: Pick<CoachBooking, "playerId" | "guestName">) => booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]);

  const data = useMemo(() => {
    const now = new Date();
    const accepted = bookingsAsCoach.filter((booking) => booking.status === "accepted");
    const counts = countByDay(accepted.map((booking) => new Date(booking.startsAt).toISOString().slice(0, 10)));
    const week = thisWeek(counts, now);
    const upcoming = accepted.filter((booking) => new Date(booking.endsAt) > now).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const today = accepted
      .filter((booking) => new Date(booking.startsAt).toDateString() === now.toDateString())
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const unwritten = accepted
      .filter((booking) => {
        const ended = new Date(booking.endsAt);
        return ended <= now && now.getTime() - ended.getTime() < RECAP_WINDOW_DAYS * 86_400_000;
      })
      .filter((booking) => needsRecap(booking, sessionRecaps, sessionNotes, sessionRoutines))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt));
    return {
      ...coachStats(bookingsAsCoach, now),
      thisWeek: week.reduce((sum, day) => sum + day.count, 0),
      week,
      next: upcoming[0] ?? null,
      today,
      unwritten,
      clients: clientsOf(bookingsAsCoach),
      pending: bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach").length,
      waitingOnClients: bookingsAsCoach.filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "player")
        .length,
    };
  }, [bookingsAsCoach, sessionNotes, sessionRecaps, sessionRoutines]);

  const rating = reviews.length ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length : null;
  const latestReview = reviews.find((review) => review.body?.trim()) ?? null;

  const openSession = (bookingId: string) => navigation.getParent()?.navigate("LiveSession", { bookingId });
  const openClient = (clientKey: string, clientName: string) =>
    navigation.navigate("CoachClients", {
      screen: "ClientDetail",
      params: { clientId: clientKey, clientName },
    });
  const message = async (playerId: string) => {
    setMessaging(true);
    const result = await startDirect(playerId);
    setMessaging(false);
    if (result.ok)
      navigation.navigate("CoachChats", {
        screen: "Chat",
        params: { conversationId: result.value },
      });
  };

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const next = data.next;
  const nextLive = next ? isSessionLive(next) : false;
  const nextRecap = next ? lastRecapOf(clientKeyOf(next), bookingsAsCoach, sessionRecaps) : null;
  const nextHomework = next?.playerId ? homework.filter((item) => item.coachId === me && item.playerId === next.playerId).length : 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      {/* ---------------------------------------------------------------- up next */}
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <View style={styles.heroTop}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: nextLive ? colors.danger : colors.boardRule }]}>
            {next ? (nextLive ? "ON NOW" : "UP NEXT") : "NOTHING BOOKED"}
          </Text>
          {next && !nextLive ? (
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.countdown, { color: colors.boardText }]}>
              {untilLabel(next.startsAt).toUpperCase()}
            </Text>
          ) : null}
        </View>
        {next ? (
          <>
            <Pressable onPress={() => openClient(clientKeyOf(next), nameFor(next))} accessibilityRole="button" style={styles.heroWho}>
              <ClientAvatar profile={profiles[next.playerId ?? ""]} guest={!next.playerId} size={52} />
              <View style={styles.heroText}>
                <Text
                  maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                  style={[styles.heroName, { color: colors.boardText }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {nameFor(next)}
                </Text>
                <Text style={[styles.heroWhen, { color: colors.boardMuted }]} numberOfLines={1}>
                  {relativeDay(next.startsAt)} · {timeOf(next.startsAt)}–{timeOf(next.endsAt)}
                </Text>
              </View>
            </Pressable>
            {nextRecap ? (
              <View style={[styles.lastTime, { borderTopColor: colors.boardRaised }]}>
                <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.miniLabel, { color: colors.boardMuted }]}>
                  LAST TIME
                </Text>
                <FocusChips focus={nextRecap.focus} onBoard />
                {nextRecap.summary ? (
                  <Text style={[styles.lastSummary, { color: colors.boardText }]} numberOfLines={2}>
                    {nextRecap.summary}
                  </Text>
                ) : null}
              </View>
            ) : null}
            {nextHomework ? (
              <Text style={[styles.heroMeta, { color: colors.boardMuted }]}>
                {nextHomework} homework routine{nextHomework === 1 ? "" : "s"} set
              </Text>
            ) : null}
            <View style={styles.heroActions}>
              <Pressable
                onPress={() => openSession(next.id)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primaryButton,
                  {
                    backgroundColor: colors.primary,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons name="play" size={18} color={colors.onPrimary} />
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>{nextLive ? "Open session" : "Start session"}</Text>
              </Pressable>
              {next.playerId ? (
                <Pressable
                  onPress={() => message(next.playerId as string)}
                  disabled={messaging}
                  accessibilityRole="button"
                  accessibilityLabel={`Message ${nameFor(next)}`}
                  style={({ pressed }) => [
                    styles.ghostButton,
                    {
                      borderColor: colors.boardRule,
                      opacity: pressed ? 0.8 : 1,
                    },
                  ]}
                >
                  {messaging ? (
                    <ActivityIndicator size="small" color={colors.boardText} />
                  ) : (
                    <MaterialCommunityIcons name="chat-outline" size={18} color={colors.boardText} />
                  )}
                </Pressable>
              ) : null}
            </View>
          </>
        ) : (
          <Pressable onPress={() => navigation.navigate("CoachCalendar")} accessibilityRole="button" style={styles.heroEmpty}>
            <Text style={[styles.heroName, { color: colors.boardText }]}>Open a slot to get booked</Text>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.boardText} />
          </Pressable>
        )}
      </View>

      {/* ---------------------------------------------------------------- waiting on you */}
      {!coachSubscribed ? (
        <Banner
          icon="lock-outline"
          text="Subscribe to unlock your booking diary"
          onPress={() => navigation.getParent()?.navigate("ProfileModal", { screen: "CoachPlan" })}
        />
      ) : null}
      {data.pending ? (
        <Banner
          icon="calendar-alert-outline"
          text={`${data.pending} request${data.pending === 1 ? "" : "s"} waiting on you`}
          onPress={() => navigation.navigate("CoachToday")}
        />
      ) : null}

      {/* ---------------------------------------------------------------- the numbers */}
      <View style={[styles.numbers, { backgroundColor: colors.board, borderColor: colors.boardRaised }]}>
        {[
          { label: "TODAY", value: data.sessionsToday },
          { label: "THIS WEEK", value: data.thisWeek },
          { label: "THIS MONTH", value: data.sessionsThisMonth },
          { label: "CLIENTS", value: data.clients.length },
        ].map((cell, index) => (
          <React.Fragment key={cell.label}>
            {index ? <View style={[styles.cellRule, { backgroundColor: colors.boardRaised }]} /> : null}
            <View style={styles.cell}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellValue, { color: colors.boardText }]}>
                {cell.value}
              </Text>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.cellLabel, { color: colors.boardMuted }]} numberOfLines={1}>
                {cell.label}
              </Text>
            </View>
          </React.Fragment>
        ))}
      </View>

      {/* ---------------------------------------------------------------- today */}
      {data.today.length ? (
        <>
          <SectionLabel title="Today" count={data.today.length} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {data.today.map((booking, index) => {
              const live = isSessionLive(booking);
              const done = new Date(booking.endsAt) <= new Date();
              return (
                <Pressable
                  key={booking.id}
                  onPress={() => openSession(booking.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${timeOf(booking.startsAt)}, ${nameFor(booking)}${live ? ", on now" : done ? ", done" : ""}`}
                  style={({ pressed }) => [
                    styles.todayRow,
                    {
                      backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                    },
                    index
                      ? {
                          borderTopWidth: StyleSheet.hairlineWidth,
                          borderTopColor: colors.border,
                        }
                      : null,
                  ]}
                >
                  <Text
                    maxFontSizeMultiplier={DISPLAY_TEXT_SCALE}
                    style={[styles.todayTime, { color: done ? colors.textSubtle : colors.text }]}
                  >
                    {timeOf(booking.startsAt)}
                  </Text>
                  <ClientAvatar profile={profiles[booking.playerId ?? ""]} guest={!booking.playerId} size={32} />
                  <Text style={[styles.rowTitle, { color: done ? colors.textMuted : colors.text, flex: 1 }]} numberOfLines={1}>
                    {nameFor(booking)}
                  </Text>
                  {live ? <Tag label="ON NOW" tone="live" /> : done ? <Tag label="DONE" /> : null}
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------------- the week */}
      <SectionLabel title="This week" count={data.thisWeek} />
      <View style={[styles.board, { backgroundColor: colors.board, borderColor: colors.boardRaised }]}>
        <View onLayout={(event) => setRailWidth(event.nativeEvent.layout.width)}>
          {railWidth ? <WeekTrack days={data.week} width={railWidth} /> : null}
        </View>
      </View>

      {/* ---------------------------------------------------------------- write-ups */}
      {data.unwritten.length ? (
        <>
          <SectionLabel title="Needs a recap" count={data.unwritten.length} />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {data.unwritten.slice(0, 3).map((booking, index) => (
              <Pressable
                key={booking.id}
                onPress={() => openSession(booking.id)}
                accessibilityRole="button"
                accessibilityLabel={`Write the recap for ${nameFor(booking)}, ${relativeDay(booking.startsAt)}`}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                  },
                  index
                    ? {
                        borderTopWidth: StyleSheet.hairlineWidth,
                        borderTopColor: colors.border,
                      }
                    : null,
                ]}
              >
                <ClientAvatar profile={profiles[booking.playerId ?? ""]} guest={!booking.playerId} size={36} />
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                    {nameFor(booking)}
                  </Text>
                  <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                    {relativeDay(booking.startsAt)} · {agoLabel(booking.startsAt)}
                  </Text>
                </View>
                <View style={[styles.writeButton, { backgroundColor: colors.surfaceMuted }]}>
                  <MaterialCommunityIcons name="pencil-outline" size={14} color={colors.primary} />
                  <Text style={[styles.writeText, { color: colors.primary }]}>Recap</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------------- clients */}
      {data.clients.length ? (
        <>
          <SectionLabel
            title="Most sessions"
            action="All clients"
            onAction={() => navigation.navigate("CoachClients", { screen: "ClientsList" })}
          />
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {[...data.clients]
              .sort((a, b) => b.sessions - a.sessions)
              .slice(0, 3)
              .map((client, index) => {
                const name = client.playerId ? nameOf(profiles[client.playerId]) : (client.guestName ?? "Guest");
                const recap = lastRecapOf(client.key, bookingsAsCoach, sessionRecaps);
                return (
                  <Pressable
                    key={client.key}
                    onPress={() => openClient(client.key, name)}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.row,
                      {
                        backgroundColor: pressed ? colors.surfaceMuted : "transparent",
                      },
                      index
                        ? {
                            borderTopWidth: StyleSheet.hairlineWidth,
                            borderTopColor: colors.border,
                          }
                        : null,
                    ]}
                  >
                    <ClientAvatar profile={profiles[client.playerId ?? ""]} guest={!client.playerId} size={36} />
                    <View style={styles.rowText}>
                      <Text style={[styles.rowTitle, { color: colors.text }]} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {recap?.focus.length ? recap.focus.slice(0, 2).join(" · ") : `Last seen ${agoLabel(client.lastAt)}`}
                      </Text>
                    </View>
                    <View style={styles.count}>
                      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.countValue, { color: colors.text }]}>
                        {client.sessions}
                      </Text>
                      <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.countLabel, { color: colors.textMuted }]}>
                        SESSIONS
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
          </View>
        </>
      ) : null}

      {/* ---------------------------------------------------------------- reviews */}
      {rating != null ? (
        <>
          <SectionLabel title="What clients say" />
          <View style={[styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={styles.ratingRow}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.ratingValue, { color: colors.text }]}>
                {rating.toFixed(1)}
              </Text>
              <View style={styles.ratingSide}>
                <View style={styles.stars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <MaterialCommunityIcons
                      key={star}
                      name={rating >= star - 0.25 ? "star" : rating >= star - 0.75 ? "star-half-full" : "star-outline"}
                      size={16}
                      color={colors.accent}
                    />
                  ))}
                </View>
                <Text style={[styles.rowMeta, { color: colors.textMuted }]}>
                  from {reviews.length} review{reviews.length === 1 ? "" : "s"}
                </Text>
              </View>
            </View>
            {latestReview?.body ? (
              <Text style={[styles.quote, { color: colors.text }]} numberOfLines={3}>
                “{latestReview.body.trim()}”
              </Text>
            ) : null}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
};

const Banner = ({
  icon,
  text,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  text: string;
  onPress: () => void;
}) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.banner,
        {
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          borderColor: colors.primary,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <Text style={[styles.bannerText, { color: colors.text }]}>{text}</Text>
      <MaterialCommunityIcons name="chevron-right" size={20} color={colors.primary} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.sm },

  hero: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.3 },
  countdown: { fontFamily: FONTS.board, fontSize: 14, letterSpacing: 1 },
  heroWho: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  heroText: { flex: 1, minWidth: 0, gap: 2 },
  heroName: {
    fontFamily: FONTS.boardHeavy,
    fontSize: 30,
    lineHeight: 33,
    letterSpacing: 0.3,
  },
  heroWhen: { fontSize: 14 },
  heroMeta: { fontSize: 13 },
  heroEmpty: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  lastTime: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.sm,
    gap: 6,
  },
  miniLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1.1 },
  lastSummary: { fontSize: 13, lineHeight: 18 },
  heroActions: { flexDirection: "row", gap: SPACING.sm, marginTop: 2 },
  primaryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 15, fontWeight: "800" },
  ghostButton: {
    width: HIT_TARGET + 4,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: HIT_TARGET,
  },
  bannerText: { flex: 1, fontSize: 15, fontWeight: "700" },

  numbers: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
  },
  cell: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: SPACING.sm,
    minHeight: 64,
  },
  cellRule: { width: StyleSheet.hairlineWidth, marginVertical: SPACING.sm },
  cellValue: { fontFamily: FONTS.boardHeavy, fontSize: 26, lineHeight: 28 },
  cellLabel: { fontFamily: FONTS.boardLabel, fontSize: 10, letterSpacing: 0.9 },

  board: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    minHeight: 52,
  },
  todayTime: {
    fontFamily: FONTS.board,
    fontSize: 18,
    width: 50,
    fontVariant: ["tabular-nums"],
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.md,
    minHeight: 60,
  },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 13 },
  writeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  writeText: { fontSize: 13, fontWeight: "800" },
  count: { alignItems: "center", minWidth: 52 },
  countValue: { fontFamily: FONTS.boardHeavy, fontSize: 22, lineHeight: 24 },
  countLabel: {
    fontFamily: FONTS.boardLabel,
    fontSize: 10,
    letterSpacing: 0.8,
  },

  reviewCard: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  ratingValue: { fontFamily: FONTS.boardHeavy, fontSize: 40, lineHeight: 42 },
  ratingSide: { gap: 2 },
  stars: { flexDirection: "row", gap: 1 },
  quote: { fontSize: 14, lineHeight: 20, fontStyle: "italic" },
});
