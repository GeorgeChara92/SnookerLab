import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, useRoute, type NavigationProp, type RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useDialog } from "../../components/ui/DialogProvider";
import { CommunityAvatar, flagOf } from "../../components/community/CommunityAvatar";
import { ReportSheet } from "../../components/community/ReportSheet";
import { startDirect } from "../../features/community/chat";
import { nameOf, relationTo, type PublicProfile } from "../../features/community/types";
import { galleryPhotoUrl, listGalleryPhotos, type CoachGalleryPhoto } from "../../features/coach/gallery";
import { getCountryByCode } from "../../constants/profileOptions";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const GALLERY_TILE = 96;

const SKILL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
  expert: "Expert",
  professional: "Professional",
};

/**
 * A coach as a player deciding whether to book them sees them: who they are, why they're
 * qualified, and where they coach, leading straight to booking - not the general player profile
 * (friend requests, match record, shared routines), which is about a fellow player, not a hire.
 */
export const CoachProfileScreen = () => {
  const route = useRoute<RouteProp<CommunityStackParamList, "CoachProfile">>();
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { userId: coachId } = route.params;
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const me = useAuthStore((state) => state.user?.id ?? null);
  const { friendships, blocked, profiles, loadProfile, block, unblock } = useCommunityStore();
  const [profile, setProfile] = useState<PublicProfile | null>(profiles[coachId] ?? null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [photos, setPhotos] = useState<CoachGalleryPhoto[]>([]);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const relation = relationTo(me, coachId, friendships, blocked);
  const isSelf = relation === "self";
  const isBlocked = relation === "blocked";

  const load = useCallback(async () => {
    setLoading(true);
    const [result, gallery] = await Promise.all([loadProfile(coachId), listGalleryPhotos(coachId)]);
    if (result.profile) setProfile(result.profile);
    setPhotos(gallery);
    setLoading(false);
  }, [loadProfile, coachId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    navigation.setOptions({ title: profile?.handle ? `@${profile.handle}` : "Coach" });
  }, [navigation, profile?.handle]);

  const run = async (task: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(true);
    const result = await task();
    setBusy(false);
    if (!result.ok) dialog.alert({ title: "That did not work", message: result.message ?? "Try again.", tone: "danger" });
  };

  if (!profile) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <>
            <MaterialCommunityIcons name="account-off-outline" size={36} color={colors.textMuted} />
            <Text style={[styles.body, { color: colors.textMuted }]}>This profile is not available.</Text>
          </>
        )}
      </View>
    );
  }

  const name = nameOf(profile);
  const country = getCountryByCode(profile.countryCode ?? undefined);
  const canMessage =
    !isSelf && !isBlocked && profile.messagePrivacy !== "nobody" && (relation === "friends" || profile.messagePrivacy === "everyone");

  const message = async () => {
    setBusy(true);
    const result = await startDirect(coachId);
    setBusy(false);
    if (result.ok) navigation.navigate("Chat", { conversationId: result.value });
    else dialog.alert({ title: `You cannot message ${name}`, message: result.message, icon: "message-lock-outline" });
  };

  return (
    <ScrollView
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + SPACING.xl }]}
      refreshControl={<RefreshControl refreshing={loading && Boolean(profile)} onRefresh={load} tintColor={colors.primary} />}
    >
      <View style={styles.hero}>
        <CommunityAvatar profile={profile} size={104} />
        <Text style={[styles.name, { color: colors.text }]}>
          {name} {flagOf(profile.countryCode)}
        </Text>
        {profile.handle ? (
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.handle, { color: colors.primary }]}>
            @{profile.handle}
          </Text>
        ) : null}
        {profile.coachLocation ? (
          <Text style={[styles.location, { color: colors.textMuted }]}>
            <MaterialCommunityIcons name="map-marker-outline" size={14} color={colors.textMuted} /> {profile.coachLocation}
          </Text>
        ) : null}
        <View style={[styles.verifiedRow, { backgroundColor: colors.surfaceMuted }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={14} color={colors.primary} />
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.verifiedText, { color: colors.text }]}>
            Verified coach
          </Text>
        </View>
        <View style={styles.tags}>
          {profile.wpbsaAccredited ? (
            <View style={[styles.tag, styles.tagRow, { backgroundColor: colors.primary }]}>
              <MaterialCommunityIcons name="whistle-outline" size={13} color={colors.onPrimary} />
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colors.onPrimary }]}>
                WPBSA ACCREDITED
              </Text>
            </View>
          ) : null}
          {profile.coachQualifications.map((qualification) => (
            <View key={qualification} style={[styles.tag, { backgroundColor: colors.board }]}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tagText, { color: colors.boardRule }]}>
                {qualification.toUpperCase()}
              </Text>
            </View>
          ))}
        </View>
        {profile.wpbsaAccredited || profile.coachQualifications.length ? (
          <Text style={[styles.disclaimer, { color: colors.textSubtle }]}>
            Qualifications as given by the coach - checked at application, not verified against the awarding body's own records.
          </Text>
        ) : null}
      </View>

      {profile.bio ? (
        <View style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.bio, { color: colors.text }]}>{profile.bio}</Text>
        </View>
      ) : null}

      {profile.coachExperience ? (
        <View style={[styles.bioCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Experience</Text>
          <Text style={[styles.bio, { color: colors.text }]}>{profile.coachExperience}</Text>
        </View>
      ) : null}

      {photos.length ? (
        <View style={styles.gallerySection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Gallery</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.galleryRow}>
            {photos.map((photo) => (
              <Pressable
                key={photo.id}
                onPress={() => setLightboxUrl(galleryPhotoUrl(photo.path))}
                accessibilityRole="button"
                accessibilityLabel="View photo"
              >
                <Image source={{ uri: galleryPhotoUrl(photo.path) }} style={styles.galleryTile} resizeMode="cover" />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {!isSelf && !isBlocked ? (
        <Pressable
          onPress={() => navigation.navigate("BookCoach", { coachId, coachName: name })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="calendar-plus" size={20} color={colors.onPrimary} />
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Book a session</Text>
        </Pressable>
      ) : null}

      {canMessage ? (
        <Pressable
          onPress={message}
          disabled={busy}
          accessibilityRole="button"
          style={({ pressed }) => [
            styles.primary,
            { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary, opacity: busy ? 0.6 : pressed ? 0.85 : 1 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <>
              <MaterialCommunityIcons name="chat-outline" size={20} color={colors.primary} />
              <Text style={[styles.primaryText, { color: colors.primary }]}>
                {relation === "friends" ? "Message" : "Send a message request"}
              </Text>
            </>
          )}
        </Pressable>
      ) : null}

      {isBlocked ? (
        <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="cancel" size={18} color={colors.textMuted} />
          <Text style={[styles.noteText, { color: colors.textMuted }]}>
            You have blocked {name}. Unblock them to book or message.
          </Text>
        </View>
      ) : null}

      {country || (profile.skillLevel && SKILL[profile.skillLevel]) || profile.joinedAt ? (
        <View style={[styles.about, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {[
            ...(country ? [{ key: "country", icon: "earth" as const, label: "Country", value: `${country.emoji} ${country.name}` }] : []),
            ...(profile.skillLevel && SKILL[profile.skillLevel]
              ? [{ key: "standard", icon: "chart-bell-curve-cumulative" as const, label: "Own standard", value: SKILL[profile.skillLevel] }]
              : []),
            ...(profile.joinedAt
              ? [
                  {
                    key: "joined",
                    icon: "calendar-account-outline" as const,
                    label: "Coaching since",
                    value: new Date(profile.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
                  },
                ]
              : []),
          ].map((item, index) => (
            <View
              key={item.key}
              style={[styles.aboutRow, index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border } : null]}
            >
              <MaterialCommunityIcons name={item.icon} size={20} color={colors.textMuted} />
              <Text style={[styles.aboutLabel, { color: colors.textMuted }]}>{item.label}</Text>
              <Text style={[styles.aboutValue, { color: colors.text }]} numberOfLines={2}>
                {item.value}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {!isSelf ? (
        <View style={styles.safety}>
          {!isBlocked ? (
            <Pressable
              onPress={() =>
                dialog.confirm({
                  title: `Block ${name}?`,
                  message: "They will not be able to find you, see your profile, add you or message you. Any friendship ends. They are not told.",
                  tone: "danger",
                  icon: "cancel",
                  confirmLabel: "Block",
                  cancelLabel: "Cancel",
                  onConfirm: () => run(() => block(coachId)),
                })
              }
              accessibilityRole="button"
              style={styles.safetyButton}
              hitSlop={6}
            >
              <MaterialCommunityIcons name="cancel" size={18} color={colors.textMuted} />
              <Text style={[styles.safetyText, { color: colors.textMuted }]}>Block</Text>
            </Pressable>
          ) : (
            <Pressable onPress={() => run(() => unblock(coachId))} accessibilityRole="button" style={styles.safetyButton} hitSlop={6}>
              <MaterialCommunityIcons name="lock-open-outline" size={18} color={colors.textMuted} />
              <Text style={[styles.safetyText, { color: colors.textMuted }]}>Unblock</Text>
            </Pressable>
          )}
          <Pressable onPress={() => setReporting(true)} accessibilityRole="button" style={styles.safetyButton} hitSlop={6}>
            <MaterialCommunityIcons name="flag-outline" size={18} color={colors.danger} />
            <Text style={[styles.safetyText, { color: colors.danger }]}>Report</Text>
          </Pressable>
        </View>
      ) : null}

      <ReportSheet
        visible={reporting}
        onClose={() => setReporting(false)}
        targetType="profile"
        targetId={coachId}
        reportedUser={coachId}
        what={`${name}'s profile`}
      />

      <Modal visible={Boolean(lightboxUrl)} transparent animationType="fade" onRequestClose={() => setLightboxUrl(null)}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.lightbox]}
          onPress={() => setLightboxUrl(null)}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          {lightboxUrl ? <Image source={{ uri: lightboxUrl }} style={styles.lightboxImage} resizeMode="contain" /> : null}
        </Pressable>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm },
  content: { padding: SPACING.lg, gap: SPACING.md },
  body: { fontSize: 15 },
  hero: { alignItems: "center", gap: SPACING.xs, paddingVertical: SPACING.md },
  name: { fontSize: 26, fontWeight: "800", textAlign: "center", marginTop: SPACING.sm },
  handle: { fontFamily: FONTS.boardLabel, fontSize: 17, letterSpacing: 0.5 },
  location: { fontSize: 14, marginTop: 2 },
  verifiedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    marginTop: SPACING.xs,
  },
  verifiedText: { fontSize: 12, fontWeight: "700" },
  tags: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: SPACING.xs, marginTop: SPACING.sm },
  tag: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: 4 },
  tagRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  tagText: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1 },
  disclaimer: { fontSize: 11, marginTop: SPACING.xs },
  bioCard: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  bio: { fontSize: 15, lineHeight: 22 },
  gallerySection: { gap: SPACING.sm },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  galleryRow: { gap: SPACING.sm },
  galleryTile: { width: GALLERY_TILE, height: GALLERY_TILE, borderRadius: RADIUS.md },
  lightbox: { backgroundColor: "rgba(0,0,0,0.92)", alignItems: "center", justifyContent: "center" },
  lightboxImage: { width: "100%", height: "80%" },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
  note: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20 },
  about: { borderWidth: 1, borderRadius: RADIUS.lg, paddingHorizontal: SPACING.md },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, minHeight: HIT_TARGET + 4 },
  aboutLabel: { width: 120, fontSize: 14, fontWeight: "600" },
  aboutValue: { flex: 1, fontSize: 15, fontWeight: "700", textAlign: "right" },
  safety: { flexDirection: "row", justifyContent: "center", gap: SPACING.xl, marginTop: SPACING.md },
  safetyButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: HIT_TARGET },
  safetyText: { fontSize: 15, fontWeight: "700" },
});
