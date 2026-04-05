import React, { useRef, useState } from "react";
import {
  Alert,
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
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { AppButton } from "../../components/ui/AppButton";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useTournamentsStore } from "../../store";
import type { MatchesStackParamList, TournamentEntryMode, TournamentPairingMode, TournamentType } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";

const framesOptions = [1, 3, 5, 7, 9, 11, 13, 19];
const creationSteps = ["Basics", "Format", "Players", "Draw", "Review"];
const iconOptions = ["🏆", "🎱", "⚡", "🔥", "🥇", "🎯"];

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

export const NewTournamentScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const route = useRoute<RouteProp<MatchesStackParamList, "NewTournament">>();
  const prefill = route.params?.prefill;
  const { colors } = useAppTheme();
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
  const [drawModalVisible, setDrawModalVisible] = useState(false);
  const [drawParticipants, setDrawParticipants] = useState<string[]>([]);
  const [drawPreviewPairs, setDrawPreviewPairs] = useState<Array<{ a: string; b: string }>>([]);
  const [revealedPairs, setRevealedPairs] = useState<Array<{ a: string; b: string }>>([]);
  const [activeDrawPair, setActiveDrawPair] = useState<{ a: string; b: string } | null>(null);
  const [activeMatchNumber, setActiveMatchNumber] = useState<number>(0);
  const [drawComplete, setDrawComplete] = useState(false);
  const [drawMode, setDrawMode] = useState<"animated" | "quick">("animated");
  const [didAutoRunDraw, setDidAutoRunDraw] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const participants = entryMode === "singles" ? singlesParticipants : doublesTeams;
  const hasEnoughParticipants = participants.filter((item) => !isByeName(item)).length >= 2;

  React.useEffect(() => {
    if (tournamentType !== "knockout" || pairingMode !== "manual") return;
    const seeded = participants.length % 2 !== 0 ? [...participants, makeByeLabel(participants)] : [...participants];
    setManualAvailable(arrangeToAvoidByePairs(seeded));
    setManualPairs([]);
    setManualPicked([]);
  }, [participants, pairingMode, tournamentType]);

  React.useEffect(
    () => () => {
      if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    },
    []
  );

  const clearRevealTimer = () => {
    if (revealTimerRef.current) {
      clearTimeout(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  const animatePairReveal = (pair: { a: string; b: string }, matchNumber: number, onDone: () => void) => {
    triggerHaptic("light");
    setActiveDrawPair(pair);
    setActiveMatchNumber(matchNumber);
    revealAOpacity.setValue(0);
    revealATranslate.setValue(-34);
    revealBOpacity.setValue(0);
    revealBTranslate.setValue(34);
    revealPulse.setValue(1);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(revealAOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(revealATranslate, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
      Animated.delay(120),
      Animated.parallel([
        Animated.timing(revealBOpacity, { toValue: 1, duration: 240, useNativeDriver: true }),
        Animated.timing(revealBTranslate, { toValue: 0, duration: 240, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(revealPulse, { toValue: 1.05, duration: 170, useNativeDriver: true }),
        Animated.timing(revealPulse, { toValue: 1, duration: 170, useNativeDriver: true }),
      ]),
      Animated.delay(170),
    ]).start(() => {
      triggerHaptic("success");
      setRevealedPairs((prev) => [...prev, pair]);
      setActiveDrawPair(null);
      onDone();
    });
  };

  const runAnimatedDraw = (pairs: Array<{ a: string; b: string }>, index = 0) => {
    if (index >= pairs.length) {
      triggerHaptic("success");
      setDrawComplete(true);
      return;
    }

    animatePairReveal(pairs[index], index + 1, () => {
      revealTimerRef.current = setTimeout(() => runAnimatedDraw(pairs, index + 1), 320);
    });
  };

  const onAddEntry = () => {
    const trimmed = participantName.trim();
    if (!trimmed) return;

    if (entryMode === "singles") {
      if (singlesParticipants.includes(trimmed)) {
        Alert.alert("Already added", "This player is already in the draw.");
        return;
      }
      setSinglesParticipants((prev) => [...prev, trimmed]);
    } else {
      if (doublesPlayers.includes(trimmed)) {
        Alert.alert("Already added", "This player is already in the player pool.");
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
    setDrawPreviewPairs(pairs);
    setRevealedPairs([]);
    setActiveDrawPair(null);
    setDrawComplete(false);
    setDrawModalVisible(true);

    if (drawMode === "quick") {
      setRevealedPairs(pairs);
      setDrawComplete(true);
      return;
    }

    runAnimatedDraw(pairs);
  };

  React.useEffect(() => {
    if (!prefill?.autoRunDraw || didAutoRunDraw) return;
    if (participants.length < 2) return;

    setDidAutoRunDraw(true);
    randomiseAndDraw();
  }, [didAutoRunDraw, participants.length, prefill?.autoRunDraw]);

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

  const createWith = async (entriesOverride?: string[]) => {
    if (!subscription.canCreateTournament) {
      setShowPaywall(true);
      return;
    }

    const sourceParticipants = entriesOverride ?? participants;

    if (!name.trim()) {
      Alert.alert("Tournament name needed", "Give your tournament a name before creating it.");
      return;
    }

    if (sourceParticipants.filter((item) => item !== "BYE" && !/^BYE\b/i.test(item)).length < 2) {
      Alert.alert("Add entries", "Please add at least 2 real players/teams.");
      return;
    }

    if (tournamentType === "knockout") {
      const source =
        pairingMode === "manual"
          ? manualPairs.flatMap((pair) => [pair.participantA, pair.participantB])
          : sourceParticipants;
      const seeded = source.length % 2 !== 0 ? [...source, makeByeLabel(source)] : source;
      const hasByeVsBye = seeded.some((_, index) => {
        if (index % 2 !== 0) return false;
        return isByeName(seeded[index]) && isByeName(seeded[index + 1] ?? "");
      });

      if (hasByeVsBye) {
        Alert.alert("Invalid BYE pairing", "A BYE cannot be matched against another BYE in round one. Reorder the draw.");
        return;
      }

      if (pairingMode === "manual" && (manualAvailable.length > 0 || manualPicked.length > 0)) {
        Alert.alert("Manual fixtures incomplete", "Finish pairing all entries before creating the tournament.");
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
        participants: sourceParticipants,
        manualFixtures: pairingMode === "manual" ? manualPairs : undefined,
      });

      navigation.navigate("TournamentDetail", { tournamentId });
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        Alert.alert("Save failed", "Could not create this tournament right now.");
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

  const renderPlayersStep = () => (
    <>
      <Text style={[styles.label, { color: colors.text }]}>Add {entryMode === "singles" ? "Players" : "Doubles Pool Players"}</Text>
      <View style={styles.addRow}>
        <TextInput
          value={participantName}
          onChangeText={setParticipantName}
          onSubmitEditing={onAddEntry}
          placeholder={entryMode === "singles" ? "Enter player name" : "Enter player for doubles pool"}
          placeholderTextColor={colors.textMuted}
          style={[styles.input, styles.flexInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
        />
        <View style={styles.addButtonWrap}>
          <AppButton label="Add" onPress={onAddEntry} />
        </View>
      </View>

      {entryMode === "singles" ? (
        <View style={styles.participantWrap}>
          {singlesParticipants.map((nameValue) => (
            <Pressable key={nameValue} onPress={() => removeParticipant(nameValue)} style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
              <Text style={[styles.participantText, { color: colors.text }]}>{nameValue}</Text>
              <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Tap two players to create a doubles team. Long press to remove.</Text>
          <View style={styles.participantWrap}>
            {doublesPlayers.map((nameValue) => {
              const selected = selectedDoublesPlayers.includes(nameValue);
              return (
                <Pressable
                  key={nameValue}
                  onPress={() => toggleDoublesSelection(nameValue)}
                  onLongPress={() => removeDoublesPlayer(nameValue)}
                  style={[
                    styles.participantChip,
                    {
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                    },
                  ]}
                >
                  <Text style={[styles.participantText, { color: selected ? colors.primary : colors.text }]}>{nameValue}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.toolsSplit}>
            <View style={styles.toolButton}><AppButton label="Build Team" onPress={createTeamFromSelection} disabled={selectedDoublesPlayers.length !== 2} /></View>
            <View style={styles.toolButton}><AppButton label="Auto Build" variant="secondary" onPress={randomBuildDoublesTeams} disabled={doublesPlayers.length < 2} /></View>
          </View>
          <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Created Teams:</Text>
          <View style={styles.participantWrap}>
            {doublesTeams.map((team) => (
              <Pressable key={team} onPress={() => removeParticipant(team)} style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
                <Text style={[styles.participantText, { color: colors.text }]}>{team}</Text>
                <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {tournamentType === "knockout" ? (
        <View style={styles.toolsSplit}>
          <View style={styles.toolButton}><AppButton label="Add BYE Slot" variant="secondary" onPress={addByeSlot} /></View>
        </View>
      ) : null}
      <Text style={[styles.smallHint, { color: colors.textMuted }]}>Need at least 2 real entries to continue.</Text>
    </>
  );

  const renderCurrentStep = () => {
    if (currentStep === 0) {
      return (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Tournament Name</Text>
          <TextInput value={name} onChangeText={setName} placeholder="Friday Club Open" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]} />
          <Text style={[styles.label, { color: colors.text }]}>Event Icon</Text>
          <View style={styles.framesRow}>
            {iconOptions.map((icon) => (
              <Pressable key={icon} onPress={() => setTournamentIcon(icon)} style={[styles.frameChip, { borderColor: tournamentIcon === icon ? colors.primary : colors.border, backgroundColor: tournamentIcon === icon ? colors.surfaceMuted : colors.surface }]}> 
                <Text style={styles.iconChip}>{icon}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.label, { color: colors.text }]}>Notes (Optional)</Text>
          <TextInput value={notes} onChangeText={setNotes} placeholder="Final night starts at 7:30pm" placeholderTextColor={colors.textMuted} style={[styles.input, styles.notes, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]} multiline textAlignVertical="top" />
        </>
      );
    }

    if (currentStep === 1) {
      return (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Tournament Format</Text>
          <View style={styles.cardsRow}>
            <Pressable style={[styles.selectCard, { borderColor: tournamentType === "knockout" ? colors.primary : colors.border, backgroundColor: colors.surfaceMuted }]} onPress={() => setTournamentType("knockout")}>
              <Text style={styles.selectEmoji}>🏆</Text>
              <Text style={[styles.selectTitle, { color: colors.text }]}>Knockout</Text>
              <Text style={[styles.selectMeta, { color: colors.textMuted }]}>Single elimination bracket</Text>
            </Pressable>
            <Pressable style={[styles.selectCard, { borderColor: tournamentType === "league" ? colors.primary : colors.border, backgroundColor: colors.surfaceMuted }]} onPress={() => setTournamentType("league")}>
              <Text style={styles.selectEmoji}>📋</Text>
              <Text style={[styles.selectTitle, { color: colors.text }]}>League</Text>
              <Text style={[styles.selectMeta, { color: colors.textMuted }]}>Round-robin standings</Text>
            </Pressable>
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Entry Mode</Text>
          <View style={styles.rowButtons}>
            {([ ["singles", "Singles"], ["doubles", "Doubles"] ] as const).map(([value, label]) => (
              <Pressable key={value} onPress={() => setEntryMode(value)} style={[styles.segment, { borderColor: entryMode === value ? colors.primary : colors.border, backgroundColor: entryMode === value ? colors.surfaceMuted : colors.surface }]}> 
                <Text style={[styles.segmentText, { color: entryMode === value ? colors.primary : colors.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {tournamentType === "knockout" ? (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Draw Type</Text>
              <View style={styles.rowButtons}>
                {([ ["random", "🎲 Random Draw"], ["manual", "🧩 Manual Draw"] ] as const).map(([value, label]) => (
                  <Pressable key={value} onPress={() => setPairingMode(value)} style={[styles.segment, { borderColor: pairingMode === value ? colors.primary : colors.border, backgroundColor: pairingMode === value ? colors.surfaceMuted : colors.surface }]}> 
                    <Text style={[styles.segmentText, { color: pairingMode === value ? colors.primary : colors.text }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.text }]}>Match Length (Best Of)</Text>
          <View style={styles.framesRow}>
            {framesOptions.map((option) => (
              <Pressable key={option} onPress={() => setBestOfFrames(option)} style={[styles.frameChip, { borderColor: bestOfFrames === option ? colors.primary : colors.border, backgroundColor: bestOfFrames === option ? colors.surfaceMuted : colors.surface }]}> 
                <Text style={[styles.frameLabel, { color: bestOfFrames === option ? colors.primary : colors.text }]}>{option}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.smallHint, { color: colors.textMuted }]}>First to {Math.floor(bestOfFrames / 2) + 1} frames.</Text>
        </>
      );
    }

    if (currentStep === 2) return renderPlayersStep();

    if (currentStep === 3) {
      return (
        <>
          <Text style={[styles.label, { color: colors.text }]}>Draw Setup</Text>
          {tournamentType === "league" ? (
            <Text style={[styles.smallHint, { color: colors.textMuted }]}>League format auto-generates fixtures from participant list.</Text>
          ) : pairingMode === "random" ? (
            <>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Generate a live reveal draw with animated pairing cards.</Text>
              <View style={styles.toolsRow}>
                <AppButton label="Generate Live Draw" onPress={randomiseAndDraw} disabled={participants.length < 2} />
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Tap one entry then another to pair fixtures manually.</Text>
              <View style={styles.manualToolsRow}>
                <View style={styles.toolButton}><AppButton label="Undo" variant="secondary" onPress={undoLastManualFixture} disabled={!manualPairs.length} /></View>
                <View style={styles.toolButton}><AppButton label="Reset" variant="secondary" onPress={resetManualPairing} /></View>
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Selected:</Text>
              <View style={styles.participantWrap}>
                {manualPicked.length === 0 ? <Text style={[styles.emptyManualText, { color: colors.textMuted }]}>No selection yet.</Text> : manualPicked.map((item) => (
                  <Pressable key={item} onPress={() => unpickManualEntry(item)} style={[styles.participantChip, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}> 
                    <Text style={[styles.participantText, { color: colors.primary }]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Available:</Text>
              <View style={styles.participantWrap}>
                {manualAvailable.map((item) => (
                  <Pressable key={item} onPress={() => pickManualEntry(item)} style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
                    <Text style={[styles.participantText, { color: colors.text }]}>{item}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Fixture Preview:</Text>
              <View style={styles.fixturePreviewWrap}>
                {manualPairs.length === 0 ? <Text style={[styles.emptyManualText, { color: colors.textMuted }]}>No fixtures paired yet.</Text> : manualPairs.map((pair, index) => (
                  <View key={`manual-${index}`} style={[styles.fixturePreview, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
                    <Text style={[styles.fixturePreviewText, { color: colors.text }]}>{pair.participantA}</Text>
                    <Text style={[styles.fixturePreviewVs, { color: colors.textMuted }]}>vs</Text>
                    <Text style={[styles.fixturePreviewText, { color: colors.text }]}>{pair.participantB}</Text>
                  </View>
                ))}
              </View>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <Text style={[styles.label, { color: colors.text }]}>Review & Create</Text>
        <View style={[styles.reviewCard, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
          <Text style={[styles.reviewLine, { color: colors.text }]}>{tournamentIcon} {name || "Untitled Tournament"}</Text>
          <Text style={[styles.reviewSub, { color: colors.textMuted }]}>Type: {tournamentType.toUpperCase()} · {entryMode.toUpperCase()}</Text>
          <Text style={[styles.reviewSub, { color: colors.textMuted }]}>Draw: {tournamentType === "knockout" ? pairingMode.toUpperCase() : "AUTO LEAGUE"}</Text>
          <Text style={[styles.reviewSub, { color: colors.textMuted }]}>Best of {bestOfFrames} (First to {Math.floor(bestOfFrames / 2) + 1})</Text>
          <Text style={[styles.reviewSub, { color: colors.textMuted }]}>Entries: {participants.length}</Text>
        </View>
        <AppButton label="Create Tournament" onPress={create} loading={isSaving} disabled={!hasEnoughParticipants || !name.trim() || isSaving} />
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={[styles.heroCard, { borderColor: colors.border, backgroundColor: colors.surface }]}> 
          <Text style={[styles.heroEyebrow, { color: colors.textMuted }]}>Tournament Creator</Text>
          <Text style={[styles.title, { color: colors.text }]}>Set Up Your Event</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Wizard-style flow with live draw reveal and full bracket control.</Text>
        </View>

        <View style={styles.stepDotsRow}>
          {creationSteps.map((label, index) => (
            <Pressable key={label} onPress={() => transitionToStep(index)} style={[styles.stepDot, { borderColor: colors.border, backgroundColor: index === currentStep ? colors.primary : colors.surfaceMuted }]}> 
              <Text style={[styles.stepDotLabel, { color: index === currentStep ? colors.onPrimary : colors.textMuted }]}>{index + 1}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={[styles.stepLabel, { color: colors.text }]}>{creationSteps[currentStep]}</Text>

        <Animated.View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border, opacity: stepFade, transform: [{ translateY: stepShift }] }]}> 
          {renderCurrentStep()}
        </Animated.View>

        <View style={styles.wizardNavRow}>
          <View style={styles.toolButton}><AppButton label="Back" variant="secondary" onPress={() => transitionToStep(Math.max(0, currentStep - 1))} disabled={currentStep === 0} /></View>
          {currentStep < creationSteps.length - 1 ? (
            <View style={styles.toolButton}><AppButton label="Next" onPress={() => transitionToStep(Math.min(creationSteps.length - 1, currentStep + 1))} disabled={!canGoNext()} /></View>
          ) : null}
        </View>
      </ScrollView>

      <Modal
        visible={drawModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          clearRevealTimer();
          setDrawModalVisible(false);
        }}
      >
        <View style={[styles.drawFullscreen, { backgroundColor: "rgba(5,12,9,0.96)" }]}> 
          <View style={styles.drawTopBar}>
            <Text style={[styles.modalTitle, { color: "#ECFFF5" }]}>🎲 Tournament Draw</Text>
            <Pressable
              onPress={() => {
                clearRevealTimer();
                setDrawModalVisible(false);
              }}
              style={styles.closeDrawButton}
            >
              <Text style={styles.closeDrawText}>Close</Text>
            </Pressable>
          </View>

          <Text style={[styles.modalHint, { color: "#8FB9AB" }]}>One match reveals at a time</Text>

          <View style={styles.drawModeRow}>
            <Pressable style={[styles.drawModeChip, drawMode === "animated" && styles.drawModeChipActive]} onPress={() => setDrawMode("animated")}>
              <Text style={[styles.drawModeText, drawMode === "animated" && styles.drawModeTextActive]}>Animated Draw</Text>
            </Pressable>
            <Pressable style={[styles.drawModeChip, drawMode === "quick" && styles.drawModeChipActive]} onPress={() => setDrawMode("quick")}>
              <Text style={[styles.drawModeText, drawMode === "quick" && styles.drawModeTextActive]}>Quick Draw</Text>
            </Pressable>
          </View>

          <View style={styles.drawCenterZone}>
            <View style={styles.activeRevealWrap}>
              {activeDrawPair ? (
                <>
                  <Text style={styles.activeMatchLabel}>Match {activeMatchNumber}</Text>
                  <Animated.View style={[styles.activeCardsRow, { transform: [{ scale: revealPulse }] }]}> 
                    <Animated.View style={[styles.activePlayerCard, { opacity: revealAOpacity, transform: [{ translateX: revealATranslate }] }]}>
                      <Text style={styles.activePlayerName}>{activeDrawPair.a}</Text>
                    </Animated.View>
                    <Text style={styles.activeVsText}>vs</Text>
                    <Animated.View style={[styles.activePlayerCard, { opacity: revealBOpacity, transform: [{ translateX: revealBTranslate }] }]}>
                      <Text style={styles.activePlayerName}>{activeDrawPair.b}</Text>
                    </Animated.View>
                  </Animated.View>
                </>
              ) : (
                <Text style={styles.awaitingDrawText}>{drawComplete ? "Draw Complete 🎱" : "Preparing draw..."}</Text>
              )}
            </View>
          </View>

          <ScrollView style={styles.modalList} contentContainerStyle={{ paddingBottom: 12 }}>
            {revealedPairs.map((pair, index) => (
              <View key={`${pair.a}-${pair.b}-${index}`} style={styles.drawRow}> 
                <Text style={styles.drawMatchIndex}>M{index + 1}</Text>
                <Text style={styles.drawName}>{pair.a}</Text>
                <Text style={styles.drawVs}>vs</Text>
                <Text style={styles.drawName}>{pair.b}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.modalActionRow}>
            <View style={styles.toolButton}>
              <AppButton label="Restart Draw" variant="secondary" onPress={randomiseAndDraw} disabled={participants.length < 2} />
            </View>
            <View style={styles.toolButton}>
              <AppButton
                label="Use This Draw"
                disabled={!drawComplete}
                onPress={async () => {
                  clearRevealTimer();
                  setDrawModalVisible(false);
                  await createWith(drawParticipants.length ? drawParticipants : entryMode === "singles" ? singlesParticipants : doublesTeams);
                }}
              />
            </View>
          </View>
        </View>
      </Modal>

      <TierPaywallModal visible={showPaywall} onClose={() => setShowPaywall(false)} currentTier={subscription.tier} featureLabel="Monthly Tournament Limit" />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  heroCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  stepDotsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  stepDot: {
    width: 30,
    height: 30,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotLabel: {
    fontSize: 12,
    fontWeight: "800",
  },
  stepLabel: {
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 8,
  },
  wizardNavRow: {
    marginTop: 2,
    flexDirection: "row",
    gap: 8,
  },
  cardsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  selectCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 10,
  },
  selectEmoji: {
    fontSize: 20,
  },
  selectTitle: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "800",
  },
  selectMeta: {
    marginTop: 3,
    fontSize: 12,
  },
  iconChip: {
    fontSize: 18,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  reviewLine: {
    fontSize: 16,
    fontWeight: "800",
  },
  reviewSub: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: "600",
  },
  dismissKeyboard: {
    alignSelf: "flex-end",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  dismissKeyboardText: { fontSize: 12, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "800" },
  subtitle: { marginTop: 6, fontSize: 14, marginBottom: 14 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
  },
  label: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
  },
  notes: { minHeight: 64 },
  rowButtons: { flexDirection: "row", gap: 8, marginBottom: 8 },
  segment: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: "center",
  },
  segmentText: { fontSize: 12, fontWeight: "700" },
  framesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  frameChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  frameLabel: { fontWeight: "700", fontSize: 12 },
  addRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  flexInput: { flex: 1 },
  addButtonWrap: { width: 90 },
  participantWrap: { marginTop: 10, flexDirection: "row", flexWrap: "wrap", gap: 8 },
  participantChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  participantText: { fontSize: 12, fontWeight: "700" },
  removeText: { fontSize: 11, fontWeight: "700" },
  toolsRow: { marginTop: 10 },
  toolsSplit: { marginTop: 10, flexDirection: "row", gap: 8 },
  toolButton: { flex: 1 },
  manualToolsRow: { marginTop: 8, flexDirection: "row", gap: 8 },
  sectionHint: { marginTop: 8, fontSize: 12 },
  smallHint: { marginTop: 8, fontSize: 12 },
  emptyManualText: { fontSize: 12, fontWeight: "600" },
  fixturePreviewWrap: { marginTop: 10, gap: 8 },
  fixturePreview: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  fixturePreviewText: { flex: 1, textAlign: "center", fontSize: 12, fontWeight: "700" },
  fixturePreviewVs: { fontSize: 11, fontWeight: "700" },
  vsText: { fontWeight: "700", fontSize: 12 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  drawFullscreen: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 44,
    paddingBottom: 16,
  },
  drawTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  closeDrawButton: {
    borderWidth: 1,
    borderColor: "#36584D",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#11231D",
  },
  closeDrawText: {
    color: "#D8F3E8",
    fontSize: 12,
    fontWeight: "700",
  },
  drawModeRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  drawModeChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#3B5E52",
    borderRadius: 999,
    paddingVertical: 8,
    alignItems: "center",
    backgroundColor: "#132821",
  },
  drawModeChipActive: {
    borderColor: "#5BD0A2",
    backgroundColor: "#1A6B4D",
  },
  drawModeText: {
    color: "#B9DDD0",
    fontSize: 12,
    fontWeight: "700",
  },
  drawModeTextActive: {
    color: "#EDFFF8",
  },
  drawCenterZone: {
    flex: 1,
    justifyContent: "center",
  },
  activeRevealWrap: {
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#2F4C41",
    backgroundColor: "#0F201A",
    borderRadius: 14,
    minHeight: 170,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  activeMatchLabel: {
    color: "#80DDB7",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.7,
  },
  activeCardsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  activePlayerCard: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#58CDA0",
    backgroundColor: "#183028",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    shadowColor: "#58CDA0",
    shadowOpacity: 0.35,
    shadowRadius: 10,
  },
  activePlayerName: {
    color: "#EDFFF8",
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center",
  },
  activeVsText: {
    color: "#8BB8A8",
    fontSize: 12,
    fontWeight: "800",
  },
  awaitingDrawText: {
    color: "#A9CDC0",
    fontSize: 13,
    fontWeight: "700",
  },
  modalActionRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  modalCard: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  modalTitle: { fontSize: 22, fontWeight: "800" },
  modalHint: { marginTop: 4, fontSize: 12 },
  ballWrap: {
    marginTop: 10,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  ball: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  ballText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalList: { marginTop: 10, marginBottom: 4, gap: 8, maxHeight: 240 },
  drawRow: {
    borderWidth: 1,
    borderColor: "#315347",
    backgroundColor: "#11241D",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawMatchIndex: { width: 34, color: "#7FB8A3", fontSize: 11, fontWeight: "800" },
  drawName: { flex: 1, fontSize: 13, fontWeight: "700", textAlign: "center", color: "#E7FCF3" },
  drawVs: { fontSize: 12, fontWeight: "700", color: "#95BDAF" },
  drawingText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
