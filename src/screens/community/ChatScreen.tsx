import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import { HeaderIconButton } from "../../navigation/stackOptions";
import { supabase } from "../../api/supabase";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useChatStore } from "../../store/chatStore";
import { useCommunityStore } from "../../store/communityStore";
import { useUiModeStore } from "../../store/uiModeStore";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { GroupBadge } from "../../components/community/GroupBadge";
import { ReportSheet } from "../../components/community/ReportSheet";
import { ChatShareCard } from "../../components/community/ChatShareCard";
import { ChatMediaBubble } from "../../components/community/ChatMediaBubble";
import { shareBody, sharePayload, shareFromMessage, type MediaShare, type RoutineShare } from "../../features/community/chatShare";
import { uploadChatMedia, chatMediaUrl, type ChatMediaType } from "../../features/community/chatMedia";
import { linkify, linkUrlFor } from "../../features/community/linkify";
import { containsBlockedWord } from "../../features/community/wordFilter";
import { nameOf, type PublicProfile } from "../../features/community/types";
import {
  answerRequest,
  conversationDetails,
  getGroup,
  loadMessages,
  markRead,
  messageFromRow,
  profilesFor,
  sendMessage,
  setMuted,
  type Group,
  type GroupRole,
  type Message,
} from "../../features/community/chat";
import { HIT_TARGET, RADIUS, SPACING } from "../../constants";

const LightboxVideo = ({ url }: { url: string }) => {
  const player = useVideoPlayer({ uri: url }, (instance) => {
    instance.loop = false;
    instance.play();
  });
  return <VideoView player={player} style={styles.lightboxVideo} nativeControls contentFit="contain" />;
};

/** A phone number, email or postcode in a message becomes a tappable link (call, email, or open
 * in Maps); everything else stays plain. */
const LinkifiedBody = ({ text, linkColor }: { text: string; linkColor: string }) => (
  <>
    {linkify(text).map((segment, index) => {
      const url = linkUrlFor(segment);
      if (!url) return <Text key={index}>{segment.text}</Text>;
      return (
        <Text key={index} style={{ color: linkColor, textDecorationLine: "underline" }} onPress={() => Linking.openURL(url)}>
          {segment.text}
        </Text>
      );
    })}
  </>
);

const dayLabel = (iso: string) => {
  const date = new Date(iso);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  if (date.toDateString() === new Date(now.getTime() - 86_400_000).toDateString()) return "Yesterday";
  return date.toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
};

/**
 * One conversation, with a friend, another player or a group. New messages arrive live. A
 * message request shows the choice to accept, decline or block before any reply; a group
 * where only admins post says so in place of the box.
 */
export const ChatScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { conversationId } = route.params as { conversationId: string };
  const { colors } = useAppTheme();
  const headerHeight = useHeaderHeight();
  const { width } = useWindowDimensions();
  const cardWidth = Math.min(280, Math.round(width * 0.72));
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const inboxRow = useChatStore((state) => state.inbox.find((row) => row.conversationId === conversationId));
  const refreshInbox = useChatStore((state) => state.refresh);
  const markSeen = useChatStore((state) => state.markSeen);
  const block = useCommunityStore((state) => state.block);
  // Sending a photo, video or PDF is a coaching feature - a player messaging a friend should not
  // see it, only a coach messaging a client.
  const canAttachMedia = useUiModeStore((state) => state.viewMode) === "coach";

  const [kind, setKind] = useState<"direct" | "group" | null>(null);
  const [other, setOther] = useState<PublicProfile | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [myRole, setMyRole] = useState<GroupRole | null>(null);
  const [people, setPeople] = useState<Record<string, PublicProfile>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [older, setOlder] = useState(true);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState<Message | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [attaching, setAttaching] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const focused = useRef(false);
  const resolvedMedia = useRef(new Set<string>());

  const isRequest = inboxRow?.status === "request";

  // Who the conversation is with, and its first page of messages.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const details = await conversationDetails(conversationId);
      if (cancelled || !details) {
        setLoading(false);
        return;
      }
      setKind(details.kind);
      if (details.kind === "direct") {
        const otherId = details.pair_low === me ? details.pair_high : details.pair_low;
        const found = await profilesFor([otherId ?? ""]);
        if (!cancelled && otherId) {
          setOther(found[otherId] ?? null);
          setPeople(found);
        }
      } else if (details.group_id) {
        const info = await getGroup(details.group_id);
        if (!cancelled && info) {
          setGroup(info.group);
          setMyRole(info.members.find((member) => member.profile.id === me)?.role ?? null);
          setPeople(Object.fromEntries(info.members.map((member) => [member.profile.id, member.profile])));
        }
      }
      const page = await loadMessages(conversationId);
      if (cancelled) return;
      setMessages(page);
      setOlder(page.length >= 40);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId, me]);

  // New messages as they are sent.
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = messageFromRow(payload.new);
          setMessages((prev) => (prev.some((item) => item.id === message.id) ? prev : [message, ...prev]));
          if (focused.current) {
            void markRead(conversationId);
            markSeen(conversationId);
          }
          if (!people[message.sender]) {
            void profilesFor([message.sender]).then((found) => setPeople((prev) => ({ ...prev, ...found })));
          }
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, markSeen]);

  // A signed URL for each media message as it appears - once per message, tracked by a ref rather
  // than by mediaUrls itself so resolving one does not re-trigger this for every other.
  useEffect(() => {
    const pending = messages.filter((item) => item.kind === "media" && !resolvedMedia.current.has(item.id));
    if (!pending.length) return;
    pending.forEach((item) => resolvedMedia.current.add(item.id));
    void Promise.all(
      pending.map(async (item) => {
        const share = shareFromMessage(item.kind, item.payload);
        if (share?.kind !== "media") return;
        const url = await chatMediaUrl(share.path);
        if (url) setMediaUrls((prev) => ({ ...prev, [item.id]: url }));
      })
    );
  }, [messages]);

  // Reading it clears the unread count.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (!isRequest) {
        void markRead(conversationId);
        markSeen(conversationId);
      }
      return () => {
        focused.current = false;
      };
    }, [conversationId, isRequest, markSeen])
  );

  const title = group ? group.name : nameOf(other);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <Pressable
          onPress={() =>
            group
              ? navigation.navigate("Group", { groupId: group.id })
              : other && navigation.navigate("PlayerProfile", { userId: other.id })
          }
          accessibilityRole="button"
          style={styles.headerTitle}
        >
          {group ? <GroupBadge group={group} size={30} /> : <CommunityAvatar profile={other} size={30} />}
          <Text style={[styles.headerText, { color: colors.text }]} numberOfLines={1}>
            {title}
          </Text>
        </Pressable>
      ),
      headerRight: () =>
        inboxRow && !isRequest ? (
          <HeaderIconButton
            icon={inboxRow.muted ? "bell-off-outline" : "bell-outline"}
            color={colors.textMuted}
            label={inboxRow.muted ? "Unmute" : "Mute"}
            onPress={async () => {
              if (!me) return;
              await setMuted(conversationId, me, !inboxRow.muted);
              void refreshInbox();
            }}
          />
        ) : null,
    });
  }, [
    colors.text,
    colors.textMuted,
    conversationId,
    group,
    inboxRow,
    isRequest,
    me,
    navigation,
    other,
    refreshInbox,
    title,
  ]);

  const canPost =
    !isRequest &&
    (kind === "direct" || (group && (group.whoCanPost === "everyone" || myRole === "owner" || myRole === "admin")));

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    if (containsBlockedWord(text)) {
      setError("That message contains a word that is not allowed.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await sendMessage(conversationId, text);
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setDraft("");
    setMessages((prev) => (prev.some((item) => item.id === result.value.id) ? prev : [result.value, ...prev]));
    void refreshInbox();
  };

  const pickAndSendMedia = async (mediaType: ChatMediaType) => {
    setAttachOpen(false);
    let file: { uri: string; fileName?: string | null; mimeType?: string | null } | null = null;
    if (mediaType === "pdf") {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf" });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      file = { uri: asset.uri, fileName: asset.name, mimeType: asset.mimeType };
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== "granted") {
        dialog.alert({ title: "Library access needed", message: "Allow access to your photo library in Settings, then try again." });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: mediaType === "video" ? ["videos"] : ["images"],
        allowsEditing: false,
        videoMaxDuration: mediaType === "video" ? 60 : undefined,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      file = { uri: asset.uri, fileName: asset.fileName, mimeType: asset.mimeType };
    }

    setAttaching(true);
    const uploaded = await uploadChatMedia(conversationId, file, mediaType);
    if (!uploaded.ok) {
      setAttaching(false);
      dialog.alert({ title: "Could not send that", message: uploaded.message, tone: "danger" });
      return;
    }
    const share: MediaShare = { kind: "media", mediaType, path: uploaded.path, fileName: file.fileName ?? null };
    const result = await sendMessage(conversationId, shareBody(share), "media", sharePayload(share));
    setAttaching(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not send that", message: result.message, tone: "danger" });
      return;
    }
    setMessages((prev) => (prev.some((item) => item.id === result.value.id) ? prev : [result.value, ...prev]));
    void refreshInbox();
  };

  const loadOlder = async () => {
    if (!older || loading || !messages.length) return;
    const page = await loadMessages(conversationId, messages[messages.length - 1].createdAt);
    setOlder(page.length >= 40);
    setMessages((prev) => [...prev, ...page.filter((item) => !prev.some((known) => known.id === item.id))]);
  };

  const answer = async (accept: boolean) => {
    const result = await answerRequest(conversationId, accept);
    if (!result.ok) {
      dialog.alert({ title: "That did not work", message: result.message, tone: "danger" });
      return;
    }
    await refreshInbox();
    if (!accept) navigation.goBack();
  };

  const confirmBlock = () =>
    other &&
    dialog.confirm({
      title: `Block ${nameOf(other)}?`,
      message: "They will not be able to message you or find you, and this conversation closes. They are not told.",
      tone: "danger",
      icon: "cancel",
      confirmLabel: "Block",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await block(other.id);
        await answerRequest(conversationId, false).catch(() => undefined);
        await refreshInbox();
        navigation.goBack();
      },
    });

  const onLongPress = (message: Message) => {
    if (message.sender === me || message.hidden) return;
    dialog.confirm({
      title: "Report this message?",
      message: "A moderator will look at it. They will not know it was you.",
      icon: "flag-outline",
      tone: "danger",
      confirmLabel: "Report",
      cancelLabel: "Cancel",
      onConfirm: () => setReporting(message),
    });
  };

  const openRoutine = (share: RoutineShare) => {
    if (share.sharedId) navigation.navigate("SharedRoutine", { id: share.sharedId });
    else if (share.libraryId)
      navigation.navigate("Practice", {
        screen: "RoutineDetail",
        params: { routineId: share.libraryId },
        initial: false,
      });
  };

  // Newest first for the inverted list, with a day label where the day changes.
  const rows = useMemo(() => {
    const out: Array<
      { type: "message"; message: Message; showName: boolean } | { type: "day"; key: string; label: string }
    > = [];
    messages.forEach((message, index) => {
      const next = messages[index + 1];
      const showName = kind === "group" && message.sender !== me && (!next || next.sender !== message.sender);
      out.push({ type: "message", message, showName });
      if (!next || new Date(next.createdAt).toDateString() !== new Date(message.createdAt).toDateString()) {
        out.push({ type: "day", key: `day-${message.createdAt}`, label: dayLabel(message.createdAt) });
      }
    });
    return out;
  }, [kind, me, messages]);

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={headerHeight}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: SPACING.xl }} />
      ) : (
        <FlatList
          inverted
          data={rows}
          keyExtractor={(row) => (row.type === "day" ? row.key : row.message.id)}
          contentContainerStyle={styles.list}
          onEndReached={loadOlder}
          onEndReachedThreshold={0.3}
          keyboardShouldPersistTaps="handled"
          ListFooterComponent={
            <View style={styles.intro}>
              {group ? <GroupBadge group={group} size={64} /> : <CommunityAvatar profile={other} size={64} />}
              <Text style={[styles.introTitle, { color: colors.text }]}>{title}</Text>
              <Text style={[styles.introBody, { color: colors.textMuted }]}>
                {group
                  ? `${group.memberCount} ${group.memberCount === 1 ? "member" : "members"}`
                  : other?.handle
                    ? `@${other.handle}`
                    : ""}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            if (item.type === "day") {
              return <Text style={[styles.day, { color: colors.textMuted }]}>{item.label}</Text>;
            }
            const { message, showName } = item;
            const mine = message.sender === me;
            const sender = people[message.sender];
            const share = message.hidden ? null : shareFromMessage(message.kind, message.payload);
            if (share) {
              return (
                <View style={[styles.messageRow, mine ? styles.mineRow : null]}>
                  {kind === "group" && !mine ? (
                    <View style={styles.avatarSlot}>
                      {showName ? <CommunityAvatar profile={sender} size={28} /> : null}
                    </View>
                  ) : null}
                  <Pressable onLongPress={() => onLongPress(message)} delayLongPress={350} style={styles.shareWrap}>
                    {showName ? (
                      <Text style={[styles.senderName, { color: colors.primary }]} numberOfLines={1}>
                        {nameOf(sender)}
                      </Text>
                    ) : null}
                    {share.kind === "media" ? (
                      <ChatMediaBubble
                        share={share}
                        url={mediaUrls[message.id] ?? null}
                        onExpand={() => {
                          const url = mediaUrls[message.id];
                          if (url) setLightbox({ url, type: share.mediaType === "video" ? "video" : "image" });
                        }}
                      />
                    ) : (
                      <ChatShareCard
                        share={share}
                        senderName={mine ? "You" : nameOf(sender)}
                        width={cardWidth}
                        onPress={share.kind === "routine" ? () => openRoutine(share) : undefined}
                      />
                    )}
                    <Text style={[styles.time, styles.shareTime, { color: colors.textMuted }]}>
                      {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </Pressable>
                </View>
              );
            }
            return (
              <View style={[styles.messageRow, mine ? styles.mineRow : null]}>
                {kind === "group" && !mine ? (
                  <View style={styles.avatarSlot}>
                    {showName ? <CommunityAvatar profile={sender} size={28} /> : null}
                  </View>
                ) : null}
                <Pressable
                  onLongPress={() => onLongPress(message)}
                  delayLongPress={350}
                  style={[
                    styles.bubble,
                    mine
                      ? { backgroundColor: colors.primary, borderBottomRightRadius: 6 }
                      : {
                          backgroundColor: colors.surface,
                          borderColor: colors.border,
                          borderWidth: 1,
                          borderBottomLeftRadius: 6,
                        },
                  ]}
                >
                  {showName ? (
                    <Text style={[styles.senderName, { color: colors.primary }]} numberOfLines={1}>
                      {nameOf(sender)}
                    </Text>
                  ) : null}
                  <Text
                    style={[
                      styles.body,
                      { color: mine ? colors.onPrimary : colors.text },
                      message.hidden ? styles.hiddenBody : null,
                    ]}
                  >
                    {message.hidden ? (
                      "Hidden after reports"
                    ) : (
                      <LinkifiedBody text={message.body} linkColor={mine ? colors.onPrimary : colors.primary} />
                    )}
                  </Text>
                  <Text style={[styles.time, { color: mine ? colors.onPrimary : colors.textMuted }]}>
                    {new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </Pressable>
              </View>
            );
          }}
        />
      )}

      {isRequest ? (
        <View
          style={[
            styles.request,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: SPACING.sm,
            },
          ]}
        >
          <Text style={[styles.requestText, { color: colors.text }]}>
            {nameOf(other)} wants to message you. They will not know you have seen this unless you accept.
          </Text>
          <View style={styles.requestActions}>
            <Pressable
              onPress={confirmBlock}
              accessibilityRole="button"
              style={[styles.requestButton, { borderColor: colors.danger }]}
            >
              <Text style={[styles.requestButtonText, { color: colors.danger }]}>Block</Text>
            </Pressable>
            <Pressable
              onPress={() => answer(false)}
              accessibilityRole="button"
              style={[styles.requestButton, { borderColor: colors.border }]}
            >
              <Text style={[styles.requestButtonText, { color: colors.text }]}>Decline</Text>
            </Pressable>
            <Pressable
              onPress={() => answer(true)}
              accessibilityRole="button"
              style={[styles.requestButton, { backgroundColor: colors.primary, borderColor: colors.primary }]}
            >
              <Text style={[styles.requestButtonText, { color: colors.onPrimary }]}>Accept</Text>
            </Pressable>
          </View>
        </View>
      ) : canPost ? (
        <View
          style={[
            styles.composer,
            {
              backgroundColor: colors.surface,
              borderTopColor: colors.border,
              paddingBottom: SPACING.sm,
            },
          ]}
        >
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          {canAttachMedia && attachOpen ? (
            <View style={styles.attachRow}>
              {(
                [
                  { type: "image" as const, icon: "image-outline" as const, label: "Photo" },
                  { type: "video" as const, icon: "video-outline" as const, label: "Video" },
                  { type: "pdf" as const, icon: "file-pdf-box" as const, label: "PDF" },
                ]
              ).map((option) => (
                <Pressable
                  key={option.type}
                  onPress={() => void pickAndSendMedia(option.type)}
                  disabled={attaching}
                  accessibilityRole="button"
                  style={[styles.attachOption, { backgroundColor: colors.surfaceMuted }]}
                >
                  <MaterialCommunityIcons name={option.icon} size={20} color={colors.primary} />
                  <Text style={[styles.attachOptionText, { color: colors.text }]}>{option.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={styles.composerRow}>
            {canAttachMedia ? (
              <Pressable
                onPress={() => setAttachOpen((prev) => !prev)}
                disabled={attaching}
                accessibilityRole="button"
                accessibilityLabel="Attach a photo, video or PDF"
                hitSlop={8}
                style={styles.attachButton}
              >
                {attaching ? (
                  <ActivityIndicator size="small" color={colors.textMuted} />
                ) : (
                  <MaterialCommunityIcons name="paperclip" size={22} color={colors.textMuted} />
                )}
              </Pressable>
            ) : null}
            <TextInput
              value={draft}
              onChangeText={(text) => {
                setDraft(text);
                if (error) setError(null);
              }}
              placeholder={kind === "group" ? `Message ${title}` : "Message"}
              placeholderTextColor={colors.textMuted}
              multiline
              maxLength={2000}
              style={[styles.input, { color: colors.text, backgroundColor: colors.surfaceMuted }]}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || sending}
              accessibilityRole="button"
              accessibilityLabel="Send"
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: colors.primary, opacity: !draft.trim() || sending ? 0.4 : pressed ? 0.8 : 1 },
              ]}
            >
              {sending ? (
                <ActivityIndicator size="small" color={colors.onPrimary} />
              ) : (
                <MaterialCommunityIcons name="send" size={20} color={colors.onPrimary} style={styles.sendIcon} />
              )}
            </Pressable>
          </View>
        </View>
      ) : kind === "group" ? (
        <View style={[styles.note, { borderTopColor: colors.border, paddingBottom: SPACING.sm }]}>
          <MaterialCommunityIcons name="bullhorn-outline" size={18} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>Only admins post in this group.</Text>
        </View>
      ) : null}

      <ReportSheet
        visible={reporting !== null}
        onClose={() => setReporting(null)}
        targetType="message"
        targetId={reporting?.id ?? ""}
        reportedUser={reporting?.sender}
        what="this message"
      />

      <Modal visible={Boolean(lightbox)} transparent animationType="fade" onRequestClose={() => setLightbox(null)}>
        <View style={[StyleSheet.absoluteFill, styles.lightbox]}>
          {lightbox?.type === "image" ? (
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setLightbox(null)}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Image source={{ uri: lightbox.url }} style={styles.lightboxImage} resizeMode="contain" />
            </Pressable>
          ) : lightbox?.type === "video" ? (
            <>
              <LightboxVideo url={lightbox.url} />
              <Pressable
                onPress={() => setLightbox(null)}
                accessibilityRole="button"
                accessibilityLabel="Close"
                hitSlop={10}
                style={styles.lightboxClose}
              >
                <MaterialCommunityIcons name="close" size={26} color="#FFFFFF" />
              </Pressable>
            </>
          ) : null}
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerTitle: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, maxWidth: 240 },
  headerText: { fontSize: 17, fontWeight: "800", flexShrink: 1 },
  list: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.md },
  intro: { alignItems: "center", gap: 4, paddingVertical: SPACING.xl },
  introTitle: { fontSize: 18, fontWeight: "800", marginTop: SPACING.sm },
  introBody: { fontSize: 13 },
  day: { fontSize: 12, fontWeight: "700", textAlign: "center", marginVertical: SPACING.md },
  messageRow: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginVertical: 2 },
  mineRow: { justifyContent: "flex-end" },
  avatarSlot: { width: 28 },
  bubble: { maxWidth: "78%", borderRadius: 18, paddingHorizontal: SPACING.md, paddingTop: 8, paddingBottom: 6 },
  senderName: { fontSize: 12, fontWeight: "800", marginBottom: 2 },
  body: { fontSize: 16, lineHeight: 21 },
  hiddenBody: { fontStyle: "italic", opacity: 0.7 },
  time: { fontSize: 10, opacity: 0.75, alignSelf: "flex-end", marginTop: 2 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: SPACING.md, paddingTop: SPACING.sm, gap: 4 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: SPACING.sm },
  input: {
    flex: 1,
    minHeight: HIT_TARGET - 2,
    maxHeight: 120,
    borderRadius: 21,
    paddingHorizontal: SPACING.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: 16,
  },
  send: {
    width: HIT_TARGET,
    height: HIT_TARGET,
    borderRadius: HIT_TARGET / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  sendIcon: { marginLeft: 2 },
  attachButton: { width: HIT_TARGET - 2, height: HIT_TARGET - 2, alignItems: "center", justifyContent: "center" },
  attachRow: { flexDirection: "row", gap: SPACING.sm, paddingBottom: SPACING.sm },
  attachOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: HIT_TARGET - 6,
    borderRadius: RADIUS.md,
  },
  attachOptionText: { fontSize: 13, fontWeight: "700" },
  lightbox: { backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  lightboxVideo: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", top: 56, right: 24, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  shareWrap: { maxWidth: "80%", gap: 4 },
  shareTime: { alignSelf: "flex-end" },
  error: { fontSize: 12, fontWeight: "600" },
  request: { borderTopWidth: StyleSheet.hairlineWidth, padding: SPACING.md, gap: SPACING.sm },
  requestText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  requestActions: { flexDirection: "row", gap: SPACING.sm },
  requestButton: {
    flex: 1,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  requestButtonText: { fontSize: 15, fontWeight: "800" },
  note: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: SPACING.md,
  },
  noteText: { fontSize: 14 },
});
