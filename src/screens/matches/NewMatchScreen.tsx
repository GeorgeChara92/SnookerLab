import React, { useState } from "react";
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
  const [isSaving, setIsSaving] = useState(false);
  const [dialog, setDialog] = useState<{
    title: string;
    message: string;
    actions: Array<{ label: string; role?: "default" | "destructive"; onPress?: () => void }>;
  } | null>(null);

  const ui = isDark
    ? {
        page: "#081310",
        panel: "#0E1B17",
        panelAlt: "#0F201A",
        border: "#2C4D41",
        text: "#EAFFF7",
        textMuted: "#8FB4A8",
        label: "#9AC5B8",
        inputBg: "#11231D",
        inputBorder: "#2B4A3F",
        placeholder: "#7FA79A",
        chipBg: "#183029",
        chipBorder: "#3B5E52",
        chipText: "#CFE9DE",
        chipActiveBg: "#2DA777",
        chipActiveBorder: "#4FD4A1",
      }
    : {
        page: "#EFF5F3",
        panel: "#FFFFFF",
        panelAlt: "#F7FBF9",
        border: "#D3E1DB",
        text: "#123028",
        textMuted: "#5F7A70",
        label: "#45685D",
        inputBg: "#FFFFFF",
        inputBorder: "#C5D7CF",
        placeholder: "#89A59A",
        chipBg: "#EEF5F1",
        chipBorder: "#C5D9D0",
        chipText: "#29584A",
        chipActiveBg: "#BEEBD6",
        chipActiveBorder: "#64B88F",
      };

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
      frames_played: 1,
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
        showDialog("Save failed", "Could not save this match right now.");
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
      showDialog("Opponent required", "Please add an opponent name before starting live scoring.");
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
        target_frames: 7,
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
        showDialog("Start failed", "Could not start live frame scoring right now.");
      }
      console.warn("Failed to start live match:", error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: ui.page }]}> 
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={[styles.hero, { borderColor: ui.border, backgroundColor: ui.panelAlt }]}> 
          <Text style={[styles.heroEyebrow, { color: ui.label }]}>Match Setup</Text>
          <Text style={[styles.heroTitle, { color: ui.text }]}>Create a New Match</Text>
          <Text style={[styles.heroMeta, { color: ui.textMuted }]}>Manual result entry or launch premium live frame scoring.</Text>
        </View>

        <View style={[styles.card, { borderColor: ui.border, backgroundColor: ui.panel }]}>
          <Text style={[styles.sectionTitle, { color: ui.text }]}>Players & Venue</Text>
          <Text style={[styles.label, { color: ui.label }]}>Opponent Name</Text>
          <TextInput
            style={[styles.input, { borderColor: ui.inputBorder, backgroundColor: ui.inputBg, color: ui.text }]}
            value={opponentName}
            onChangeText={setOpponentName}
            placeholder="John Smith"
            placeholderTextColor={ui.placeholder}
          />

          <Text style={[styles.label, { color: ui.label }]}>Location</Text>
          <TextInput
            style={[styles.input, { borderColor: ui.inputBorder, backgroundColor: ui.inputBg, color: ui.text }]}
            value={location}
            onChangeText={setLocation}
            placeholder="Local Club"
            placeholderTextColor={ui.placeholder}
          />
        </View>

        <View style={[styles.card, { borderColor: ui.border, backgroundColor: ui.panel }]}>
          <Text style={[styles.sectionTitle, { color: ui.text }]}>Scoreline</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreCol}>
              <Text style={[styles.label, { color: ui.label }]}>You</Text>
              <TextInput style={[styles.input, { borderColor: ui.inputBorder, backgroundColor: ui.inputBg, color: ui.text }]} value={userScore} onChangeText={setUserScore} keyboardType="numeric" placeholder="0" placeholderTextColor={ui.placeholder} />
            </View>
            <View style={styles.scoreCol}>
              <Text style={[styles.label, { color: ui.label }]}>{opponentName.trim() || "Opponent"}</Text>
              <TextInput style={[styles.input, { borderColor: ui.inputBorder, backgroundColor: ui.inputBg, color: ui.text }]} value={opponentScore} onChangeText={setOpponentScore} keyboardType="numeric" placeholder="0" placeholderTextColor={ui.placeholder} />
            </View>
          </View>

        </View>

        <View style={[styles.actionsCard, { borderColor: ui.border, backgroundColor: ui.panelAlt }]}> 
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

      <Modal visible={!!dialog} transparent animationType="fade" onRequestClose={() => setDialog(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setDialog(null)}>
          <Pressable style={[styles.modalCard, { backgroundColor: ui.panel, borderColor: ui.border }]} onPress={() => null}>
            <Text style={[styles.modalTitle, { color: ui.text }]}>{dialog?.title ?? ""}</Text>
            <Text style={[styles.modalMessage, { color: ui.textMuted }]}>{dialog?.message ?? ""}</Text>
            <View style={styles.modalActions}>
              {(dialog?.actions ?? []).map((action, index) => (
                <Pressable
                  key={`${action.label}-${index}`}
                  style={[
                    styles.modalButton,
                    {
                      borderColor: action.role === "destructive" ? "#A24D4D" : ui.border,
                      backgroundColor: action.role === "destructive" ? "#5A2526" : ui.panelAlt,
                    },
                  ]}
                  onPress={() => {
                    setDialog(null);
                    action.onPress?.();
                  }}
                >
                  <Text style={[styles.modalButtonText, { color: action.role === "destructive" ? "#FFDADA" : ui.text }]}>{action.label}</Text>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  modalMessage: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: "500",
  },
  modalActions: {
    marginTop: 12,
    gap: 8,
  },
  modalButton: {
    borderWidth: 1,
    borderRadius: 10,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonText: {
    fontSize: 13,
    fontWeight: "800",
  },
});
