import React, { useState } from "react";
import {
  Alert,
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
  const { colors, isDark } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const [showPaywall, setShowPaywall] = useState(false);
  const [opponentName, setOpponentName] = useState(route.params?.opponentName ?? "");
  const [location, setLocation] = useState("");
  const [userScore, setUserScore] = useState("");
  const [opponentScore, setOpponentScore] = useState("");
  const [framesPlayedInput, setFramesPlayedInput] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const quickFrames = [1, 3, 5, 7, 9, 11, 13];

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
    const scorelineFrames = uScore + oScore;
    const manualFrames = parseInt(framesPlayedInput) || 0;
    const framesPlayed = manualFrames > 0 ? manualFrames : scorelineFrames;

    const match = {
      user_id: "",
      opponent_name: opponentName,
      date: new Date().toISOString().split("T")[0],
      location,
      match_type: "casual" as const,
      format: "best_of" as const,
      frames_played: framesPlayed,
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

  const handleCreateAndStartLive = async () => {
    if (!subscription.canCreateMatch) {
      setShowPaywall(true);
      return;
    }

    if (!opponentName.trim()) {
      Alert.alert("Opponent required", "Please add an opponent name before starting live scoring.");
      return;
    }

    try {
      setIsSaving(true);
      const match = await addMatch({
        user_id: "",
        opponent_name: opponentName.trim(),
        date: new Date().toISOString().split("T")[0],
        location,
        match_type: "casual",
        format: "best_of",
        target_frames: (parseInt(framesPlayedInput) || 7),
        frames_played: 0,
        user_score: 0,
        opponent_score: 0,
        result: "draw",
        sync_status: "pending",
      });

      navigation.navigate("LiveFrameScoring", { matchId: match.id });
    } catch (error: any) {
      if (isSubscriptionLimitError(error)) {
        setShowPaywall(true);
      } else {
        Alert.alert("Start failed", "Could not start live frame scoring right now.");
      }
      console.warn("Failed to start live match:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: "#081310" }]}> 
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.hero, { borderColor: "#2C4D41" }]}> 
          <Text style={styles.heroEyebrow}>Match Setup</Text>
          <Text style={styles.heroTitle}>Create a New Match</Text>
          <Text style={styles.heroMeta}>Manual result entry or launch premium live frame scoring.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Players & Venue</Text>
          <Text style={styles.label}>Opponent Name</Text>
          <TextInput
            style={styles.input}
            value={opponentName}
            onChangeText={setOpponentName}
            placeholder="John Smith"
            placeholderTextColor="#7FA79A"
          />

          <Text style={styles.label}>Location</Text>
          <TextInput
            style={styles.input}
            value={location}
            onChangeText={setLocation}
            placeholder="Local Club"
            placeholderTextColor="#7FA79A"
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Scoreline</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={styles.label}>You</Text>
              <TextInput style={styles.input} value={userScore} onChangeText={setUserScore} keyboardType="numeric" placeholder="0" placeholderTextColor="#7FA79A" />
            </View>
            <View style={styles.scoreCol}>
              <Text style={styles.label}>{opponentName.trim() || "Opponent"}</Text>
              <TextInput style={styles.input} value={opponentScore} onChangeText={setOpponentScore} keyboardType="numeric" placeholder="0" placeholderTextColor="#7FA79A" />
            </View>
          </View>

          <Text style={styles.label}>Frames Played (type or select)</Text>
          <TextInput
            style={styles.input}
            value={framesPlayedInput}
            onChangeText={setFramesPlayedInput}
            keyboardType="numeric"
            placeholder={`Auto from scoreline (${(parseInt(userScore) || 0) + (parseInt(opponentScore) || 0)})`}
            placeholderTextColor="#7FA79A"
          />

          <View style={styles.quickFramesRow}>
            {quickFrames.map((frameCount) => (
              <Pressable
                key={frameCount}
                onPress={() => setFramesPlayedInput(String(frameCount))}
                style={[
                  styles.quickFrameChip,
                  framesPlayedInput === String(frameCount) && { backgroundColor: "#2DA777", borderColor: "#4FD4A1" },
                ]}
              >
                <Text style={[styles.quickFrameChipText, framesPlayedInput === String(frameCount) && { color: isDark ? colors.onPrimary : "#072D22" }]}>{frameCount}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable style={styles.autoFramesButton} onPress={() => setFramesPlayedInput("")}> 
            <Text style={styles.autoFramesText}>Use scoreline total automatically</Text>
          </Pressable>
        </View>

        <View style={styles.actionsCard}>
          <AppButton label="Save Match" onPress={handleSave} loading={isSaving} disabled={!opponentName.trim() || isSaving} />
          <View style={styles.secondaryAction}>
            <AppButton
              label="Create & Start Live Frame"
              onPress={handleCreateAndStartLive}
              disabled={!opponentName.trim() || isSaving}
              variant="secondary"
            />
          </View>
        </View>
      </ScrollView>

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
  hero: {
    borderRadius: 16,
    borderWidth: 1,
    backgroundColor: "#0F201A",
    padding: 14,
    marginBottom: 12,
  },
  heroEyebrow: {
    color: "#9AC8B8",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  heroTitle: {
    marginTop: 5,
    color: "#EAFFF7",
    fontSize: 24,
    fontWeight: "800",
  },
  heroMeta: {
    marginTop: 6,
    color: "#8FB4A8",
    fontSize: 13,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C4D41",
    backgroundColor: "#0E1B17",
    padding: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    color: "#DDF8EE",
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 2,
  },
  label: { color: "#9AC5B8", fontSize: 12, fontWeight: "700", marginBottom: 6, marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: "#2B4A3F",
    backgroundColor: "#11231D",
    color: "#ECFFF7",
    padding: 11,
    borderRadius: 11,
    fontSize: 16,
  },
  scoreRow: {
    flexDirection: "row",
    gap: 8,
  },
  scoreCol: {
    flex: 1,
  },
  quickFramesRow: {
    marginTop: 9,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
  },
  quickFrameChip: {
    minWidth: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#3B5E52",
    backgroundColor: "#183029",
    paddingHorizontal: 12,
    paddingVertical: 7,
    alignItems: "center",
  },
  quickFrameChipText: {
    color: "#CFE9DE",
    fontSize: 12,
    fontWeight: "800",
  },
  autoFramesButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  autoFramesText: {
    color: "#7CE0B8",
    fontSize: 12,
    fontWeight: "700",
  },
  actionsCard: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#2C4D41",
    backgroundColor: "#0F201A",
    padding: 12,
  },
  secondaryAction: {
    marginTop: 10,
  },
});
