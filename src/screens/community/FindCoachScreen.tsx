import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Linking, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useDialog } from "../../components/ui/DialogProvider";
import { useCoachStore } from "../../store/coachStore";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { nameOf, type PublicProfile } from "../../features/community/types";
import { distanceKm } from "../../features/coach/types";
import type { CommunityStackParamList } from "../../types";
import { FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

const WPBSA_FINDER_URL = "https://www.wpbsa.com/participation/find-your-coach/";

/** Coaches who have an account on Snookered, searchable by name or where they coach. */
export const FindCoachScreen = () => {
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const dialog = useDialog();
  const { searchCoaches } = useCoachStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    void searchCoaches("").then((data) => {
      setResults(data);
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onChangeQuery = (text: string) => {
    setQuery(text);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    setLoading(true);
    searchTimer.current = setTimeout(async () => {
      setResults(await searchCoaches(text));
      setLoading(false);
    }, 300);
  };

  const sortByDistance = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        dialog.alert({
          title: "Location not available",
          message: "Turn on location for Snookered in Settings to sort by distance.",
          icon: "map-marker-off-outline",
        });
        return;
      }
      const position = await Location.getCurrentPositionAsync({});
      setMyLocation({ lat: position.coords.latitude, lng: position.coords.longitude });
    } catch {
      dialog.alert({ title: "Could not get your location", message: "Check your connection and try again." });
    } finally {
      setLocating(false);
    }
  };

  const sorted = useMemo(() => {
    if (!myLocation) return results;
    const withDistance = results.map((coach) => ({
      coach,
      km: coach.coachLat != null && coach.coachLng != null ? distanceKm(myLocation, { lat: coach.coachLat, lng: coach.coachLng }) : null,
    }));
    withDistance.sort((a, b) => {
      if (a.km == null && b.km == null) return 0;
      if (a.km == null) return 1;
      if (b.km == null) return -1;
      return a.km - b.km;
    });
    return withDistance.map((item) => item.coach);
  }, [results, myLocation]);

  const distanceTo = (coach: PublicProfile) =>
    myLocation && coach.coachLat != null && coach.coachLng != null
      ? `${Math.round(distanceKm(myLocation, { lat: coach.coachLat, lng: coach.coachLng }))} km away`
      : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search by name or location"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <Pressable
          onPress={sortByDistance}
          disabled={locating}
          accessibilityRole="button"
          accessibilityLabel="Sort by distance from me"
          style={[
            styles.nearMe,
            { borderColor: myLocation ? colors.primary : colors.border, backgroundColor: myLocation ? colors.primary : colors.surface },
          ]}
        >
          {locating ? (
            <ActivityIndicator size="small" color={myLocation ? colors.onPrimary : colors.primary} />
          ) : (
            <MaterialCommunityIcons name="crosshairs-gps" size={18} color={myLocation ? colors.onPrimary : colors.primary} />
          )}
        </Pressable>
      </View>

      <FlatList
        data={sorted}
        keyExtractor={(profile) => profile.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + SPACING.xl }]}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator style={styles.loading} color={colors.primary} />
          ) : (
            <View style={styles.empty}>
              <MaterialCommunityIcons name="account-search-outline" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                {query ? "No coaches match that search." : "No coaches have joined Snookered yet."}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => navigation.navigate("CoachProfile", { userId: item.id })}
            accessibilityRole="button"
            style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            <CommunityAvatar profile={item} size={48} />
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: colors.text }]}>{nameOf(item)}</Text>
              {item.coachLocation ? (
                <Text style={[styles.rowLocation, { color: colors.textMuted }]} numberOfLines={1}>
                  <MaterialCommunityIcons name="map-marker-outline" size={13} color={colors.textMuted} /> {item.coachLocation}
                  {distanceTo(item) ? ` · ${distanceTo(item)}` : ""}
                </Text>
              ) : null}
              {item.wpbsaAccredited || item.coachQualifications.length ? (
                <View style={styles.tags}>
                  {item.wpbsaAccredited ? (
                    <View style={[styles.tag, { backgroundColor: colors.primary }]}>
                      <Text style={[styles.tagText, { color: colors.onPrimary }]}>WPBSA</Text>
                    </View>
                  ) : null}
                  {item.coachQualifications.slice(0, 2).map((tag) => (
                    <View key={tag} style={[styles.tag, { backgroundColor: colors.surfaceMuted }]}>
                      <Text style={[styles.tagText, { color: colors.text }]}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              {item.bio ? (
                <Text style={[styles.rowBio, { color: colors.textMuted }]} numberOfLines={2}>
                  {item.bio}
                </Text>
              ) : null}
            </View>
            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
          </Pressable>
        )}
        ListFooterComponent={
          <Pressable
            onPress={() => Linking.openURL(WPBSA_FINDER_URL)}
            accessibilityRole="link"
            style={styles.footer}
          >
            <Text style={[styles.footerText, { color: colors.textMuted }]}>
              Can't find your coach? Search the{" "}
              <Text style={{ color: colors.primary, fontWeight: "700" }}>official WPBSA Coach Finder ↗</Text>
            </Text>
          </Pressable>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  searchWrap: { flexDirection: "row", gap: SPACING.sm, paddingHorizontal: SPACING.lg, paddingTop: SPACING.md, paddingBottom: SPACING.sm },
  search: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  nearMe: { width: HIT_TARGET, height: HIT_TARGET, borderWidth: 1, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  searchInput: { flex: 1, fontSize: 15 },
  list: { padding: SPACING.lg, paddingTop: 0, gap: SPACING.sm, flexGrow: 1 },
  loading: { marginTop: SPACING.xl * 2 },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.sm, paddingTop: SPACING.xl * 2 },
  emptyText: { fontSize: 15, textAlign: "center", maxWidth: 260 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rowText: { flex: 1, gap: 4 },
  rowName: { fontSize: 16, fontWeight: "700" },
  rowLocation: { fontSize: 13 },
  rowBio: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 },
  tag: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 3 },
  tagText: { fontSize: 11, fontFamily: FONTS.boardLabel, letterSpacing: 0.4 },
  footer: { paddingTop: SPACING.lg, paddingHorizontal: SPACING.sm },
  footerText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
});
