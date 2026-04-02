import React, { useMemo, useState } from "react";
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
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

  const { getMatchById, updateMatch, deleteMatch } = useMatchesStore();
  const { colors } = useAppTheme();
  const match = useMemo(() => getMatchById(matchId), [getMatchById, matchId]);

  const [opponentName, setOpponentName] = useState(match?.opponent_name ?? "");
  const [location, setLocation] = useState(match?.location ?? "");
  const [userScore, setUserScore] = useState(String(match?.user_score ?? 0));
  const [opponentScore, setOpponentScore] = useState(String(match?.opponent_score ?? 0));
  const [notes, setNotes] = useState(match?.notes ?? "");
  const [isSaving, setIsSaving] = useState(false);

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
