import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { useUiModeStore } from "../../store/uiModeStore";
import { PlayerAvatar } from "../../components/profile/PlayerAvatar";
import { cleanHandle, handleProblem } from "../../features/community/handle";
import {
  deleteGalleryPhoto,
  galleryPhotoUrl,
  listGalleryPhotos,
  uploadGalleryPhoto,
  GALLERY_LIMIT,
  type CoachGalleryPhoto,
} from "../../features/coach/gallery";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const LOCATION_LIMIT = 120;
const QUALIFICATION_LIMIT = 40;
const MAX_QUALIFICATIONS = 6;
const BIO_LIMIT = 160;
const PHOTO_SIZE = 88;

type HandleState = "idle" | "checking" | "free" | "taken";

/** What a coach shows on their listing: qualifications, WPBSA accreditation, and where they coach. */
export const CoachSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { me, saveMe, handleIsFree } = useCommunityStore();
  const { viewMode, setViewMode } = useUiModeStore();
  const { user, signOut } = useAuthStore();

  const [handle, setHandle] = useState(me?.handle ?? "");
  const [handleState, setHandleState] = useState<HandleState>("idle");
  const [bio, setBio] = useState(me?.bio ?? "");
  const [location, setLocation] = useState(me?.coachLocation ?? "");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(
    me?.coachLat != null && me?.coachLng != null ? { lat: me.coachLat, lng: me.coachLng } : null
  );
  const [wpbsa, setWpbsa] = useState(me?.wpbsaAccredited ?? false);
  const [qualifications, setQualifications] = useState<string[]>(me?.coachQualifications ?? []);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [photos, setPhotos] = useState<CoachGalleryPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!me?.id) return;
      void listGalleryPhotos(me.id).then(setPhotos);
    }, [me?.id])
  );

  const addPhoto = async () => {
    if (!me?.id || photos.length >= GALLERY_LIMIT) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      dialog.alert({ title: "Library access needed", message: "Allow access to your photo library in Settings, then choose a photo." });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets?.length) return;
    setUploadingPhoto(true);
    const uploaded = await uploadGalleryPhoto(me.id, result.assets[0].uri);
    setUploadingPhoto(false);
    if (!uploaded.ok) {
      dialog.alert({ title: "Could not add that photo", message: uploaded.message, tone: "danger" });
      return;
    }
    setPhotos(await listGalleryPhotos(me.id));
  };

  const removePhoto = (photo: CoachGalleryPhoto) =>
    dialog.confirm({
      title: "Remove this photo?",
      message: "It disappears from your gallery for good.",
      tone: "danger",
      icon: "trash-can-outline",
      confirmLabel: "Remove",
      cancelLabel: "Keep",
      onConfirm: async () => {
        setDeletingPhotoId(photo.id);
        const result = await deleteGalleryPhoto(photo);
        setDeletingPhotoId(null);
        if (!result.ok) {
          dialog.alert({ title: "Could not remove that photo", message: result.message, tone: "danger" });
          return;
        }
        setPhotos((prev) => prev.filter((item) => item.id !== photo.id));
      },
    });

  // A hand-typed location no longer matches whatever coordinates were set by GPS, so it stops
  // counting as "near me" for search until the coach uses GPS again.
  const onEditLocation = (text: string) => {
    setLocation(text.slice(0, LOCATION_LIMIT));
    setCoords(null);
  };

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dialog.alert({
          title: "Location not available",
          message: "Turn on location for Snookered in Settings to use this.",
          icon: "map-marker-off-outline",
        });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      const { latitude, longitude } = position.coords;
      const [place] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const label = place ? [place.city ?? place.subregion, place.region ?? place.country].filter(Boolean).join(", ") : null;
      setCoords({ lat: latitude, lng: longitude });
      if (label) setLocation(label.slice(0, LOCATION_LIMIT));
    } catch {
      dialog.alert({ title: "Could not get your location", message: "Check your connection and try again." });
    } finally {
      setLocating(false);
    }
  };

  const addTag = () => {
    const tag = newTag.trim();
    if (!tag || qualifications.includes(tag) || qualifications.length >= MAX_QUALIFICATIONS) return;
    setQualifications([...qualifications, tag]);
    setNewTag("");
  };

  const removeTag = (tag: string) => setQualifications(qualifications.filter((item) => item !== tag));

  const handleProblemText = handleProblem(handle);

  // Is the handle free? Checked a moment after typing stops - the same pattern as the player's
  // own community settings, so a coach who never opens player view can still claim one.
  useEffect(() => {
    if (handleProblemText || handle === me?.handle) {
      setHandleState("idle");
      return;
    }
    setHandleState("checking");
    const timer = setTimeout(async () => setHandleState((await handleIsFree(handle)) ? "free" : "taken"), 400);
    return () => clearTimeout(timer);
  }, [handle, handleIsFree, me?.handle, handleProblemText]);

  const canSave = !handleProblemText && handleState !== "taken" && handleState !== "checking" && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const result = await saveMe({
      handle,
      bio: bio.trim(),
      coachLocation: location,
      coachLat: coords?.lat ?? null,
      coachLng: coords?.lng ?? null,
      wpbsaAccredited: wpbsa,
      coachQualifications: qualifications,
    });
    setSaving(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not save that", message: result.message, tone: "danger" });
      return;
    }
    navigation.goBack();
  };

  const switchTo = (mode: "player" | "coach") => {
    setViewMode(mode);
    navigation.getParent()?.goBack();
  };

  const confirmSignOut = () =>
    dialog.confirm({
      title: "Sign out of this phone?",
      message: "Your coaching schedule and clients are saved to your account and come back when you sign in.",
      icon: "logout",
      tone: "danger",
      confirmLabel: "Sign out",
      cancelLabel: "Stay signed in",
      onConfirm: () => {
        setSigningOut(true);
        setTimeout(() => void signOut(), 350);
      },
    });

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Pressable
        onPress={() => switchTo(viewMode === "coach" ? "player" : "coach")}
        accessibilityRole="button"
        style={[styles.switchModeButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
      >
        <MaterialCommunityIcons name="swap-horizontal" size={20} color={colors.primary} />
        <Text style={[styles.switchModeText, { color: colors.text }]}>
          {viewMode === "coach" ? "Switch to player view" : "Switch to coach view"}
        </Text>
      </Pressable>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>PHOTO</Text>
      <Pressable
        onPress={() => navigation.navigate("AvatarPicker")}
        accessibilityRole="button"
        style={[styles.card, styles.photoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
      >
        {user?.profile_image_url ? (
          <Image
            source={{ uri: user.profile_image_url }}
            style={styles.avatarPreview}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={0}
          />
        ) : (
          <PlayerAvatar preset={user?.avatar_preset} name={user?.username} size={56} />
        )}
        <View style={styles.switchText}>
          <Text style={[styles.switchLabel, { color: colors.text }]}>Change your photo</Text>
          <Text style={[styles.switchHint, { color: colors.textMuted }]}>Shown on your coach profile in Find a Coach.</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
      </Pressable>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>HANDLE</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View
          style={[
            styles.handleBox,
            { backgroundColor: colors.surfaceMuted, borderColor: handleState === "taken" || handleProblemText ? colors.danger : colors.border },
          ]}
        >
          <Text style={[styles.at, { color: colors.textMuted }]}>@</Text>
          <TextInput
            value={handle}
            onChangeText={(text) => setHandle(cleanHandle(text))}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            placeholder="yourhandle"
            placeholderTextColor={colors.textMuted}
            style={[styles.handleInput, { color: colors.text }]}
          />
          {handleState === "checking" ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
          {handleState === "free" ? <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} /> : null}
        </View>
        <Text style={[styles.charCount, { color: handleState === "taken" || handleProblemText ? colors.danger : colors.textSubtle }]}>
          {handleProblemText && handle.length > 0
            ? handleProblemText
            : handleState === "taken"
              ? "Someone already has that handle."
              : handleState === "free"
                ? "That handle is yours if you want it."
                : "How players find you. Letters, numbers, dots and underscores."}
        </Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>ABOUT YOU</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={bio}
          onChangeText={(text) => setBio(text.slice(0, BIO_LIMIT))}
          placeholder="Your teaching style, what you specialise in, who you coach..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[styles.cardInput, styles.bioInput, { color: colors.text }]}
        />
        <Text style={[styles.charCount, { color: colors.textSubtle }]}>
          {bio.length}/{BIO_LIMIT} · shown to players browsing for a coach
        </Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>WHERE YOU COACH</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={location}
          onChangeText={onEditLocation}
          placeholder="A club or town, e.g. The Cue Club, Sheffield"
          placeholderTextColor={colors.textMuted}
          style={[styles.cardInput, { color: colors.text }]}
        />
        <Pressable
          onPress={useCurrentLocation}
          disabled={locating}
          accessibilityRole="button"
          style={[styles.locateButton, { opacity: locating ? 0.6 : 1 }]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={16} color={colors.primary} />
          )}
          <Text style={[styles.locateText, { color: colors.primary }]}>Use my current location</Text>
        </Pressable>
        {coords ? (
          <Text style={[styles.coordsHint, { color: colors.textSubtle }]}>
            Set from GPS - players searching nearby can find you by distance.
          </Text>
        ) : null}
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>CREDENTIALS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>WPBSA accredited</Text>
            <Text style={[styles.switchHint, { color: colors.textMuted }]}>
              Self-declared - not checked against the WPBSA's own records.
            </Text>
          </View>
          <Switch value={wpbsa} onValueChange={setWpbsa} trackColor={{ true: colors.primary }} />
        </View>

        <View style={[styles.cardDivider, { backgroundColor: colors.border }]} />

        <Text style={[styles.cardSubLabel, { color: colors.textMuted }]}>Qualifications</Text>
        {qualifications.length ? (
          <View style={styles.tags}>
            {qualifications.map((tag) => (
              <Pressable
                key={tag}
                onPress={() => removeTag(tag)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${tag}`}
                style={[styles.tag, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>{tag}</Text>
                <MaterialCommunityIcons name="close" size={14} color={colors.textMuted} />
              </Pressable>
            ))}
          </View>
        ) : null}
        {qualifications.length < MAX_QUALIFICATIONS ? (
          <View style={styles.addTag}>
            <TextInput
              value={newTag}
              onChangeText={(text) => setNewTag(text.slice(0, QUALIFICATION_LIMIT))}
              placeholder="e.g. WPBSA Level 2"
              placeholderTextColor={colors.textMuted}
              onSubmitEditing={addTag}
              returnKeyType="done"
              style={[styles.tagInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            />
            <Pressable
              onPress={addTag}
              disabled={!newTag.trim()}
              accessibilityRole="button"
              accessibilityLabel="Add qualification"
              style={[styles.addButton, { backgroundColor: colors.primary, opacity: newTag.trim() ? 1 : 0.4 }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color={colors.onPrimary} />
            </Pressable>
          </View>
        ) : null}
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>GALLERY</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.switchHint, { color: colors.textMuted }]}>
          Work with professionals, at events, whatever helps a player decide - shown on your profile in Find a Coach.
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photoRow}>
          {photos.map((photo) => (
            <View key={photo.id} style={styles.photoTile}>
              <Image
                source={{ uri: galleryPhotoUrl(photo.path) }}
                style={styles.photo}
                contentFit="cover"
                cachePolicy="memory-disk"
                transition={0}
              />
              <Pressable
                onPress={() => removePhoto(photo)}
                disabled={deletingPhotoId === photo.id}
                accessibilityRole="button"
                accessibilityLabel="Remove this photo"
                hitSlop={6}
                style={[styles.photoRemove, { backgroundColor: colors.danger }]}
              >
                {deletingPhotoId === photo.id ? (
                  <ActivityIndicator size="small" color={colors.onDanger} />
                ) : (
                  <MaterialCommunityIcons name="close" size={14} color={colors.onDanger} />
                )}
              </Pressable>
            </View>
          ))}
          {photos.length < GALLERY_LIMIT ? (
            <Pressable
              onPress={addPhoto}
              disabled={uploadingPhoto}
              accessibilityRole="button"
              accessibilityLabel="Add a photo"
              style={[styles.addPhoto, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            >
              {uploadingPhoto ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <MaterialCommunityIcons name="camera-plus-outline" size={24} color={colors.primary} />
              )}
            </Pressable>
          ) : null}
        </ScrollView>
        <Text style={[styles.charCount, { color: colors.textSubtle }]}>
          {photos.length}/{GALLERY_LIMIT} photos
        </Text>
      </View>

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        style={[styles.save, { backgroundColor: colors.primary, opacity: !canSave ? 0.5 : 1 }]}
      >
        {saving ? (
          <ActivityIndicator color={colors.onPrimary} />
        ) : (
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>Save</Text>
        )}
      </Pressable>

      <Text style={[styles.groupLabel, { color: colors.textMuted, marginTop: SPACING.xl }]}>ACCOUNT</Text>
      <View style={[styles.accountList, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable onPress={() => navigation.navigate("Settings")} accessibilityRole="button" style={styles.accountRow}>
          <MaterialCommunityIcons name="cog-outline" size={20} color={colors.text} />
          <Text style={[styles.accountRowText, { color: colors.text }]}>Account settings</Text>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      </View>

      <Pressable
        onPress={confirmSignOut}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityState={{ busy: signingOut }}
        style={[styles.signOut, { borderColor: colors.danger, backgroundColor: colors.surface, opacity: signingOut ? 0.6 : 1 }]}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.danger} />
        ) : (
          <>
            <MaterialCommunityIcons name="logout" size={20} color={colors.danger} />
            <Text style={[styles.signOutText, { color: colors.danger }]}>Sign out</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.xs },
  groupLabel: {
    fontFamily: FONTS.boardLabel,
    fontSize: 13,
    letterSpacing: 1.6,
    marginTop: SPACING.lg,
    marginBottom: -4,
    marginLeft: 2,
  },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.xs },
  cardInput: { fontSize: 15, minHeight: HIT_TARGET - 8 },
  cardSubLabel: { fontSize: 13, fontFamily: FONTS.boardLabel, letterSpacing: 0.5, textTransform: "uppercase" },
  cardDivider: { height: StyleSheet.hairlineWidth, marginVertical: SPACING.sm },
  bioInput: { minHeight: 90, paddingVertical: SPACING.xs, lineHeight: 20 },
  charCount: { fontSize: 12, marginTop: 4 },
  locateButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, alignSelf: "flex-start", minHeight: HIT_TARGET - 12 },
  locateText: { fontSize: 14, fontWeight: "700" },
  coordsHint: { fontSize: 12, marginTop: -SPACING.xs },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontWeight: "700" },
  switchHint: { fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
  },
  addTag: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  photoCard: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  avatarPreview: { width: 56, height: 56, borderRadius: 28 },
  handleBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: HIT_TARGET,
    borderWidth: 1.5,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  at: { fontSize: 18, fontWeight: "800" },
  handleInput: { flex: 1, fontSize: 16, fontWeight: "700", paddingVertical: SPACING.sm },
  photoRow: { gap: SPACING.sm, paddingTop: SPACING.xs },
  photoTile: { width: PHOTO_SIZE, height: PHOTO_SIZE },
  photo: { width: PHOTO_SIZE, height: PHOTO_SIZE, borderRadius: RADIUS.md },
  photoRemove: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  addPhoto: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  tagInput: { flex: 1, minHeight: HIT_TARGET, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 15 },
  addButton: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  save: {
    marginTop: SPACING.xl,
    minHeight: HIT_TARGET + 6,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: { fontSize: 16, fontWeight: "800" },
  switchModeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1,
    borderRadius: RADIUS.md,
  },
  switchModeText: { fontSize: 15, fontWeight: "700" },
  accountList: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: "hidden" },
  accountRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, minHeight: HIT_TARGET + 12, paddingHorizontal: SPACING.md },
  accountRowText: { flex: 1, fontSize: 15, fontWeight: "600" },
  signOut: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 6,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    marginTop: SPACING.md,
  },
  signOutText: { fontSize: 16, fontWeight: "800" },
});
