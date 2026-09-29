import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { fetchPendingCoachApplications, reviewCoachApplication } from "../../features/coach/applications";
import type { CoachApplication } from "../../features/coach/types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const Field = ({ label, value }: { label: string; value: string }) => {
  const { colors } = useAppTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
};

/**
 * The coach application queue, for an admin to check by hand - experience, qualifications and the
 * links they gave to be checked against - before is_coach is ever granted. See
 * approve-coach-application, the only thing that can actually turn an approval into an account.
 */
export const AdminCoachApplicationsScreen = () => {
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const [applications, setApplications] = useState<CoachApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setApplications(await fetchPendingCoachApplications());
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const decide = (application: CoachApplication, action: "approve" | "reject") => {
    const goAhead = async (reviewerNote?: string) => {
      setBusy(application.id);
      const result = await reviewCoachApplication(application.id, action, reviewerNote);
      setBusy(null);
      if (!result.ok) {
        dialog.alert({ title: "That did not work", message: result.message, tone: "danger" });
        return;
      }
      setApplications((prev) => prev.filter((item) => item.id !== application.id));
    };

    if (action === "approve") {
      dialog.confirm({
        title: `Approve ${application.fullName}?`,
        message: "This creates or updates their account and grants coach status straight away.",
        icon: "check-decagram-outline",
        confirmLabel: "Approve",
        cancelLabel: "Cancel",
        onConfirm: () => void goAhead(),
      });
      return;
    }
    const reason = reasons[application.id]?.trim();
    dialog.confirm({
      title: `Turn down ${application.fullName}?`,
      message: reason
        ? `They will see: "${reason}". They can apply again later.`
        : "They will see a generic message, with no reason given. They can apply again later.",
      tone: "danger",
      icon: "close-circle-outline",
      confirmLabel: "Turn down",
      cancelLabel: "Cancel",
      onConfirm: () => void goAhead(reason || undefined),
    });
  };

  return (
    <FlatList
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={applications}
      keyExtractor={(item) => item.id}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
      ListHeaderComponent={
        <Text style={[styles.summary, { color: colors.textMuted }]}>
          {loading ? "Loading…" : `${applications.length} waiting on a decision`}
        </Text>
      }
      ListEmptyComponent={
        loading ? null : (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <MaterialCommunityIcons name="whistle-outline" size={32} color={colors.primary} />
            <Text style={[styles.emptyText, { color: colors.text }]}>Nothing to review</Text>
          </View>
        )
      }
      ItemSeparatorComponent={() => <View style={{ height: SPACING.md }} />}
      renderItem={({ item }) => (
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.head}>
            <Text style={[styles.title, { color: colors.text }]}>{item.fullName}</Text>
            <Text style={[styles.meta, { color: colors.textMuted }]}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Field label="Email" value={item.email} />
          {item.location ? <Field label="Where they coach" value={item.location} /> : null}
          <Field label="Experience" value={item.experience} />
          {item.qualifications.length ? <Field label="Qualifications" value={item.qualifications.join(", ")} /> : null}
          {item.wpbsaAccredited ? <Field label="WPBSA number" value={item.wpbsaNumber || "Given, no number"} /> : null}
          {item.socialLinks ? (
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Social media / links</Text>
              {item.socialLinks.split("\n").map((line) =>
                line.trim() ? (
                  <Pressable key={line} onPress={() => void Linking.openURL(line.trim().startsWith("http") ? line.trim() : `https://${line.trim()}`)}>
                    <Text style={[styles.link, { color: colors.primary }]}>{line.trim()}</Text>
                  </Pressable>
                ) : null
              )}
            </View>
          ) : null}
          {item.bio ? <Field label="Bio" value={item.bio} /> : null}

          <View style={styles.field}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>If turning down: reason (shown to them)</Text>
            <TextInput
              value={reasons[item.id] ?? ""}
              onChangeText={(text) => setReasons((prev) => ({ ...prev, [item.id]: text }))}
              placeholder="Optional, but helps them apply again properly"
              placeholderTextColor={colors.textMuted}
              multiline
              textAlignVertical="top"
              style={[styles.reasonInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
          </View>

          {busy === item.id ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={() => decide(item, "reject")}
                accessibilityRole="button"
                style={[styles.action, { borderColor: colors.danger }]}
              >
                <Text style={[styles.actionText, { color: colors.danger }]}>Turn down</Text>
              </Pressable>
              <Pressable
                onPress={() => decide(item, "approve")}
                accessibilityRole="button"
                style={[styles.action, { backgroundColor: colors.primary, borderColor: colors.primary }]}
              >
                <Text style={[styles.actionText, { color: colors.onPrimary }]}>Approve</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    />
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, flexGrow: 1 },
  summary: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1, marginBottom: SPACING.md },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyText: { fontSize: 16, fontWeight: "800" },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "800" },
  meta: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  field: { gap: 2 },
  fieldLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1, textTransform: "uppercase" },
  fieldValue: { fontSize: 14, lineHeight: 20 },
  reasonInput: { minHeight: 60, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, fontSize: 14, lineHeight: 19 },
  link: { fontSize: 14, fontWeight: "700", textDecorationLine: "underline" },
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
