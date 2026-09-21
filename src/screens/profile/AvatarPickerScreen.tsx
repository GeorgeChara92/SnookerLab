import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { PlayerAvatar } from "../../components/profile/PlayerAvatar";
import { FacePickerSheet } from "../../components/profile/FacePickerSheet";
import { usePlayerProgress } from "../../features/profile/playerProgress";
import {
  BALLS,
  OUTFITS,
  ballUnlocked,
  encodeAvatar,
  faceSeeds,
  isGeneratedAvatar,
  outfitUnlocked,
  parseAvatar,
  topBallFor,
  type AvatarSpec,
} from "../../features/profile/avatarSpec";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * Building your avatar: pick a face, dress it, and choose the ball colour for the ring. Outfits
 * and colours are earned by level, so the picker also shows what the next few levels bring.
 */
// Two full rows, so the grid never ends with a gap.
const FACE_COLUMNS = 5;
const QUICK_FACES = FACE_COLUMNS * 2;
const FACE_GAP = 8;

export const AvatarPickerScreen = () => {
  const navigation = useNavigation();
  const { user, updateAvatarPreset } = useAuthStore();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { width } = useWindowDimensions();
  const faceTile = Math.floor((width - SPACING.lg * 2 - FACE_GAP * (FACE_COLUMNS - 1)) / FACE_COLUMNS);
  const { level } = usePlayerProgress();
  const name = user?.username ?? "player";

  const initial = useMemo<AvatarSpec>(() => {
    if (isGeneratedAvatar(user?.avatar_preset)) return parseAvatar(user?.avatar_preset, name);
    return {
      seed: faceSeeds(name, 0)[0],
      outfit: "casual",
      ball: topBallFor(level.level),
    };
    // Only the first render decides where the draft starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [draft, setDraft] = useState<AvatarSpec>(initial);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  // A short row to pick from here, always led by the face in use; the sheet has the rest.
  const seeds = useMemo(
    () => [draft.seed, ...faceSeeds(name, 0, QUICK_FACES).filter((seed) => seed !== draft.seed)].slice(0, QUICK_FACES),
    [draft.seed, name]
  );
  const changed = encodeAvatar(draft) !== user?.avatar_preset;
  const ball = BALLS.find((item) => item.id === draft.ball);

  const locked = (what: string, needed: number) =>
    dialog.alert({
      title: `${what} is not unlocked yet`,
      message: `Reach level ${needed} to use it. You are level ${level.level}, ${
        level.nextTitle ? `${level.xpToNext} XP from level ${level.level + 1}` : "the top level"
      }.`,
      icon: "lock-outline",
      confirmLabel: "Got it",
    });

  const save = async () => {
    setSaving(true);
    try {
      await updateAvatarPreset(encodeAvatar(draft));
      navigation.goBack();
    } catch {
      dialog.alert({
        title: "Could not save your avatar",
        message: "It has been left as it was. Check your connection and try again.",
        tone: "danger",
        icon: "wifi-off",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* ---------------------------------------------------------------- preview */}
        <View style={styles.preview}>
          <PlayerAvatar spec={draft} size={128} />
          <Text style={[styles.previewLine, { color: colors.textMuted }]}>
            LEVEL {level.level} · {ball?.label.toUpperCase()} RING
          </Text>
        </View>

        {/* ---------------------------------------------------------------- face */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Face</Text>
        <View style={styles.faces}>
          {seeds.map((seed) => {
            const selected = draft.seed === seed;
            return (
              <Pressable
                key={seed}
                onPress={() => setDraft((prev) => ({ ...prev, seed }))}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel="Use this face"
                style={[
                  styles.faceTile,
                  { width: faceTile, height: faceTile, borderRadius: faceTile / 2 },
                  {
                    borderColor: selected ? colors.primary : "transparent",
                    backgroundColor: colors.surface,
                  },
                ]}
              >
                <PlayerAvatar spec={{ ...draft, seed }} size={faceTile - 10} showRing={false} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          onPress={() => setSheetOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Show more avatars"
          style={({ pressed }) => [
            styles.moreButton,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceMuted : colors.surface,
            },
          ]}
        >
          <MaterialCommunityIcons name="emoticon-outline" size={18} color={colors.primary} />
          <Text style={[styles.moreText, { color: colors.primary }]}>More avatars</Text>
        </Pressable>

        {/* ---------------------------------------------------------------- outfit */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Outfit</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          Dress for the table. The waistcoat is the one to work towards.
        </Text>
        <View style={styles.outfits}>
          {OUTFITS.map((outfit) => {
            const open = outfitUnlocked(outfit.id, level.level);
            const selected = draft.outfit === outfit.id;
            return (
              <Pressable
                key={outfit.id}
                onPress={() =>
                  open ? setDraft((prev) => ({ ...prev, outfit: outfit.id })) : locked(outfit.label, outfit.level)
                }
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !open }}
                accessibilityLabel={open ? outfit.label : `${outfit.label}, unlocks at level ${outfit.level}`}
                style={[
                  styles.outfitTile,
                  {
                    backgroundColor: colors.surface,
                    borderColor: selected ? colors.primary : colors.border,
                  },
                ]}
              >
                <View style={{ opacity: open ? 1 : 0.35 }}>
                  <PlayerAvatar spec={{ ...draft, outfit: outfit.id }} size={68} showRing={false} />
                </View>
                <Text style={[styles.outfitLabel, { color: open ? colors.text : colors.textMuted }]} numberOfLines={1}>
                  {outfit.label}
                </Text>
                <Text style={[styles.outfitMeta, { color: open ? colors.primary : colors.textMuted }]}>
                  {open ? (selected ? "WEARING" : "READY") : `LEVEL ${outfit.level}`}
                </Text>
                {!open ? (
                  <View style={[styles.lock, { backgroundColor: colors.surfaceMuted }]}>
                    <MaterialCommunityIcons name="lock" size={12} color={colors.textMuted} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>

        {/* ---------------------------------------------------------------- ring */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Ring</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>
          A new colour every level, in the order they come off the table.
        </Text>
        <View style={styles.balls}>
          {BALLS.map((item) => {
            const open = ballUnlocked(item.id, level.level);
            const selected = draft.ball === item.id;
            return (
              <Pressable
                key={item.id}
                onPress={() =>
                  open
                    ? setDraft((prev) => ({ ...prev, ball: item.id }))
                    : locked(`The ${item.label.toLowerCase()} ring`, item.level)
                }
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: !open }}
                accessibilityLabel={open ? `${item.label} ring` : `${item.label} ring, unlocks at level ${item.level}`}
                style={styles.ballCell}
              >
                <View
                  style={[
                    styles.ball,
                    {
                      backgroundColor: item.colour,
                      opacity: open ? 1 : 0.25,
                      borderColor: selected ? colors.text : item.id === "black" ? colors.boardMuted : "transparent",
                      borderWidth: selected ? 3 : item.id === "black" ? 1 : 0,
                    },
                  ]}
                >
                  {!open ? <MaterialCommunityIcons name="lock" size={12} color="#FFFFFF" /> : null}
                </View>
                <Text style={[styles.ballLevel, { color: selected ? colors.text : colors.textMuted }]}>
                  {item.level}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <FacePickerSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        name={name}
        draft={draft}
        onPick={(seed) => setDraft((prev) => ({ ...prev, seed }))}
      />

      <View style={[styles.saveBar, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        <Pressable
          onPress={() => void save()}
          disabled={!changed || saving}
          accessibilityRole="button"
          accessibilityLabel="Save avatar"
          accessibilityState={{ disabled: !changed || saving, busy: saving }}
          style={({ pressed }) => [
            styles.save,
            {
              backgroundColor: changed ? colors.primary : colors.surfaceMuted,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          {saving ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <Text style={[styles.saveText, { color: changed ? colors.onPrimary : colors.textMuted }]}>
              {changed ? "Save avatar" : "No changes"}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: 120 },

  preview: { alignItems: "center", gap: SPACING.md, marginBottom: SPACING.lg },
  previewLine: {
    fontFamily: FONTS.boardLabel,
    fontSize: 14,
    letterSpacing: 1.6,
  },

  sectionTitle: { fontSize: 18, fontWeight: "800", marginTop: SPACING.lg },
  sectionHint: { fontSize: 13, marginTop: 2, marginBottom: SPACING.md },
  moreButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  moreText: { fontSize: 14, fontWeight: "700" },

  faces: { flexDirection: "row", flexWrap: "wrap", gap: FACE_GAP, marginTop: SPACING.md },
  faceTile: { borderWidth: 2, alignItems: "center", justifyContent: "center" },

  outfits: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  outfitTile: {
    width: "48.5%",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.md,
  },
  outfitLabel: { fontSize: 14, fontWeight: "700", marginTop: SPACING.xs },
  outfitMeta: {
    fontFamily: FONTS.boardLabel,
    fontSize: 12,
    letterSpacing: 1.2,
  },
  lock: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  balls: { flexDirection: "row", justifyContent: "space-between" },
  ballCell: { alignItems: "center", gap: 4, minWidth: 36 },
  ball: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  ballLevel: { fontFamily: FONTS.boardLabel, fontSize: 12 },

  saveBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  save: {
    minHeight: HIT_TARGET + 4,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontWeight: "800" },
});
