import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { useCoachStore } from "../../store/coachStore";
import { useCommunityStore } from "../../store/communityStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf } from "../../features/community/types";
import { clientsOf } from "../../features/coach/types";
import { createCoachGroup } from "../../features/coach/groups";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const NAME_LIMIT = 60;

/** Naming a new group and picking which clients are in it. */
export const CoachGroupFormScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { bookingsAsCoach, refreshMyCoachGroups } = useCoachStore();
  const { profiles } = useCommunityStore();
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // A group post reaches real accounts only - a guest with no Snookered account has nowhere to see it.
  const clients = useMemo(
    () => clientsOf(bookingsAsCoach).filter((client): client is typeof client & { playerId: string } => client.playerId !== null),
    [bookingsAsCoach]
  );

  const toggle = (playerId: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });

  const save = async () => {
    if (!me || !name.trim()) return;
    setSaving(true);
    const result = await createCoachGroup(me, name, [...selected]);
    setSaving(false);
    if (result.ok) {
      void refreshMyCoachGroups();
      navigation.goBack();
    }
    else dialog.alert({ title: "Could not create that group", message: result.message, tone: "danger" });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <FlatList
        data={clients}
        keyExtractor={(client) => client.playerId}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={[styles.label, { color: colors.textMuted }]}>Group name</Text>
            <TextInput
              value={name}
              onChangeText={(text) => setName(text.slice(0, NAME_LIMIT))}
              placeholder="e.g. Sunday morning group"
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
            />
            <Text style={[styles.label, styles.clientsLabel, { color: colors.textMuted }]}>Clients</Text>
          </View>
        }
        ListEmptyComponent={
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            Clients you've had a session with will show up here to add.
          </Text>
        }
        renderItem={({ item }) => {
          const profile = profiles[item.playerId];
          const checked = selected.has(item.playerId);
          return (
            <Pressable
              onPress={() => toggle(item.playerId)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <CommunityAvatar profile={profile} size={38} />
              <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
                {nameOf(profile)}
              </Text>
              <MaterialCommunityIcons
                name={checked ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                size={22}
                color={checked ? colors.primary : colors.textMuted}
              />
            </Pressable>
          );
        }}
      />
      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.bottom + SPACING.sm }]}>
        <Pressable
          onPress={save}
          disabled={saving || !name.trim()}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: colors.primary, opacity: saving || !name.trim() ? 0.5 : 1 }]}
        >
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveText, { color: colors.onPrimary }]}>Create group</Text>}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  list: { padding: SPACING.lg, gap: SPACING.sm },
  header: { gap: SPACING.xs, marginBottom: SPACING.sm },
  label: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  clientsLabel: { marginTop: SPACING.md },
  input: { borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, minHeight: HIT_TARGET, fontSize: 16 },
  emptyText: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm, minHeight: HIT_TARGET + 12 },
  rowName: { flex: 1, fontSize: 15, fontWeight: "700" },
  footer: { padding: SPACING.lg, borderTopWidth: StyleSheet.hairlineWidth },
  save: { minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 16, fontWeight: "800" },
});
