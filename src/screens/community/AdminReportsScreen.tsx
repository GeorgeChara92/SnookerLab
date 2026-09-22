import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { supabase } from "../../api/supabase";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import {
  PROFILE_COLUMNS,
  REPORT_REASONS,
  nameOf,
  profileFromRow,
  type PublicProfile,
} from "../../features/community/types";
import type { CommunityStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

type ReportRow = {
  id: string;
  target_type: string;
  target_id: string;
  reason: string;
  details: string | null;
  created_at: string;
};

type Case = {
  key: string;
  targetType: string;
  targetId: string;
  reports: ReportRow[];
  profile: PublicProfile | null;
  hidden: boolean;
};

const reasonLabel = (value: string) => REPORT_REASONS.find((item) => item.value === value)?.label ?? value;

/**
 * Open reports, one card per thing reported, with every reason and note, for an admin to act
 * on: hide the profile, restore one hidden automatically, or dismiss the reports.
 */
export const AdminReportsScreen = () => {
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const adminId = useAuthStore((state) => state.user?.id ?? null);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("reports")
      .select("id, target_type, target_id, reason, details, created_at")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error || !data) {
      setLoading(false);
      dialog.alert({ title: "Could not load reports", message: error?.message ?? "Try again.", tone: "danger" });
      return;
    }
    const grouped = new Map<string, ReportRow[]>();
    (data as ReportRow[]).forEach((row) => {
      const key = `${row.target_type}:${row.target_id}`;
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    });
    const profileIds = [...grouped.values()]
      .filter((rows) => rows[0].target_type === "profile")
      .map((rows) => rows[0].target_id);
    const { data: profileRows } = profileIds.length
      ? await supabase.from("profiles").select(`${PROFILE_COLUMNS}, hidden_at`).in("id", profileIds)
      : { data: [] as any[] };
    const byId = new Map((profileRows ?? []).map((row: any) => [row.id, row]));
    setCases(
      [...grouped.entries()]
        .map(([key, rows]) => {
          const row = byId.get(rows[0].target_id);
          return {
            key,
            targetType: rows[0].target_type,
            targetId: rows[0].target_id,
            reports: rows,
            profile: row ? profileFromRow(row) : null,
            hidden: Boolean(row?.hidden_at),
          };
        })
        .sort((a, b) => b.reports.length - a.reports.length)
    );
    setLoading(false);
  }, [dialog]);

  useEffect(() => {
    void load();
  }, [load]);

  const resolve = async (item: Case, status: "actioned" | "dismissed", hide: boolean | null) => {
    setBusy(item.key);
    if (hide !== null && item.targetType === "profile") {
      const { error } = await supabase
        .from("profiles")
        .update({ hidden_at: hide ? new Date().toISOString() : null })
        .eq("id", item.targetId);
      if (error) {
        setBusy(null);
        dialog.alert({ title: "Could not change the profile", message: error.message, tone: "danger" });
        return;
      }
    }
    const { error } = await supabase
      .from("reports")
      .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: adminId })
      .in(
        "id",
        item.reports.map((row) => row.id)
      );
    setBusy(null);
    if (error) {
      dialog.alert({ title: "Could not update the reports", message: error.message, tone: "danger" });
      return;
    }
    setCases((prev) => prev.filter((entry) => entry.key !== item.key));
  };

  const counts = useMemo(() => cases.reduce((sum, item) => sum + item.reports.length, 0), [cases]);

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={cases}
      keyExtractor={(item) => item.key}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <Text style={[styles.summary, { color: colors.textMuted }]}>
          {loading
            ? "Loading…"
            : `${counts} open ${counts === 1 ? "report" : "reports"} on ${cases.length} ${cases.length === 1 ? "thing" : "things"}`}
        </Text>
      }
      ListEmptyComponent={
        loading ? null : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="shield-check-outline" size={32} color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Nothing to review</Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
      renderItem={({ item }) => (
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: item.hidden ? colors.danger : colors.border },
          ]}
        >
          <Pressable
            disabled={item.targetType !== "profile"}
            onPress={() => navigation.navigate("PlayerProfile", { userId: item.targetId })}
            style={styles.head}
          >
            {item.profile ? <CommunityAvatar profile={item.profile} size={40} /> : null}
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {item.profile ? nameOf(item.profile) : `${item.targetType} ${item.targetId.slice(0, 8)}`}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.targetType.toUpperCase()} · {item.reports.length}{" "}
                {item.reports.length === 1 ? "REPORT" : "REPORTS"}
                {item.hidden ? " · HIDDEN" : ""}
              </Text>
            </View>
          </Pressable>
          {item.profile?.bio ? (
            <Text style={[styles.quote, { color: colors.text, borderLeftColor: colors.border }]}>
              {item.profile.bio}
            </Text>
          ) : null}
          {item.reports.map((row) => (
            <View key={row.id} style={styles.report}>
              <Text style={[styles.reason, { color: colors.text }]}>{reasonLabel(row.reason)}</Text>
              {row.details ? <Text style={[styles.details, { color: colors.textMuted }]}>{row.details}</Text> : null}
            </View>
          ))}
          {busy === item.key ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => resolve(item, "dismissed", item.hidden ? false : null)}
                accessibilityRole="button"
                style={[styles.action, { borderColor: colors.border }]}
              >
                <Text style={[styles.actionText, { color: colors.text }]}>{item.hidden ? "Restore" : "Dismiss"}</Text>
              </Pressable>
              {item.targetType === "profile" ? (
                <Pressable
                  onPress={() => resolve(item, "actioned", true)}
                  accessibilityRole="button"
                  style={[styles.action, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                >
                  <Text style={[styles.actionText, { color: "#FFFFFF" }]}>
                    {item.hidden ? "Keep hidden" : "Hide profile"}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, flexGrow: 1 },
  summary: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1, marginBottom: SPACING.md },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyText: { fontSize: 16, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  head: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  title: { fontSize: 16, fontWeight: "800" },
  meta: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  quote: { fontSize: 14, lineHeight: 20, borderLeftWidth: 3, paddingLeft: SPACING.sm },
  report: { gap: 2 },
  reason: { fontSize: 14, fontWeight: "700" },
  details: { fontSize: 13, lineHeight: 18 },
  actions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.xs },
  action: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontSize: 15, fontWeight: "800" },
});
