import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { supabase } from "../../api/supabase";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { GroupBadge } from "../../components/community/GroupBadge";
import { groupFromRow, profilesFor, type Group } from "../../features/community/chat";
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
  /** The player the case is about: the profile, or who sent, made or owns the thing. */
  profile: PublicProfile | null;
  group: Group | null;
  /** What to show: the group or routine's name, or "Message from …". */
  title: string;
  /** The words reported: a bio, a message, a description. */
  quote: string | null;
  hidden: boolean;
  /** Gone since it was reported (deleted by its owner). */
  missing: boolean;
};

/** Where each kind of reported thing lives; each has a hidden_at an admin can set. */
const TABLES: Record<string, string> = {
  profile: "profiles",
  message: "messages",
  group: "groups",
  routine: "shared_routines",
};

const HIDE_LABEL: Record<string, string> = {
  profile: "Hide profile",
  message: "Hide message",
  group: "Hide group",
  routine: "Hide routine",
};

const reasonLabel = (value: string) => REPORT_REASONS.find((item) => item.value === value)?.label ?? value;

/**
 * Open reports, one card per thing reported - a profile, a message, a group or a shared routine -
 * with what was said and every reason and note, for an admin to act on: hide it, restore one
 * hidden automatically after three reports, or dismiss the reports.
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
    const idsOf = (type: string) =>
      [...grouped.values()].filter((rows) => rows[0].target_type === type).map((rows) => rows[0].target_id);
    const none = { data: [] as any[] };
    const [profileRows, messageRows, groupRows, routineRows] = await Promise.all([
      idsOf("profile").length
        ? supabase.from("profiles").select(`${PROFILE_COLUMNS}, hidden_at`).in("id", idsOf("profile"))
        : none,
      idsOf("message").length
        ? supabase.from("messages").select("id, sender, body, kind, hidden_at").in("id", idsOf("message"))
        : none,
      idsOf("group").length
        ? supabase
            .from("groups")
            .select(
              "id, owner, name, description, emoji, colour, visibility, who_can_post, who_can_invite, member_count, created_at, hidden_at"
            )
            .in("id", idsOf("group"))
        : none,
      idsOf("routine").length
        ? supabase.from("shared_routines").select("id, owner, name, description, hidden_at").in("id", idsOf("routine"))
        : none,
    ]);
    const rowsById = new Map<string, any>();
    [profileRows, messageRows, groupRows, routineRows].forEach((result) =>
      (result.data ?? []).forEach((row: any) => rowsById.set(row.id, row))
    );
    // The people behind messages, groups and routines, to show who they are.
    const people = await profilesFor([
      ...(messageRows.data ?? []).map((row: any) => row.sender),
      ...(groupRows.data ?? []).map((row: any) => row.owner),
      ...(routineRows.data ?? []).map((row: any) => row.owner),
    ]);
    setCases(
      [...grouped.entries()]
        .map(([key, rows]): Case => {
          const type = rows[0].target_type;
          const row = rowsById.get(rows[0].target_id);
          const base = {
            key,
            targetType: type,
            targetId: rows[0].target_id,
            reports: rows,
            hidden: Boolean(row?.hidden_at),
            missing: !row,
            group: null,
          };
          if (type === "profile") {
            const profile = row ? profileFromRow(row) : null;
            return {
              ...base,
              profile,
              title: profile ? nameOf(profile) : "Deleted profile",
              quote: profile?.bio ?? null,
            };
          }
          if (type === "message") {
            const sender = row ? (people[row.sender] ?? null) : null;
            return {
              ...base,
              profile: sender,
              title: row ? `Message from ${nameOf(sender)}` : "Deleted message",
              quote: row?.body ?? null,
            };
          }
          if (type === "group") {
            return {
              ...base,
              profile: row ? (people[row.owner] ?? null) : null,
              group: row ? groupFromRow(row) : null,
              title: row?.name ?? "Deleted group",
              quote: row?.description ?? null,
            };
          }
          return {
            ...base,
            profile: row ? (people[row.owner] ?? null) : null,
            title: row?.name ?? "Deleted routine",
            quote: row?.description ?? null,
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
    const table = TABLES[item.targetType];
    if (hide !== null && table && !item.missing) {
      const { error } = await supabase
        .from(table)
        .update({ hidden_at: hide ? new Date().toISOString() : null })
        .eq("id", item.targetId);
      if (error) {
        setBusy(null);
        dialog.alert({ title: `Could not change the ${item.targetType}`, message: error.message, tone: "danger" });
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

  /** Where each case leads: the player, the group, the routine; a message leads to who sent it. */
  const open = (item: Case) => {
    if (item.targetType === "group") navigation.navigate("Group", { groupId: item.targetId });
    else if (item.targetType === "routine") navigation.navigate("SharedRoutine", { id: item.targetId });
    else if (item.targetType === "profile") navigation.navigate("PlayerProfile", { userId: item.targetId });
    else if (item.profile) navigation.navigate("PlayerProfile", { userId: item.profile.id });
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
          <Pressable disabled={item.missing} onPress={() => open(item)} style={styles.head}>
            {item.group ? (
              <GroupBadge group={item.group} size={40} />
            ) : item.profile ? (
              <CommunityAvatar profile={item.profile} size={40} />
            ) : null}
            <View style={styles.flex}>
              <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                {item.title}
              </Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {item.targetType.toUpperCase()} · {item.reports.length}{" "}
                {item.reports.length === 1 ? "REPORT" : "REPORTS"}
                {item.hidden ? " · HIDDEN" : ""}
              </Text>
            </View>
          </Pressable>
          {item.quote ? (
            <Text style={[styles.quote, { color: colors.text, borderLeftColor: colors.border }]}>{item.quote}</Text>
          ) : null}
          {item.targetType !== "profile" && item.profile ? (
            <Text style={[styles.details, { color: colors.textMuted }]}>
              {item.targetType === "message" ? "Sent by" : "Made by"} {nameOf(item.profile)}
              {item.profile.handle ? ` (@${item.profile.handle})` : ""}
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
              {!item.missing ? (
                <Pressable
                  onPress={() => resolve(item, "actioned", true)}
                  accessibilityRole="button"
                  style={[styles.action, { backgroundColor: colors.danger, borderColor: colors.danger }]}
                >
                  <Text style={[styles.actionText, { color: "#FFFFFF" }]}>
                    {item.hidden ? "Keep hidden" : HIDE_LABEL[item.targetType]}
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
