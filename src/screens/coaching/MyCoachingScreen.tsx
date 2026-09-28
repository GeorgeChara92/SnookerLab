import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { RescheduleSheet } from "../../components/coach/RescheduleSheet";
import { nameOf } from "../../features/community/types";
import type { CoachBooking } from "../../features/coach/types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** How long until a session starts, in the roughest useful unit - a countdown does not need to be
 * to the second on a list screen the way it is once a session is actually live. */
const startsIn = (iso: string, now: Date) => {
  const ms = new Date(iso).getTime() - now.getTime();
  const hours = ms / 3_600_000;
  if (hours < 1) return `Starts in ${Math.max(1, Math.round(ms / 60_000))} min`;
  if (hours < 24) return `Starts in ${Math.round(hours)}h`;
  return `Starts in ${Math.round(hours / 24)}d`;
};

/**
 * A player's own coaching, at a glance: requests waiting on a coach's answer, sessions confirmed
 * and coming up with a rough countdown, and their history - the mirror of a coach's Today tab,
 * but read-only, since only the coach can see what actually happened in a session.
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
    loaded,
    markPlayerResolutionsSeen,
    memberCoachGroups: groups,
    refreshMemberCoachGroups,
  } = useCoachStore();
  const { profiles } = useCommunityStore();
  const now = useMemo(() => new Date(), []);
  const [rescheduling, setRescheduling] = useState<CoachBooking | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      markPlayerResolutionsSeen();
      void refreshMemberCoachGroups();
    }, [markPlayerResolutionsSeen, refreshMemberCoachGroups])
  );

  const coachName = (coachId: string) => nameOf(profiles[coachId]);

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
        .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
        .slice(0, 10),
    [bookingsAsPlayer, now]
  );

  const findCoach = () => navigation.navigate("Community", { screen: "FindCoach", initial: false });

  const respond = async (booking: CoachBooking, status: "accepted" | "declined") => {
    setBusyId(booking.id);
    const result = await respondToBooking(booking.id, status);
    setBusyId(null);
    if (!result.ok) dialog.alert({ title: "Could not update that", message: result.message, tone: "danger" });
  };

  if (!loaded) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!needsResponse.length && !pendingSent.length && !upcoming.length && !past.length && !groups.length) {
    return (
      <View style={[styles.empty, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="whistle-outline" size={40} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No coaching yet</Text>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          Sessions you book with a coach, and any groups they add you to, show up here.
        </Text>
        <Pressable onPress={findCoach} accessibilityRole="button" style={[styles.findButton, { backgroundColor: colors.primary }]}>
          <Text style={[styles.findButtonText, { color: colors.onPrimary }]}>Find a coach</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      {needsResponse.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Needs your response</Text>
          <View style={styles.list}>
            {needsResponse.map((booking) => (
              <View key={booking.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                  {coachName(booking.coachId)}
                </Text>
                <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                  {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
                </Text>
                {booking.rescheduleReason ? (
                  <Text style={[styles.waiting, { color: colors.text }]}>“{booking.rescheduleReason}”</Text>
                ) : null}
                <Text style={[styles.waiting, { color: colors.textMuted }]}>Proposed a new time - review it</Text>
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
          </View>
        </>
      ) : null}

      {upcoming.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Upcoming</Text>
          <View style={styles.list}>
            {upcoming.map((booking) => (
              <View key={booking.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {coachName(booking.coachId)}
                  </Text>
                  <Text style={[styles.countdown, { color: colors.primary }]}>{startsIn(booking.startsAt, now)}</Text>
                  <Pressable
                    onPress={() => openUpcomingActions(booking)}
                    accessibilityRole="button"
                    accessibilityLabel="Session options"
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="dots-horizontal" size={20} color={colors.textMuted} />
                  </Pressable>
                </View>
                <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                  {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {pendingSent.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Requests sent</Text>
          <View style={styles.list}>
            {pendingSent.map((booking) => (
              <View key={booking.id} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.cardHead}>
                  <Text style={[styles.cardName, { color: colors.text }]} numberOfLines={1}>
                    {coachName(booking.coachId)}
                  </Text>
                  <Pressable onPress={() => withdraw(booking)} accessibilityRole="button" hitSlop={8}>
                    <Text style={[styles.withdrawLink, { color: colors.danger }]}>Withdraw</Text>
                  </Pressable>
                </View>
                <Text style={[styles.cardTime, { color: colors.textMuted }]}>
                  {formatDay(booking.startsAt)} · {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
                </Text>
                <Text style={[styles.waiting, { color: colors.textMuted }]}>Waiting for them to accept</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      {groups.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Coach groups</Text>
          <View style={styles.list}>
            {groups.map((group) => (
              <Pressable
                key={group.id}
                onPress={() => navigation.navigate("CoachGroup", { groupId: group.id, groupName: group.name })}
                accessibilityRole="button"
                style={[styles.groupRow, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <MaterialCommunityIcons name="account-multiple-outline" size={22} color={colors.primary} />
                <Text style={[styles.groupName, { color: colors.text }]} numberOfLines={1}>
                  {group.name}
                </Text>
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        </>
      ) : null}

      {past.length ? (
        <>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Past sessions</Text>
          <View style={[styles.pastCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {past.map((booking, index) => (
              <View
                key={booking.id}
                style={[styles.pastRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
              >
                <Text style={[styles.pastName, { color: colors.text }]} numberOfLines={1}>
                  {coachName(booking.coachId)}
                </Text>
                <Text style={[styles.pastDate, { color: colors.textMuted }]}>{formatDay(booking.startsAt)}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Pressable onPress={findCoach} accessibilityRole="button" style={[styles.moreCoaches, { borderColor: colors.border }]}>
        <MaterialCommunityIcons name="whistle-outline" size={18} color={colors.primary} />
        <Text style={[styles.moreCoachesText, { color: colors.primary }]}>Find another coach</Text>
      </Pressable>

      <RescheduleSheet
        visible={rescheduling !== null}
        coachId={rescheduling?.coachId ?? ""}
        bookingId={rescheduling?.id ?? ""}
        onClose={() => setRescheduling(null)}
        onDone={() => setRescheduling(null)}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  content: { padding: SPACING.lg, gap: SPACING.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: "800", marginTop: SPACING.xs },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center", maxWidth: 280 },
  findButton: { minHeight: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl, marginTop: SPACING.sm },
  findButtonText: { fontSize: 15, fontWeight: "800" },
  sectionTitle: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase" },
  list: { gap: SPACING.sm },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  cardName: { flex: 1, fontSize: 16, fontWeight: "800" },
  cardTime: { fontSize: 14 },
  countdown: { fontSize: 13, fontWeight: "800" },
  withdrawLink: { fontSize: 13, fontWeight: "700" },
  waiting: { fontSize: 13, fontStyle: "italic", marginTop: 2 },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  actionButton: { flex: 1, minHeight: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  actionText: { fontSize: 15, fontWeight: "800" },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: HIT_TARGET + 8,
  },
  groupName: { flex: 1, fontSize: 15, fontWeight: "700" },
  pastCard: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  pastRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.md, minHeight: HIT_TARGET },
  pastName: { flex: 1, fontSize: 15, fontWeight: "700" },
  pastDate: { fontSize: 13 },
  moreCoaches: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
  },
  moreCoachesText: { fontSize: 14, fontWeight: "700" },
});
