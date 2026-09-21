import React, { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAIAnalysesStore } from "../../store";
import type { AICoachStackParamList } from "../../types";
import { TierPaywallModal } from "../../components/subscription";
import { BoardPanel } from "../../components/scoreboard/Scoreboard";
import { SectionHeader } from "../../components/matches/MatchRows";
import { AnalysisRow } from "../../components/ai/AnalysisRow";
import { FONTS, RADIUS, SPACING } from "../../constants";
import { analysisDate, daysSince, typeInfo } from "../../features/ai/analysisLabels";

/** How many analyses the home page lists before "See all". */
const PREVIEW = 3;

const CLIP_TIPS: Array<{ icon: "video-outline" | "arrow-expand-horizontal" | "timer-outline"; text: string }> = [
  { icon: "video-outline", text: "Film side-on, with the phone at the height of the cue." },
  { icon: "arrow-expand-horizontal", text: "Keep your whole cue action in frame, from bridge to elbow." },
  { icon: "timer-outline", text: "One shot, 10 to 20 seconds. Several shots blur the report." },
];

export const AIDashboardScreen = () => {
  const navigation = useNavigation<NativeStackNavigationProp<AICoachStackParamList>>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { analyses } = useAIAnalysesStore();
  const [showPaywall, setShowPaywall] = useState(false);

  const sorted = useMemo(
    () => [...analyses].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    [analyses]
  );
  const completed = useMemo(() => sorted.filter((item) => item.status === "completed"), [sorted]);
  const working = sorted.filter((item) => item.status === "processing" || item.status === "pending");
  const latest = completed[0];
  const latestTip = completed.find((item) => item.report_json?.coaching_tip);

  // What they have sent in most often is what they are working on.
  const focus = useMemo(() => {
    const counts = new Map<string, number>();
    completed.forEach((item) => counts.set(item.analysis_type, (counts.get(item.analysis_type) ?? 0) + 1));
    const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0];
    return top ? typeInfo(top[0]) : null;
  }, [completed]);

  const upload = () => (subscription.canUseAI ? navigation.navigate("VideoUpload") : setShowPaywall(true));

  const allowance =
    subscription.remaining.aiAnalyses === null
      ? "UNLIMITED"
      : `${subscription.remaining.aiAnalyses} LEFT THIS MONTH`;

  const since = latest ? daysSince(latest.created_at) : null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* ---------------------------------------------------------------- where you are */}
      <BoardPanel kicker="AI COACH" aside={allowance}>
        {latest && since !== null ? (
          <>
            <View style={styles.sinceRow}>
              <Text style={[styles.sinceValue, { color: colors.boardText }]}>{since === 0 ? "Today" : since}</Text>
              <Text style={[styles.sinceLabel, { color: colors.boardMuted }]}>
                {since === 0 ? "YOUR LAST CLIP WENT IN" : since === 1 ? "DAY SINCE YOUR\nLAST CLIP" : "DAYS SINCE YOUR\nLAST CLIP"}
              </Text>
            </View>

            <View style={[styles.cells, { borderTopColor: colors.boardRaised }]}>
              <View style={styles.cell}>
                <Text style={[styles.cellLabel, { color: colors.boardMuted }]}>REPORTS</Text>
                <Text style={[styles.cellValue, { color: colors.boardText }]}>{completed.length}</Text>
              </View>
              <View style={styles.cell}>
                <Text style={[styles.cellLabel, { color: colors.boardMuted }]}>FOCUS</Text>
                <Text style={[styles.cellValue, { color: colors.boardText }]} numberOfLines={1}>
                  {focus?.label ?? "–"}
                </Text>
              </View>
              <View style={[styles.cell, styles.cellRight]}>
                <Text style={[styles.cellLabel, { color: colors.boardMuted }]}>LAST</Text>
                <Text style={[styles.cellValue, { color: colors.boardText }]} numberOfLines={1}>
                  {analysisDate(latest.created_at)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <>
            <Text style={[styles.emptyTitle, { color: colors.boardText }]}>No clips yet</Text>
            <Text style={[styles.emptyBody, { color: colors.boardMuted }]}>
              Film one shot and the coach reports back on what went well, what to work on, and a tip to take to
              the table.
            </Text>
          </>
        )}

        <Pressable
          onPress={upload}
          accessibilityRole="button"
          accessibilityLabel={subscription.canUseAI ? "Upload a clip for analysis" : "Upload a clip, locked on your plan"}
          style={({ pressed }) => [styles.upload, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons
            name={subscription.canUseAI ? "video-plus-outline" : "lock-outline"}
            size={20}
            color={colors.onPrimary}
          />
          <Text style={[styles.uploadText, { color: colors.onPrimary }]}>Upload a clip</Text>
        </Pressable>
      </BoardPanel>

      {/* ---------------------------------------------------------------- in progress */}
      {working.length ? (
        <View style={[styles.working, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.workingText, { color: colors.text }]}>
            Analysing {working.length === 1 ? "your clip" : `${working.length} clips`}. The report appears here when it
            is ready.
          </Text>
        </View>
      ) : null}

      {/* ---------------------------------------------------------------- latest tip */}
      {latestTip?.report_json?.coaching_tip ? (
        <Pressable
          onPress={() => navigation.navigate("AnalysisDetail", { analysisId: latestTip.id })}
          accessibilityRole="button"
          accessibilityLabel="Open the report this tip came from"
          style={({ pressed }) => [
            styles.tip,
            { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={[styles.tipRule, { backgroundColor: colors.primary }]} />
          <View style={styles.tipBody}>
            <Text style={[styles.tipKicker, { color: colors.primary }]}>TAKE TO THE TABLE</Text>
            <Text style={[styles.tipText, { color: colors.text }]}>{latestTip.report_json.coaching_tip}</Text>
            <Text style={[styles.tipSource, { color: colors.textMuted }]}>
              From your {typeInfo(latestTip.analysis_type).label.toLowerCase()} clip, {analysisDate(latestTip.created_at)}
            </Text>
          </View>
        </Pressable>
      ) : null}

      {/* ---------------------------------------------------------------- reports */}
      {sorted.length ? (
        <>
          <SectionHeader
            title="Your reports"
            actionLabel={sorted.length > PREVIEW ? `See all ${sorted.length}` : undefined}
            onAction={() => navigation.navigate("AnalysisHistory")}
          />
          {sorted.slice(0, PREVIEW).map((item) => (
            <AnalysisRow
              key={item.id}
              analysis={item}
              onPress={() => navigation.navigate("AnalysisDetail", { analysisId: item.id })}
            />
          ))}
        </>
      ) : null}

      {/* ---------------------------------------------------------------- better clips */}
      {completed.length < 2 ? (
        <View style={[styles.guide, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.guideTitle, { color: colors.text }]}>For a sharper report</Text>
          {CLIP_TIPS.map((tip) => (
            <View key={tip.icon} style={styles.guideRow}>
              <MaterialCommunityIcons name={tip.icon} size={18} color={colors.primary} />
              <Text style={[styles.guideText, { color: colors.textMuted }]}>{tip.text}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <TierPaywallModal
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        currentTier={subscription.tier}
        featureLabel="AI Coach Monthly Limit"
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.md },

  sinceRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  sinceValue: { fontFamily: FONTS.boardHeavy, fontSize: 64, lineHeight: 70, fontVariant: ["tabular-nums"] },
  sinceLabel: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 1.6, lineHeight: 18 },

  cells: { flexDirection: "row", borderTopWidth: 1, marginTop: SPACING.md, paddingTop: SPACING.md },
  cell: { flex: 1, gap: 4 },
  cellRight: { alignItems: "flex-end" },
  cellLabel: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.6 },
  cellValue: { fontFamily: FONTS.board, fontSize: 20, letterSpacing: 0.4 },

  emptyTitle: { fontFamily: FONTS.board, fontSize: 34, letterSpacing: 0.4 },
  emptyBody: { fontSize: 14, lineHeight: 20, marginTop: SPACING.xs },

  upload: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: 50,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  uploadText: { fontSize: 16, fontWeight: "800" },

  working: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  workingText: { flex: 1, fontSize: 14, fontWeight: "600", lineHeight: 20 },

  tip: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
  },
  tipRule: { width: 4 },
  tipBody: { flex: 1, padding: SPACING.lg, gap: SPACING.sm },
  tipKicker: { fontFamily: FONTS.board, fontSize: 13, letterSpacing: 1.8 },
  tipText: { fontSize: 17, fontWeight: "600", lineHeight: 24 },
  tipSource: { fontSize: 12, fontWeight: "600" },

  guide: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.lg, gap: SPACING.md },
  guideTitle: { fontSize: 16, fontWeight: "800" },
  guideRow: { flexDirection: "row", gap: SPACING.md, alignItems: "flex-start" },
  guideText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
