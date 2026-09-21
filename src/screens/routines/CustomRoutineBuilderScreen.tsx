import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { PracticeStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCustomRoutinesStore } from "../../store";
import { BALL_LOOK, TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { BallTray } from "../../components/scanSnooker/BallTray";
import { describePosition, type BallColour } from "../../features/scanSnooker/table";
import {
  RACK_SIZES,
  coloursOnSpots,
  moveBall,
  placeBall,
  placeLine,
  rackReds,
  removeBall,
  summarise,
  type PlacedBall,
} from "../../features/scanSnooker/position";
import { DESCRIPTION_MAX, NAME_MAX, cleanDraft, validateDraft } from "../../features/customRoutines/customRoutine";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Building a routine, in two steps:
 *   1. the table - place the balls, with room to zoom in and set them precisely
 *   2. the details - a name, what the routine is, and a score to aim for
 * Every change to the table can be undone, one step at a time. Going back from the details
 * returns to the table rather than leaving, and nothing entered is lost.
 */
export const CustomRoutineBuilderScreen = () => {
  const navigation = useNavigation<NavigationProp<PracticeStackParamList>>();
  const route = useRoute<RouteProp<PracticeStackParamList, "CustomRoutineBuilder">>();
  const editingId = route.params?.routineId;
  const existing = useCustomRoutinesStore((state) => (editingId ? state.getById(editingId) : undefined));
  const save = useCustomRoutinesStore((state) => state.save);
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  const [step, setStep] = useState<1 | 2>(1);
  const [balls, setBalls] = useState<PlacedBall[]>(existing?.balls ?? []);
  const [history, setHistory] = useState<PlacedBall[][]>([]);
  const [colour, setColour] = useState<BallColour>("cue");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState(existing?.name ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [maxScore, setMaxScore] = useState(existing?.maxScore ? String(existing.maxScore) : "");
  const [tried, setTried] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Laying reds in a line rather than one at a time, and how many each line lays.
  const [lineMode, setLineMode] = useState(false);
  const [lineCount, setLineCount] = useState(5);
  // Choosing how many reds to rack.
  const [rackOpen, setRackOpen] = useState(false);
  const saved = useRef(false);

  useEffect(() => {
    navigation.setOptions({ title: `${editingId ? "Edit routine" : "New routine"} · ${step} of 2` });
  }, [editingId, navigation, step]);

  const problems = useMemo(
    () => validateDraft({ name, description, maxScore, balls }),
    [balls, description, maxScore, name]
  );
  const changed =
    JSON.stringify(balls) !== JSON.stringify(existing?.balls ?? []) ||
    name !== (existing?.name ?? "") ||
    description !== (existing?.description ?? "") ||
    maxScore !== (existing?.maxScore ? String(existing.maxScore) : "");

  // Back from the details goes to the table; leaving with unsaved work asks first.
  useEffect(
    () =>
      navigation.addListener("beforeRemove", (event) => {
        if (saved.current) return;
        if (step === 2) {
          event.preventDefault();
          setStep(1);
          return;
        }
        if (!changed) return;
        event.preventDefault();
        dialog.confirm({
          title: "Discard this routine?",
          message: "The balls you placed and the details you entered will be lost.",
          icon: "delete-outline",
          tone: "danger",
          confirmLabel: "Discard",
          cancelLabel: "Keep editing",
          onConfirm: () => {
            saved.current = true;
            navigation.dispatch(event.data.action);
          },
        });
      }),
    [changed, dialog, navigation, step]
  );

  // ---------------------------------------------------------------- the table
  /** Every change to the balls goes through here, so it can be undone. */
  const change = (next: PlacedBall[]) => {
    if (next === balls) return;
    setHistory((past) => [...past.slice(-49), balls]);
    setBalls(next);
  };

  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((past) => past.slice(0, -1));
    setBalls(previous);
    setSelectedId(null);
  };

  const place = (point: { x: number; y: number }) => {
    const result = placeBall(balls, colour, point);
    if (result.refused) {
      setNotice(result.refused);
      return;
    }
    setNotice(null);
    change(result.balls);
    setSelectedId(result.placed?.id ?? null);
    if (colour === "cue") setColour("red");
  };

  const layLine = (start: { x: number; y: number }, end: { x: number; y: number }) => {
    const result = placeLine(balls, start, end, lineCount);
    if (result.placed) change(result.balls);
    setNotice(result.notice);
    setSelectedId(null);
  };

  const toggleLine = () => {
    setLineMode((value) => !value);
    setRackOpen(false);
    setSelectedId(null);
    setNotice(null);
  };

  const toggleRack = () => {
    setRackOpen((value) => !value);
    setLineMode(false);
    setSelectedId(null);
    setNotice(null);
  };

  const rack = (count: number) => {
    change(rackReds(balls, count));
    setRackOpen(false);
    setSelectedId(null);
    setNotice(null);
  };

  const next = () => {
    if (!balls.length) {
      setNotice("Place at least one ball on the table first.");
      return;
    }
    setNotice(null);
    setSelectedId(null);
    setStep(2);
  };

  // ---------------------------------------------------------------- the details
  const onSave = () => {
    setTried(true);
    if (Object.keys(problems).length) return;
    const routine = save({ id: editingId, ...cleanDraft({ name, description, maxScore, balls }) });
    saved.current = true;
    if (editingId) navigation.goBack();
    else navigation.navigate("CustomRoutine", { routineId: routine.id });
  };

  const selected = balls.find((ball) => ball.id === selectedId) ?? null;

  if (step === 1) {
    return (
      <View
        style={[
          styles.flex,
          styles.tableStep,
          { backgroundColor: colors.background, paddingBottom: insets.bottom + SPACING.sm },
        ]}
      >
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {lineMode
            ? "Drag across the table to lay reds along a line. Pinch or use + to zoom in for a precise line."
            : "Choose a ball and tap to place it. Drag a ball to move it. Pinch or use + to zoom in."}
        </Text>

        <View style={styles.flex}>
          <TableDiagram
            balls={balls}
            selectedId={selectedId}
            onPlace={place}
            onMove={(id, point) => change(moveBall(balls, id, point))}
            onSelect={setSelectedId}
            zoomable
            lineMode={lineMode}
            lineCount={lineCount}
            onLine={layLine}
          />
        </View>

        {selected ? (
          <View style={[styles.selected, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View
              style={[
                styles.selectedBall,
                { backgroundColor: BALL_LOOK[selected.colour].fill, borderColor: BALL_LOOK[selected.colour].edge },
              ]}
            />
            <Text style={[styles.selectedText, { color: colors.textMuted }]} numberOfLines={2}>
              <Text style={{ color: colors.text, fontWeight: "800" }}>{BALL_LOOK[selected.colour].label}</Text> ·{" "}
              {describePosition(selected).side} · {describePosition(selected).end}
            </Text>
            <Pressable
              onPress={() => {
                change(removeBall(balls, selected.id));
                setSelectedId(null);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Remove the ${BALL_LOOK[selected.colour].label.toLowerCase()}`}
              hitSlop={8}
            >
              <MaterialCommunityIcons name="close-circle-outline" size={22} color={colors.danger} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.summaryRow}>
            <Text style={[styles.summary, { color: notice ? colors.danger : colors.textMuted }]} numberOfLines={2}>
              {notice ?? summarise(balls)}
            </Text>
            <IconTool icon="undo" label="Undo" onPress={undo} disabled={!history.length} />
            <IconTool
              icon="delete-sweep-outline"
              label="Clear the table"
              onPress={() => {
                change([]);
                setSelectedId(null);
              }}
              disabled={!balls.length}
            />
          </View>
        )}

        {lineMode ? (
          <View style={[styles.lineBar, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <View style={[styles.lineBall, { backgroundColor: BALL_LOOK.red.fill, borderColor: BALL_LOOK.red.edge }]} />
            <Text style={[styles.lineLabel, { color: colors.text }]}>Reds along the line</Text>
            <IconTool
              icon="minus"
              label="Fewer reds"
              onPress={() => setLineCount((value) => Math.max(2, value - 1))}
              disabled={lineCount <= 2}
            />
            <Text style={[styles.lineCount, { color: colors.text }]}>{lineCount}</Text>
            <IconTool
              icon="plus"
              label="More reds"
              onPress={() => setLineCount((value) => Math.min(15, value + 1))}
              disabled={lineCount >= 15}
            />
          </View>
        ) : rackOpen ? (
          <View style={[styles.lineBar, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
            <Text style={[styles.lineLabel, { color: colors.text }]}>Rack reds</Text>
            {RACK_SIZES.map((size) => (
              <Pressable
                key={size}
                onPress={() => rack(size)}
                accessibilityRole="button"
                accessibilityLabel={`Rack ${size} reds, with the colours on their spots`}
                style={({ pressed }) => [
                  styles.rackChoice,
                  { borderColor: colors.border, backgroundColor: pressed ? colors.surfaceMuted : colors.background },
                ]}
              >
                <Text style={[styles.rackChoiceText, { color: colors.text }]}>{size}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <BallTray balls={balls} selected={colour} onSelect={setColour} />
        )}

        <View style={styles.tools}>
          <Tool icon="dots-horizontal" label={lineMode ? "Done" : "Line"} onPress={toggleLine} active={lineMode} />
          <Tool icon="triangle-outline" label={rackOpen ? "Close" : "Rack"} onPress={toggleRack} active={rackOpen} />
          <Tool icon="circle-multiple-outline" label="Colours on spots" onPress={() => change(coloursOnSpots(balls))} />
        </View>

        <Pressable
          onPress={next}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Next: details</Text>
          <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onPrimary} />
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* The table as set up, with the way back to it. */}
        <View style={styles.preview}>
          <View style={{ width: Math.min(96, width * 0.24), height: Math.min(96, width * 0.24) * 1.95 }}>
            <TableDiagram balls={balls} readOnly />
          </View>
          <View style={styles.previewText}>
            <Text style={[styles.previewTitle, { color: colors.text }]}>{summarise(balls)}</Text>
            <Pressable onPress={() => setStep(1)} accessibilityRole="button" hitSlop={8} style={styles.editTable}>
              <MaterialCommunityIcons name="pencil-outline" size={16} color={colors.primary} />
              <Text style={[styles.editTableText, { color: colors.primary }]}>Edit table</Text>
            </Pressable>
          </View>
        </View>

        <Field
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Line-up to the pink"
          maxLength={NAME_MAX}
          autoFocus={!editingId}
          error={tried ? problems.name : undefined}
        />
        <Field
          label="Description"
          optional
          value={description}
          onChangeText={setDescription}
          placeholder="How to play it, and what counts as a success"
          maxLength={DESCRIPTION_MAX}
          multiline
          error={tried ? problems.description : undefined}
        />
        <Field
          label="Max score"
          optional
          value={maxScore}
          onChangeText={(text) => setMaxScore(text.replace(/[^0-9]/g, ""))}
          placeholder="e.g. 15"
          keyboardType="number-pad"
          maxLength={3}
          hint="The best possible score, such as the points on the table. Leave empty to count attempts instead."
          error={tried ? problems.maxScore : undefined}
        />

        <Pressable
          onPress={onSave}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>
            {editingId ? "Save changes" : "Save routine"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const Tool = ({
  icon,
  label,
  onPress,
  disabled,
  active,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
  active?: boolean;
}) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, selected: active }}
      style={({ pressed }) => [
        styles.tool,
        {
          borderColor: active ? colors.primary : colors.border,
          backgroundColor: active ? colors.primary : pressed ? colors.surfaceMuted : colors.surface,
          opacity: disabled ? 0.45 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={18} color={active ? colors.onPrimary : colors.text} />
      <Text
        style={[styles.toolText, { color: active ? colors.onPrimary : colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {label}
      </Text>
    </Pressable>
  );
};

/** A small round button with just an icon; its label is read out by screen readers. */
const IconTool = ({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>["name"];
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.iconTool,
        {
          borderColor: colors.border,
          backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
};

const Field = ({
  label,
  optional,
  hint,
  error,
  multiline,
  ...input
}: React.ComponentProps<typeof TextInput> & { label: string; optional?: boolean; hint?: string; error?: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
        {label}
        {optional ? <Text style={{ fontWeight: "500" }}> · optional</Text> : null}
      </Text>
      <TextInput
        {...input}
        multiline={multiline}
        accessibilityLabel={label}
        placeholderTextColor={colors.textSubtle}
        style={[
          styles.input,
          multiline && styles.inputMultiline,
          { color: colors.text, backgroundColor: colors.surface, borderColor: error ? colors.danger : colors.border },
        ]}
      />
      {error || hint ? (
        <Text style={[styles.fieldHint, { color: error ? colors.danger : colors.textMuted }]}>{error ?? hint}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  tableStep: { paddingHorizontal: SPACING.lg, paddingTop: SPACING.sm, gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.md },
  hint: { fontSize: 13, lineHeight: 18 },

  selected: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  selectedBall: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  selectedText: { flex: 1, fontSize: 13, lineHeight: 18 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  summary: { flex: 1, fontSize: 13, fontWeight: "600" },
  iconTool: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  lineBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
  },
  lineBall: { width: 20, height: 20, borderRadius: 10, borderWidth: 1 },
  lineLabel: { flex: 1, fontSize: 14, fontWeight: "700" },
  lineCount: { minWidth: 24, textAlign: "center", fontSize: 18, fontWeight: "800" },
  rackChoice: {
    minWidth: 40,
    minHeight: 36,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.sm,
  },
  rackChoiceText: { fontSize: 16, fontWeight: "800" },

  tools: { flexDirection: "row", gap: SPACING.sm },
  tool: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  toolText: { fontSize: 13, fontWeight: "700", flexShrink: 1 },

  preview: { flexDirection: "row", alignItems: "center", gap: SPACING.lg },
  previewText: { flex: 1, gap: SPACING.sm },
  previewTitle: { fontSize: 16, fontWeight: "800" },
  editTable: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: HIT_TARGET },
  editTableText: { fontSize: 15, fontWeight: "700" },

  field: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: "700" },
  input: {
    minHeight: 48,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: "top" },
  fieldHint: { fontSize: 12, lineHeight: 17 },

  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
});
