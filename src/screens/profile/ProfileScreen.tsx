import React, { useMemo, useState } from "react";
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { SNOOKER_PRESET_AVATARS } from "../../constants/profileAvatars";
import { SnookerPresetAvatar } from "../../components/profile/SnookerPresetAvatar";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";

export const ProfileScreen = () => {
  const navigation = useNavigation<any>();
  const { user, signOut, isLoading, updateAvatarPreset, uploadProfilePhoto } = useAuthStore();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { width } = useWindowDimensions();
  const [activeGalleryPage, setActiveGalleryPage] = useState(0);
  const playerPresets = SNOOKER_PRESET_AVATARS.filter((preset) => preset.group === "player");
  const snookerPresets = SNOOKER_PRESET_AVATARS.filter((preset) => preset.group !== "player");
  const galleryPages = useMemo(() => {
    const pages: typeof snookerPresets[] = [];

    for (let index = 0; index < snookerPresets.length; index += 9) {
      pages.push(snookerPresets.slice(index, index + 9));
    }

    return pages;
  }, [snookerPresets]);

  const galleryPageWidth = Math.max(270, width - 60);

  const handleSignOut = async () => {
    await signOut();
  };

  const handlePresetSelect = async (presetId: string) => {
    try {
      await updateAvatarPreset(presetId);
    } catch (error: any) {
      Alert.alert("Avatar update failed", error?.message ?? "Could not save your preset avatar.");
    }
  };

  const handleUploadPhoto = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert("Permission required", "Please grant photo library access to upload an avatar.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]?.uri) return;

      await uploadProfilePhoto(result.assets[0].uri);
      Alert.alert("Avatar updated", "Your profile photo is now synced to your account.");
    } catch (error: any) {
      Alert.alert("Upload failed", error?.message ?? "Could not upload your photo.");
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={styles.content}>
      <AppCard style={styles.profileHeader}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          {user?.profile_image_url ? (
            <Image source={{ uri: user.profile_image_url }} style={styles.avatarImage} resizeMode="cover" />
          ) : (
            <SnookerPresetAvatar presetId={user?.avatar_preset} size={100} />
          )}
        </View>
        <Text style={[styles.username, { color: colors.text }]}>{user?.username || user?.email || "Player"}</Text>
        <Text style={[styles.email, { color: colors.textMuted }]}>{user?.email}</Text>
        <View style={[styles.tierPill, { borderColor: colors.primary, backgroundColor: colors.surfaceMuted }]}>
          <Text style={[styles.tierText, { color: colors.primary }]}>{subscription.tierLabel} Plan</Text>
        </View>
        <View style={styles.avatarActions}>
          <View style={styles.actionButtonWrap}>
            <AppButton label="Upload Photo" variant="secondary" loading={isLoading} onPress={handleUploadPhoto} />
          </View>
          <View style={styles.actionButtonWrap}>
            <AppButton label="Open Settings" variant="secondary" onPress={() => navigation.navigate("Settings")} />
          </View>
        </View>
      </AppCard>

      <AppCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Plan Usage (Current Billing Cycle)</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>Matches Created</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{subscription.usage.matches} / {subscription.limits.matchesPerPeriod ?? "∞"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>Tournaments Created</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{subscription.usage.tournaments} / {subscription.limits.tournamentsPerPeriod ?? "∞"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>AI Analyses</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{subscription.usage.aiAnalyses} / {subscription.limits.aiAnalysesPerPeriod ?? "∞"}</Text>
        </View>
      </AppCard>

      <AppCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Snooker Avatar Presets</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Choose a snooker-themed avatar. This syncs with your account profile.</Text>
        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Player Avatars</Text>
        <View style={styles.playerRow}>
          {playerPresets.map((preset) => {
            const selected = user?.avatar_preset === preset.id;

            return (
              <Pressable
                key={preset.id}
                onPress={() => handlePresetSelect(preset.id)}
                style={[
                  styles.playerCard,
                  {
                    borderColor: selected ? colors.primary : colors.border,
                    backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                  },
                ]}
              >
                <SnookerPresetAvatar presetId={preset.id} size={52} />
                <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.subSectionTitle, { color: colors.text }]}>Snooker Icons Gallery</Text>
        <Text style={[styles.galleryHint, { color: colors.textMuted }]}>3x3 grid - swipe right for more options.</Text>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          style={styles.galleryScroll}
          contentContainerStyle={styles.galleryContent}
          onMomentumScrollEnd={(event) => {
            const page = Math.round(event.nativeEvent.contentOffset.x / galleryPageWidth);
            setActiveGalleryPage(page);
          }}
        >
          {galleryPages.map((page, pageIndex) => (
            <View key={`gallery-page-${pageIndex}`} style={[styles.galleryPage, { width: galleryPageWidth }]}> 
              <View style={styles.galleryGrid}>
                {page.map((preset) => {
                  const selected = user?.avatar_preset === preset.id;

                  return (
                    <Pressable
                      key={preset.id}
                      onPress={() => handlePresetSelect(preset.id)}
                      style={[
                        styles.presetCard,
                        {
                          borderColor: selected ? colors.primary : colors.border,
                          backgroundColor: selected ? colors.surfaceMuted : colors.surface,
                        },
                      ]}
                    >
                      <SnookerPresetAvatar presetId={preset.id} size={44} />
                      <Text style={[styles.presetLabel, { color: colors.text }]}>{preset.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
        {galleryPages.length > 1 ? (
          <View style={styles.pageDotsRow}>
            {galleryPages.map((_, index) => {
              const active = index === activeGalleryPage;

              return (
                <View
                  key={`gallery-dot-${index}`}
                  style={[
                    styles.pageDot,
                    {
                      backgroundColor: active ? colors.primary : colors.border,
                      width: active ? 20 : 8,
                    },
                  ]}
                />
              );
            })}
          </View>
        ) : null}
      </AppCard>

      <AppCard style={styles.sectionCard}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Global Compete Profile</Text>
        <Text style={[styles.sectionHint, { color: colors.textMuted }]}>Preparing your profile for upcoming worldwide leaderboards and challenges.</Text>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>Skill Level</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{user?.skill_level ?? "Not set"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>Country</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{user?.country_code ?? "Not set"}</Text>
        </View>
        <View style={styles.metaRow}>
          <Text style={[styles.metaKey, { color: colors.textMuted }]}>Cue Preference</Text>
          <Text style={[styles.metaValue, { color: colors.text }]}>{user?.cue_preference ?? "Not set"}</Text>
        </View>
      </AppCard>

      <View style={styles.menuContainer}>
        <AppButton label="Sign Out" onPress={handleSignOut} variant="danger" />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  profileHeader: { alignItems: "center", marginBottom: 12, marginTop: 4 },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
  },
  avatarImage: { width: "100%", height: "100%" },
  username: { fontSize: 24, fontWeight: "700", marginBottom: 4 },
  email: { fontSize: 15 },
  tierPill: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  tierText: { fontSize: 12, fontWeight: "800" },
  avatarActions: { marginTop: 14, flexDirection: "row", gap: 8 },
  actionButtonWrap: { flex: 1 },
  sectionCard: { marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  sectionHint: { marginTop: 6, fontSize: 13, lineHeight: 18 },
  subSectionTitle: { marginTop: 10, marginBottom: 8, fontSize: 13, fontWeight: "700" },
  playerRow: { flexDirection: "row", gap: 8 },
  playerCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  galleryHint: { marginTop: -2, marginBottom: 10, fontSize: 12 },
  galleryScroll: { marginHorizontal: -2 },
  galleryContent: { paddingRight: 8 },
  galleryPage: { paddingRight: 10 },
  galleryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pageDotsRow: {
    marginTop: 10,
    flexDirection: "row",
    alignSelf: "center",
    alignItems: "center",
    gap: 6,
  },
  pageDot: {
    height: 8,
    borderRadius: 5,
  },
  presetCard: {
    width: "31%",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
  },
  presetLabel: { marginTop: 4, fontSize: 11, fontWeight: "700", textAlign: "center" },
  metaRow: { marginTop: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  metaKey: { fontSize: 13 },
  metaValue: { fontSize: 13, fontWeight: "700" },
  menuContainer: { marginTop: 14 },
});
