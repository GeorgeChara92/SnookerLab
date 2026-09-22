import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { BoardPanel } from "../scoreboard/Scoreboard";
import { LeaderboardRow } from "./LeaderboardRow";
import { routineLeaderboard, type BoardEntry } from "../../features/community/sharedRoutines";
import { SPACING } from "../../constants";

const SHOWN = 5;

/**
 * The top of a routine's leaderboard, with the player's own place if they are further down,
 * and a way to the whole board. Once the player has joined the community it fills with
 * everyone's bests; before, it invites them to.
 */
export const RoutineLeaderboardCard = ({
  routineKey,
  onSeeAll,
  onOpenPlayer,
}: {
  routineKey: string;
  onSeeAll: () => void;
  onOpenPlayer: (userId: string) => void;
}) => {
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const joined = useCommunityStore((state) => Boolean(state.me?.handle));
  const [entries, setEntries] = useState<BoardEntry[] | null>(null);

  const load = useCallback(async () => {
    setEntries((await routineLeaderboard(routineKey, { limit: 100 })).entries);
  }, [routineKey]);

  useEffect(() => {
    void load();
  }, [load]);

  // A score just recorded should show when the player comes back.
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => void load(), 1500);
      return () => clearTimeout(timer);
    }, [load])
  );

  const mine = entries?.find((entry) => entry.profile.id === me);
  const top = entries?.slice(0, SHOWN) ?? [];

  return (
    <BoardPanel
      kicker="LEADERBOARD"
      aside={entries?.length ? `${entries.length} ${entries.length === 1 ? "PLAYER" : "PLAYERS"}` : undefined}
    >
      {entries === null ? (
        <ActivityIndicator color={colors.boardText} style={{ marginVertical: SPACING.md }} />
      ) : top.length === 0 ? (
        <Text style={[styles.empty, { color: colors.boardMuted }]}>
          {joined
            ? "No scores yet. Record one and you top the board."
            : "Join the community on the Community tab to post your best here."}
        </Text>
      ) : (
        <View style={styles.list}>
          {top.map((entry) => (
            <LeaderboardRow
              key={entry.profile.id}
              entry={entry}
              isMe={entry.profile.id === me}
              onPress={() => onOpenPlayer(entry.profile.id)}
            />
          ))}
          {mine && mine.rank > SHOWN ? (
            <>
              <MaterialCommunityIcons name="dots-vertical" size={18} color={colors.boardMuted} style={styles.gap} />
              <LeaderboardRow entry={mine} isMe onPress={() => onOpenPlayer(mine.profile.id)} />
            </>
          ) : null}
        </View>
      )}
      {entries && entries.length > 0 ? (
        <Pressable onPress={onSeeAll} accessibilityRole="button" style={styles.more} hitSlop={6}>
          <Text style={[styles.moreText, { color: colors.boardRule }]}>See the whole board</Text>
          <MaterialCommunityIcons name="chevron-right" size={18} color={colors.boardRule} />
        </Pressable>
      ) : null}
    </BoardPanel>
  );
};

const styles = StyleSheet.create({
  empty: { fontSize: 14, lineHeight: 20, marginTop: SPACING.xs },
  list: { gap: SPACING.xs, marginTop: SPACING.xs },
  gap: { alignSelf: "center" },
  more: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    marginTop: SPACING.md,
    minHeight: 32,
  },
  moreText: { fontSize: 14, fontWeight: "800" },
});
