import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { useAuthStore } from "../../store/authStore";
import { useRoutineScoresStore } from "../../store";
import { useCoachGroupSeenStore } from "../../store/coachGroupSeenStore";
import { RescheduleSheet } from "../../components/coach/RescheduleSheet";
import { ReviewModal } from "../../components/coach/ReviewModal";
import { HomeworkRow } from "../../components/coach/HomeworkRow";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { startDirect } from "../../features/community/chat";
import { addBookingToCalendar } from "../../features/coach/calendarSync";
import { latestGroupPosts } from "../../features/coach/groups";
import { homeworkProgress } from "../../features/coach/homework";
import {
  COACH_REVIEW_COLUMNS,
  coachReviewFromRow,
  openSlots,
  type CoachBooking,
  type CoachGroupPost,
  type CoachReview,
  type CoachSlot,
} from "../../features/coach/types";
import { supabase } from "../../api/supabase";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const formatDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
const formatSlot = (iso: string) => {
  const date = new Date(iso);
  const days = Math.round((new Date(date.toDateString()).getTime() - new Date(new Date().toDateString()).getTime()) / 86_400_000);
  const day = days === 0 ? "Today" : days === 1 ? "Tomorrow" : date.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
  return `${day} ${formatTime(iso)}`;
};
const minutesBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60_000);
const durationLabel = (start: string, end: string) => {
  const minutes = minutesBetween(start, end);
  if (minutes % 60 === 0) return minutes === 60 ? "1 hour" : `${minutes / 60} hours`;
  return minutes > 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes} min`;
};

/** How long until a session starts, in the roughest useful unit. */
const startsIn = (iso: string, now: Date) => {
  const ms = new Date(iso).getTime() - now.getTime();
  if (ms <= 0) return "On now";
  const hours = ms / 3_600_000;
  if (hours < 1) return `Starts in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `Starts in ${Math.round(hours)}h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "Tomorrow" : `In ${days} days`;
};

/**
 * A player's coaching, built around the coach rather than a list of dates: the next session, the
 * homework they've been set and how it's going, their coach with a quick way to book again, what's
 * new in their coach's groups, and every session with what was covered.
 */
export const MyCoachingScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const {
    bookingsAsPlayer,
    cancelBooking,
    respondToBooking,
    requestBooking,
    loadCoachSchedule,
    searchCoaches,
    loaded,
    markPlayerResolutionsSeen,
    memberCoachGroups: groups,
    refreshMemberCoachGroups,
    homework: allHomework,
    sessionRecaps,
    sessionRoutines,
  } = useCoachStore(
    useShallow((state) => ({
      bookingsAsPlayer: state.bookingsAsPlayer,
      cancelBooking: state.cancelBooking,
      respondToBooking: state.respondToBooking,
      requestBooking: state.requestBooking,
      loadCoachSchedule: state.loadCoachSchedule,
      searchCoaches: state.searchCoaches,
      loaded: state.loaded,
      markPlayerResolutionsSeen: state.markPlayerResolutionsSeen,
      memberCoachGroups: state.memberCoachGroups,
      refreshMemberCoachGroups: state.refreshMemberCoachGroups,
      homework: state.homework,
      sessionRecaps: state.sessionRecaps,
      sessionRoutines: state.sessionRoutines,
    }))
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const loadProfile = useCommunityStore((state) => state.loadProfile);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const scoreEntries = useRoutineScoresStore((state) => state.entries);
  const seen = useCoachGroupSeenStore((state) => state.seen);
  const markGroupSeen = useCoachGroupSeenStore((state) => state.markSeen);

  const [now, setNow] = useState(() => new Date());
  const [rescheduling, setRescheduling] = useState<CoachBooking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [slotsByCoach, setSlotsByCoach] = useState<Record<string, CoachSlot[]>>({});
  const [posts, setPosts] = useState<CoachGroupPost[]>([]);
  const [reviews, setReviews] = useState<Record<string, CoachReview>>({});
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<PublicProfile[]>([]);
  const [showAllHistory, setShowAllHistory] = useState(false);

  const coachName = (coachId: string) => nameOf(profiles[coachId]);

  // ------------------------------------------------------------------ what there is
  const needsResponse = useMemo(
    () =>
      bookingsAsPlayer
        .filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "player")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsPlayer]
  );
  const pendingSent = useMemo(
    () =>
      bookingsAsPlayer
        .filter((booking) => booking.status === "pending" && booking.awaitingResponseFrom === "coach")
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsPlayer]
  );
  const upcoming = useMemo(
    () =>
      bookingsAsPlayer
        .filter((booking) => booking.status === "accepted" && new Date(booking.endsAt) > now)
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    [bookingsAsPlayer, now]
  );
  const past = useMemo(
    () =>
      bookingsAsPlayer
        .filter((booking) => booking.status === "accepted" && new Date(booking.endsAt) <= now)
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt)),
    [bookingsAsPlayer, now]
  );
  const homework = useMemo(() => allHomework.filter((item) => item.playerId === userId), [allHomework, userId]);
  const progress = useMemo(
    () => Object.fromEntries(homework.map((item) => [item.id, homeworkProgress(item, scoreEntries, now)])),
    [homework, scoreEntries, now]
  );

  // The coaches this player has actually had (or has booked) sessions with, most recent first.
  const coaches = useMemo(() => {
    const byCoach = new Map<string, { coachId: string; sessions: number; since: string; last: string }>();
    for (const booking of bookingsAsPlayer) {
      if (booking.status !== "accepted" && booking.status !== "pending") continue;
      const entry = byCoach.get(booking.coachId) ?? { coachId: booking.coachId, sessions: 0, since: booking.startsAt, last: booking.startsAt };
      if (booking.status === "accepted" && new Date(booking.endsAt) <= now) entry.sessions++;
      if (booking.startsAt < entry.since) entry.since = booking.startsAt;
      if (booking.startsAt > entry.last) entry.last = booking.startsAt;
      byCoach.set(booking.coachId, entry);
    }
    return [...byCoach.values()].sort((a, b) => b.last.localeCompare(a.last));
  }, [bookingsAsPlayer, now]);
  const coachIds = useMemo(() => coaches.map((coach) => coach.coachId).join(","), [coaches]);

  // ------------------------------------------------------------------ loading the extras
  useFocusEffect(
    useCallback(() => {
      markPlayerResolutionsSeen();
      setNow(new Date());
      void refreshMemberCoachGroups();
    }, [markPlayerResolutionsSeen, refreshMemberCoachGroups])
  );

  // Each coach's next free times, for "Book again".
  useEffect(() => {
    const ids = coachIds ? coachIds.split(",") : [];
    let cancelled = false;
    void Promise.all(
      ids.map(async (coachId) => {
        const { slots, bookings } = await loadCoachSchedule(coachId);
        return [coachId, openSlots(slots, bookings).slice(0, 3)] as const;
      })
    ).then((pairs) => {
      if (!cancelled) setSlotsByCoach(Object.fromEntries(pairs));
    });
    ids.filter((id) => !profiles[id]).forEach((id) => void loadProfile(id));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coachIds, loadCoachSchedule]);

  // The newest post in each of the player's coach groups.
  const groupIds = useMemo(() => groups.map((group) => group.id).join(","), [groups]);
  useEffect(() => {
    if (!groupIds) return;
    void latestGroupPosts(groupIds.split(",")).then(setPosts);
  }, [groupIds]);

  // The player's own reviews, so a finished session can ask for one only when there isn't one.
  useEffect(() => {
    if (!userId || !coachIds) return;
    void supabase
      .from("coach_reviews")
      .select(COACH_REVIEW_COLUMNS)
      .eq("player_id", userId)
      .then(({ data }) => setReviews(Object.fromEntries((data ?? []).map((row) => [row.coach_id as string, coachReviewFromRow(row)]))));
  }, [userId, coachIds]);

  // No coaching yet: a few coaches to start from.
  const empty = loaded && !bookingsAsPlayer.length && !groups.length;
  useEffect(() => {
    if (!empty) return;
    void searchCoaches("").then((list) => setSuggested(list.filter((coach) => coach.id !== userId).slice(0, 4)));
  }, [empty, searchCoaches, userId]);

  // ------------------------------------------------------------------ actions
  const findCoach = () => navigation.navigate("Community", { screen: "FindCoach", initial: false });
  const openCoach = (coachId: string) => navigation.navigate("Community", { screen: "CoachProfile", params: { userId: coachId }, initial: false });
  const openRoutine = (routineId: string) => navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId }, initial: false });

  const message = async (coachId: string) => {
    const result = await startDirect(coachId);
    if (result.ok) navigation.navigate("Community", { screen: "Chat", params: { conversationId: result.value }, initial: false });
    else dialog.alert({ title: `You can't message ${coachName(coachId)} yet`, message: result.message, icon: "message-lock-outline" });
  };

  const addToCalendar = async (booking: CoachBooking) => {
    const result = await addBookingToCalendar(booking, `Snooker coaching with ${coachName(booking.coachId)}`);
    if (result.ok) dialog.alert({ title: "Added to your calendar", message: `${formatDay(booking.startsAt)} · ${formatTime(booking.startsAt)}`, icon: "calendar-check-outline" });
    else dialog.alert({ title: "Could not add it", message: result.message, tone: "danger" });
  };

  const withdraw = (booking: CoachBooking) =>
    dialog.confirm({
      title: "Withdraw this request?",
      message: `${coachName(booking.coachId)} will no longer see it waiting.`,
      tone: "danger",
      confirmLabel: "Withdraw",
      cancelLabel: "Keep it",
      onConfirm: () => cancelBooking(booking.id),
    });

  const cancelSession = (booking: CoachBooking) =>
    // The session-options dialog is still animating closed when this fires - showing another
    // dialog in the same instant is what silently swallows it on iOS, so this waits it out first.
    setTimeout(() => {
      dialog.confirm({
        title: "Cancel this session?",
        message: `${coachName(booking.coachId)} will be told it's cancelled.`,
        tone: "danger",
        confirmLabel: "Cancel session",
        cancelLabel: "Keep it",
        onConfirm: () => cancelBooking(booking.id),
      });
    }, 350);

  const openUpcomingActions = (booking: CoachBooking) =>
    dialog.choose({
      title: "Session options",
      message: `${coachName(booking.coachId)} · ${formatDay(booking.startsAt)} · ${formatTime(booking.startsAt)}`,
      icon: "calendar-clock-outline",
      confirmLabel: "Reschedule",
      secondaryLabel: "Cancel session",
      cancelLabel: "Never mind",
      onConfirm: () => setTimeout(() => setRescheduling(booking), 350),
      onSecondary: () => cancelSession(booking),
    });

  const respond = async (booking: CoachBooking, status: "accepted" | "declined") => {
    setBusyId(booking.id);
    const result = await respondToBooking(booking.id, status);
    setBusyId(null);
    if (!result.ok) dialog.alert({ title: "Could not update that", message: result.message, tone: "danger" });
  };

  const bookSlot = (coachId: string, slot: CoachSlot) =>
    dialog.confirm({
      title: `Book ${formatSlot(slot.startsAt)}?`,
      message: `${coachName(coachId)} gets a request for ${formatDay(slot.startsAt)}, ${formatTime(slot.startsAt)}–${formatTime(slot.endsAt)}.`,
      icon: "calendar-plus",
      confirmLabel: "Send request",
      cancelLabel: "Not now",
      onConfirm: async () => {
        const result = await requestBooking(coachId, slot, "");
        if (!result.ok) {
          setTimeout(() => dialog.alert({ title: "Could not book that", message: result.message, tone: "danger" }), 350);
          return;
        }
        setSlotsByCoach((current) => ({ ...current, [coachId]: (current[coachId] ?? []).filter((item) => item.id !== slot.id) }));
      },
    });

  const openGroup = (groupId: string, groupName: string) => {
    markGroupSeen(groupId);
    navigation.navigate("CoachGroup", { groupId, groupName });
  };

  // ------------------------------------------------------------------ screen
  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const next = upcoming[0];
  const lastSession = past[0];
  // A session in the last fortnight with a coach this player hasn't reviewed: ask, once, here.
  const askReview =
    lastSession && !reviews[lastSession.coachId] && now.getTime() - new Date(lastSession.endsAt).getTime() < 14 * 86_400_000
      ? lastSession
      : null;
  const history = showAllHistory ? past : past.slice(0, 5);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
      {/* A coach's proposed new time comes first: it's waiting on this player. */}
      {needsResponse.map((booking) => (
        <View key={booking.id} style={[styles.card, styles.attention, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
          <Text style={[styles.kicker, { color: colors.primary }]}>NEW TIME PROPOSED</Text>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            {coachName(booking.coachId)} · {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
          </Text>
          {booking.rescheduleReason ? <Text style={[styles.quote, { color: colors.text }]}>“{booking.rescheduleReason}”</Text> : null}
          <View style={styles.actions}>
            <Pressable
              onPress={() => respond(booking, "declined")}
              disabled={busyId === booking.id}
              accessibilityRole="button"
              style={[styles.actionButton, { borderWidth: 1, borderColor: colors.border }]}
            >
              <Text style={[styles.actionText, { color: colors.text }]}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={() => respond(booking, "accepted")}
              disabled={busyId === booking.id}
              accessibilityRole="button"
              style={[styles.actionButton, { backgroundColor: colors.primary }]}
            >
              <Text style={[styles.actionText, { color: colors.onPrimary }]}>Accept</Text>
            </Pressable>
          </View>
        </View>
      ))}

      {/* Next session, given the scoreboard treatment */}
      {next ? (
        <Pressable
          onPress={() => navigation.navigate("CoachingSession", { bookingId: next.id })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule, opacity: pressed ? 0.94 : 1 }]}
        >
          <View style={styles.heroTop}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.heroKicker, { color: colors.boardRule }]}>
              NEXT SESSION
            </Text>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.heroKicker, { color: colors.boardText }]}>
              {startsIn(next.startsAt, now).toUpperCase()}
            </Text>
          </View>
          <View style={styles.heroWho}>
            <CommunityAvatar profile={profiles[next.coachId]} size={52} borderColour={colors.board} />
            <View style={{ flex: 1 }}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.heroWhen, { color: colors.boardText }]}>
                {formatDay(next.startsAt)} · {formatTime(next.startsAt)}
              </Text>
              <Text numberOfLines={1} style={[styles.heroSub, { color: colors.boardMuted }]}>
                {[coachName(next.coachId), profiles[next.coachId]?.coachLocation, durationLabel(next.startsAt, next.endsAt)].filter(Boolean).join(" · ")}
              </Text>
            </View>
          </View>
          <View style={styles.heroActions}>
            <Pressable onPress={() => void message(next.coachId)} accessibilityRole="button" style={[styles.heroButton, { borderColor: colors.boardRaised }]}>
              <MaterialCommunityIcons name="message-outline" size={17} color={colors.boardText} />
              <Text style={[styles.heroButtonText, { color: colors.boardText }]}>Message</Text>
            </Pressable>
            <Pressable onPress={() => void addToCalendar(next)} accessibilityRole="button" style={[styles.heroButton, { borderColor: colors.boardRaised }]}>
              <MaterialCommunityIcons name="calendar-plus" size={17} color={colors.boardText} />
              <Text style={[styles.heroButtonText, { color: colors.boardText }]}>Calendar</Text>
            </Pressable>
            <Pressable
              onPress={() => openUpcomingActions(next)}
              accessibilityRole="button"
              accessibilityLabel="Session options"
              style={[styles.heroIconButton, { borderColor: colors.boardRaised }]}
            >
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.boardText} />
            </Pressable>
          </View>
        </Pressable>
      ) : null}

      {/* Further confirmed sessions, and requests still with the coach */}
      {upcoming.length > 1 || pendingSent.length ? (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
          {upcoming.slice(1).map((booking, index) => (
            <Pressable
              key={booking.id}
              onPress={() => openUpcomingActions(booking)}
              accessibilityRole="button"
              style={[styles.listRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
            >
              <MaterialCommunityIcons name="calendar-check-outline" size={18} color={colors.primary} />
              <Text style={[styles.listMain, { color: colors.text }]} numberOfLines={1}>
                {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}
              </Text>
              <Text style={[styles.listSide, { color: colors.textMuted }]} numberOfLines={1}>
                {coachName(booking.coachId)}
              </Text>
            </Pressable>
          ))}
          {pendingSent.map((booking, index) => (
            <View
              key={booking.id}
              style={[styles.listRow, index > 0 || upcoming.length > 1 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
            >
              <MaterialCommunityIcons name="clock-outline" size={18} color={colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.listMain, { color: colors.text }]} numberOfLines={1}>
                  {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}
                </Text>
                <Text style={[styles.listSub, { color: colors.textMuted }]}>Waiting for {coachName(booking.coachId)} to accept</Text>
              </View>
              <Pressable onPress={() => withdraw(booking)} accessibilityRole="button" hitSlop={8}>
                <Text style={[styles.withdraw, { color: colors.danger }]}>Withdraw</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {/* Homework */}
      {homework.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            SET BY YOUR COACH
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
            {homework.map((item, index) => (
              <HomeworkRow key={item.id} homework={item} progress={progress[item.id]} first={index === 0} onStart={() => openRoutine(item.routineId)} />
            ))}
          </View>
        </View>
      ) : null}

      {/* Review, after a session */}
      {askReview ? (
        <Pressable
          onPress={() => setReviewing(askReview.coachId)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.card, styles.reviewCard, { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.85 : 1 }]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>How was {formatDay(askReview.startsAt).split(" ")[0]}'s session?</Text>
            <Text style={[styles.listSub, { color: colors.textMuted }]}>Rate {coachName(askReview.coachId)} - it helps other players find them.</Text>
          </View>
          <View style={styles.stars}>
            {[0, 1, 2, 3, 4].map((i) => (
              <MaterialCommunityIcons key={i} name="star-outline" size={20} color={colors.accent} />
            ))}
          </View>
        </Pressable>
      ) : null}

      {/* Your coach(es) */}
      {coaches.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            {coaches.length === 1 ? "YOUR COACH" : "YOUR COACHES"}
          </Text>
          {coaches.map((coach) => {
            const profile = profiles[coach.coachId];
            const slots = slotsByCoach[coach.coachId];
            return (
              <View key={coach.coachId} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Pressable onPress={() => openCoach(coach.coachId)} accessibilityRole="button" style={styles.coachHead}>
                  <CommunityAvatar profile={profile} size={46} borderColour={colors.surface} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.coachNameRow}>
                      <Text style={[styles.cardTitle, { color: colors.text, flexShrink: 1 }]} numberOfLines={1}>
                        {coachName(coach.coachId)}
                      </Text>
                      {profile?.wpbsaAccredited ? (
                        <View style={[styles.badge, { backgroundColor: colors.accentWash }]}>
                          <Text style={[styles.badgeText, { color: colors.accent }]}>WPBSA</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.listSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {coach.sessions
                        ? `${coach.sessions} ${coach.sessions === 1 ? "session" : "sessions"} since ${new Date(coach.since).toLocaleDateString(undefined, { month: "short", year: "numeric" })}`
                        : "First session coming up"}
                      {profile?.coachLocation ? ` · ${profile.coachLocation}` : ""}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
                <Text style={[styles.kicker, styles.bookLabel, { color: colors.textMuted }]}>BOOK AGAIN</Text>
                {slots === undefined ? (
                  <ActivityIndicator color={colors.primary} style={styles.slotsLoading} />
                ) : (
                  <View style={styles.slots}>
                    {slots.map((slot) => (
                      <Pressable
                        key={slot.id}
                        onPress={() => bookSlot(coach.coachId, slot)}
                        accessibilityRole="button"
                        style={({ pressed }) => [styles.slot, { borderColor: colors.primary, backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
                      >
                        <Text style={[styles.slotText, { color: colors.primary }]}>{formatSlot(slot.startsAt)}</Text>
                      </Pressable>
                    ))}
                    <Pressable onPress={() => openCoach(coach.coachId)} accessibilityRole="button" hitSlop={6} style={styles.allTimes}>
                      <Text style={[styles.allTimesText, { color: slots.length ? colors.textMuted : colors.primary }]}>
                        {slots.length ? "All times" : "No open times - see their profile"}
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Coach groups, with what's new */}
      {groups.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            COACH GROUPS
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
            {groups.map((group, index) => {
              const groupPosts = posts.filter((post) => post.groupId === group.id);
              const latest = groupPosts[0];
              const lastSeen = seen[group.id];
              const fresh = groupPosts.filter((post) => !lastSeen || post.createdAt > lastSeen).length;
              return (
                <Pressable
                  key={group.id}
                  onPress={() => openGroup(group.id, group.name)}
                  accessibilityRole="button"
                  style={[styles.listRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
                >
                  <View style={[styles.groupIcon, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name="account-group-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listMain, { color: colors.text }]} numberOfLines={1}>
                      {group.name}
                    </Text>
                    <Text style={[styles.listSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {latest
                        ? `${coachName(group.coachId).split(" ")[0]}: ${latest.caption || latest.fileName || (latest.mediaType === "video" ? "Posted a video" : latest.mediaType === "image" ? "Posted a photo" : "Posted a PDF")}`
                        : "Nothing posted yet"}
                    </Text>
                  </View>
                  {fresh ? (
                    <View style={[styles.newBadge, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.newBadgeText, { color: colors.onPrimary }]}>{fresh} new</Text>
                    </View>
                  ) : (
                    <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* Session history */}
      {past.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            SESSION HISTORY
          </Text>
          <View style={[styles.timeline, { borderLeftColor: colors.border }]}>
            {history.map((booking) => {
              const recap = sessionRecaps[booking.id];
              const covered = sessionRoutines[booking.id] ?? [];
              const worked = recap?.focus.length ? recap.focus.join(", ") : covered.map((entry) => entry.routineName).join(", ");
              return (
                <Pressable
                  key={booking.id}
                  onPress={() => navigation.navigate("CoachingSession", { bookingId: booking.id })}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.timelineItem, { opacity: pressed ? 0.7 : 1 }]}
                >
                  <View style={[styles.timelineDot, { backgroundColor: recap || covered.length ? colors.primary : colors.border, borderColor: colors.background }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listMain, { color: colors.text }]}>
                      {formatDay(booking.startsAt)} · {durationLabel(booking.startsAt, booking.endsAt)}
                    </Text>
                    <Text style={[styles.listSub, { color: colors.textMuted }]} numberOfLines={2}>
                      {worked ? `Worked on: ${worked}` : coaches.length > 1 ? `With ${coachName(booking.coachId)}` : "No notes from your coach yet"}
                    </Text>
                    {recap?.summary ? (
                      <Text style={[styles.timelineQuote, { color: colors.text }]} numberOfLines={2}>
                        “{recap.summary}”
                      </Text>
                    ) : null}
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textMuted} />
                </Pressable>
              );
            })}
          </View>
          {past.length > 5 ? (
            <Pressable onPress={() => setShowAllHistory((value) => !value)} accessibilityRole="button" style={styles.showAll}>
              <Text style={[styles.showAllText, { color: colors.primary }]}>{showAllHistory ? "Show fewer" : `All ${past.length} sessions`}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Nothing yet: an invitation, with real coaches to start from */}
      {empty ? (
        <View style={styles.section}>
          <View style={[styles.hero, styles.emptyHero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
            <MaterialCommunityIcons name="whistle-outline" size={30} color={colors.boardRule} />
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.heroWhen, { color: colors.boardText, textAlign: "center" }]}>
              Get a coach in your corner
            </Text>
            <Text style={[styles.heroSub, { color: colors.boardMuted, textAlign: "center" }]}>
              Book a session, get homework between sessions, and see what you covered each time.
            </Text>
            <Pressable onPress={findCoach} accessibilityRole="button" style={[styles.findButton, { backgroundColor: colors.primary }]}>
              <Text style={[styles.findButtonText, { color: colors.onPrimary }]}>Find a coach</Text>
            </Pressable>
          </View>
          {suggested.length ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
              {suggested.map((coach, index) => (
                <Pressable
                  key={coach.id}
                  onPress={() => openCoach(coach.id)}
                  accessibilityRole="button"
                  style={[styles.listRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
                >
                  <CommunityAvatar profile={coach} size={40} borderColour={colors.surface} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.listMain, { color: colors.text }]} numberOfLines={1}>
                      {nameOf(coach)}
                    </Text>
                    <Text style={[styles.listSub, { color: colors.textMuted }]} numberOfLines={1}>
                      {[coach.wpbsaAccredited ? "WPBSA" : null, coach.coachLocation].filter(Boolean).join(" · ") || "Coach"}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Pressable onPress={findCoach} accessibilityRole="button" style={[styles.moreCoaches, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="whistle-outline" size={18} color={colors.primary} />
          <Text style={[styles.moreCoachesText, { color: colors.primary }]}>Find another coach</Text>
        </Pressable>
      )}

      <RescheduleSheet
        visible={rescheduling !== null}
        coachId={rescheduling?.coachId ?? ""}
        bookingId={rescheduling?.id ?? ""}
        onClose={() => setRescheduling(null)}
        onDone={() => setRescheduling(null)}
      />
      {reviewing && userId ? (
        <ReviewModal
          visible
          coachId={reviewing}
          playerId={userId}
          existing={reviews[reviewing] ?? null}
          onClose={() => setReviewing(null)}
          onSaved={(review) => {
            setReviews((current) => ({ ...current, [review.coachId]: review }));
            setReviewing(null);
          }}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.lg },
  section: { gap: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  attention: { gap: 6 },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.1 },
  cardTitle: { fontSize: 16, fontWeight: "800" },
  quote: { fontSize: 14, fontStyle: "italic" },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },
  actionButton: { flex: 1, minHeight: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "800" },
  hero: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: SPACING.md },
  heroTop: { flexDirection: "row", justifyContent: "space-between", gap: SPACING.sm },
  heroKicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.3 },
  heroWho: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  heroWhen: { fontFamily: FONTS.board, fontSize: 24, letterSpacing: 0.2 },
  heroSub: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  heroActions: { flexDirection: "row", gap: SPACING.sm },
  heroButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, minHeight: 40 },
  heroButtonText: { fontSize: 14, fontWeight: "700" },
  heroIconButton: { width: 44, borderWidth: 1, borderRadius: RADIUS.pill, alignItems: "center", justifyContent: "center", minHeight: 40 },
  listRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET + 8, paddingVertical: SPACING.sm },
  listMain: { flex: 1, fontSize: 15, fontWeight: "700" },
  listSide: { fontSize: 13, fontWeight: "600", maxWidth: "45%" },
  listSub: { fontSize: 13, lineHeight: 18 },
  withdraw: { fontSize: 13, fontWeight: "700" },
  reviewCard: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  stars: { flexDirection: "row" },
  coachHead: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  coachNameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  badgeText: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 0.8 },
  bookLabel: { marginTop: SPACING.md, marginBottom: 6 },
  slotsLoading: { alignSelf: "flex-start", marginVertical: 6 },
  slots: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  slot: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 36, justifyContent: "center" },
  slotText: { fontSize: 13, fontWeight: "800" },
  allTimes: { paddingHorizontal: 4, minHeight: 36, justifyContent: "center" },
  allTimesText: { fontSize: 13, fontWeight: "700" },
  groupIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  newBadge: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 3 },
  newBadgeText: { fontSize: 12, fontWeight: "800" },
  timeline: { borderLeftWidth: 2, marginLeft: 6, paddingLeft: SPACING.md, gap: SPACING.md },
  timelineItem: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  timelineDot: { position: "absolute", left: -SPACING.md - 8, top: 4, width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  timelineQuote: { fontSize: 13, fontStyle: "italic", marginTop: 2 },
  showAll: { minHeight: HIT_TARGET - 8, justifyContent: "center", alignSelf: "flex-start" },
  showAllText: { fontSize: 14, fontWeight: "800" },
  emptyHero: { alignItems: "center", gap: SPACING.sm },
  findButton: { minHeight: HIT_TARGET, borderRadius: RADIUS.md, paddingHorizontal: SPACING.xl, alignItems: "center", justifyContent: "center", marginTop: SPACING.xs },
  findButtonText: { fontSize: 15, fontWeight: "800" },
  moreCoaches: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.lg,
  },
  moreCoachesText: { fontSize: 15, fontWeight: "800" },
});
