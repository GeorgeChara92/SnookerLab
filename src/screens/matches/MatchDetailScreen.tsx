import React, { useMemo, useState } from "react";
import {
  Alert,
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
import {
  useNavigation,
  useRoute,
  type NavigationProp,
  type RouteProp,
} from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import type { MatchResult, MatchesStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";

export const MatchDetailScreen = () => {
  const route = useRoute<RouteProp<MatchesStackParamList, "MatchDetail">>();
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const { matchId } = route.params;

  const { getMatchById, updateMatch, deleteMatch, getFrameRecordsByMatchId } = useMatchesStore();
  const { colors } = useAppTheme();
  const match = useMemo(() => getMatchById(matchId), [getMatchById, matchId]);

  const [opponentName, setOpponentName] = useState(match?.opponent_name ?? "");
  const [location, setLocation] = useState(match?.location ?? "");
  const [userScore, setUserScore] = useState(String(match?.user_score ?? 0));
  const [opponentScore, setOpponentScore] = useState(String(match?.opponent_score ?? 0));
  const [notes, setNotes] = useState(match?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const frameRecords = getFrameRecordsByMatchId(matchId).sort((a, b) => b.frame_number - a.frame_number);
  const selectedFrame = frameRecords.find((frame) => frame.id === selectedFrameId);

  if (!match) {
    return (
      <View style={styles.container}>
        <Text style={[styles.empty, { color: colors.textMuted }]}>Match not found.</Text>
      </View>
    );
  }

  const userScoreNum = Number(userScore) || 0;
  const opponentScoreNum = Number(opponentScore) || 0;

  const getResult = (): MatchResult => {
    if (userScoreNum > opponentScoreNum) return "win";
    if (userScoreNum < opponentScoreNum) return "loss";
    return "draw";
  };

  const onSave = async () => {
    try {
      setIsSaving(true);
      await updateMatch(match.id, {
        opponent_name: opponentName.trim() || match.opponent_name,
        location: location.trim() || undefined,
        user_score: userScoreNum,
        opponent_score: opponentScoreNum,
        frames_played: userScoreNum + opponentScoreNum,
        result: getResult(),
        notes: notes.trim() || undefined,
        sync_status: "pending",
      });

      Alert.alert("Updated", "Match has been updated.");
      navigation.goBack();
    } catch (error) {
      Alert.alert("Save failed", "Could not update this match right now.");
    } finally {
      setIsSaving(false);
    }
  };

  const onDelete = () => {
    Alert.alert("Delete Match", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMatch(match.id);
            navigation.goBack();
          } catch (error) {
            Alert.alert("Delete failed", "Could not delete this match right now.");
          }
        },
      },
    ]);
  };

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
        <Pressable style={styles.dismissKeyboard} onPress={() => Keyboard.dismiss()}>
          <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
        </Pressable>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
        <Text style={[styles.title, { color: colors.text }]}>🏆 Edit Match</Text>
        <Text style={[styles.meta, { color: colors.textMuted }]}>Played on {new Date(match.date).toLocaleDateString()}</Text>

        <Text style={[styles.label, { color: colors.text }]}>Opponent</Text>
        <TextInput style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]} value={opponentName} onChangeText={setOpponentName} />

        <Text style={[styles.label, { color: colors.text }]}>Location</Text>
        <TextInput style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]} value={location} onChangeText={setLocation} placeholder="Club / Venue" placeholderTextColor={colors.textMuted} />

        <View style={styles.scoreRow}>
          <View style={styles.scoreCol}>
            <Text style={[styles.label, { color: colors.text }]}>Your Score</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
              value={userScore}
              onChangeText={setUserScore}
              keyboardType="numeric"
            />
          </View>
          <View style={styles.scoreCol}>
            <Text style={[styles.label, { color: colors.text }]}>Opponent Score</Text>
            <TextInput
              style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
              value={opponentScore}
              onChangeText={setOpponentScore}
              keyboardType="numeric"
            />
          </View>
        </View>

        <Text style={[styles.currentResult, { color: colors.primary }]}>Current Result: {getResult().toUpperCase()}</Text>

        <Text style={[styles.label, { color: colors.text }]}>Notes</Text>
        <TextInput
          style={[styles.input, styles.notesInput, { borderColor: colors.border, backgroundColor: colors.surfaceMuted, color: colors.text }]}
          value={notes}
          onChangeText={setNotes}
          multiline
          textAlignVertical="top"
          placeholder="Optional match notes"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable
          style={[styles.liveButton, { backgroundColor: colors.primaryStrong, borderColor: colors.border }]}
          onPress={() => navigation.navigate("LiveFrameScoring", { matchId: match.id })}
        >
          <Text style={[styles.liveButtonTitle, { color: colors.onPrimary }]}>Open Live Frame Scoring</Text>
          <Text style={[styles.liveButtonMeta, { color: colors.onPrimary }]}>Track frame ball-by-ball with fouls, breaks, and snookers required.</Text>
        </Pressable>

        <View style={[styles.framesSection, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}> 
          <Text style={[styles.framesTitle, { color: colors.text }]}>Saved Frames</Text>
          {frameRecords.length === 0 ? (
            <Text style={[styles.framesEmpty, { color: colors.textMuted }]}>No frame records saved yet.</Text>
          ) : (
            frameRecords.slice(0, 8).map((frame) => (
              <Pressable key={frame.id} style={styles.frameRow} onPress={() => setSelectedFrameId(frame.id)}>
                <Text style={[styles.frameLabel, { color: colors.text }]}>Frame {frame.frame_number}</Text>
                <Text style={[styles.frameScore, { color: colors.text }]}>{frame.user_score}-{frame.opponent_score}</Text>
                <Text style={[styles.frameMeta, { color: colors.textMuted }]}>High: {frame.highest_break_user}/{frame.highest_break_opponent} · Tap for log</Text>
              </Pressable>
            ))
          )}
        </View>
      </View>

      </ScrollView>

      <View style={[styles.actionBar, { backgroundColor: colors.background, borderTopColor: colors.border }]}> 
        <Pressable style={[styles.saveButton, { backgroundColor: colors.primary, opacity: isSaving ? 0.7 : 1 }]} onPress={onSave}>
          <Text style={[styles.saveButtonText, { color: colors.onPrimary }]}>Save Changes</Text>
        </Pressable>

        <Pressable style={[styles.deleteButton, { backgroundColor: colors.surfaceMuted }]} onPress={onDelete}>
          <Text style={[styles.deleteButtonText, { color: colors.danger }]}>Delete Match</Text>
        </Pressable>
      </View>

      <Modal visible={!!selectedFrame} transparent animationType="fade" onRequestClose={() => setSelectedFrameId(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedFrameId(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.surface }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Frame {selectedFrame?.frame_number} Log</Text>
            <ScrollView style={styles.modalScroll}>
              {(selectedFrame?.events ?? []).length === 0 ? (
                <Text style={[styles.modalEmpty, { color: colors.textMuted }]}>No events recorded.</Text>
              ) : (
                (selectedFrame?.events ?? []).map((event) => (
                  <View key={event.id} style={styles.modalRow}>
                    <Text style={[styles.modalEvent, { color: colors.text }]}>• {event.kind.replace("_", " ")}</Text>
                    <Text style={[styles.modalTime, { color: colors.textMuted }]}>
                      {new Date(event.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                ))
              )}
            </ScrollView>
            <Pressable style={[styles.modalClose, { backgroundColor: colors.primary }]} onPress={() => setSelectedFrameId(null)}>
              <Text style={[styles.modalCloseText, { color: colors.onPrimary }]}>Close</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 110,
  },
  dismissKeyboard: {
    alignSelf: "flex-end",
    backgroundColor: "#D9E2EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  dismissKeyboardText: {
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
  },
  meta: {
    marginTop: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 10,
  },
  scoreCol: {
    flex: 1,
  },
  currentResult: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: "700",
  },
  notesInput: {
    minHeight: 88,
  },
  liveButton: {
    marginTop: 14,
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  liveButtonTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  liveButtonMeta: {
    marginTop: 4,
    fontSize: 12,
    opacity: 0.9,
  },
  framesSection: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  framesTitle: {
    fontSize: 14,
    fontWeight: "800",
  },
  framesEmpty: {
    marginTop: 8,
    fontSize: 12,
  },
  frameRow: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(120,120,120,0.2)",
  },
  frameLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  frameScore: {
    marginTop: 2,
    fontSize: 16,
    fontWeight: "800",
  },
  frameMeta: {
    marginTop: 2,
    fontSize: 11,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 14,
    padding: 14,
    maxHeight: "75%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "800",
  },
  modalScroll: {
    marginTop: 10,
  },
  modalEmpty: {
    fontSize: 13,
  },
  modalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(120,120,120,0.2)",
  },
  modalEvent: {
    fontSize: 13,
    fontWeight: "600",
  },
  modalTime: {
    fontSize: 11,
    fontWeight: "700",
  },
  modalClose: {
    marginTop: 12,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalCloseText: {
    fontSize: 13,
    fontWeight: "800",
  },
  actionBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  saveButton: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  saveButtonText: {
    fontSize: 15,
    fontWeight: "700",
  },
  deleteButton: {
    marginTop: 10,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  empty: {
    fontSize: 16,
    padding: 16,
  },
});
