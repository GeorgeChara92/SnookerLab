import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useChatStore } from "../../store/chatStore";
import { useAuthStore } from "../../store";
import { useDialog } from "../../components/ui/DialogProvider";
import { GroupBadge } from "../../components/community/GroupBadge";
import { containsBlockedWord } from "../../features/community/wordFilter";
import { createGroup, deleteGroup, getGroup, updateGroup, type GroupDraft } from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const EMOJIS = ["🎱", "🏆", "🎯", "🔥", "⭐", "👑", "🍺", "🏠", "📍", "💯", "🥇", "⚡"];
const COLOURS = [
  "#1E7A46",
  "#0F2A22",
  "#C9A44C",
  "#1F5FBF",
  "#C8102E",
  "#6B3FA0",
  "#E8731B",
  "#1BA39C",
  "#7A4B2A",
  "#14181A",
];

/** Creating a group, or changing one the player runs: name, look, who can join, post and invite. */
export const GroupFormScreen = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const groupId: string | undefined = route.params?.groupId;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const refreshInbox = useChatStore((state) => state.refresh);
  const me = useAuthStore((state) => state.user?.id ?? null);
  const [draft, setDraft] = useState<GroupDraft>({
    name: "",
    description: "",
    emoji: "🎱",
    colour: "#1E7A46",
    visibility: "public",
    whoCanPost: "everyone",
    whoCanInvite: "everyone",
  });
  const [isOwner, setIsOwner] = useState(!groupId);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    navigation.setOptions({ title: groupId ? "Group settings" : "New group" });
    if (!groupId) return;
    void getGroup(groupId).then((info) => {
      if (!info) return;
      const { group } = info;
      setDraft({
        name: group.name,
        description: group.description ?? "",
        emoji: group.emoji,
        colour: group.colour,
        visibility: group.visibility,
        whoCanPost: group.whoCanPost,
        whoCanInvite: group.whoCanInvite,
      });
      setIsOwner(group.owner === me);
    });
  }, [groupId, me, navigation]);

  const set = <K extends keyof GroupDraft>(key: K, value: GroupDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const problem =
    draft.name.trim().length < 3
      ? "Give the group a name of at least 3 characters."
      : containsBlockedWord(draft.name) || containsBlockedWord(draft.description)
        ? "The name or description contains a word that is not allowed."
        : null;

  const save = async () => {
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    setError(null);
    const result = groupId ? await updateGroup(groupId, draft) : await createGroup(draft);
    setSaving(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    void refreshInbox();
    if (groupId) navigation.goBack();
    else navigation.replace("Group", { groupId: (result as { ok: true; value: string }).value });
  };

  const remove = () =>
    groupId &&
    dialog.confirm({
      title: `Delete ${draft.name}?`,
      message: "The group, its members and its chat are gone for everyone. This cannot be undone.",
      tone: "danger",
      icon: "delete-outline",
      confirmLabel: "Delete group",
      cancelLabel: "Keep it",
      onConfirm: async () => {
        const result = await deleteGroup(groupId);
        if (result.ok) {
          void refreshInbox();
          navigation.popToTop();
          navigation.navigate("Groups");
        } else setError(result.message);
      },
    });

  const Choice = <T extends string>({
    value,
    options,
    onChange,
  }: {
    value: T;
    options: Array<{ value: T; label: string }>;
    onChange: (next: T) => void;
  }) => (
    <View style={[styles.choice, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="radiogroup">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.choiceItem, selected ? { backgroundColor: colors.surface } : null]}
          >
            <Text style={[styles.choiceText, { color: selected ? colors.text : colors.textMuted }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.preview}>
          <GroupBadge group={draft} size={84} />
          <Text style={[styles.previewName, { color: colors.text }]} numberOfLines={1}>
            {draft.name.trim() || "Your group"}
          </Text>
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>NAME</Text>
        <TextInput
          value={draft.name}
          onChangeText={(text) => set("name", text)}
          maxLength={40}
          placeholder="e.g. Crucible Club Tuesday League"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
        />
        <Text style={[styles.label, { color: colors.textMuted }]}>ABOUT</Text>
        <TextInput
          value={draft.description}
          onChangeText={(text) => set("description", text)}
          maxLength={300}
          multiline
          placeholder="Who it is for and what you get up to"
          placeholderTextColor={colors.textMuted}
          style={[
            styles.input,
            styles.about,
            { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>LOOK</Text>
        <View style={styles.swatches}>
          {EMOJIS.map((emoji) => (
            <Pressable
              key={emoji}
              onPress={() => set("emoji", emoji)}
              accessibilityRole="radio"
              accessibilityState={{ selected: draft.emoji === emoji }}
              style={[
                styles.emoji,
                {
                  borderColor: draft.emoji === emoji ? colors.primary : colors.border,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <Text style={styles.emojiText}>{emoji}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.swatches}>
          {COLOURS.map((colour) => (
            <Pressable
              key={colour}
              onPress={() => set("colour", colour)}
              accessibilityRole="radio"
              accessibilityLabel={`Colour ${colour}`}
              accessibilityState={{ selected: draft.colour === colour }}
              style={[
                styles.colour,
                { backgroundColor: colour, borderColor: draft.colour === colour ? colors.text : "transparent" },
              ]}
            />
          ))}
        </View>

        <Text style={[styles.label, { color: colors.textMuted }]}>WHO CAN JOIN</Text>
        <Choice
          value={draft.visibility}
          onChange={(value) => set("visibility", value)}
          options={[
            { value: "public", label: "Anyone" },
            { value: "invite", label: "Invite only" },
          ]}
        />
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          {draft.visibility === "public"
            ? "It shows in Find groups and anyone can join."
            : "It is hidden from search. Members invite people in."}
        </Text>

        <Text style={[styles.label, { color: colors.textMuted }]}>WHO CAN POST</Text>
        <Choice
          value={draft.whoCanPost}
          onChange={(value) => set("whoCanPost", value)}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "admins", label: "Admins" },
          ]}
        />

        <Text style={[styles.label, { color: colors.textMuted }]}>WHO CAN INVITE</Text>
        <Choice
          value={draft.whoCanInvite}
          onChange={(value) => set("whoCanInvite", value)}
          options={[
            { value: "everyone", label: "Everyone" },
            { value: "admins", label: "Admins" },
          ]}
        />

        {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
        <Pressable
          onPress={save}
          disabled={saving}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.save,
            { backgroundColor: colors.primary, opacity: saving ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          {saving ? <ActivityIndicator color={colors.onPrimary} /> : null}
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>
            {groupId ? "Save changes" : "Create group"}
          </Text>
        </Pressable>

        {groupId && isOwner ? (
          <Pressable onPress={remove} accessibilityRole="button" style={styles.delete}>
            <Text style={[styles.deleteText, { color: colors.danger }]}>Delete group</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: SPACING.lg, gap: SPACING.sm },
  preview: { alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  previewName: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 12, fontWeight: "800", letterSpacing: 1.2, marginTop: SPACING.md },
  input: {
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  about: { minHeight: 84, paddingTop: SPACING.sm, textAlignVertical: "top" },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  emoji: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiText: { fontSize: 22 },
  colour: { width: 36, height: 36, borderRadius: 18, borderWidth: 3 },
  choice: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  choiceItem: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  choiceText: { fontSize: 14, fontWeight: "700" },
  hint: { fontSize: 12, lineHeight: 17 },
  error: { fontSize: 14, fontWeight: "600", marginTop: SPACING.sm },
  save: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
    marginTop: SPACING.lg,
  },
  saveText: { fontSize: 16, fontWeight: "800" },
  delete: { alignItems: "center", justifyContent: "center", minHeight: HIT_TARGET, marginTop: SPACING.sm },
  deleteText: { fontSize: 15, fontWeight: "700" },
});
