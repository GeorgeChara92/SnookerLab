import React, { useCallback, useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "../../api/supabase";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { profilesFor } from "../../features/community/chat";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { loadLiveScores, type LiveScore } from "../../features/matches/liveShare";
import { LiveMatchCard } from "./LiveMatchCard";
import { DISPLAY_TEXT_SCALE, FONTS, SPACING } from "../../constants";

/**
 * Matches friends and group-mates are playing right now (and ones that just finished), side
 * by side, updating as they are scored. Nothing shows when nobody is playing. Given `only`, it
 * keeps to those players, for a group's page.
 */
export const LiveNow = ({
  only,
  onOpen,
  title = "LIVE NOW",
}: {
  only?: string[];
  onOpen: (matchId: string) => void;
  title?: string;
}) => {
  const { colors } = useAppTheme();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const [scores, setScores] = useState<LiveScore[]>([]);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onlyKey = only?.join(",") ?? "";

  const load = useCallback(async () => {
    const rows = (await loadLiveScores(me)).filter((score) => !only || only.includes(score.userId));
    setScores(rows);
    const missing = rows.map((row) => row.userId).filter((id) => !people[id]);
    if (missing.length) {
      const found = await profilesFor(missing);
      setPeople((prev) => ({ ...prev, ...found }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me, onlyKey]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // Scores arrive as they are posted; a burst of them causes one reload.
  useEffect(() => {
    const channel = supabase
      .channel(`live-now-${onlyKey || "all"}-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "live_scores" }, () => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void load(), 500);
      })
      .subscribe();
    return () => {
      if (timer.current) clearTimeout(timer.current);
      void supabase.removeChannel(channel);
    };
  }, [load, onlyKey]);

  if (!scores.length) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.title, { color: colors.text }]}>
          {title}
        </Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {scores.map((score) => (
          <LiveMatchCard
            key={score.matchId}
            score={score}
            playerName={nameOf(people[score.userId])}
            onPress={() => onOpen(score.matchId)}
            width={scores.length === 1 ? 300 : 250}
          />
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: SPACING.sm },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#C8102E" },
  title: { fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  row: { gap: SPACING.sm },
});
