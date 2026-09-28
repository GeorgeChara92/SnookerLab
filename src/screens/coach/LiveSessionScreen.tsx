import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { useCustomRoutinesStore, useRoutinesStore } from "../../store";
import { CUSTOM_CATEGORY_ID, toRoutine, type CustomRoutine } from "../../features/customRoutines/customRoutine";
import { nameOf } from "../../features/community/types";
import { DialogProvider, useDialog } from "../../components/ui/DialogProvider";
import { getYoutubeThumbnailUrl } from "../../utils/youtube";
import { getRoutineReferenceImageByRoutineId } from "../../features/ar/routineLayouts";
import { TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { RescheduleSheet } from "../../components/coach/RescheduleSheet";
import { FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";
import type { SessionRoutineEntry } from "../../features/coach/types";
import type { Routine, RoutineCategory } from "../../types";
import type { RootStackParamList } from "../../types";

const CUSTOM_CATEGORY: RoutineCategory = {
  id: CUSTOM_CATEGORY_ID,
  name: "My routines",
  order_index: -1,
  created_at: "",
};

const thumbnailFor = (routine: Routine) => {
  const reference = getRoutineReferenceImageByRoutineId(routine.id);
  if (reference) return reference;
  const videoId = routine.youtube_video_id ?? routine.youtube_alt_video_id;
  return videoId ? { uri: getYoutubeThumbnailUrl(videoId) } : null;
};

/** A routine's preview, at whatever size it is given: a live mini table diagram for a custom
 * routine (its actual layout, not a stock icon), or its image/video thumbnail for a library one. */
const RoutineThumb = ({
  routine,
  custom,
  style,
  onPress,
}: {
  routine: Routine;
  custom?: CustomRoutine;
  style: any;
  onPress?: () => void;
}) => {
  const { colors } = useAppTheme();
  if (custom) {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        style={[style, styles.diagramThumb, { backgroundColor: "#0F4A33" }]}
      >
        <TableDiagram balls={custom.balls} readOnly />
      </Pressable>
    );
  }
  const source = thumbnailFor(routine);
  if (!source) {
    return (
      <View style={[style, styles.pickerThumbFallback, { backgroundColor: colors.surfaceMuted }]}>
        <Text style={styles.pickerIcon}>{routine.icon ?? "🎱"}</Text>
      </View>
    );
  }
  const image = <Image source={source} style={style} resizeMode={onPress ? "contain" : "cover"} />;
  return onPress ? <Pressable onPress={onPress}>{image}</Pressable> : image;
};

/** The routine library plus this account's own custom routines, merged and indexed by id - the
 * same set whichever mode (player or coach) built them, since both are the one signed-in account. */
const useMergedRoutines = () => {
  const { routines: libraryRoutines } = useRoutinesStore();
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  const mine = useMemo(() => customRoutines.map(toRoutine), [customRoutines]);
  const customById = useMemo(() => new Map(customRoutines.map((routine) => [routine.id, routine])), [customRoutines]);
  const all = useMemo(() => [...mine, ...libraryRoutines], [mine, libraryRoutines]);
  const byId = useMemo(() => new Map(all.map((routine) => [routine.id, routine])), [all]);
  return { mine, all, byId, customById };
};

const NOTES_LIMIT = 2000;
const ROUTINE_NOTES_LIMIT = 1000;

const formatDay = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const formatTime = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** "6d 19h" while it's still a way off, then "1:30:05" or "05:12" once it's within a day - a
 * countdown in raw hours (yesterday this read "163:50:55" for a session nearly a week away) stops
 * being useful long before it stops being technically correct. */
const formatCountdown = (ms: number) => {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const days = Math.floor(totalSeconds / 86_400);
  if (days > 0) {
    const hours = Math.floor((totalSeconds % 86_400) / 3600);
    return `${days}d ${hours}h`;
  }
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
};

/**
 * A session in progress: a countdown to keep time by, which routines were covered (with the
 * client's score and any routine-specific notes), and free-form notes the coach can write as it
 * happens rather than trying to remember it all afterwards.
 *
 * Wrapped in its own DialogProvider because this screen is presented as a root-level modal: iOS
 * will not show a dialog from the app's own root DialogProvider while a modal sits on top of it
 * (the same reason ProfileNavigator has its own), so every dialog.* call in here would otherwise
 * silently do nothing.
 */
export const LiveSessionScreen = () => (
  <DialogProvider>
    <LiveSessionScreenContent />
  </DialogProvider>
);

const LiveSessionScreenContent = () => {
  const route = useRoute<RouteProp<RootStackParamList, "LiveSession">>();
  const navigation = useNavigation<any>();
  const { bookingId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const {
    bookingsAsCoach,
    sessionNotes,
    sessionRoutines,
    saveSessionNotes,
    addSessionRoutine,
    removeSessionRoutine,
    updateSessionRoutine,
    cancelBooking,
  } = useCoachStore();
  const { profiles } = useCommunityStore();
  const { byId, customById } = useMergedRoutines();

  const booking = bookingsAsCoach.find((item) => item.id === bookingId);
  const partyName = booking ? booking.guestName ?? nameOf(profiles[booking.playerId ?? ""]) : "";
  const [notes, setNotes] = useState(sessionNotes[bookingId] ?? "");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(new Date());
  const [picking, setPicking] = useState(false);
  const [editing, setEditing] = useState<SessionRoutineEntry | null>(null);
  const [rescheduling, setRescheduling] = useState(false);

  const routines = sessionRoutines[bookingId] ?? [];

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const phase = useMemo(() => {
    if (!booking) return null;
    const start = new Date(booking.startsAt);
    const end = new Date(booking.endsAt);
    if (now < start) return { label: "Starts in", ms: start.getTime() - now.getTime() };
    if (now <= end) return { label: "Time remaining", ms: end.getTime() - now.getTime() };
    return { label: "Session ended", ms: 0 };
  }, [booking, now]);

  const save = async () => {
    setSaving(true);
    const result = await saveSessionNotes(bookingId, notes);
    setSaving(false);
    if (result.ok) navigation.goBack();
  };

  const removeRoutine = (id: string, name: string) =>
    dialog.confirm({
      title: `Remove ${name}?`,
      message: "This takes it off this session's record.",
      tone: "danger",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: () => removeSessionRoutine(id, bookingId),
    });

  const confirmCancel = () => {
    if (!booking) return;
    const name = partyName;
    // The session-options dialog is still animating closed when this fires (its own onSecondary
    // calls onDismiss right after) - showing another dialog or modal in the same instant is what
    // silently swallows it on iOS, so this waits for that to finish first.
    setTimeout(() => {
      dialog.confirm({
        title: "Cancel this session?",
        message: `${name} will be told it's cancelled.`,
        tone: "danger",
        confirmLabel: "Cancel session",
        cancelLabel: "Keep it",
        onConfirm: async () => {
          const result = await cancelBooking(bookingId);
          if (result.ok) navigation.goBack();
          else dialog.alert({ title: "Could not cancel", message: result.message, tone: "danger" });
        },
      });
    }, 350);
  };

  const openSessionActions = () => {
    if (!booking) return;
    dialog.choose({
      title: "Session options",
      message: `${partyName} · ${formatDay(booking.startsAt)} · ${formatTime(booking.startsAt)}`,
      icon: "calendar-clock-outline",
      confirmLabel: "Reschedule",
      secondaryLabel: "Cancel session",
      cancelLabel: "Never mind",
      onConfirm: () => setTimeout(() => setRescheduling(true), 350),
      onSecondary: confirmCancel,
    });
  };

  if (!booking) {
    return (
      <View style={[styles.screen, styles.centre, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.textMuted }}>This session is no longer available.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + SPACING.md }]}>
        <Pressable onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
          <MaterialCommunityIcons name="close" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.name, { color: colors.text }]}>{partyName}</Text>
        {phase?.label === "Session ended" ? (
          <View style={{ width: 24 }} />
        ) : (
          <Pressable onPress={openSessionActions} accessibilityRole="button" accessibilityLabel="Session options" hitSlop={10}>
            <MaterialCommunityIcons name="dots-horizontal" size={24} color={colors.text} />
          </Pressable>
        )}
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}>
        {phase ? (
          <View style={styles.countdownBlock}>
            <Text style={[styles.countdownLabel, { color: colors.textMuted }]}>{phase.label.toUpperCase()}</Text>
            {phase.ms > 0 ? (
              <Text style={[styles.countdown, { color: colors.primary, fontFamily: FONTS.boardHeavy }]}>
                {formatCountdown(phase.ms)}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.sectionHead}>
          <Text style={[styles.label, { color: colors.textMuted }]}>Routines covered</Text>
          <Pressable onPress={() => setPicking(true)} accessibilityRole="button" hitSlop={8} style={styles.addRoutine}>
            <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.addRoutineText, { color: colors.primary }]}>Add routine</Text>
          </Pressable>
        </View>

        {routines.length ? (
          <View style={styles.routineList}>
            {routines.map((entry) => {
              const routine = byId.get(entry.routineId);
              return (
                <View key={entry.id} style={[styles.routineRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Pressable onPress={() => setEditing(entry)} accessibilityRole="button" style={styles.routineRowMain}>
                    {routine ? (
                      <RoutineThumb routine={routine} custom={customById.get(entry.routineId)} style={styles.pickerThumb} />
                    ) : (
                      <View style={[styles.pickerThumb, styles.pickerThumbFallback, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={styles.pickerIcon}>🎱</Text>
                      </View>
                    )}
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.routineName, { color: colors.text }]} numberOfLines={1}>
                        {entry.routineName}
                      </Text>
                      {entry.notes ? (
                        <Text style={[styles.routineNotes, { color: colors.textMuted }]} numberOfLines={1}>
                          {entry.notes}
                        </Text>
                      ) : null}
                    </View>
                    {entry.score !== null ? (
                      <View style={[styles.scoreBadge, { backgroundColor: colors.surfaceMuted }]}>
                        <Text style={[styles.scoreBadgeText, { color: colors.text }]}>{entry.score}</Text>
                      </View>
                    ) : null}
                  </Pressable>
                  <Pressable
                    onPress={() => removeRoutine(entry.id, entry.routineName)}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${entry.routineName}`}
                    hitSlop={8}
                  >
                    <MaterialCommunityIcons name="close" size={16} color={colors.textMuted} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : (
          <Text style={[styles.emptyRoutines, { color: colors.textMuted }]}>Nothing added yet.</Text>
        )}

        <Text style={[styles.label, styles.notesLabel, { color: colors.textMuted }]}>Session notes</Text>
        <TextInput
          value={notes}
          onChangeText={(text) => setNotes(text.slice(0, NOTES_LIMIT))}
          placeholder="What you covered, and what to focus on before the next session..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[styles.notes, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
        />

        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save notes</Text>
          )}
        </Pressable>
      </ScrollView>

      <RoutinePickerSheet
        visible={picking}
        onClose={() => setPicking(false)}
        onAdd={async (routine, score, routineNotes) => {
          const result = await addSessionRoutine(bookingId, routine.id, routine.name, score, routineNotes);
          if (result.ok) setPicking(false);
          else dialog.alert({ title: "Could not add that routine", message: result.message, tone: "danger" });
        }}
      />

      <RoutineEntryEditSheet
        entry={editing}
        routine={editing ? byId.get(editing.routineId) : undefined}
        custom={editing ? customById.get(editing.routineId) : undefined}
        onClose={() => setEditing(null)}
        onSave={async (score, routineNotes) => {
          if (!editing) return;
          const result = await updateSessionRoutine(editing.id, bookingId, score, routineNotes);
          if (result.ok) setEditing(null);
          else dialog.alert({ title: "Could not update that routine", message: result.message, tone: "danger" });
        }}
        onRemove={() => {
          if (!editing) return;
          removeRoutine(editing.id, editing.routineName);
          setEditing(null);
        }}
      />

      <RescheduleSheet
        visible={rescheduling}
        coachId={booking.coachId}
        bookingId={bookingId}
        onClose={() => setRescheduling(false)}
        // The session is no longer confirmed once a new time is proposed - nothing to do here
        // until the player answers, so this screen closes rather than showing a stale countdown.
        onDone={() => navigation.goBack()}
      />
    </KeyboardAvoidingView>
  );
};

/** Editing one already-covered routine: its score, its notes, and a way to remove it - the
 * overview of what actually happened on that routine, opened by tapping it in the covered list. */
const RoutineEntryEditSheet = ({
  entry,
  routine,
  custom,
  onClose,
  onSave,
  onRemove,
}: {
  entry: SessionRoutineEntry | null;
  routine: Routine | undefined;
  custom: CustomRoutine | undefined;
  onClose: () => void;
  onSave: (score: number | null, notes: string) => Promise<void>;
  onRemove: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [score, setScore] = useState("");
  const [routineNotes, setRoutineNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (entry) {
      setScore(entry.score !== null ? String(entry.score) : "");
      setRoutineNotes(entry.notes ?? "");
    }
  }, [entry]);

  const save = async () => {
    setSaving(true);
    await onSave(score.trim() ? Math.max(0, Math.round(Number(score))) : null, routineNotes);
    setSaving(false);
  };

  return (
    <Modal visible={Boolean(entry)} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        {entry ? (
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.previewScroll}>
            {routine ? <RoutineThumb routine={routine} custom={custom} style={styles.previewImage} /> : null}
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{entry.routineName}</Text>

            <Text style={[styles.label, { color: colors.textMuted }]}>Score (optional)</Text>
            <TextInput
              value={score}
              onChangeText={(text) => setScore(text.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 7"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <Text style={[styles.label, styles.notesLabel, { color: colors.textMuted }]}>Notes on this routine (optional)</Text>
            <TextInput
              value={routineNotes}
              onChangeText={(text) => setRoutineNotes(text.slice(0, ROUTINE_NOTES_LIMIT))}
              placeholder="What to watch on this one..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.routineNotesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <View style={styles.sheetActions}>
              <Pressable onPress={onRemove} accessibilityRole="button" style={[styles.secondaryButton, { borderColor: colors.danger }]}>
                <Text style={[styles.secondaryButtonText, { color: colors.danger }]}>Remove</Text>
              </Pressable>
              <Pressable
                onPress={save}
                disabled={saving}
                accessibilityRole="button"
                style={[styles.save, styles.sheetSave, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save</Text>}
              </Pressable>
            </View>
          </ScrollView>
        ) : null}
      </View>
    </Modal>
  );
};

type RoutineSection = { title: string; categoryId: string; data: Routine[] };

/** Browse the routine library by category (with a preview thumbnail), open one to see what it
 * actually involves, then say how the client did on it. Closes itself once actually added. */
const RoutinePickerSheet = ({
  visible,
  onClose,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  onAdd: (routine: Routine, score: number | null, notes: string) => Promise<void>;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { routines: libraryRoutines, categories } = useRoutinesStore();
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Routine | null>(null);
  const [score, setScore] = useState("");
  const [routineNotes, setRoutineNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set([CUSTOM_CATEGORY_ID]));
  const [lightboxSource, setLightboxSource] = useState<any>(null);

  const mine = useMemo(() => customRoutines.map(toRoutine), [customRoutines]);
  const customById = useMemo(() => new Map(customRoutines.map((routine) => [routine.id, routine])), [customRoutines]);
  const allCategories = useMemo(() => (mine.length ? [CUSTOM_CATEGORY, ...categories] : categories), [mine.length, categories]);
  const categoryName = (categoryId: string) => allCategories.find((category) => category.id === categoryId)?.name ?? "Practice";
  const searching = query.trim().length > 0;

  const toggleSection = (categoryId: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });

  const sections = useMemo(() => {
    const text = query.trim().toLowerCase();
    const all = [...mine, ...libraryRoutines];
    const matches = (routine: Routine) =>
      !text || routine.name.toLowerCase().includes(text) || categoryName(routine.category_id).toLowerCase().includes(text);
    return allCategories
      .map((category): RoutineSection => ({
        title: category.name,
        categoryId: category.id,
        data: all.filter((routine) => routine.category_id === category.id && matches(routine)),
      }))
      .filter((section) => section.data.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, mine, libraryRoutines, allCategories]);

  const visibleSections = useMemo(
    () => sections.map((section) => ({ ...section, data: searching || expanded.has(section.categoryId) ? section.data : [] })),
    [sections, expanded, searching]
  );

  const reset = () => {
    setQuery("");
    setSelected(null);
    setScore("");
    setRoutineNotes("");
  };

  const close = () => {
    reset();
    onClose();
  };

  const buildRoutine = () => {
    close();
    navigation.navigate("CustomRoutineBuilder", { returnToCaller: true });
  };

  const add = async () => {
    if (!selected) return;
    setSaving(true);
    await onAdd(selected, score.trim() ? Math.max(0, Math.round(Number(score))) : null, routineNotes);
    setSaving(false);
    reset();
  };

  const selectedCustom = selected ? customById.get(selected.id) : undefined;
  const selectedThumb = selected ? thumbnailFor(selected) : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={close} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        {!selected ? (
          <>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>Add a routine</Text>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search routines..."
              placeholderTextColor={colors.textMuted}
              style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <Pressable
              onPress={buildRoutine}
              accessibilityRole="button"
              style={[styles.newRoutine, { borderColor: colors.primary }]}
            >
              <MaterialCommunityIcons name="plus-circle-outline" size={20} color={colors.primary} />
              <Text style={[styles.newRoutineText, { color: colors.primary }]}>Build a new routine</Text>
            </Pressable>
            <SectionList
              sections={visibleSections}
              keyExtractor={(item) => item.id}
              style={styles.sheetList}
              keyboardShouldPersistTaps="handled"
              stickySectionHeadersEnabled={false}
              ListEmptyComponent={<Text style={[styles.emptyRoutines, { color: colors.textMuted }]}>No routines match.</Text>}
              renderSectionHeader={({ section }) => {
                const full = sections.find((item) => item.categoryId === section.categoryId);
                const count = full?.data.length ?? 0;
                const isOpen = searching || expanded.has(section.categoryId);
                return (
                  <Pressable
                    onPress={() => toggleSection(section.categoryId)}
                    disabled={searching}
                    accessibilityRole="button"
                    style={[styles.pickerSection, { backgroundColor: colors.surface }]}
                  >
                    <Text style={[styles.pickerSectionText, { color: colors.textMuted }]}>
                      {section.title.toUpperCase()} · {count}
                    </Text>
                    {searching ? null : (
                      <MaterialCommunityIcons name={isOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.textMuted} />
                    )}
                  </Pressable>
                );
              }}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => setSelected(item)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.pickerRow,
                    { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : "transparent" },
                  ]}
                >
                  <RoutineThumb routine={item} custom={customById.get(item.id)} style={styles.pickerThumb} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.pickerName, { color: colors.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={[styles.pickerSummary, { color: colors.textMuted }]} numberOfLines={2}>
                      {item.summary ?? item.description ?? categoryName(item.category_id)}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              )}
            />
          </>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.previewScroll}>
            {selectedCustom ? (
              <RoutineThumb routine={selected} custom={selectedCustom} style={styles.previewImage} />
            ) : selectedThumb ? (
              <RoutineThumb
                routine={selected}
                style={styles.previewImage}
                onPress={() => setLightboxSource(selectedThumb)}
              />
            ) : null}
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{selected.name}</Text>
            {selected.summary || selected.description ? (
              <Text style={[styles.previewSummary, { color: colors.textMuted }]}>{selected.summary ?? selected.description}</Text>
            ) : null}
            {selected.steps?.length ? (
              <>
                <Text style={[styles.label, styles.notesLabel, { color: colors.textMuted }]}>Steps</Text>
                {selected.steps.map((step, index) => (
                  <Text key={index} style={[styles.previewStep, { color: colors.text }]}>
                    {index + 1}. {step}
                  </Text>
                ))}
              </>
            ) : null}

            <Text style={[styles.label, styles.notesLabel, { color: colors.textMuted }]}>Score (optional)</Text>
            <TextInput
              value={score}
              onChangeText={(text) => setScore(text.replace(/[^0-9]/g, ""))}
              placeholder="e.g. 7"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
              style={[styles.search, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <Text style={[styles.label, styles.notesLabel, { color: colors.textMuted }]}>Notes on this routine (optional)</Text>
            <TextInput
              value={routineNotes}
              onChangeText={(text) => setRoutineNotes(text.slice(0, ROUTINE_NOTES_LIMIT))}
              placeholder="What to watch on this one..."
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.routineNotesInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <View style={styles.sheetActions}>
              <Pressable
                onPress={() => setSelected(null)}
                accessibilityRole="button"
                style={[styles.secondaryButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Back</Text>
              </Pressable>
              <Pressable
                onPress={add}
                disabled={saving}
                accessibilityRole="button"
                style={[styles.save, styles.sheetSave, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveText, { color: colors.onPrimary }]}>Add</Text>}
              </Pressable>
            </View>
          </ScrollView>
        )}
      </View>

      <Modal visible={Boolean(lightboxSource)} transparent animationType="fade" onRequestClose={() => setLightboxSource(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.lightbox]}
          onPress={() => setLightboxSource(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          {lightboxSource ? <Image source={lightboxSource} style={styles.lightboxImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1 },
  centre: { alignItems: "center", justifyContent: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACING.lg, paddingBottom: SPACING.md },
  content: { paddingHorizontal: SPACING.lg },
  name: { fontSize: 18, fontWeight: "800" },
  countdownBlock: { alignItems: "center", marginBottom: SPACING.xl },
  countdownLabel: { fontSize: 12, fontFamily: FONTS.boardLabel, letterSpacing: 1 },
  countdown: { fontSize: 48, marginTop: 4 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: SPACING.xs },
  label: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase" },
  notesLabel: { marginTop: SPACING.lg, marginBottom: SPACING.xs },
  addRoutine: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: HIT_TARGET - 8 },
  addRoutineText: { fontSize: 14, fontWeight: "700" },
  routineList: { gap: SPACING.sm },
  emptyRoutines: { fontSize: 14, marginBottom: SPACING.sm },
  routineRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm },
  routineRowMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  routineName: { flex: 1, fontSize: 15, fontWeight: "700" },
  routineNotes: { fontSize: 13, lineHeight: 18 },
  scoreBadge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 2 },
  scoreBadgeText: { fontSize: 13, fontWeight: "800" },
  notes: { minHeight: 140, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, fontSize: 15, lineHeight: 21 },
  save: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginTop: SPACING.md },
  saveText: { fontSize: 16, fontWeight: "800" },
  sheet: { marginTop: "auto", maxHeight: "80%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: SPACING.sm },
  search: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: HIT_TARGET, fontSize: 15, marginBottom: SPACING.sm },
  sheetList: { maxHeight: 420 },
  newRoutine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  newRoutineText: { fontSize: 14, fontWeight: "700" },
  pickerSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACING.sm,
    paddingBottom: 6,
  },
  pickerSectionText: { fontSize: 12, fontWeight: "800", letterSpacing: 0.6 },
  pickerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: SPACING.sm, borderRadius: RADIUS.sm, paddingHorizontal: 4 },
  pickerThumb: { width: 48, height: 48, borderRadius: RADIUS.sm },
  pickerThumbFallback: { alignItems: "center", justifyContent: "center" },
  pickerIcon: { fontSize: 22 },
  pickerName: { fontSize: 15, fontWeight: "700" },
  pickerSummary: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  diagramThumb: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewScroll: { maxHeight: 460 },
  previewImage: { width: "100%", height: 190, borderRadius: RADIUS.md, marginBottom: SPACING.sm, backgroundColor: "#00000022" },
  lightbox: { backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  previewSummary: { fontSize: 14, lineHeight: 20, marginBottom: SPACING.xs },
  previewStep: { fontSize: 13, lineHeight: 19, marginBottom: 2 },
  routineNotesInput: { minHeight: 90, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.md, fontSize: 14, lineHeight: 19 },
  sheetActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.md, marginBottom: SPACING.sm },
  secondaryButton: { flex: 1, minHeight: HIT_TARGET, borderWidth: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 15, fontWeight: "700" },
  sheetSave: { flex: 1, marginTop: 0 },
});
