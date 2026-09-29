import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useAuthStore } from "../../store";
import { fetchMyCoachApplication, submitCoachApplication } from "../../features/coach/applications";
import type { CoachApplication } from "../../features/coach/types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const LOCATION_LIMIT = 120;
const QUALIFICATION_LIMIT = 40;
const MAX_QUALIFICATIONS = 6;
const BIO_LIMIT = 160;
const EXPERIENCE_LIMIT = 1000;
const SOCIAL_LIMIT = 500;

/** A player asking to become a coach - reviewed by hand, not granted on the spot. See
 * 20261016_0001_coach_applications.sql for why is_coach can no longer be self-served. */
export const ApplyToCoachScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { user } = useAuthStore();

  const [checking, setChecking] = useState(true);
  const [existing, setExisting] = useState<CoachApplication | null>(null);

  const [fullName, setFullName] = useState(user?.full_name ?? "");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [experience, setExperience] = useState("");
  const [socialLinks, setSocialLinks] = useState("");
  const [wpbsa, setWpbsa] = useState(false);
  const [wpbsaNumber, setWpbsaNumber] = useState("");
  const [qualifications, setQualifications] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id || !user.email) return;
      let cancelled = false;
      setChecking(true);
      void fetchMyCoachApplication(user.id, user.email).then((application) => {
        if (!cancelled) {
          setExisting(application);
          setChecking(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }, [user?.id])
  );

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

  const canSubmit = fullName.trim().length >= 2 && experience.trim().length >= 20 && !submitting;

  const submit = async () => {
    if (!canSubmit || !user?.email) return;
    setSubmitting(true);
    const result = await submitCoachApplication(
      {
        email: user.email,
        fullName: fullName.trim(),
        bio: bio.trim() || undefined,
        location: location.trim() || undefined,
        lat: coords?.lat,
        lng: coords?.lng,
        experience: experience.trim(),
        qualifications,
        wpbsaAccredited: wpbsa,
        wpbsaNumber: wpbsaNumber.trim() || undefined,
        socialLinks: socialLinks.trim() || undefined,
      },
      user.id
    );
    setSubmitting(false);
    if (!result.ok) {
      dialog.alert({ title: "Could not send that", message: result.message, tone: "danger" });
      return;
    }
    setExisting({
      id: "pending",
      status: "pending",
      fullName: fullName.trim(),
      email: user.email,
      bio: bio.trim() || null,
      location: location.trim() || null,
      experience: experience.trim(),
      qualifications,
      wpbsaAccredited: wpbsa,
      wpbsaNumber: wpbsaNumber.trim() || null,
      socialLinks: socialLinks.trim() || null,
      reviewerNote: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null,
    });
  };

  if (checking) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (existing?.status === "pending") {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="clock-outline" size={40} color={colors.primary} />
        <Text style={[styles.statusTitle, { color: colors.text }]}>Application under review</Text>
        <Text style={[styles.statusBody, { color: colors.textMuted }]}>
          We check every coach by hand before they can list themselves or take bookings. We will let you know at{" "}
          {existing.email} once yours has been looked at.
        </Text>
      </View>
    );
  }

  if (existing?.status === "rejected") {
    return (
      <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.centered}>
        <MaterialCommunityIcons name="close-circle-outline" size={40} color={colors.danger} />
        <Text style={[styles.statusTitle, { color: colors.text }]}>Not approved this time</Text>
        <Text style={[styles.statusBody, { color: colors.textMuted }]}>
          {existing.reviewerNote || "We could not verify enough to approve this application."}
        </Text>
        <Pressable
          onPress={() => setExisting(null)}
          accessibilityRole="button"
          style={[styles.save, { backgroundColor: colors.primary, marginTop: SPACING.lg, alignSelf: "stretch" }]}
        >
          <Text style={[styles.saveText, { color: colors.onPrimary }]}>Apply again</Text>
        </Pressable>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Text style={[styles.intro, { color: colors.textMuted }]}>
        Coaches are reviewed by hand before they can take bookings - a real person checks what you send here. It is free to
        apply; an approved coach pays a small subscription to list themselves and take bookings.
      </Text>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>YOUR NAME</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Full name"
          placeholderTextColor={colors.textMuted}
          style={[styles.cardInput, { color: colors.text }]}
        />
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
          {bio.length}/{BIO_LIMIT} · shown to players, once approved
        </Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>YOUR COACHING EXPERIENCE</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={experience}
          onChangeText={(text) => setExperience(text.slice(0, EXPERIENCE_LIMIT))}
          placeholder="How long you've coached, who you've coached, where you've worked..."
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          style={[styles.cardInput, styles.experienceInput, { color: colors.text }]}
        />
        <Text style={[styles.charCount, { color: colors.textSubtle }]}>
          {experience.length}/{EXPERIENCE_LIMIT} · this is what we check you against
        </Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>SOCIAL MEDIA OR LINKS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={socialLinks}
          onChangeText={(text) => setSocialLinks(text.slice(0, SOCIAL_LIMIT))}
          placeholder="Instagram, a club page, a coaching website - one per line"
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          autoCapitalize="none"
          style={[styles.cardInput, styles.bioInput, { color: colors.text }]}
        />
        <Text style={[styles.charCount, { color: colors.textSubtle }]}>Never shown to players - for us to verify you by.</Text>
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>WHERE YOU COACH</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={location}
          onChangeText={(text) => {
            setLocation(text.slice(0, LOCATION_LIMIT));
            setCoords(null);
          }}
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
      </View>

      <Text style={[styles.groupLabel, { color: colors.textMuted }]}>CREDENTIALS</Text>
      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.switchRow}>
          <View style={styles.switchText}>
            <Text style={[styles.switchLabel, { color: colors.text }]}>WPBSA accredited</Text>
            <Text style={[styles.switchHint, { color: colors.textMuted }]}>We ask for your number below to check it.</Text>
          </View>
          <Switch value={wpbsa} onValueChange={setWpbsa} trackColor={{ true: colors.primary }} />
        </View>
        {wpbsa ? (
          <TextInput
            value={wpbsaNumber}
            onChangeText={(text) => setWpbsaNumber(text.slice(0, 40))}
            placeholder="WPBSA number"
            placeholderTextColor={colors.textMuted}
            style={[styles.cardInput, { color: colors.text, marginTop: SPACING.sm }]}
          />
        ) : null}

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

      <Pressable onPress={submit} disabled={!canSubmit} accessibilityRole="button" style={[styles.save, { backgroundColor: colors.primary, opacity: !canSubmit ? 0.5 : 1 }]}>
        {submitting ? <ActivityIndicator color={colors.onPrimary} /> : <Text style={[styles.saveText, { color: colors.onPrimary }]}>Send application</Text>}
      </Pressable>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  content: { padding: SPACING.lg, gap: SPACING.xs },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  intro: { fontSize: 13, lineHeight: 19, marginBottom: SPACING.sm },
  statusTitle: { fontSize: 19, fontWeight: "800", marginTop: SPACING.sm, textAlign: "center" },
  statusBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
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
  experienceInput: { minHeight: 130, paddingVertical: SPACING.xs, lineHeight: 20 },
  charCount: { fontSize: 12, marginTop: 4 },
  locateButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: SPACING.sm, alignSelf: "flex-start", minHeight: HIT_TARGET - 12 },
  locateText: { fontSize: 14, fontWeight: "700" },
  switchRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontSize: 15, fontWeight: "700" },
  switchHint: { fontSize: 13, lineHeight: 18 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm, marginTop: SPACING.xs },
  tag: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm },
  addTag: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.sm },
  tagInput: { flex: 1, minHeight: HIT_TARGET, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: SPACING.md, fontSize: 15 },
  addButton: { width: HIT_TARGET, height: HIT_TARGET, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  save: { marginTop: SPACING.xl, minHeight: HIT_TARGET + 6, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  saveText: { fontSize: 16, fontWeight: "800" },
});
