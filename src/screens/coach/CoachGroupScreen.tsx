import React, { useCallback, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Image, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { useVideoPlayer, VideoView } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useCoachStore } from "../../store/coachStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf } from "../../features/community/types";
import { clientsOf } from "../../features/coach/types";
import {
  addGroupMember,
  deleteCoachGroup,
  deleteGroupPost,
  getCoachGroup,
  groupMembers,
  groupPosts,
  removeGroupMember,
} from "../../features/coach/groups";
import { groupMediaUrl } from "../../features/coach/groupMedia";
import type { CoachGroupMember, CoachGroupPost } from "../../features/coach/types";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/** A lightweight stand-in for a video post - no player is created (and nothing streams) until it
 * is actually tapped, instead of every video in the feed loading and buffering its first frame at
 * once. The real player only exists inside the lightbox once opened. */
const VideoThumb = ({ onPress }: { onPress: () => void }) => {
  const { colors } = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Play video"
      style={[styles.media, styles.videoThumb, { backgroundColor: colors.board }]}
    >
      <View style={[styles.playButton, { backgroundColor: "rgba(0,0,0,0.45)" }]}>
        <MaterialCommunityIcons name="play" size={28} color="#FFFFFF" />
      </View>
    </Pressable>
  );
};

const LightboxVideo = ({ url }: { url: string }) => {
  const player = useVideoPlayer({ uri: url }, (instance) => {
    instance.loop = false;
    instance.play();
  });
  return <VideoView player={player} style={styles.lightboxVideo} nativeControls contentFit="contain" />;
};

const PostCard = ({
  post,
  url,
  onDelete,
  onExpand,
}: {
  post: CoachGroupPost;
  url: string | null;
  onDelete?: () => void;
  onExpand: () => void;
}) => {
  const { colors } = useAppTheme();
  const navigation = useNavigation<any>();
  return (
    <View style={[styles.post, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {!url ? (
        <View style={[styles.media, styles.mediaLoading]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : post.mediaType === "image" ? (
        <Pressable onPress={onExpand} accessibilityRole="imagebutton" accessibilityLabel="Expand image">
          <Image source={{ uri: url }} style={styles.media} resizeMode="cover" />
        </Pressable>
      ) : post.mediaType === "video" ? (
        <VideoThumb onPress={onExpand} />
      ) : (
        <Pressable
          onPress={() => navigation.navigate("PdfViewer", { url, title: post.fileName ?? undefined })}
          accessibilityRole="button"
          accessibilityLabel={post.fileName ? `Open ${post.fileName}` : "Open document"}
          style={[styles.media, styles.pdfCard, { backgroundColor: colors.board }]}
        >
          <View style={[styles.pdfThumb, { backgroundColor: colors.boardRaised }]}>
            <MaterialCommunityIcons name="file-pdf-box" size={40} color={colors.boardRule} />
          </View>
          <Text style={[styles.pdfName, { color: colors.boardText }]} numberOfLines={2}>
            {post.fileName || "Document"}
          </Text>
          <Text style={[styles.pdfOpen, { color: colors.boardMuted }]}>Open document</Text>
        </Pressable>
      )}
      {post.caption ? <Text style={[styles.caption, { color: colors.text }]}>{post.caption}</Text> : null}
      <View style={styles.postFooter}>
        <Text style={[styles.postDate, { color: colors.textMuted }]}>
          {new Date(post.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        </Text>
        {onDelete ? (
          <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={8}>
            <MaterialCommunityIcons name="trash-can-outline" size={18} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

/** One coach group: its posts, and - for the coach who owns it - who is in it. A player who is a
 * member gets a read-only version of the same screen. */
export const CoachGroupScreen = () => {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { groupId, groupName } = route.params as { groupId: string; groupName: string };
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { profiles, loadProfile } = useCommunityStore();
  const { bookingsAsCoach, refreshMyCoachGroups } = useCoachStore();
  const [posts, setPosts] = useState<CoachGroupPost[] | null>(null);
  const [members, setMembers] = useState<CoachGroupMember[]>([]);
  const [coachId, setCoachId] = useState<string | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"posts" | "members">("posts");
  const [addingMembers, setAddingMembers] = useState(false);
  const [lightbox, setLightbox] = useState<{ url: string; type: "image" | "video" } | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [group, postList, memberList] = await Promise.all([getCoachGroup(groupId), groupPosts(groupId), groupMembers(groupId)]);
    setCoachId(group?.coachId ?? null);
    setPosts(postList);
    setMembers(memberList);
    const missing = memberList.map((member) => member.playerId).filter((id) => !profiles[id]);
    void Promise.all(missing.map((id) => loadProfile(id)));
    void Promise.all(
      postList.map(async (post) => {
        const url = await groupMediaUrl(post.mediaPath);
        if (url) setMediaUrls((prev) => ({ ...prev, [post.id]: url }));
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const canManage = coachId !== null && coachId === me;

  // A group post reaches real accounts only - a guest with no Snookered account has nowhere to see it.
  const addableClients = useMemo(
    () =>
      clientsOf(bookingsAsCoach).filter(
        (client): client is typeof client & { playerId: string } =>
          client.playerId !== null && !members.some((member) => member.playerId === client.playerId)
      ),
    [bookingsAsCoach, members]
  );

  const addMember = async (playerId: string) => {
    setAddingId(playerId);
    const result = await addGroupMember(groupId, playerId);
    setAddingId(null);
    if (result.ok) void load();
    else dialog.alert({ title: "Could not add them", message: result.message, tone: "danger" });
  };

  const removeMember = (member: CoachGroupMember) =>
    dialog.confirm({
      title: `Remove ${nameOf(profiles[member.playerId])}?`,
      message: "They stop seeing this group's posts.",
      tone: "danger",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await removeGroupMember(groupId, member.playerId);
        void load();
      },
    });

  const removeGroup = () =>
    dialog.confirm({
      title: `Delete ${groupName}?`,
      message: "This removes the group and every post in it for everyone.",
      tone: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await deleteCoachGroup(groupId);
        void refreshMyCoachGroups();
        navigation.goBack();
      },
    });

  const removePost = (post: CoachGroupPost) =>
    dialog.confirm({
      title: "Delete this post?",
      message: "It disappears for everyone in the group.",
      tone: "danger",
      confirmLabel: "Delete",
      cancelLabel: "Cancel",
      onConfirm: async () => {
        await deleteGroupPost(post.id, post.mediaPath);
        void load();
      },
    });

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {canManage ? (
        <View style={[styles.tabs, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
          {(["posts", "members"] as const).map((option) => (
            <Pressable
              key={option}
              onPress={() => setTab(option)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === option }}
              style={[styles.tab, tab === option ? { backgroundColor: colors.surface } : null]}
            >
              <Text style={[styles.tabText, { color: tab === option ? colors.text : colors.textMuted }]}>
                {option === "posts" ? "Posts" : `Members · ${members.length}`}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {tab === "posts" || !canManage ? (
        posts === null ? (
          <ActivityIndicator style={styles.loading} color={colors.primary} />
        ) : (
          <FlatList
            data={posts}
            keyExtractor={(post) => post.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
            ListEmptyComponent={
              <View style={styles.empty}>
                <MaterialCommunityIcons name="image-multiple-outline" size={32} color={colors.textMuted} />
                <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                  {canManage ? "Post a routine video, image or PDF for everyone in this group." : "Nothing posted yet."}
                </Text>
              </View>
            }
            renderItem={({ item }) => (
              <PostCard
                post={item}
                url={mediaUrls[item.id] ?? null}
                onDelete={canManage ? () => removePost(item) : undefined}
                onExpand={() => {
                  const url = mediaUrls[item.id];
                  if (url) setLightbox({ url, type: item.mediaType === "video" ? "video" : "image" });
                }}
              />
            )}
          />
        )
      ) : (
        <FlatList
          data={members}
          keyExtractor={(member) => member.playerId}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.textMuted }]}>No clients added yet.</Text>}
          renderItem={({ item }) => (
            <View style={[styles.memberRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <CommunityAvatar profile={profiles[item.playerId]} size={38} />
              <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                {nameOf(profiles[item.playerId])}
              </Text>
              {canManage ? (
                <Pressable onPress={() => removeMember(item)} accessibilityRole="button" hitSlop={8}>
                  <MaterialCommunityIcons name="close" size={18} color={colors.textMuted} />
                </Pressable>
              ) : null}
            </View>
          )}
        />
      )}

      {canManage ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACING.sm, borderTopColor: colors.border }]}>
          {tab === "members" ? (
            <Pressable
              onPress={() => setAddingMembers(true)}
              accessibilityRole="button"
              style={[styles.postButton, { backgroundColor: colors.primary }]}
            >
              <MaterialCommunityIcons name="account-plus-outline" size={20} color={colors.onPrimary} />
              <Text style={[styles.postButtonText, { color: colors.onPrimary }]}>Add clients</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => navigation.navigate("CoachGroupPostForm", { groupId })}
              accessibilityRole="button"
              style={[styles.postButton, { backgroundColor: colors.primary }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
              <Text style={[styles.postButtonText, { color: colors.onPrimary }]}>New post</Text>
            </Pressable>
          )}
          <Pressable onPress={removeGroup} accessibilityRole="button" hitSlop={8} style={styles.deleteGroup}>
            <MaterialCommunityIcons name="delete-outline" size={20} color={colors.danger} />
          </Pressable>
        </View>
      ) : null}

      <Modal visible={addingMembers} transparent animationType="slide" onRequestClose={() => setAddingMembers(false)}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={() => setAddingMembers(false)} />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          <Text style={[styles.sheetTitle, { color: colors.text }]}>Add clients</Text>
          <FlatList
            data={addableClients}
            keyExtractor={(client) => client.playerId}
            style={styles.sheetList}
            ListEmptyComponent={
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                Everyone you've had a session with is already in this group.
              </Text>
            }
            renderItem={({ item }) => (
              <Pressable
                onPress={() => addMember(item.playerId)}
                disabled={addingId !== null}
                accessibilityRole="button"
                style={[styles.memberRow, { backgroundColor: colors.surfaceMuted, marginBottom: SPACING.sm }]}
              >
                <CommunityAvatar profile={profiles[item.playerId]} size={38} />
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {nameOf(profiles[item.playerId])}
                </Text>
                {addingId === item.playerId ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <MaterialCommunityIcons name="plus-circle-outline" size={22} color={colors.primary} />
                )}
              </Pressable>
            )}
          />
        </View>
      </Modal>

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
    </View>
  );
};

const styles = StyleSheet.create({
  loading: { marginTop: SPACING.xl },
  tabs: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, margin: SPACING.lg, marginBottom: 0 },
  tab: { flex: 1, minHeight: 38, borderRadius: RADIUS.sm, alignItems: "center", justifyContent: "center" },
  tabText: { fontSize: 14, fontWeight: "700" },
  list: { padding: SPACING.lg, gap: SPACING.md },
  empty: { alignItems: "center", gap: SPACING.sm, paddingTop: SPACING.xl },
  emptyText: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  post: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  media: { width: "100%", height: 200, backgroundColor: "#00000022" },
  mediaLoading: { alignItems: "center", justifyContent: "center" },
  videoThumb: { alignItems: "center", justifyContent: "center" },
  playButton: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  pdfCard: { alignItems: "center", justifyContent: "center", gap: 4, padding: SPACING.lg },
  pdfThumb: { width: 64, height: 64, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginBottom: SPACING.xs },
  pdfName: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  pdfOpen: { fontSize: 12 },
  caption: { fontSize: 14, lineHeight: 20, padding: SPACING.md, paddingBottom: 0 },
  postFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: SPACING.md },
  postDate: { fontSize: 12 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.md, padding: SPACING.sm },
  memberName: { flex: 1, fontSize: 15, fontWeight: "700" },
  footer: { flexDirection: "row", gap: SPACING.sm, padding: SPACING.lg, borderTopWidth: StyleSheet.hairlineWidth },
  postButton: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: HIT_TARGET + 4, borderRadius: RADIUS.md },
  postButtonText: { fontSize: 16, fontWeight: "800" },
  deleteGroup: { width: HIT_TARGET + 4, alignItems: "center", justifyContent: "center" },
  sheet: {
    marginTop: "auto",
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingTop: SPACING.sm,
    paddingHorizontal: SPACING.lg,
  },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.sm },
  sheetTitle: { fontSize: 20, fontWeight: "800", marginBottom: SPACING.sm },
  sheetList: { maxHeight: 420 },
  lightbox: { backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  lightboxVideo: { width: "100%", height: "80%" },
  lightboxClose: { position: "absolute", top: 56, right: 24, width: 40, height: 40, alignItems: "center", justifyContent: "center" },
});
