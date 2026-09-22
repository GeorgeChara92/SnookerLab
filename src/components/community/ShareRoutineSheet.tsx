import React, { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useCustomRoutinesStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import type { CustomRoutine } from "../../features/customRoutines/customRoutine";
import { publishRoutine, routineLink, unpublishRoutine } from "../../features/community/sharedRoutines";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/**
 * Sharing a routine. For the player's own routine: put it in the community library (or share
 * it only by link), update the shared copy after editing, or stop sharing. For any shared
 * routine: its link and QR code, to send or to show someone at the club.
 */
export const ShareRoutineSheet = ({
  visible,
  onClose,
  own,
  sharedId,
  name,
  onOpenCommunity,
}: {
  visible: boolean;
  onClose: () => void;
  /** The player's own routine, when it is theirs to publish. */
  own?: CustomRoutine;
  /** A routine already shared, when it is someone else's. */
  sharedId?: string;
  name: string;
  /** Takes the player to the Community tab to set up their profile first. */
  onOpenCommunity?: () => void;
}) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const joined = useCommunityStore((state) => Boolean(state.me?.handle));
  const setShared = useCustomRoutinesStore((state) => state.setShared);
  const [visibility, setVisibility] = useState<"public" | "link">("public");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = own?.sharedId ?? sharedId ?? null;

  useEffect(() => {
    if (!visible) return;
    setError(null);
    setConfirmStop(false);
  }, [visible]);

  const publish = async () => {
    if (!own) return;
    setBusy(true);
    setError(null);
    const result = await publishRoutine(own, visibility);
    setBusy(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (!own.sharedId) setShared(own.id, result.value);
  };

  // Confirmed in place: iOS will not show another pop-up over this sheet.
  const [confirmStop, setConfirmStop] = useState(false);
  const stop = async () => {
    if (!own?.sharedId) return;
    if (!confirmStop) {
      setConfirmStop(true);
      return;
    }
    setBusy(true);
    const result = await unpublishRoutine(own.sharedId);
    setBusy(false);
    setConfirmStop(false);
    if (result.ok) setShared(own.id, null);
    else setError(result.message);
  };

  const shareLink = () => {
    if (!id) return;
    const url = routineLink(id);
    void Share.share({ message: `Try my snooker routine "${name}" in Snooker Lab: ${url}`, url });
  };

  const edited = own?.sharedId ? true : false;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
        ]}
        accessibilityViewIsModal
      >
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.title, { color: colors.text }]}>
            {id ? `Share “${name}”` : "Share to the community"}
          </Text>

          {own && !joined ? (
            <>
              <Text style={[styles.text, { color: colors.textMuted }]}>
                Shared routines carry your name and @handle. Set up your community profile first.
              </Text>
              <Pressable
                onPress={() => {
                  onClose();
                  onOpenCommunity?.();
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Go to Community</Text>
              </Pressable>
            </>
          ) : own && !own.sharedId ? (
            <>
              <Text style={[styles.text, { color: colors.textMuted }]}>
                Other players can practise it, like it and save a copy, and it gets a leaderboard of everyone's best.
              </Text>
              {(
                [
                  {
                    value: "public",
                    icon: "earth",
                    label: "Everyone",
                    hint: "In the routine library for anyone to find",
                  },
                  {
                    value: "link",
                    icon: "link-variant",
                    label: "Only with the link",
                    hint: "For friends you send it to",
                  },
                ] as const
              ).map((option) => {
                const selected = option.value === visibility;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => setVisibility(option.value)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.option,
                      {
                        borderColor: selected ? colors.primary : colors.border,
                        backgroundColor: selected ? colors.primary + "14" : colors.surface,
                      },
                    ]}
                  >
                    <MaterialCommunityIcons
                      name={option.icon}
                      size={22}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <View style={styles.flex}>
                      <Text style={[styles.optionLabel, { color: colors.text }]}>{option.label}</Text>
                      <Text style={[styles.optionHint, { color: colors.textMuted }]}>{option.hint}</Text>
                    </View>
                  </Pressable>
                );
              })}
              {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
              <Pressable
                onPress={publish}
                disabled={busy}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
                ]}
              >
                {busy ? <ActivityIndicator color={colors.onPrimary} /> : null}
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Share routine</Text>
              </Pressable>
            </>
          ) : id ? (
            <>
              <View style={[styles.qr, { backgroundColor: "#FFFFFF" }]}>
                <QRCode value={routineLink(id)} size={180} color="#0F2A22" backgroundColor="#FFFFFF" />
              </View>
              <Text style={[styles.text, { color: colors.textMuted, textAlign: "center" }]}>
                Scan it with an iPhone camera to open the routine in Snooker Lab.
              </Text>
              <Pressable
                onPress={shareLink}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <MaterialCommunityIcons name="export-variant" size={20} color={colors.onPrimary} />
                <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Share link</Text>
              </Pressable>
              {own && edited ? (
                <>
                  {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
                  <Pressable
                    onPress={publish}
                    disabled={busy}
                    accessibilityRole="button"
                    style={({ pressed }) => [
                      styles.secondary,
                      { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
                    ]}
                  >
                    {busy ? <ActivityIndicator color={colors.text} /> : null}
                    <Text style={[styles.secondaryText, { color: colors.text }]}>Update the shared copy</Text>
                  </Pressable>
                  <Text style={[styles.hint, { color: colors.textMuted }]}>
                    Edited your routine? Update the shared copy so everyone gets the change.
                  </Text>
                  {confirmStop ? (
                    <Text style={[styles.hint, { color: colors.danger }]}>
                      It leaves the library, its link stops working, and its likes and leaderboard go. Your own copy
                      stays.
                    </Text>
                  ) : null}
                  <Pressable onPress={stop} accessibilityRole="button" style={styles.stop}>
                    <Text style={[styles.stopText, { color: colors.danger }]}>
                      {confirmStop ? "Tap again to stop sharing" : "Stop sharing"}
                    </Text>
                  </Pressable>
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    marginTop: "auto",
    maxHeight: "90%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  body: { gap: SPACING.md, paddingBottom: SPACING.sm },
  title: { fontSize: 20, fontWeight: "800" },
  text: { fontSize: 14, lineHeight: 20 },
  hint: { fontSize: 12, lineHeight: 17, textAlign: "center" },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    minHeight: HIT_TARGET + 12,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  optionLabel: { fontSize: 15, fontWeight: "800" },
  optionHint: { fontSize: 12 },
  error: { fontSize: 13, fontWeight: "600" },
  qr: { alignSelf: "center", padding: SPACING.md, borderRadius: RADIUS.lg },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  secondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryText: { fontSize: 15, fontWeight: "700" },
  stop: { alignItems: "center", justifyContent: "center", minHeight: HIT_TARGET },
  stopText: { fontSize: 15, fontWeight: "700" },
});
