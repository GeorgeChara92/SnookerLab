import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useShallow } from "zustand/react/shallow";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { useAuthStore } from "../../store/authStore";
import { useRoutineScoresStore, useRoutinesStore } from "../../store";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { HomeworkRow } from "../../components/coach/HomeworkRow";
import { ReviewModal } from "../../components/coach/ReviewModal";
import { nameOf } from "../../features/community/types";
import { startDirect } from "../../features/community/chat";
import { addBookingToCalendar } from "../../features/coach/calendarSync";
import { homeworkProgress } from "../../features/coach/homework";
import { COACH_REVIEW_COLUMNS, coachReviewFromRow, type CoachReview } from "../../features/coach/types";
import { supabase } from "../../api/supabase";
import type { CoachingStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const formatLongDay = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * One coaching session, from the player's side: when and with whom, what the coach says it
 * focused on and their notes for the player, the routines covered with the scores, and the
 * homework that came out of it. The coach's private notes are never here.
 */
export const CoachingSessionScreen = () => {
  const navigation = useNavigation<any>();
  const { bookingId } = useRoute<RouteProp<CoachingStackParamList, "CoachingSession">>().params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { bookingsAsPlayer, sessionRecaps, sessionRoutines, allHomework } = useCoachStore(
    useShallow((state) => ({
      bookingsAsPlayer: state.bookingsAsPlayer,
      sessionRecaps: state.sessionRecaps,
      sessionRoutines: state.sessionRoutines,
      allHomework: state.homework,
    }))
  );
  const profiles = useCommunityStore((state) => state.profiles);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const scoreEntries = useRoutineScoresStore((state) => state.entries);
  const libraryRoutines = useRoutinesStore((state) => state.routines);
  // Only library routines open on this phone - a coach's own custom routine lives on their account.
  const inLibrary = useMemo(() => new Set(libraryRoutines.map((routine) => routine.id)), [libraryRoutines]);
  const [review, setReview] = useState<CoachReview | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const booking = bookingsAsPlayer.find((item) => item.id === bookingId);
  const recap = sessionRecaps[bookingId];
  const covered = sessionRoutines[bookingId] ?? [];
  const homework = useMemo(() => allHomework.filter((item) => item.bookingId === bookingId && item.playerId === userId), [allHomework, bookingId, userId]);
  const now = new Date();
  const finished = booking ? new Date(booking.endsAt) <= now : false;

  useEffect(() => {
    if (!booking || !userId) return;
    void supabase
      .from("coach_reviews")
      .select(COACH_REVIEW_COLUMNS)
      .eq("player_id", userId)
      .eq("coach_id", booking.coachId)
      .maybeSingle()
      .then(({ data }) => setReview(data ? coachReviewFromRow(data) : null));
  }, [booking, userId]);

  if (!booking) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>This session isn't available any more.</Text>
      </View>
    );
  }

  const coach = profiles[booking.coachId];
  const coachName = nameOf(coach);
  const firstName = coachName.split(" ")[0];
  const message = async () => {
    const result = await startDirect(booking.coachId);
    if (result.ok) navigation.navigate("Community", { screen: "Chat", params: { conversationId: result.value }, initial: false });
    else dialog.alert({ title: `You can't message ${coachName} yet`, message: result.message, icon: "message-lock-outline" });
  };
  const nothingShared = !recap && !covered.length && !homework.length;

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
      <View style={[styles.hero, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
          {finished ? "COACHING SESSION" : "COMING UP"}
        </Text>
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.when, { color: colors.boardText }]}>
          {formatLongDay(booking.startsAt)}
        </Text>
        <Text style={[styles.sub, { color: colors.boardMuted }]}>
          {formatTime(booking.startsAt)}–{formatTime(booking.endsAt)}
          {coach?.coachLocation ? ` · ${coach.coachLocation}` : ""}
        </Text>
        <Pressable
          onPress={() => navigation.navigate("Community", { screen: "CoachProfile", params: { userId: booking.coachId }, initial: false })}
          accessibilityRole="button"
          style={[styles.coachRow, { borderTopColor: colors.boardRaised }]}
        >
          <CommunityAvatar profile={coach} size={40} borderColour={colors.board} />
          <Text style={[styles.coachName, { color: colors.boardText }]} numberOfLines={1}>
            {coachName}
          </Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.boardMuted} />
        </Pressable>
        <View style={styles.heroActions}>
          <Pressable onPress={() => void message()} accessibilityRole="button" style={[styles.heroButton, { borderColor: colors.boardRaised }]}>
            <MaterialCommunityIcons name="message-outline" size={17} color={colors.boardText} />
            <Text style={[styles.heroButtonText, { color: colors.boardText }]}>Message {firstName}</Text>
          </Pressable>
          {finished ? (
            <Pressable onPress={() => setReviewing(true)} accessibilityRole="button" style={[styles.heroButton, { borderColor: colors.boardRaised }]}>
              <MaterialCommunityIcons name={review ? "star" : "star-outline"} size={17} color={colors.accent} />
              <Text style={[styles.heroButtonText, { color: colors.boardText }]}>{review ? `Rated ${review.rating}/5` : "Rate session"}</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={async () => {
                const result = await addBookingToCalendar(booking, `Snooker coaching with ${coachName}`);
                if (result.ok) dialog.alert({ title: "Added to your calendar", message: formatLongDay(booking.startsAt), icon: "calendar-check-outline" });
                else dialog.alert({ title: "Could not add it", message: result.message, tone: "danger" });
              }}
              accessibilityRole="button"
              style={[styles.heroButton, { borderColor: colors.boardRaised }]}
            >
              <MaterialCommunityIcons name="calendar-plus" size={17} color={colors.boardText} />
              <Text style={[styles.heroButtonText, { color: colors.boardText }]}>Calendar</Text>
            </Pressable>
          )}
        </View>
      </View>

      {recap?.focus.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            WHAT YOU WORKED ON
          </Text>
          <View style={styles.chips}>
            {recap.focus.map((area) => (
              <View key={area} style={[styles.chip, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                <Text style={[styles.chipText, { color: colors.primary }]}>{area}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {recap?.summary ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            FROM {firstName.toUpperCase()}
          </Text>
          <View style={[styles.card, styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border, borderLeftColor: colors.boardRule }]}>
            <Text style={[styles.noteText, { color: colors.text }]}>{recap.summary}</Text>
            <Text style={[styles.noteMeta, { color: colors.textMuted }]}>
              Updated {new Date(recap.updatedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
            </Text>
          </View>
        </View>
      ) : null}

      {covered.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            ROUTINES COVERED
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
            {covered.map((entry, index) => (
              <Pressable
                key={entry.id}
                onPress={() => navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId: entry.routineId }, initial: false })}
                disabled={!inLibrary.has(entry.routineId)}
                accessibilityRole={inLibrary.has(entry.routineId) ? "button" : undefined}
                style={[styles.routineRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.routineName, { color: colors.text }]} numberOfLines={1}>
                    {entry.routineName}
                  </Text>
                  {entry.notes ? (
                    <Text style={[styles.routineNotes, { color: colors.textMuted }]} numberOfLines={3}>
                      {entry.notes}
                    </Text>
                  ) : null}
                </View>
                {entry.score !== null ? (
                  <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.score, { color: colors.text, backgroundColor: colors.surfaceMuted }]}>
                    {entry.score}
                  </Text>
                ) : null}
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {homework.length ? (
        <View style={styles.section}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.sectionTitle, { color: colors.text }]}>
            HOMEWORK FROM THIS SESSION
          </Text>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, paddingVertical: 0 }]}>
            {homework.map((item, index) => (
              <HomeworkRow
                key={item.id}
                homework={item}
                progress={homeworkProgress(item, scoreEntries)}
                first={index === 0}
                onStart={() => navigation.navigate("Practice", { screen: "RoutineDetail", params: { routineId: item.routineId }, initial: false })}
              />
            ))}
          </View>
        </View>
      ) : null}

      {nothingShared ? (
        <View style={[styles.card, styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name={finished ? "note-text-outline" : "calendar-clock"} size={26} color={colors.textMuted} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>{finished ? "Nothing shared yet" : "See you at the table"}</Text>
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {finished
              ? `When ${firstName} adds notes, routines or homework from this session, they appear here.`
              : `After the session, ${firstName}'s notes, the routines you covered and your homework appear here.`}
          </Text>
        </View>
      ) : null}

      {reviewing && userId ? (
        <ReviewModal
          visible
          coachId={booking.coachId}
          playerId={userId}
          existing={review}
          onClose={() => setReviewing(false)}
          onSaved={(saved) => {
            setReview(saved);
            setReviewing(false);
          }}
        />
      ) : null}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.lg },
  content: { padding: SPACING.lg, gap: SPACING.lg },
  hero: { borderWidth: 1, borderRadius: RADIUS.xl, padding: SPACING.lg, gap: 4 },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.3 },
  when: { fontFamily: FONTS.board, fontSize: 26, marginTop: 2 },
  sub: { fontSize: 14, fontWeight: "600" },
  coachRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderTopWidth: 1, paddingTop: SPACING.md, marginTop: SPACING.md },
  coachName: { flex: 1, fontSize: 16, fontWeight: "800" },
  heroActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md },
  heroButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, minHeight: 40, paddingHorizontal: 8 },
  heroButtonText: { fontSize: 14, fontWeight: "700" },
  section: { gap: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, minHeight: 32, justifyContent: "center" },
  chipText: { fontSize: 13, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  noteCard: { borderLeftWidth: 3, gap: SPACING.sm },
  noteText: { fontSize: 15, lineHeight: 22 },
  noteMeta: { fontSize: 12 },
  routineRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET + 8, paddingVertical: SPACING.sm },
  routineName: { fontSize: 15, fontWeight: "800" },
  routineNotes: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  score: { fontFamily: FONTS.board, fontSize: 18, borderRadius: RADIUS.sm, paddingHorizontal: 10, paddingVertical: 2, overflow: "hidden" },
  empty: { alignItems: "center", gap: SPACING.xs, padding: SPACING.lg },
  emptyTitle: { fontSize: 16, fontWeight: "800" },
  emptyText: { fontSize: 13, lineHeight: 18, textAlign: "center" },
});
