import React, { useState } from "react";
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
import { useNavigation } from "@react-navigation/native";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useMatchesStore } from "../../store";
import { MatchResult } from "../../types";
import type { MatchesStackParamList } from "../../types";
import type { NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { TierPaywallModal } from "../../components/subscription";
import { isSubscriptionLimitError } from "../../constants";

export const NewMatchScreen = () => {
  const navigation = useNavigation<NavigationProp<MatchesStackParamList>>();
  const route = useRoute<RouteProp<MatchesStackParamList, "NewMatch">>();
  const { addMatch } = useMatchesStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const [showPaywall, setShowPaywall] = useState(false);
  const [opponentName, setOpponentName] = useState(route.params?.opponentName ?? "");
  const [location, setLocation] = useState("");
  const [userScore, setUserScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const getResult = (): MatchResult => {
    const uScore = parseInt(userScore) || 0;
    const oScore = parseInt(opponentScore) || 0;
    if (uScore > oScore) return "win";
    if (uScore < oScore) return "loss";
    return "draw";
  };

  const handleSave = async () => {
    if (!subscription.canCreateMatch) {
      setShowPaywall(true);
      return;
    }

    const uScore = parseInt(userScore) || 0;
    const oScore = parseInt(opponentScore) || 0;

    const match = {
      user_id: "",
      opponent_name: opponentName,
      date: new Date().toISOString().split("T")[0],
      location,
      match_type: "casual" as const,
      format: "best_of" as const,
      frames_played: uScore + oScore,
      user_score: uScore,
      opponent_score: oScore,
      result: getResult(),
      sync_status: "pending" as const,
    };
    try {
      setIsSaving(true);
      await addMatch(match);
      navigation.goBack();
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        Alert.alert("Save failed", "Could not save this match right now.");
      }
      console.warn("Failed to save match:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={styles.container}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
      <Pressable style={styles.dismissKeyboard} onPress={() => Keyboard.dismiss()}>
        <Text style={[styles.dismissKeyboardText, { color: colors.text }]}>Done Editing</Text>
      </Pressable>
      <Text style={[styles.label, { color: colors.text }]}>Opponent Name</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        value={opponentName}
        onChangeText={setOpponentName}
        placeholder="John Smith"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.text }]}>Location</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        value={location}
        onChangeText={setLocation}
        placeholder="Local Club"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.text }]}>Your Score</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        value={userScore}
        onChangeText={setUserScore}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />

      <Text style={[styles.label, { color: colors.text }]}>Opponent Score</Text>
      <TextInput
        style={[styles.input, { borderColor: colors.border, backgroundColor: colors.surface, color: colors.text }]}
        value={opponentScore}
        onChangeText={setOpponentScore}
        keyboardType="numeric"
        placeholder="0"
        placeholderTextColor={colors.textMuted}
      />

      <AppButton label="Save Match" onPress={handleSave} loading={isSaving} disabled={!opponentName.trim() || isSaving} />
      </ScrollView>

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="Monthly Match Limit"
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  dismissKeyboard: {
    alignSelf: "flex-end",
    backgroundColor: "#D9E2EC",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 8,
  },
  dismissKeyboardText: { fontSize: 12, fontWeight: "700" },
  label: { fontSize: 16, fontWeight: "600", marginBottom: 8, marginTop: 16 },
  input: { borderWidth: 1, padding: 12, borderRadius: 8, fontSize: 16 },
});
