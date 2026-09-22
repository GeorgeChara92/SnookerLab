import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore, useCustomRoutinesStore } from "../../store";
import { useDialog } from "../../components/ui/DialogProvider";
import { TableDiagram } from "../../components/scanSnooker/TableDiagram";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { RoutineLeaderboardCard } from "../../components/community/RoutineLeaderboardCard";
import { ReportSheet } from "../../components/community/ReportSheet";
import { ShareRoutineSheet } from "../../components/community/ShareRoutineSheet";
import { summarise } from "../../features/scanSnooker/position";
import { nameOf } from "../../features/community/types";
import {
  getSharedRoutine,
  myReactions,
  recordSave,
  setLiked,
  type SharedRoutine,
} from "../../features/community/sharedRoutines";
import type { CommunityStackParamList } from "../../types";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

/**
 * A routine from the community: the table, who made it, and what to do - like it, save a copy
 * to practise, share it on, see its leaderboard, or report it.
 */
export const SharedRoutineScreen = () => {
  const route = useRoute<RouteProp<CommunityStackParamList, "SharedRoutine">>();
  const navigation = useNavigation<any>();
  const { id } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { width, height } = useWindowDimensions();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const customRoutines = useCustomRoutinesStore((state) => state.routines);
  const saveCustom = useCustomRoutinesStore((state) => state.save);
  const [routine, setRoutine] = useState<SharedRoutine | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLikedState] = useState(false);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [reporting, setReporting] = useState(false);

  const mineCopy = customRoutines.find((item) => item.sharedId === id || item.sourceSharedId === id);
  const isOwner = routine?.owner === me;

  const load = useCallback(async () => {
    const found = await getSharedRoutine(id);
    setRoutine(found);
    if (found) setLikedState((await myReactions([id])).liked.has(id));
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: routine?.name ?? "Routine" });
  }, [navigation, routine?.name]);

  if (!routine) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="link-off" size={36} color={colors.textMuted} />
            <Text style={[styles.body, { color: colors.textMuted }]}>This routine is no longer shared.</Text>
          </>
        )}
      </View>
    );
  }

  const toggleLike = async () => {
    const next = !liked;
    setLikedState(next);
    setRoutine({ ...routine, likes: Math.max(0, routine.likes + (next ? 1 : -1)) });
    const result = await setLiked(id, next);
    if (!result.ok) {
      setLikedState(!next);
      setRoutine(routine);
    }
  };

  const openPractice = (routineId: string) =>
    navigation.navigate("Practice", { screen: "CustomRoutine", params: { routineId } });

  const save = async () => {
    if (mineCopy) {
      openPractice(mineCopy.id);
      return;
    }
    setBusy(true);
    const copy = saveCustom({
      name: routine.name,
      description: routine.description,
      maxScore: routine.maxScore,
      balls: routine.balls,
      sourceSharedId: id,
    });
    await recordSave(id);
    setBusy(false);
    setRoutine({ ...routine, saves: routine.saves + 1 });
    dialog.confirm({
      title: "Saved to your routines",
      message: "It is in Practice, under Saved. Scores you record on it count on this routine's leaderboard.",
      tone: "success",
      icon: "bookmark-check-outline",
      confirmLabel: "Practise it now",
      cancelLabel: "Later",
      onConfirm: () => openPractice(copy.id),
    });
  };

  const tableHeight = Math.round(Math.min(height * 0.42, (width - SPACING.lg * 2) * 1.95));

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
    >
      <View style={{ height: tableHeight }}>
        <TableDiagram balls={routine.balls} readOnly />
      </View>

      <Pressable
        onPress={() => routine.author && navigation.navigate("PlayerProfile", { userId: routine.owner })}
        accessibilityRole="button"
        style={styles.author}
      >
        <CommunityAvatar profile={routine.author} size={36} />
        <View style={styles.flex}>
          <Text style={[styles.authorName, { color: colors.text }]} numberOfLines={1}>
            {isOwner ? "Shared by you" : nameOf(routine.author)}
          </Text>
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {new Date(routine.createdAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {routine.visibility === "link" ? " · shared by link" : ""}
          </Text>
        </View>
      </Pressable>

      <View style={styles.chips}>
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.text }]}>{summarise(routine.balls)}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.chipText, { color: colors.text }]}>
            {routine.maxScore ? `Max score ${routine.maxScore}` : "Counts attempts"}
          </Text>
        </View>
      </View>

      {routine.description ? (
        <Text style={[styles.description, { color: colors.text }]}>{routine.description}</Text>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          onPress={toggleLike}
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? "Unlike" : "Like"}
          style={({ pressed }) => [
            styles.action,
            {
              borderColor: liked ? colors.danger : colors.border,
              backgroundColor: colors.surface,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
        >
          <MaterialCommunityIcons
            name={liked ? "heart" : "heart-outline"}
            size={20}
            color={liked ? colors.danger : colors.text}
          />
          <Text style={[styles.actionText, { color: colors.text }]}>{routine.likes}</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: colors.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialCommunityIcons
            name={mineCopy ? "play-circle-outline" : "bookmark-plus-outline"}
            size={20}
            color={colors.onPrimary}
          />
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>
            {mineCopy ? "Practise it" : `Save to my routines · ${routine.saves}`}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setSharing(true)}
          accessibilityRole="button"
          accessibilityLabel="Share"
          style={({ pressed }) => [
            styles.action,
            { borderColor: colors.border, backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <MaterialCommunityIcons name="qrcode" size={20} color={colors.text} />
        </Pressable>
      </View>

      <RoutineLeaderboardCard
        routineKey={`shared:${id}`}
        onSeeAll={() => navigation.navigate("RoutineLeaderboard", { routineKey: `shared:${id}`, name: routine.name })}
        onOpenPlayer={(userId) => navigation.navigate("PlayerProfile", { userId })}
      />

      {!isOwner ? (
        <Pressable onPress={() => setReporting(true)} accessibilityRole="button" style={styles.report}>
          <MaterialCommunityIcons name="flag-outline" size={18} color={colors.danger} />
          <Text style={[styles.reportText, { color: colors.danger }]}>Report this routine</Text>
        </Pressable>
      ) : null}

      <ShareRoutineSheet visible={sharing} onClose={() => setSharing(false)} sharedId={id} name={routine.name} />
      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="routine"
        targetId={id}
        reportedUser={routine.owner}
        what={`“${routine.name}”`}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  body: { fontSize: 15 },
  content: { padding: SPACING.lg, gap: SPACING.md },
  author: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: HIT_TARGET },
  authorName: { fontSize: 16, fontWeight: "800" },
  meta: { fontSize: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  chip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: "700" },
  description: { fontSize: 15, lineHeight: 22 },
  actions: { flexDirection: "row", gap: SPACING.sm },
  action: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 6,
    minWidth: HIT_TARGET + 12,
    paddingHorizontal: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  actionText: { fontSize: 15, fontWeight: "800" },
  save: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.sm,
  },
  saveText: { fontSize: 14, fontWeight: "800" },
  report: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET,
    marginTop: SPACING.sm,
  },
  reportText: { fontSize: 15, fontWeight: "700" },
});
