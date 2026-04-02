import React, { useRef, useState } from "react";
import {
  Alert,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { AppButton } from "../../components/ui/AppButton";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useTournamentsStore } from "../../store";
import type { MatchesStackParamList, TournamentEntryMode, TournamentPairingMode, TournamentType } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";

const framesOptions = [1, 3, 5, 7, 9, 11, 19];

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

  const [name, setName] = useState(prefill ? buildFreshStartName(prefill.name) : "");
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
  const [drawPreviewBalls, setDrawPreviewBalls] = useState<string[]>([]);
  const [revealedPairsCount, setRevealedPairsCount] = useState(0);
  const [revealedBallsCount, setRevealedBallsCount] = useState(0);
  const [didAutoRunDraw, setDidAutoRunDraw] = useState(false);
  const revealTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [manualPairs, setManualPairs] = useState<Array<{ participantA: string; participantB: string }>>([]);
  const [manualAvailable, setManualAvailable] = useState<string[]>([]);
  const [manualPicked, setManualPicked] = useState<string[]>([]);

  const drawOpacity = useRef(new Animated.Value(1)).current;
  const drawShift = useRef(new Animated.Value(0)).current;

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
      if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    },
    []
  );

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
    if (entryMode === "singles") setSinglesParticipants(arranged);
    else setDoublesTeams(arranged);

    const seeded = arranged.length % 2 !== 0 ? [...arranged, makeByeLabel(arranged)] : arranged;
    const pairs: Array<{ a: string; b: string }> = [];
    for (let i = 0; i < seeded.length; i += 2) {
      pairs.push({ a: seeded[i], b: seeded[i + 1] ?? "BYE" });
    }

    setDrawPreviewPairs(pairs);
    setDrawPreviewBalls(seeded);
    setRevealedBallsCount(0);
    setRevealedPairsCount(0);
    setDrawModalVisible(true);

    if (revealTimerRef.current) clearInterval(revealTimerRef.current);
    revealTimerRef.current = setInterval(() => {
      setRevealedBallsCount((ballPrev) => {
        const nextBalls = Math.min(seeded.length, ballPrev + 1);
        setRevealedPairsCount(Math.floor(nextBalls / 2));

        if (nextBalls >= seeded.length && revealTimerRef.current) {
          clearInterval(revealTimerRef.current);
          revealTimerRef.current = null;
        }

        return nextBalls;
      });
    }, 1250);
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
        name,
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

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Pressable style={[styles.dismissKeyboard, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
        </Pressable>

        <Text style={[styles.title, { color: colors.text }]}>Create Tournament</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>Build knockout or league events with random or manual draws.</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Tournament Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Friday Club Open"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
          />

          <Text style={[styles.label, { color: colors.text }]}>Notes (optional)</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            placeholder="Best of 11 final..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.notes, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
            multiline
            textAlignVertical="top"
          />
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>Format</Text>
          <View style={styles.rowButtons}>
            {([
              ["knockout", "Knockout"],
              ["league", "League"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setTournamentType(value)}
                style={[
                  styles.segment,
                  {
                    borderColor: tournamentType === value ? colors.primary : colors.border,
                    backgroundColor: tournamentType === value ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: tournamentType === value ? colors.primary : colors.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.label, { color: colors.text }]}>Entries</Text>
          <View style={styles.rowButtons}>
            {([
              ["singles", "Singles"],
              ["doubles", "Doubles"],
            ] as const).map(([value, label]) => (
              <Pressable
                key={value}
                onPress={() => setEntryMode(value)}
                style={[
                  styles.segment,
                  {
                    borderColor: entryMode === value ? colors.primary : colors.border,
                    backgroundColor: entryMode === value ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.segmentText, { color: entryMode === value ? colors.primary : colors.text }]}>{label}</Text>
              </Pressable>
            ))}
          </View>

          {tournamentType === "knockout" ? (
            <>
              <Text style={[styles.label, { color: colors.text }]}>Draw Setup</Text>
              <View style={styles.rowButtons}>
                {([
                  ["random", "Random Draw"],
                  ["manual", "Manual Draw"],
                ] as const).map(([value, label]) => (
                  <Pressable
                    key={value}
                    onPress={() => setPairingMode(value)}
                    style={[
                      styles.segment,
                      {
                        borderColor: pairingMode === value ? colors.primary : colors.border,
                        backgroundColor: pairingMode === value ? colors.surfaceMuted : colors.surface,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentText, { color: pairingMode === value ? colors.primary : colors.text }]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Text style={[styles.label, { color: colors.text }]}>Best of Frames</Text>
          <View style={styles.framesRow}>
            {framesOptions.map((option) => (
              <Pressable
                key={option}
                onPress={() => setBestOfFrames(option)}
                style={[
                  styles.frameChip,
                  {
                    borderColor: bestOfFrames === option ? colors.primary : colors.border,
                    backgroundColor: bestOfFrames === option ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <Text style={[styles.frameLabel, { color: bestOfFrames === option ? colors.primary : colors.text }]}>{option}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.label, { color: colors.text }]}>
            {entryMode === "singles" ? "Add Players" : "Add Player Pool (for doubles teams)"}
          </Text>
          <View style={styles.addRow}>
            <TextInput
              value={participantName}
              onChangeText={setParticipantName}
              onSubmitEditing={onAddEntry}
              blurOnSubmit={false}
              placeholder={entryMode === "singles" ? "Player name" : "Player for doubles pool"}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, styles.flexInput, { borderColor: colors.border, color: colors.text, backgroundColor: colors.surfaceMuted }]}
            />
            <View style={styles.addButtonWrap}>
              <AppButton label="Add" onPress={onAddEntry} />
            </View>
          </View>

          {entryMode === "singles" ? (
            <Animated.View style={{ opacity: drawOpacity, transform: [{ translateY: drawShift }] }}>
              <View style={styles.participantWrap}>
                {singlesParticipants.map((nameValue) => (
                  <Pressable
                    key={nameValue}
                    onPress={() => removeParticipant(nameValue)}
                    style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                  >
                    <Text style={[styles.participantText, { color: colors.text }]}>{nameValue}</Text>
                    <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          ) : (
            <>
              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Tap two players to create a doubles team.</Text>
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

              <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Created teams (tap to remove):</Text>
              <Animated.View style={{ opacity: drawOpacity, transform: [{ translateY: drawShift }] }}>
                <View style={styles.participantWrap}>
                  {doublesTeams.map((team) => (
                    <Pressable
                      key={team}
                      onPress={() => removeParticipant(team)}
                      style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                    >
                      <Text style={[styles.participantText, { color: colors.text }]}>{team}</Text>
                      <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
                    </Pressable>
                  ))}
                </View>
              </Animated.View>
            </>
          )}

          {tournamentType === "knockout" ? (
            <View style={styles.toolsRow}>
              <AppButton label="Randomise & Draw" variant="secondary" onPress={randomiseAndDraw} disabled={participants.length < 2} />
            </View>
          ) : null}

          {tournamentType === "knockout" ? (
            <View style={styles.toolsRow}>
              <AppButton label="Add BYE Slot" variant="secondary" onPress={addByeSlot} />
            </View>
          ) : null}

          <Text style={[styles.smallHint, { color: colors.textMuted }]}>Minimum 2 real entries needed. Long press a doubles pool player to remove.</Text>
        </View>

        <Modal visible={drawModalVisible} transparent animationType="fade" onRequestClose={() => setDrawModalVisible(false)}>
          <View style={styles.modalBackdrop}>
            <View style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
              <Text style={[styles.modalTitle, { color: colors.text }]}>Live Draw</Text>
              <Text style={[styles.modalHint, { color: colors.textMuted }]}>Fixtures revealed in real time</Text>

              <View style={styles.ballWrap}>
                {drawPreviewBalls.map((ball, index) => (
                  <View
                    key={`${ball}-${index}`}
                    style={[
                      styles.ball,
                      {
                        backgroundColor: index < revealedBallsCount ? colors.primaryStrong : colors.surfaceMuted,
                        borderColor: colors.border,
                        opacity: index < revealedBallsCount ? 1 : 0.28,
                      },
                    ]}
                  >
                    <Text style={[styles.ballText, { color: colors.onPrimary }]}>{ball}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.modalList}>
                {drawPreviewPairs.slice(0, revealedPairsCount).map((pair, index) => (
                  <View
                    key={`${pair.a}-${pair.b}-${index}`}
                    style={[
                      styles.drawRow,
                      {
                        borderColor: colors.border,
                        backgroundColor: colors.surfaceMuted,
                      },
                    ]}
                  >
                    <Text style={[styles.drawName, { color: colors.text }]}>{pair.a}</Text>
                    <Text style={[styles.drawVs, { color: colors.textMuted }]}>vs</Text>
                    <Text style={[styles.drawName, { color: colors.text }]}>{pair.b}</Text>
                  </View>
                ))}
                {revealedBallsCount % 2 === 1 && revealedPairsCount < drawPreviewPairs.length ? (
                  <View style={[styles.drawRow, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: 0.8 }]}> 
                    <Text style={[styles.drawName, { color: colors.text }]}>{drawPreviewBalls[revealedBallsCount - 1]}</Text>
                    <Text style={[styles.drawVs, { color: colors.textMuted }]}>vs</Text>
                    <Text style={[styles.drawName, { color: colors.textMuted }]}>...</Text>
                  </View>
                ) : null}
                {revealedPairsCount < drawPreviewPairs.length ? (
                  <Text style={[styles.drawingText, { color: colors.textMuted }]}>Drawing next fixture...</Text>
                ) : null}
              </View>

              <AppButton
                label="Use This Draw"
                disabled={revealedBallsCount < drawPreviewBalls.length}
                onPress={async () => {
                  if (revealTimerRef.current) {
                    clearInterval(revealTimerRef.current);
                    revealTimerRef.current = null;
                  }
                  setDrawModalVisible(false);
                  await createWith(
                    drawParticipants.length
                      ? drawParticipants
                      : entryMode === "singles"
                        ? singlesParticipants
                        : doublesTeams
                  );
                }}
              />
            </View>
          </View>
        </Modal>

        {tournamentType === "knockout" && pairingMode === "manual" ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
            <Text style={[styles.label, { color: colors.text }]}>Manual Fixtures (Tap to Pair)</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Tap one entry then another to create each fixture.</Text>

            <View style={styles.manualToolsRow}>
              <View style={styles.toolButton}>
                <AppButton label="Undo Last" variant="secondary" onPress={undoLastManualFixture} disabled={!manualPairs.length} />
              </View>
              <View style={styles.toolButton}>
                <AppButton label="Reset" variant="secondary" onPress={resetManualPairing} />
              </View>
            </View>

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Selected for next fixture:</Text>
            <View style={styles.participantWrap}>
              {manualPicked.length === 0 ? (
                <Text style={[styles.emptyManualText, { color: colors.textMuted }]}>No selection yet.</Text>
              ) : (
                manualPicked.map((item) => (
                  <Pressable
                    key={`picked-${item}`}
                    onPress={() => unpickManualEntry(item)}
                    style={[styles.participantChip, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}
                  >
                    <Text style={[styles.participantText, { color: colors.primary }]}>{item}</Text>
                    <Text style={[styles.removeText, { color: colors.danger }]}>✕</Text>
                  </Pressable>
                ))
              )}
            </View>

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Available entries:</Text>
            <View style={styles.participantWrap}>
              {manualAvailable.map((item) => (
                <Pressable
                  key={`available-${item}`}
                  onPress={() => pickManualEntry(item)}
                  style={[styles.participantChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                >
                  <Text style={[styles.participantText, { color: colors.text }]}>{item}</Text>
                </Pressable>
              ))}
            </View>

            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Fixture preview:</Text>
            <View style={styles.fixturePreviewWrap}>
              {manualPairs.length === 0 ? (
                <Text style={[styles.emptyManualText, { color: colors.textMuted }]}>No fixtures paired yet.</Text>
              ) : (
                manualPairs.map((pair, index) => (
                  <View key={`preview-${index}`} style={[styles.fixturePreview, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
                    <Text style={[styles.fixturePreviewText, { color: colors.text }]}>{pair.participantA}</Text>
                    <Text style={[styles.fixturePreviewVs, { color: colors.textMuted }]}>vs</Text>
                    <Text style={[styles.fixturePreviewText, { color: colors.text }]}>{pair.participantB}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        ) : null}

        <AppButton label="Create Tournament" onPress={create} loading={isSaving} disabled={!hasEnoughParticipants || !name.trim() || isSaving} />
      </ScrollView>

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="Monthly Tournament Limit"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
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
  modalList: { marginTop: 10, marginBottom: 12, gap: 8 },
  drawRow: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  drawName: { flex: 1, fontSize: 13, fontWeight: "700", textAlign: "center" },
  drawVs: { fontSize: 12, fontWeight: "700" },
  drawingText: { fontSize: 12, fontWeight: "700", textAlign: "center" },
});
