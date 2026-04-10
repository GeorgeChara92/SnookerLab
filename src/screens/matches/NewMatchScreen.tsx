import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import { MatchResult } from "../../types";
import type { MatchesStackParamList } from "../../types";
import type { NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";

type MatchMode = "live" | "manual";

const FORMAT_OPTIONS = [
  { label: "Best of 1", value: 1 },
  { label: "Best of 3", value: 3 },
  { label: "Best of 5", value: 5 },
  { label: "Best of 7", value: 7 },
  { label: "Best of 9", value: 9 },
];

export const NewMatchScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { addMatch, matches } = useMatchesStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();

  const [mode, setMode] = useState<MatchMode>("live");
  const [opponentName, setOpponentName] = useState("");
  const [location, setLocation] = useState("");
  const [userScore, setUserScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [targetFrames, setTargetFrames] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    actions: Array<{ label: string; role?: "default" | "destructive"; onPress?: () => void }>;
  } | null>(null);

  const recentOpponents = useMemo(() => {
    const opponentMap = new Map<string, { count: number; lastPlayed: string }>();
    matches.forEach((match) => {
      const existing = opponentMap.get(match.opponent_name);
      if (existing) {
        existing.count++;
        if (match.date > existing.lastPlayed) {
          existing.lastPlayed = match.date;
        }
      } else {
        opponentMap.set(match.opponent_name, { count: 1, lastPlayed: match.date });
      }
    });
    return Array.from(opponentMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.lastPlayed.localeCompare(a.lastPlayed))
      .slice(0, 5);
  }, [matches]);

  const lastOpponent = recentOpponents[0]?.name;
  const lastLocation = matches[0]?.location;

  const headToHead = useMemo(() => {
    if (!opponentName.trim()) return null;
    const opponentMatches = matches.filter((m) => m.opponent_name === opponentName.trim());
    if (opponentMatches.length === 0) return null;
    const wins = opponentMatches.filter((m) => m.result === "win").length;
    const losses = opponentMatches.filter((m) => m.result === "loss").length;
    const draws = opponentMatches.filter((m) => m.result === "draw").length;
    return { wins, losses, draws, total: opponentMatches.length };
  }, [matches, opponentName]);

  const showDialog = (
    title: string,
    message: string,
    actions: Array<{ label: string; role?: "default" | "destructive"; onPress?: () => void }> = [{ label: "OK" }]
  ) => setDialog({ title, message, actions });

  const getResult = (): MatchResult => {
    const uScore = parseInt(userScore) || 0;
    const oScore = parseInt(opponentScore) || 0;
    if (uScore > oScore) return "win";
    if (uScore < oScore) return "loss";
    return "draw";
  };

  const handleStartLive = async () => {
    if (!subscription.canCreateMatch) {
      setShowPaywall(true);
      return;
    }

    if (!opponentName.trim()) {
      showDialog("Opponent required", "Please add an opponent name before starting live scoring.");
      return;
    }

    try {
      setIsSaving(true);
      const match = await addMatch({
        user_id: "",
        opponent_name: opponentName.trim(),
        date: new Date().toISOString().split("T")[0],
        location: location.trim() || undefined,
        match_type: "casual",
        format: "best_of",
        target_frames: targetFrames,
        frames_played: 0,
        user_score: 0,
        opponent_score: 0,
        result: "draw",
        recording_mode: "live",
        sync_status: "pending",
      });

      navigation.navigate("LiveFrameScoring", { matchId: match.id });
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        showDialog("Start failed", "Could not start live match right now.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveManual = async () => {
    if (!subscription.canCreateMatch) {
      setShowPaywall(true);
      return;
    }

    if (!opponentName.trim()) {
      showDialog("Opponent required", "Please add an opponent name.");
      return;
    }

    const uScore = parseInt(userScore) || 0;
    const oScore = parseInt(opponentScore) || 0;

    if (uScore === 0 && oScore === 0) {
      showDialog("Score required", "Please enter at least one score.");
      return;
    }

    try {
      setIsSaving(true);
      await addMatch({
        user_id: "",
        opponent_name: opponentName.trim(),
        date: new Date().toISOString().split("T")[0],
        location: location.trim() || undefined,
        match_type: "casual",
        format: "best_of",
        target_frames: 1,
        frames_played: 1,
        user_score: uScore,
        opponent_score: oScore,
        result: getResult(),
        recording_mode: "manual",
        sync_status: "pending",
      });
      navigation.goBack();
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        showDialog("Save failed", "Could not save this match right now.");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const autofillLastValues = () => {
    if (lastOpponent) setOpponentName(lastOpponent);
    if (lastLocation) setLocation(lastLocation);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.modeCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.modeTitle, { color: colors.text }]}>How do you want to record?</Text>
          <View style={styles.modeRow}>
            <Pressable
              style={[
                styles.modeOption,
                {
                  backgroundColor: mode === "live" ? colors.primary : colors.surfaceMuted,
                  borderColor: mode === "live" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setMode("live")}
            >
              <Text style={styles.modeIcon}>🎯</Text>
              <Text style={[styles.modeLabel, { color: mode === "live" ? colors.onPrimary : colors.text }]}>Live Match</Text>
              <Text style={[styles.modeHint, { color: mode === "live" ? colors.onPrimary : colors.textMuted }]}>Track frame by frame</Text>
            </Pressable>
            <Pressable
              style={[
                styles.modeOption,
                {
                  backgroundColor: mode === "manual" ? colors.primary : colors.surfaceMuted,
                  borderColor: mode === "manual" ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setMode("manual")}
            >
              <Text style={styles.modeIcon}>📝</Text>
              <Text style={[styles.modeLabel, { color: mode === "manual" ? colors.onPrimary : colors.text }]}>Manual Entry</Text>
              <Text style={[styles.modeHint, { color: mode === "manual" ? colors.onPrimary : colors.textMuted }]}>Log a past result</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Opponent</Text>
            {recentOpponents.length > 0 && (
              <Pressable onPress={autofillLastValues}>
                <Text style={[styles.autofillBtn, { color: colors.primary }]}>Use last</Text>
              </Pressable>
            )}
          </View>

          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
            value={opponentName}
            onChangeText={setOpponentName}
            placeholder="Enter opponent name"
            placeholderTextColor={colors.textMuted}
            autoFocus
          />

          {recentOpponents.length > 0 && !opponentName && (
            <View style={styles.suggestionsRow}>
              <Text style={[styles.suggestionsLabel, { color: colors.textMuted }]}>Recent:</Text>
              {recentOpponents.slice(0, 3).map((opp) => (
                <Pressable key={opp.name} style={[styles.suggestionChip, { backgroundColor: colors.surfaceMuted }]} onPress={() => setOpponentName(opp.name)}>
                  <Text style={[styles.suggestionText, { color: colors.text }]}>{opp.name}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {headToHead && (
            <View style={[styles.h2hCard, { backgroundColor: colors.primary + "10", borderColor: colors.primary + "30" }]}>
              <Text style={[styles.h2hTitle, { color: colors.text }]}>Head to Head</Text>
              <Text style={[styles.h2hRecord, { color: colors.primary }]}>
                {headToHead.wins}W · {headToHead.losses}L · {headToHead.draws}D
              </Text>
            </View>
          )}

          <Text style={[styles.label, { color: colors.textMuted }]}>Location (optional)</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
            value={location}
            onChangeText={setLocation}
            placeholder="e.g. Local Club"
            placeholderTextColor={colors.textMuted}
          />
        </View>

        {mode === "live" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Match Format</Text>
            <View style={styles.formatRow}>
              {FORMAT_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[
                    styles.formatOption,
                    {
                      backgroundColor: targetFrames === opt.value ? colors.primary + "20" : colors.surfaceMuted,
                      borderColor: targetFrames === opt.value ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setTargetFrames(opt.value)}
                >
                  <Text style={[styles.formatLabel, { color: targetFrames === opt.value ? colors.primary : colors.text }]}>{opt.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {mode === "manual" && (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Frame Score</Text>
            <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Enter the points for this frame. Higher points wins.</Text>
            <View style={styles.scoreRow}>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>You</Text>
                <TextInput
                  style={[styles.scoreInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  value={userScore}
                  onChangeText={setUserScore}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
              <Text style={[styles.scoreVs, { color: colors.textMuted }]}>v</Text>
              <View style={styles.scoreCol}>
                <Text style={[styles.scoreLabel, { color: colors.textMuted }]}>{opponentName || "Opponent"}</Text>
                <TextInput
                  style={[styles.scoreInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
                  value={opponentScore}
                  onChangeText={setOpponentScore}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                />
              </View>
            </View>
            {userScore && opponentScore && (
              <View style={styles.resultPreview}>
                <Text style={[styles.resultText, { color: colors.primary }]}>
                  {(parseInt(userScore) || 0) > (parseInt(opponentScore) || 0)
                    ? "You win the frame"
                    : (parseInt(userScore) || 0) < (parseInt(opponentScore) || 0)
                    ? "Opponent wins the frame"
                    : "Draw"}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.actionsCard}>
          {mode === "live" ? (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !opponentName.trim() || isSaving ? 0.6 : 1 }]}
              onPress={handleStartLive}
              disabled={!opponentName.trim() || isSaving}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {isSaving ? "Starting..." : "Start Match"}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: !opponentName.trim() || isSaving ? 0.6 : 1 }]}
              onPress={handleSaveManual}
              disabled={!opponentName.trim() || isSaving}
            >
              <Text style={[styles.primaryButtonText, { color: colors.onPrimary }]}>
                {isSaving ? "Saving..." : "Save Match"}
              </Text>
            </Pressable>
          )}

          <Text style={[styles.cancelBtn, { color: colors.textMuted }]} onPress={() => navigation.goBack()}>
            Cancel
          </Text>
        </View>
      </ScrollView>

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDialog(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{dialog?.title ?? ""}</Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>{dialog?.message ?? ""}</Text>
            <View style={styles.modalActions}>
              {(dialog?.actions ?? []).map((action, index) => (
                <Pressable
                  key={`${action.label}-${index}`}
                  style={[
                    styles.modalButton,
                    {
                      borderColor: action.role === "destructive" ? colors.danger : colors.border,
                      backgroundColor: action.role === "destructive" ? colors.danger + "20" : colors.surfaceMuted,
                    },
                  ]}
                  onPress={() => {
                    setDialog(null);
                    action.onPress?.();
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: action.role === "destructive" ? colors.danger : colors.text }]}>{action.label}</Text>
                </Pressable>
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="Monthly Match Limit"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 24 },
  modeCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  modeTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: "row",
    gap: 10,
  },
  modeOption: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 2,
    padding: 14,
    alignItems: "center",
  },
  modeIcon: {
    fontSize: 24,
    marginBottom: 6,
  },
  modeLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  modeHint: {
    fontSize: 11,
    textAlign: "center",
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  autofillBtn: {
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginTop: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    marginTop: 12,
  },
  suggestionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  suggestionsLabel: {
    fontSize: 12,
  },
  suggestionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  suggestionText: {
    fontSize: 12,
    fontWeight: "600",
  },
  h2hCard: {
    marginTop: 12,
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  h2hTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  h2hRecord: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 10,
  },
  sectionHint: {
    fontSize: 13,
    marginBottom: 12,
  },
  formatRow: {
    flexDirection: "row",
    gap: 8,
  },
  formatOption: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  formatLabel: {
    fontSize: 13,
    fontWeight: "700",
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  scoreCol: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  scoreInput: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  scoreVs: {
    fontSize: 16,
    fontWeight: "600",
  },
  resultPreview: {
    marginTop: 12,
    alignItems: "center",
  },
  resultText: {
    fontSize: 16,
    fontWeight: "700",
  },
  actionsCard: {
    marginTop: 8,
    alignItems: "center",
  },
  primaryButton: {
    width: "100%",
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: "700",
  },
  cancelBtn: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
  },
  modalActions: {
    marginTop: 14,
    gap: 8,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  modalButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
});
