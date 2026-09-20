import React, { useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { AppButton } from "../../components/ui/AppButton";
import { useDialog } from "../../components/ui/DialogProvider";
import { leagueRoundCount, leagueTieCount } from "../../features/tournaments/leagueSchedule";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useTournamentsStore } from "../../store";
import type { MatchesStackParamList, TournamentEntryMode, TournamentPairingMode, TournamentType } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { HIT_TARGET, RADIUS, SPACING, TYPE, isSubscriptionLimitError } from "../../constants";

/** The scrim behind a modal, matching AppDialog and FoulSheet. There is no token for it. */
const SCRIM = "rgba(4, 10, 8, 0.72)";

const framesOptions = [1, 3, 5, 7, 9, 11, 13, 19];

/** The five steps, each with the one line that says what it is for. */
const creationSteps = [
  { key: "basics", title: "Basics", blurb: "Name the event and add any notes." },
  { key: "format", title: "Format", blurb: "Set the competition, the entries and the match length." },
  { key: "entries", title: "Entries", blurb: "Add everyone taking part." },
  { key: "draw", title: "Draw", blurb: "Decide who meets who in round one." },
  { key: "review", title: "Review", blurb: "Check the details, then create the tournament." },
] as const;

/** The icon is data the owner picks; the label is what a screen reader says. */
const iconOptions: ReadonlyArray<{ glyph: string; label: string }> = [
  { glyph: "🏆", label: "Trophy" },
  { glyph: "🎱", label: "Snooker ball" },
  { glyph: "⚡", label: "Lightning" },
  { glyph: "🔥", label: "Flame" },
  { glyph: "🥇", label: "Gold medal" },
  { glyph: "🎯", label: "Target" },
];

const drawModes = [
  { value: "animated", label: "One tie at a time", meta: "Names appear slowly, as they do at a live draw." },
  { value: "quick", label: "The whole draw at once", meta: "Show every tie straight away." },
] as const;

const triggerHaptic = async (type: "light" | "success") => {
  try {
    if (type === "light") await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    Vibration.vibrate(type === "light" ? 10 : 18);
  }
};

const isByeName = (value: string) => /^BYE\b/i.test(value);

const arrangeToAvoidByePairs = (items: string[]) => {
  const real = items.filter((value) => !isByeName(value));
  const byes = items.filter((value) => isByeName(value));
  const arranged: string[] = [];

  while (real.length || byes.length) {
    if (real.length) arranged.push(real.shift() as string);
    if (byes.length) arranged.push(byes.shift() as string);
    if (real.length) arranged.push(real.shift() as string);
  }

  return arranged;
};

const makeByeLabel = (existing: string[]) => {
  const byeCount = existing.filter((item) => isByeName(item)).length;
  return byeCount === 0 ? "BYE" : `BYE ${byeCount + 1}`;
};

const buildFreshStartName = (base?: string) => {
  if (!base?.trim()) return "Rematch Series";
  const clean = base.replace(/\s*\(Restart\)$/i, "").trim();
  if (/rematch/i.test(clean)) return clean;
  return `${clean} Rematch`;
};

/** One card. Everything on a step lives inside one of these, so the page reads as a stack. */
const Section = ({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) => {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {hint ? <Text style={[styles.sectionHint, { color: colors.textMuted }]}>{hint}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
};

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const { colors } = useAppTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
};

function Segmented<T extends string>({
  options,
  value,
  onChange,
  groupLabel,
}: {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (next: T) => void;
  groupLabel: string;
}) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.segmentedTrack, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${groupLabel}: ${option.label}`}
            style={[
              styles.segment,
              selected ? { backgroundColor: colors.surface, borderColor: colors.primary } : null,
            ]}
          >
            <Text style={[styles.segmentText, { color: selected ? colors.primary : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export const NewTournamentScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const route = useRoute<RouteProp<MatchesStackParamList, "NewTournament">>();
  const prefill = route.params?.prefill;
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { createTournament } = useTournamentsStore();
  const subscription = useSubscriptionAccess();
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  const [name, setName] = useState(prefill ? buildFreshStartName(prefill.name) : "");
  const [tournamentIcon, setTournamentIcon] = useState("🏆");
  const [notes, setNotes] = useState(prefill?.previousChampion ? `Previous champion: ${prefill.previousChampion}` : "");
  const [participantName, setParticipantName] = useState("");
  const [singlesParticipants, setSinglesParticipants] = useState<string[]>(
    prefill?.entryMode === "singles" ? prefill.participants : []
  );
  const [doublesPlayers, setDoublesPlayers] = useState<string[]>([]);
  const [doublesTeams, setDoublesTeams] = useState<string[]>(
    prefill?.entryMode === "doubles" ? prefill.participants : []
  );
  const [selectedDoublesPlayers, setSelectedDoublesPlayers] = useState<string[]>([]);
  const [tournamentType, setTournamentType] = useState<TournamentType>(prefill?.tournamentType ?? "knockout");
  const [entryMode, setEntryMode] = useState<TournamentEntryMode>(prefill?.entryMode ?? "singles");
  const [pairingMode, setPairingMode] = useState<TournamentPairingMode>(prefill?.pairingMode ?? "random");
  const [bestOfFrames, setBestOfFrames] = useState(prefill?.bestOfFrames ?? 5);
  /** League only: how many times each pair meets. */
  const [meetings, setMeetings] = useState(1);
  const [drawModalVisible, setDrawModalVisible] = useState(false);
  const [drawParticipants, setDrawParticipants] = useState<string[]>([]);
  const [drawPreviewPairs, setDrawPreviewPairs] = useState<Array<{ a: string; b: string }>>([]);
  const [revealedPairs, setRevealedPairs] = useState<Array<{ a: string; b: string }>>([]);
  const [activeDrawPair, setActiveDrawPair] = useState<{ a: string; b: string } | null>(null);
  const [activeMatchNumber, setActiveMatchNumber] = useState<number>(0);
  const [drawComplete, setDrawComplete] = useState(false);
  const [drawPhase, setDrawPhase] = useState<"setup" | "revealing" | "complete">("setup");
  const [slotLeftName, setSlotLeftName] = useState("");
  const [slotRightName, setSlotRightName] = useState("");
  const [drawMode, setDrawMode] = useState<"animated" | "quick">("animated");
  const [didAutoRunDraw, setDidAutoRunDraw] = useState(false);
  const drawTimersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const drawCancelledRef = useRef(false);
  const [manualPairs, setManualPairs] = useState<Array<{ participantA: string; participantB: string }>>([]);
  const [manualAvailable, setManualAvailable] = useState<string[]>([]);
  const [manualPicked, setManualPicked] = useState<string[]>([]);

  const stepFade = useRef(new Animated.Value(1)).current;
  const stepShift = useRef(new Animated.Value(0)).current;
  const revealAOpacity = useRef(new Animated.Value(0)).current;
  const revealATranslate = useRef(new Animated.Value(-34)).current;
  const revealBOpacity = useRef(new Animated.Value(0)).current;
  const revealBTranslate = useRef(new Animated.Value(34)).current;
  const revealPulse = useRef(new Animated.Value(1)).current;
  const finalRevealAnim = useRef(new Animated.Value(0)).current;

  const participants = entryMode === "singles" ? singlesParticipants : doublesTeams;
  const realEntries = participants.filter((item) => !isByeName(item));
  const byeCount = participants.length - realEntries.length;
  const hasEnoughParticipants = realEntries.length >= 2;
  const framesToWin = Math.floor(bestOfFrames / 2) + 1;
  const leagueTies = leagueTieCount(realEntries.length, meetings);
  const leagueRounds = leagueRoundCount(realEntries.length, meetings);
  const step = creationSteps[currentStep];
  const isLastStep = currentStep === creationSteps.length - 1;

  const entryNoun = (count: number) => {
    if (entryMode === "singles") return count === 1 ? "player" : "players";
    return count === 1 ? "team" : "teams";
  };

  React.useEffect(() => {
    if (tournamentType !== "knockout" || pairingMode !== "manual") return;
    const seeded = participants.length % 2 !== 0 ? [...participants, makeByeLabel(participants)] : [...participants];
    setManualAvailable(arrangeToAvoidByePairs(seeded));
    setManualPairs([]);
    setManualPicked([]);
  }, [participants, pairingMode, tournamentType]);

  const clearRevealTimer = () => {
    drawCancelledRef.current = true;
    drawTimersRef.current.forEach((timer) => clearTimeout(timer));
    drawTimersRef.current = [];
  };

  React.useEffect(
    () => () => {
      clearRevealTimer();
    },
    []
  );

  const waitFor = (duration: number) =>
    new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, duration);
      drawTimersRef.current.push(timer);
    });

  const animateSlotReveal = async (
    target: string,
    pool: string[],
    setter: (value: string) => void
  ) => {
    const sequence = [70, 70, 80, 90, 105, 120, 145, 175, 220];
    for (let index = 0; index < sequence.length; index += 1) {
      if (drawCancelledRef.current) return;
      const candidate = pool[Math.floor(Math.random() * pool.length)] ?? target;
      setter(candidate);
      await waitFor(sequence[index]);
    }
    setter(target);
    await triggerHaptic("light");
  };

  const startDrawSequence = async () => {
    if (!drawPreviewPairs.length) return;

    drawCancelledRef.current = false;
    finalRevealAnim.setValue(0);
    setDrawPhase("revealing");
    setDrawComplete(false);
    setRevealedPairs([]);
    setActiveDrawPair(null);
    setActiveMatchNumber(0);

    if (drawMode === "quick") {
      setRevealedPairs(drawPreviewPairs);
      setDrawComplete(true);
      setDrawPhase("complete");
      Animated.timing(finalRevealAnim, { toValue: 1, duration: 280, useNativeDriver: true }).start();
      await triggerHaptic("success");
      return;
    }

    const slotPool = Array.from(new Set(drawPreviewPairs.flatMap((pair) => [pair.a, pair.b])));

    for (let index = 0; index < drawPreviewPairs.length; index += 1) {
      if (drawCancelledRef.current) return;

      const pair = drawPreviewPairs[index];
      setActiveDrawPair(pair);
      setActiveMatchNumber(index + 1);
      setSlotLeftName("...");
      setSlotRightName("...");

      revealAOpacity.setValue(0);
      revealATranslate.setValue(-26);
      revealBOpacity.setValue(0);
      revealBTranslate.setValue(26);
      revealPulse.setValue(1);

      Animated.parallel([
        Animated.timing(revealAOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(revealATranslate, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      await animateSlotReveal(pair.a, slotPool, setSlotLeftName);
      await waitFor(180);

      Animated.parallel([
        Animated.timing(revealBOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(revealBTranslate, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();

      await animateSlotReveal(pair.b, slotPool, setSlotRightName);

      await new Promise<void>((resolve) => {
        Animated.sequence([
          Animated.timing(revealPulse, { toValue: 1.05, duration: 160, useNativeDriver: true }),
          Animated.timing(revealPulse, { toValue: 1, duration: 180, useNativeDriver: true }),
        ]).start(() => resolve());
      });

      if (drawCancelledRef.current) return;

      await triggerHaptic("success");
      setRevealedPairs((prev) => [...prev, pair]);
      await waitFor(340);
    }

    setActiveDrawPair(null);
    setDrawComplete(true);
    setDrawPhase("complete");
    Animated.timing(finalRevealAnim, { toValue: 1, duration: 320, useNativeDriver: true }).start();
    await triggerHaptic("success");
  };

  const onAddEntry = () => {
    const trimmed = participantName.trim();
    if (!trimmed) return;

    if (entryMode === "singles") {
      if (singlesParticipants.includes(trimmed)) {
        dialog.alert({
          title: "Already in the draw",
          message: "That name is entered. Add an initial or surname to tell two players apart.",
          icon: "account-alert-outline",
          confirmLabel: "Got it",
        });
        return;
      }
      setSinglesParticipants((prev) => [...prev, trimmed]);
    } else {
      if (doublesPlayers.includes(trimmed)) {
        dialog.alert({
          title: "Already in the pool",
          message: "That name is waiting to be paired up. Add an initial or surname to tell two players apart.",
          icon: "account-alert-outline",
          confirmLabel: "Got it",
        });
        return;
      }
      setDoublesPlayers((prev) => [...prev, trimmed]);
    }

    setParticipantName("");
  };

  const randomiseAndDraw = () => {
    if (participants.length < 2) return;

    const shuffled = [...participants];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    const arranged = arrangeToAvoidByePairs(shuffled);
    setDrawParticipants(arranged);

    const seeded = arranged.length % 2 !== 0 ? [...arranged, makeByeLabel(arranged)] : arranged;
    const pairs: Array<{ a: string; b: string }> = [];
    for (let i = 0; i < seeded.length; i += 2) {
      pairs.push({ a: seeded[i], b: seeded[i + 1] ?? "BYE" });
    }

    clearRevealTimer();
    drawCancelledRef.current = false;
    setDrawPreviewPairs(pairs);
    setRevealedPairs([]);
    setActiveDrawPair(null);
    setActiveMatchNumber(0);
    setDrawComplete(false);
    setDrawPhase("setup");
    setSlotLeftName("");
    setSlotRightName("");
    finalRevealAnim.setValue(0);
    setDrawModalVisible(true);
  };

  React.useEffect(() => {
    if (!prefill?.autoRunDraw || didAutoRunDraw) return;
    if (participants.length < 2) return;

    setDidAutoRunDraw(true);
    randomiseAndDraw();
  }, [didAutoRunDraw, participants.length, prefill?.autoRunDraw]);

  React.useEffect(() => {
    if (!drawModalVisible || drawPhase !== "setup" || !prefill?.autoRunDraw) return;
    if (!drawPreviewPairs.length) return;
    void startDrawSequence();
  }, [drawModalVisible, drawPhase, prefill?.autoRunDraw, drawPreviewPairs.length]);

  const removeParticipant = (target: string) => {
    if (entryMode === "singles") setSinglesParticipants((prev) => prev.filter((item) => item !== target));
    else setDoublesTeams((prev) => prev.filter((item) => item !== target));
  };

  const addByeSlot = () => {
    const label = makeByeLabel(participants);
    if (entryMode === "singles") {
      setSinglesParticipants((prev) => [...prev, label]);
      return;
    }

    setDoublesTeams((prev) => [...prev, label]);
  };

  const pickManualEntry = (nameValue: string) => {
    setManualAvailable((prev) => prev.filter((item) => item !== nameValue));
    setManualPicked((prev) => {
      const next = [...prev, nameValue];
      if (next.length < 2) return next;

      setManualPairs((pairs) => [...pairs, { participantA: next[0], participantB: next[1] }]);
      return [];
    });
  };

  const unpickManualEntry = (nameValue: string) => {
    setManualPicked((prev) => prev.filter((item) => item !== nameValue));
    setManualAvailable((prev) => [...prev, nameValue]);
  };

  const undoLastManualFixture = () => {
    setManualPairs((prev) => {
      if (!prev.length) return prev;
      const last = prev[prev.length - 1];
      setManualAvailable((available) => [...available, last.participantA, last.participantB]);
      return prev.slice(0, -1);
    });
  };

  const resetManualPairing = () => {
    const seeded = participants.length % 2 !== 0 ? [...participants, makeByeLabel(participants)] : [...participants];
    setManualAvailable(arrangeToAvoidByePairs(seeded));
    setManualPairs([]);
    setManualPicked([]);
  };

  const removeDoublesPlayer = (target: string) => {
    setDoublesPlayers((prev) => prev.filter((item) => item !== target));
    setSelectedDoublesPlayers((prev) => prev.filter((item) => item !== target));
  };

  const toggleDoublesSelection = (nameValue: string) => {
    setSelectedDoublesPlayers((prev) => {
      if (prev.includes(nameValue)) return prev.filter((item) => item !== nameValue);
      if (prev.length >= 2) return prev;
      return [...prev, nameValue];
    });
  };

  const createTeamFromSelection = () => {
    if (selectedDoublesPlayers.length !== 2) return;
    const [a, b] = selectedDoublesPlayers;
    const teamName = `${a} & ${b}`;

    if (doublesTeams.includes(teamName)) return;

    setDoublesTeams((prev) => [...prev, teamName]);
    setDoublesPlayers((prev) => prev.filter((player) => player !== a && player !== b));
    setSelectedDoublesPlayers([]);
  };

  const randomBuildDoublesTeams = () => {
    if (doublesPlayers.length < 2) return;
    const pool = [...doublesPlayers];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }

    const newTeams: string[] = [];
    for (let i = 0; i < pool.length - 1; i += 2) {
      newTeams.push(`${pool[i]} & ${pool[i + 1]}`);
    }

    const leftovers = pool.length % 2 === 1 ? [pool[pool.length - 1]] : [];
    setDoublesTeams((prev) => [...prev, ...newTeams]);
    setDoublesPlayers(leftovers);
    setSelectedDoublesPlayers([]);
  };

  const createWith = async (options?: {
    entriesOverride?: string[];
    manualFixturesOverride?: Array<{ participantA: string; participantB: string }>;
  }) => {
    if (!subscription.canCreateTournament) {
      setShowPaywall(true);
      return;
    }

    const sourceParticipants = options?.entriesOverride ?? participants;
    const manualFixturesOverride = options?.manualFixturesOverride;

    if (!name.trim()) {
      dialog.alert({
        title: "Name the tournament first",
        message: "Give the event a name on the Basics step, then come back and create it.",
        icon: "trophy-outline",
        confirmLabel: "Back to basics",
      });
      return;
    }

    if (sourceParticipants.filter((item) => item !== "BYE" && !/^BYE\b/i.test(item)).length < 2) {
      dialog.alert({
        title: "Not enough entries",
        message: "You need at least two real entries before a draw can be made. Byes do not count.",
        icon: "account-multiple-outline",
        confirmLabel: "Add entries",
      });
      return;
    }

    if (tournamentType === "knockout") {
      const effectiveManualPairs = manualFixturesOverride ?? manualPairs;
      const source =
        manualFixturesOverride?.length || pairingMode === "manual"
          ? effectiveManualPairs.flatMap((pair) => [pair.participantA, pair.participantB])
          : sourceParticipants;
      const seeded = source.length % 2 !== 0 ? [...source, makeByeLabel(source)] : source;
      const hasByeVsBye = seeded.some((_, index) => {
        if (index % 2 !== 0) return false;
        return isByeName(seeded[index]) && isByeName(seeded[index + 1] ?? "");
      });

      if (hasByeVsBye) {
        dialog.alert({
          title: "Two byes cannot meet",
          message: "Every bye must be drawn against a real entry, or nobody walks over. Reorder the draw and try again.",
          icon: "alert-outline",
          confirmLabel: "Reorder the draw",
        });
        return;
      }

      if (pairingMode === "manual" && (manualAvailable.length > 0 || manualPicked.length > 0)) {
        dialog.alert({
          title: "The draw is not finished",
          message: "Some entries are still unpaired. Pair every one of them into a fixture before you create the tournament.",
          icon: "alert-outline",
          confirmLabel: "Finish the draw",
        });
        return;
      }
    }

    try {
      setIsSaving(true);
      const tournamentId = await createTournament({
        name: `${tournamentIcon} ${name}`.trim(),
        notes,
        tournamentType,
        entryMode,
        pairingMode,
        bestOfFrames,
        meetings: tournamentType === "league" ? meetings : undefined,
        participants: sourceParticipants,
        manualFixtures: manualFixturesOverride ?? (pairingMode === "manual" ? manualPairs : undefined),
      });

      navigation.navigate("TournamentDetail", { tournamentId });
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        dialog.alert({
          title: "Could not create the tournament",
          message: "Nothing was saved, so your setup is still here. Check your connection and try again.",
          tone: "danger",
          icon: "wifi-off",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const create = async () => createWith();

  const transitionToStep = (nextStep: number) => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(stepFade, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(stepShift, { toValue: -8, duration: 120, useNativeDriver: true }),
      ]),
      Animated.parallel([
        Animated.timing(stepFade, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(stepShift, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]),
    ]).start();
    setCurrentStep(nextStep);
  };

  const canGoNext = () => {
    if (currentStep === 0) return !!name.trim();
    if (currentStep === 2) return hasEnoughParticipants;
    if (currentStep === 3 && tournamentType === "knockout" && pairingMode === "manual") {
      return manualAvailable.length === 0 && manualPicked.length === 0;
    }
    return true;
  };

  const closeDrawModal = () => {
    clearRevealTimer();
    setDrawModalVisible(false);
  };

  /** A removable chip: an entry, a team, or a name waiting to be paired. */
  const renderChip = (
    label: string,
    onPress: () => void,
    options?: { selected?: boolean; removable?: boolean; accessibilityLabel?: string; onLongPress?: () => void }
  ) => {
    const selected = options?.selected ?? false;
    const bye = isByeName(label);

    return (
      <Pressable
        key={label}
        onPress={onPress}
        onLongPress={options?.onLongPress}
        accessibilityRole="button"
        accessibilityState={{ selected }}
        accessibilityLabel={options?.accessibilityLabel ?? `Remove ${label}`}
        style={({ pressed }) => [
          styles.chip,
          {
            borderColor: selected ? colors.primary : colors.border,
            backgroundColor: selected ? colors.surface : colors.surfaceMuted,
            opacity: pressed ? 0.75 : 1,
          },
        ]}
      >
        <Text
          style={[
            styles.chipText,
            { color: selected ? colors.primary : bye ? colors.textSubtle : colors.text },
          ]}
        >
          {bye ? "Bye" : label}
        </Text>
        {options?.removable ? (
          <MaterialCommunityIcons name="close" size={14} color={colors.textSubtle} />
        ) : null}
      </Pressable>
    );
  };

  const renderBasicsStep = () => (
    <Section title="Event" hint="Only the name is needed to carry on.">
      <Field label="Tournament name">
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Friday club open"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Tournament name"
          style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
        />
      </Field>

      <Field label="Event icon">
        <View style={styles.chipRow}>
          {iconOptions.map((option) => {
            const selected = tournamentIcon === option.glyph;
            return (
              <Pressable
                key={option.glyph}
                onPress={() => setTournamentIcon(option.glyph)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Event icon: ${option.label}`}
                style={[
                  styles.iconTile,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surface : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={styles.iconGlyph}>{option.glyph}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Field label="Notes (optional)">
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Final night starts at 7:30pm"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Notes about the tournament"
          multiline
          textAlignVertical="top"
          style={[
            styles.input,
            styles.notes,
            { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted },
          ]}
        />
      </Field>
    </Section>
  );

  const renderFormatStep = () => (
    <>
      <Section title="Competition">
        <View style={styles.cardsRow}>
          {(
            [
              { value: "knockout", icon: "trophy-outline", title: "Knockout", meta: "Single elimination bracket" },
              { value: "league", icon: "format-list-numbered", title: "League", meta: "Round robin standings" },
            ] as const
          ).map((option) => {
            const selected = tournamentType === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setTournamentType(option.value)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.title}. ${option.meta}`}
                style={[
                  styles.selectCard,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surface : colors.surfaceMuted,
                  },
                ]}
              >
                <MaterialCommunityIcons
                  name={option.icon}
                  size={22}
                  color={selected ? colors.primary : colors.textMuted}
                />
                <Text style={[styles.selectTitle, { color: colors.text }]}>{option.title}</Text>
                <Text style={[styles.selectMeta, { color: colors.textMuted }]}>{option.meta}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.field}>
          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Singles or doubles</Text>
          <Segmented
            groupLabel="Entry mode"
            value={entryMode}
            onChange={setEntryMode}
            options={[
              { value: "singles" as TournamentEntryMode, label: "Singles" },
              { value: "doubles" as TournamentEntryMode, label: "Doubles" },
            ]}
          />
        </View>
      </Section>

      {tournamentType === "knockout" ? (
        <Section
          title="The draw"
          hint={
            pairingMode === "random"
              ? "Names are pulled at random when you open the draw."
              : "You pair the entries yourself on the draw step."
          }
        >
          <Segmented
            groupLabel="Draw"
            value={pairingMode}
            onChange={setPairingMode}
            options={[
              { value: "random" as TournamentPairingMode, label: "Random" },
              { value: "manual" as TournamentPairingMode, label: "Manual" },
            ]}
          />
        </Section>
      ) : null}

      {tournamentType === "league" ? (
        <Section
          title="How often does everyone play each other?"
          hint={
            realEntries.length >= 2
              ? `${leagueTies} ${leagueTies === 1 ? "match" : "matches"} in total, over ${leagueRounds} ${
                  leagueRounds === 1 ? "round" : "rounds"
                }.`
              : "Add players to see how long the league will run."
          }
        >
          <View style={styles.chipRow}>
            {[1, 2, 3, 4].map((option) => {
              const selected = meetings === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setMeetings(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={
                    option === 1 ? "Play everyone once" : `Play everyone ${option} times`
                  }
                  style={[
                    styles.meetingChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surface : colors.surfaceMuted,
                    },
                  ]}
                >
                  <Text style={[styles.meetingLabel, { color: selected ? colors.primary : colors.text }]}>
                    {option === 1 ? "Once" : option === 2 ? "Twice" : `${option} times`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Section>
      ) : null}

      <Section title="Match length" hint={`Best of ${bestOfFrames}, so first to ${framesToWin} frames.`}>
        <View style={styles.chipRow}>
          {framesOptions.map((option) => {
            const selected = bestOfFrames === option;
            return (
              <Pressable
                key={option}
                onPress={() => setBestOfFrames(option)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`Best of ${option} frames`}
                style={[
                  styles.frameChip,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surface : colors.surfaceMuted,
                  },
                ]}
              >
                <Text style={[styles.frameLabel, { color: selected ? colors.primary : colors.text }]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>
      </Section>
    </>
  );

  const renderEntriesStep = () => (
    <>
      <Section
        title={entryMode === "singles" ? "Players" : "Player pool"}
        hint={
          entryMode === "singles"
            ? "Tap a name to take it out."
            : "Tap two players to pair them up. Long press a name to take it out."
        }
      >
        <View style={styles.addRow}>
          <TextInput
            value={participantName}
            onChangeText={setParticipantName}
            onSubmitEditing={onAddEntry}
            placeholder={entryMode === "singles" ? "Player name" : "Player name for the pool"}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={entryMode === "singles" ? "Player name" : "Player name for the pool"}
            style={[
              styles.input,
              styles.flexInput,
              { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted },
            ]}
          />
          <View style={styles.addButtonWrap}>
            <AppButton label="Add" onPress={onAddEntry} />
          </View>
        </View>

        {entryMode === "singles" ? (
          singlesParticipants.length ? (
            <View style={styles.chipRow}>
              {singlesParticipants.map((nameValue) =>
                renderChip(nameValue, () => removeParticipant(nameValue), { removable: true })
              )}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSubtle }]}>Nobody entered yet.</Text>
          )
        ) : (
          <>
            {doublesPlayers.length ? (
              <View style={styles.chipRow}>
                {doublesPlayers.map((nameValue) =>
                  renderChip(nameValue, () => toggleDoublesSelection(nameValue), {
                    selected: selectedDoublesPlayers.includes(nameValue),
                    accessibilityLabel: `${nameValue}. Tap to pair, long press to remove`,
                    onLongPress: () => removeDoublesPlayer(nameValue),
                  })
                )}
              </View>
            ) : (
              <Text style={[styles.emptyText, { color: colors.textSubtle }]}>The pool is empty.</Text>
            )}

            <View style={styles.buttonRow}>
              <View style={styles.buttonCell}>
                <AppButton
                  label="Pair selected"
                  onPress={createTeamFromSelection}
                  disabled={selectedDoublesPlayers.length !== 2}
                />
              </View>
              <View style={styles.buttonCell}>
                <AppButton
                  label="Pair at random"
                  variant="secondary"
                  onPress={randomBuildDoublesTeams}
                  disabled={doublesPlayers.length < 2}
                />
              </View>
            </View>
          </>
        )}
      </Section>

      {entryMode === "doubles" ? (
        <Section title="Teams" hint="Tap a team to take it out of the draw.">
          {doublesTeams.length ? (
            <View style={styles.chipRow}>
              {doublesTeams.map((team) => renderChip(team, () => removeParticipant(team), { removable: true }))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSubtle }]}>No teams paired yet.</Text>
          )}
        </Section>
      ) : null}

      {tournamentType === "knockout" ? (
        <Section title="Byes" hint="A bye is an empty slot, so the entry drawn against it walks over.">
          <AppButton label="Add a bye" variant="secondary" onPress={addByeSlot} />
        </Section>
      ) : null}

      <Text style={[styles.footnote, { color: colors.textMuted }]}>
        {realEntries.length} {entryNoun(realEntries.length)}
        {byeCount ? ` and ${byeCount} ${byeCount === 1 ? "bye" : "byes"}` : ""}
        {hasEnoughParticipants ? "." : ". Two entries are needed to carry on."}
      </Text>
    </>
  );

  const renderDrawStep = () => {
    if (tournamentType === "league") {
      return (
        <Section title="Fixtures" hint="Everyone plays everyone else.">
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            The league table and its fixtures are built for you when the tournament is created, so there is nothing to
            do here.
          </Text>
        </Section>
      );
    }

    if (pairingMode === "random") {
      return (
        <Section title="Random draw" hint="Entries are paired at random, and no bye ever meets another bye.">
          <Text style={[styles.bodyText, { color: colors.textMuted }]}>
            Open the draw to see the round one ties, one at a time or all at once.
          </Text>
          <View style={styles.primaryAction}>
            <AppButton label="Open the draw" onPress={randomiseAndDraw} disabled={participants.length < 2} />
          </View>
        </Section>
      );
    }

    const paired = manualPairs.length;
    const left = manualAvailable.length + manualPicked.length;

    return (
      <>
        <Section title="Pair the entries" hint="Tap one entry, then another, to make a tie.">
          {manualPicked.length ? (
            <View style={styles.chipRow}>
              {manualPicked.map((item) =>
                renderChip(item, () => unpickManualEntry(item), {
                  selected: true,
                  accessibilityLabel: `${item} is picked. Tap to put it back`,
                })
              )}
            </View>
          ) : null}

          {manualAvailable.length ? (
            <View style={styles.chipRow}>
              {manualAvailable.map((item) =>
                renderChip(item, () => pickManualEntry(item), {
                  accessibilityLabel: `Pick ${item} for the next tie`,
                })
              )}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSubtle }]}>Every entry is paired.</Text>
          )}

          <Text style={[styles.footnote, { color: colors.textMuted }]}>
            {paired} {paired === 1 ? "tie" : "ties"} made
            {left ? ` · ${left} still to pair` : ""}
          </Text>

          <View style={styles.buttonRow}>
            <View style={styles.buttonCell}>
              <AppButton label="Undo" variant="secondary" onPress={undoLastManualFixture} disabled={!manualPairs.length} />
            </View>
            <View style={styles.buttonCell}>
              <AppButton label="Start again" variant="secondary" onPress={resetManualPairing} />
            </View>
          </View>
        </Section>

        <Section title="Round one">
          {manualPairs.length ? (
            <View style={styles.tieList}>
              {manualPairs.map((pair, index) => (
                <View
                  key={`manual-${index}`}
                  style={[styles.tieRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                >
                  <Text style={[styles.tieRowIndex, { color: colors.textSubtle }]}>{index + 1}</Text>
                  <View style={styles.tieRowNames}>
                    <Text
                      style={[
                        styles.tieRowName,
                        { color: isByeName(pair.participantA) ? colors.textSubtle : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {isByeName(pair.participantA) ? "Bye" : pair.participantA}
                    </Text>
                    <View style={[styles.tieRowDivider, { backgroundColor: colors.border }]} />
                    <Text
                      style={[
                        styles.tieRowName,
                        { color: isByeName(pair.participantB) ? colors.textSubtle : colors.text },
                      ]}
                      numberOfLines={1}
                    >
                      {isByeName(pair.participantB) ? "Bye" : pair.participantB}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyText, { color: colors.textSubtle }]}>No ties made yet.</Text>
          )}
        </Section>
      </>
    );
  };

  const renderReviewStep = () => {
    const summary: Array<{ label: string; value: string }> = [
      { label: "Event", value: `${tournamentIcon} ${name || "Untitled tournament"}` },
      {
        label: "Competition",
        value: `${tournamentType === "knockout" ? "Knockout" : "League"} · ${
          entryMode === "singles" ? "Singles" : "Doubles"
        }`,
      },
      {
        label: "Draw",
        value:
          tournamentType === "knockout"
            ? pairingMode === "manual"
              ? "Paired by hand"
              : "Drawn at random"
            : "Fixtures built automatically",
      },
      { label: "Match length", value: `Best of ${bestOfFrames}, first to ${framesToWin}` },
      ...(tournamentType === "league"
        ? [
            {
              label: "Fixtures",
              value: `Everyone plays each other ${meetings === 1 ? "once" : meetings === 2 ? "twice" : `${meetings} times`}, ${leagueTies} matches`,
            },
          ]
        : []),
      {
        label: "Entries",
        value: `${realEntries.length} ${entryNoun(realEntries.length)}${
          byeCount ? `, ${byeCount} ${byeCount === 1 ? "bye" : "byes"}` : ""
        }`,
      },
    ];

    return (
      <Section title="Summary" hint="Change anything by going back a step.">
        <View style={styles.summaryList}>
          {summary.map((row) => (
            <View key={row.label} style={[styles.summaryRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{row.label}</Text>
              <Text style={[styles.summaryValue, { color: colors.text }]}>{row.value}</Text>
            </View>
          ))}
        </View>
        {notes.trim() ? <Text style={[styles.bodyText, { color: colors.textMuted }]}>{notes.trim()}</Text> : null}
      </Section>
    );
  };

  const renderCurrentStep = () => {
    if (currentStep === 0) return renderBasicsStep();
    if (currentStep === 1) return renderFormatStep();
    if (currentStep === 2) return renderEntriesStep();
    if (currentStep === 3) return renderDrawStep();
    return renderReviewStep();
  };

  const renderDrawSetup = () => (
    <View style={styles.drawBody}>
      <Text style={[styles.drawPhaseTitle, { color: colors.text }]}>How should the draw be revealed?</Text>

      {drawModes.map((mode) => {
        const selected = drawMode === mode.value;
        return (
          <Pressable
            key={mode.value}
            onPress={() => setDrawMode(mode.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${mode.label}. ${mode.meta}`}
            style={[
              styles.modeOption,
              {
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.surface : colors.surfaceMuted,
              },
            ]}
          >
            <View style={[styles.radio, { borderColor: selected ? colors.primary : colors.borderStrong }]}>
              {selected ? <View style={[styles.radioDot, { backgroundColor: colors.primary }]} /> : null}
            </View>
            <View style={styles.modeText}>
              <Text style={[styles.modeTitle, { color: colors.text }]}>{mode.label}</Text>
              <Text style={[styles.modeMeta, { color: colors.textMuted }]}>{mode.meta}</Text>
            </View>
          </Pressable>
        );
      })}

      <View style={styles.anchoredAction}>
        <AppButton label="Start the draw" onPress={() => void startDrawSequence()} disabled={!drawPreviewPairs.length} />
      </View>
    </View>
  );

  const renderDrawRevealing = () => (
    <View style={styles.drawBody}>
      <Text style={[styles.drawKicker, { color: colors.textMuted }]}>
        Tie {Math.max(activeMatchNumber, 1)} of {drawPreviewPairs.length}
      </Text>

      <Animated.View
        style={[
          styles.tieCard,
          {
            borderColor: colors.borderStrong,
            backgroundColor: colors.surfaceMuted,
            transform: [{ scale: revealPulse }],
          },
        ]}
      >
        <Animated.View
          style={[styles.tieSlot, { opacity: revealAOpacity, transform: [{ translateY: revealATranslate }] }]}
        >
          <Text style={[styles.tieSlotName, { color: colors.text }]} numberOfLines={1}>
            {slotLeftName || "—"}
          </Text>
        </Animated.View>

        <View style={styles.tieSplit}>
          <View style={[styles.tieSplitLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.tieSplitText, { color: colors.textSubtle }]}>v</Text>
          <View style={[styles.tieSplitLine, { backgroundColor: colors.border }]} />
        </View>

        <Animated.View
          style={[styles.tieSlot, { opacity: revealBOpacity, transform: [{ translateY: revealBTranslate }] }]}
        >
          <Text style={[styles.tieSlotName, { color: colors.text }]} numberOfLines={1}>
            {slotRightName || "—"}
          </Text>
        </Animated.View>
      </Animated.View>

      <Text style={[styles.drawProgress, { color: colors.textMuted }]}>
        {revealedPairs.length} of {drawPreviewPairs.length} drawn
        {activeDrawPair ? " · drawing the next name" : ""}
      </Text>

      {revealedPairs.length ? (
        <ScrollView style={styles.drawList} contentContainerStyle={styles.drawListContent}>
          {revealedPairs.map((pair, index) => (
            <View
              key={`revealed-${pair.a}-${pair.b}-${index}`}
              style={[styles.tieRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            >
              <Text style={[styles.tieRowIndex, { color: colors.textSubtle }]}>{index + 1}</Text>
              <View style={styles.tieRowNames}>
                <Text
                  style={[styles.tieRowName, { color: isByeName(pair.a) ? colors.textSubtle : colors.text }]}
                  numberOfLines={1}
                >
                  {isByeName(pair.a) ? "Bye" : pair.a}
                </Text>
                <View style={[styles.tieRowDivider, { backgroundColor: colors.border }]} />
                <Text
                  style={[styles.tieRowName, { color: isByeName(pair.b) ? colors.textSubtle : colors.text }]}
                  numberOfLines={1}
                >
                  {isByeName(pair.b) ? "Bye" : pair.b}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );

  const renderDrawComplete = () => (
    <Animated.View
      style={[
        styles.drawBody,
        {
          opacity: finalRevealAnim,
          transform: [
            {
              scale: finalRevealAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.96, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={[styles.completeBadge, { backgroundColor: colors.accentWash, borderColor: colors.accent }]}>
        <MaterialCommunityIcons name="trophy-outline" size={15} color={colors.accent} />
        <Text style={[styles.completeBadgeText, { color: colors.accent }]}>The draw is made</Text>
      </View>

      <Text style={[styles.drawPhaseTitle, { color: colors.text }]}>Round one</Text>

      <ScrollView style={styles.drawList} contentContainerStyle={styles.drawListContent}>
        {revealedPairs.map((pair, index) => (
          <View
            key={`${pair.a}-${pair.b}-${index}`}
            style={[styles.tieRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
          >
            <Text style={[styles.tieRowIndex, { color: colors.textSubtle }]}>{index + 1}</Text>
            <View style={styles.tieRowNames}>
              <Text
                style={[styles.tieRowName, { color: isByeName(pair.a) ? colors.textSubtle : colors.text }]}
                numberOfLines={1}
              >
                {isByeName(pair.a) ? "Bye" : pair.a}
              </Text>
              <View style={[styles.tieRowDivider, { backgroundColor: colors.border }]} />
              <Text
                style={[styles.tieRowName, { color: isByeName(pair.b) ? colors.textSubtle : colors.text }]}
                numberOfLines={1}
              >
                {isByeName(pair.b) ? "Bye" : pair.b}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={styles.primaryAction}>
        <AppButton
          label="Use this draw"
          disabled={!drawComplete}
          onPress={async () => {
            clearRevealTimer();
            setDrawModalVisible(false);
            await createWith({
              entriesOverride: drawParticipants.length
                ? drawParticipants
                : entryMode === "singles"
                  ? singlesParticipants
                  : doublesTeams,
              manualFixturesOverride: drawPreviewPairs.map((pair) => ({ participantA: pair.a, participantB: pair.b })),
            });
          }}
        />
      </View>

      <Pressable
        onPress={randomiseAndDraw}
        disabled={participants.length < 2}
        accessibilityRole="button"
        accessibilityLabel="Draw again"
        style={({ pressed }) => [styles.quietAction, { opacity: participants.length < 2 ? 0.5 : pressed ? 0.7 : 1 }]}
      >
        <Text style={[styles.quietActionText, { color: colors.textMuted }]}>Draw again</Text>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.progressBlock}>
          <Text style={[styles.progressLabel, { color: colors.textMuted }]}>
            Step {currentStep + 1} of {creationSteps.length} · {step.title}
          </Text>

          <View style={styles.railRow}>
            {creationSteps.map((item, index) => (
              <Pressable
                key={item.key}
                onPress={() => transitionToStep(index)}
                hitSlop={{ top: 18, bottom: 18, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityState={{ selected: index === currentStep }}
                accessibilityLabel={`Go to step ${index + 1} of ${creationSteps.length}, ${item.title}`}
                style={styles.railSegment}
              >
                <View
                  style={[
                    styles.railFill,
                    { backgroundColor: index <= currentStep ? colors.primary : colors.border },
                  ]}
                />
              </Pressable>
            ))}
          </View>

          <Text style={[styles.progressBlurb, { color: colors.textSubtle }]}>{step.blurb}</Text>
        </View>

        <Animated.View style={{ opacity: stepFade, transform: [{ translateY: stepShift }] }}>
          {renderCurrentStep()}
        </Animated.View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <View style={styles.footerBack}>
          <AppButton
            label="Back"
            variant="secondary"
            onPress={() => transitionToStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          />
        </View>
        <View style={styles.footerNext}>
          {isLastStep ? (
            <AppButton
              label="Create tournament"
              onPress={create}
              loading={isSaving}
              disabled={!hasEnoughParticipants || !name.trim() || isSaving}
            />
          ) : (
            <AppButton
              label="Next"
              onPress={() => transitionToStep(Math.min(creationSteps.length - 1, currentStep + 1))}
              disabled={!canGoNext()}
            />
          )}
        </View>
      </View>

      <Modal visible={drawModalVisible} transparent animationType="slide" onRequestClose={closeDrawModal}>
        <View style={styles.drawBackdrop}>
          <View style={[styles.drawSheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />

            <View style={styles.drawHeader}>
              <View style={styles.drawHeaderText}>
                <Text style={[styles.drawTitle, { color: colors.text }]}>Tournament draw</Text>
                <Text style={[styles.drawMeta, { color: colors.textMuted }]}>
                  {drawPreviewPairs.length * 2} entries · {drawPreviewPairs.length}{" "}
                  {drawPreviewPairs.length === 1 ? "tie" : "ties"} · best of {bestOfFrames}
                </Text>
              </View>

              <Pressable
                onPress={closeDrawModal}
                accessibilityRole="button"
                accessibilityLabel="Close the draw"
                style={({ pressed }) => [
                  styles.closeButton,
                  { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="close" size={20} color={colors.textMuted} />
              </Pressable>
            </View>

            {drawPhase === "setup" ? renderDrawSetup() : null}
            {drawPhase === "revealing" ? renderDrawRevealing() : null}
            {drawPhase === "complete" ? renderDrawComplete() : null}
          </View>
        </View>
      </Modal>

      <TierPaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} currentTier={subscription.tier} featureLabel="Monthly Tournament Limit" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xl },

  progressBlock: {
    marginBottom: SPACING.lg,
  },
  progressLabel: {
    ...TYPE.label,
  },
  railRow: {
    flexDirection: "row",
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  railSegment: {
    flex: 1,
    paddingVertical: SPACING.xs,
  },
  railFill: {
    height: 4,
    borderRadius: RADIUS.pill,
  },
  progressBlurb: {
    ...TYPE.caption,
    marginTop: SPACING.xs,
  },

  section: {
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPE.heading,
  },
  sectionHint: {
    ...TYPE.caption,
    marginTop: SPACING.xs,
  },
  sectionBody: {
    marginTop: SPACING.md,
  },
  field: {
    marginTop: SPACING.md,
  },
  fieldLabel: {
    ...TYPE.label,
    marginBottom: SPACING.sm,
  },
  bodyText: {
    ...TYPE.body,
  },
  footnote: {
    ...TYPE.caption,
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  emptyText: {
    ...TYPE.caption,
    marginTop: SPACING.md,
  },

  input: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    minHeight: HIT_TARGET,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 15,
  },
  notes: { minHeight: 76 },
  flexInput: { flex: 1 },
  addRow: { flexDirection: "row", gap: SPACING.sm, alignItems: "center" },
  addButtonWrap: { width: 88 },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  chip: {
    minHeight: HIT_TARGET,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
  },
  chipText: {
    ...TYPE.label,
  },
  iconTile: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  iconGlyph: { fontSize: 20 },
  meetingChip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
  },
  meetingLabel: {
    fontSize: 14,
    fontWeight: "700",
  },
  frameChip: {
    minWidth: HIT_TARGET,
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  frameLabel: { fontSize: 15, fontWeight: "700" },

  segmentedTrack: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.xs,
    gap: SPACING.xs,
  },
  segment: {
    flex: 1,
    minHeight: HIT_TARGET - SPACING.sm,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: RADIUS.sm,
  },
  segmentText: {
    ...TYPE.label,
  },

  cardsRow: { flexDirection: "row", gap: SPACING.sm },
  selectCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    minHeight: 92,
  },
  selectTitle: {
    ...TYPE.bodyStrong,
    marginTop: SPACING.sm,
  },
  selectMeta: {
    ...TYPE.caption,
    marginTop: 2,
  },

  buttonRow: { marginTop: SPACING.md, flexDirection: "row", gap: SPACING.sm },
  buttonCell: { flex: 1 },
  primaryAction: { marginTop: SPACING.lg },
  /** Sits at the foot of the draw sheet, so the one clear action is always in the same place. */
  anchoredAction: { marginTop: "auto", paddingTop: SPACING.lg },

  tieList: { gap: SPACING.sm },
  tieRow: {
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.sm,
  },
  tieRowIndex: {
    ...TYPE.caption,
    width: 16,
  },
  tieRowNames: { flex: 1 },
  tieRowName: {
    ...TYPE.bodyStrong,
    paddingVertical: 3,
  },
  tieRowDivider: {
    height: 1,
    marginVertical: 2,
  },

  summaryList: { marginTop: -SPACING.sm },
  summaryRow: {
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
  },
  summaryLabel: {
    ...TYPE.caption,
  },
  summaryValue: {
    ...TYPE.bodyStrong,
    marginTop: 2,
  },

  footer: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xl,
    borderTopWidth: 1,
  },
  footerBack: { width: 110 },
  footerNext: { flex: 1 },

  drawBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "flex-end",
  },
  drawSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    minHeight: "70%",
    maxHeight: "94%",
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.xxl,
  },
  grabber: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: RADIUS.pill,
    marginBottom: SPACING.lg,
  },
  drawHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  drawHeaderText: { flex: 1 },
  drawTitle: {
    ...TYPE.title,
  },
  drawMeta: {
    ...TYPE.caption,
    marginTop: 2,
  },
  closeButton: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  drawBody: {
    flex: 1,
    marginTop: SPACING.lg,
  },
  drawPhaseTitle: {
    ...TYPE.heading,
    marginBottom: SPACING.md,
  },
  drawKicker: {
    ...TYPE.kicker,
    textTransform: "uppercase",
    textAlign: "center",
  },
  modeOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    minHeight: HIT_TARGET + 12,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: RADIUS.pill,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: RADIUS.pill,
  },
  modeText: { flex: 1 },
  modeTitle: {
    ...TYPE.bodyStrong,
  },
  modeMeta: {
    ...TYPE.caption,
    marginTop: 2,
  },

  tieCard: {
    marginTop: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.xl,
    paddingHorizontal: SPACING.lg,
  },
  tieSlot: {
    minHeight: 34,
    justifyContent: "center",
  },
  tieSlotName: {
    fontSize: 19,
    fontWeight: "700",
    textAlign: "center",
  },
  tieSplit: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginVertical: SPACING.md,
  },
  tieSplitLine: {
    flex: 1,
    height: 1,
  },
  tieSplitText: {
    ...TYPE.label,
  },
  drawProgress: {
    ...TYPE.caption,
    textAlign: "center",
    marginTop: SPACING.md,
  },
  drawList: {
    flex: 1,
    marginTop: SPACING.md,
  },
  drawListContent: {
    paddingBottom: SPACING.sm,
  },
  completeBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.xs,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    marginBottom: SPACING.md,
  },
  completeBadgeText: {
    ...TYPE.label,
  },
  quietAction: {
    minHeight: HIT_TARGET,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  quietActionText: {
    ...TYPE.bodyStrong,
  },
});
