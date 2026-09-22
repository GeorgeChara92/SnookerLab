import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { useCommunityStore } from "../../store/communityStore";
import { splitBadges, useChatBadges } from "../../store/chatStore";
import { useTourNewsStore } from "../../store/tourNewsStore";
import { NewsRow } from "../../components/tour/NewsRow";
import { LiveNow } from "../../components/matches/LiveNow";
import { CommunityAvatar } from "../../components/community/CommunityAvatar";
import { useDialog } from "../../components/ui/DialogProvider";
import { nameOf, relationTo, type PublicProfile, type Relation } from "../../features/community/types";
import type { CommunityStackParamList } from "../../types";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Segment = "friends" | "requests" | "find";

/**
 * The community: the player's friends, the requests waiting on them, and finding people to add.
 * Before any of it, the player picks an @handle, so others can find them.
 */
export const CommunityHomeScreen = () => {
  const navigation = useNavigation<NavigationProp<CommunityStackParamList>>();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const { me, loaded, friendships, profiles, blocked, hydrate, search, sendRequest, accept, removeFriendship } =
    useCommunityStore();
  const [segment, setSegment] = useState<Segment>("friends");
  const badges = splitBadges(useChatBadges());
  const tourNews = useTourNewsStore((state) => state.items);
  const refreshNews = useTourNewsStore((state) => state.refresh);
  useEffect(() => {
    void refreshNews();
  }, [refreshNews]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PublicProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const otherOf = (requester: string, addressee: string) => (requester === userId ? addressee : requester);
  const friends = useMemo(
    () =>
      friendships
        .filter((item) => item.status === "accepted")
        .map((item) => ({ friendship: item, profile: profiles[otherOf(item.requester, item.addressee)] }))
        .filter((row) => row.profile)
        .sort((a, b) => nameOf(a.profile).localeCompare(nameOf(b.profile))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [friendships, profiles, userId]
  );
  const incoming = friendships.filter((item) => item.status === "pending" && item.addressee === userId);
  const outgoing = friendships.filter((item) => item.status === "pending" && item.requester === userId);

  // Searching as the player types, a moment after they stop.
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (query.trim().length < 2) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      setResults(await search(query));
      setSearching(false);
    }, 300);
  }, [query, search]);

  const act = async (key: string, run: () => Promise<{ ok: boolean; message?: string }>) => {
    setBusy(key);
    const result = await run();
    setBusy(null);
    if (!result.ok) {
      dialog.alert({
        title: "That did not work",
        message: result.message ?? "Try again.",
        tone: "danger",
        icon: "alert-circle-outline",
      });
    }
  };

  if (!loaded && !me) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <MaterialCommunityIcons name="account-group-outline" size={40} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Connecting to the community</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          If this does not load, check your connection.
        </Text>
        <Pressable
          onPress={async () => {
            if (!userId) return;
            setRetrying(true);
            await hydrate(userId);
            setRetrying(false);
          }}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          {retrying ? <ActivityIndicator color={colors.onPrimary} /> : null}
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  if (!me?.handle) {
    return (
      <View style={[styles.centre, { backgroundColor: colors.background }]}>
        <View style={[styles.joinIcon, { backgroundColor: colors.board, borderColor: colors.boardRule }]}>
          <MaterialCommunityIcons name="account-group" size={40} color={colors.boardRule} />
        </View>
        <Text style={[styles.joinTitle, { color: colors.text }]}>Join the community</Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          Add the people you play, see how they are getting on, and soon share routines, join groups and chat. Pick a
          handle so they can find you. You choose who sees your stats and who can message you.
        </Text>
        <Pressable
          onPress={() => navigation.navigate("CommunitySettings", { setup: true })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="at" size={20} color={colors.onPrimary} />
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Create your profile</Text>
        </Pressable>
      </View>
    );
  }

  const Action = ({ profile, relation }: { profile: PublicProfile; relation: Relation }) => {
    const link = friendships.find(
      (item) =>
        (item.requester === userId && item.addressee === profile.id) ||
        (item.addressee === userId && item.requester === profile.id)
    );
    const key = `${profile.id}`;
    if (busy === key) return <ActivityIndicator color={colors.primary} />;
    if (relation === "none") {
      return (
        <Pressable
          onPress={() => act(key, () => sendRequest(profile.id))}
          accessibilityRole="button"
          accessibilityLabel={`Add ${nameOf(profile)}`}
          style={({ pressed }) => [styles.small, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="account-plus-outline" size={16} color={colors.onPrimary} />
          <Text style={[styles.smallText, { color: colors.onPrimary }]}>Add</Text>
        </Pressable>
      );
    }
    if (relation === "incoming" && link) {
      return (
        <Pressable
          onPress={() => act(key, () => accept(link.id))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.small, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <Text style={[styles.smallText, { color: colors.onPrimary }]}>Accept</Text>
        </Pressable>
      );
    }
    return (
      <View style={[styles.small, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialCommunityIcons
          name={relation === "friends" ? "account-check-outline" : "clock-outline"}
          size={16}
          color={colors.textMuted}
        />
        <Text style={[styles.smallText, { color: colors.textMuted }]}>
          {relation === "friends" ? "Friends" : "Requested"}
        </Text>
      </View>
    );
  };

  const Row = ({ profile, right }: { profile: PublicProfile; right?: React.ReactNode }) => (
    <Pressable
      onPress={() => navigation.navigate("PlayerProfile", { userId: profile.id })}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
      ]}
    >
      <CommunityAvatar profile={profile} size={44} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {nameOf(profile)}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {profile.handle ? `@${profile.handle} · ` : ""}Level {profile.level}
        </Text>
      </View>
      {right}
    </Pressable>
  );

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => navigation.navigate("PlayerProfile", { userId: me.id })}
        accessibilityRole="button"
        accessibilityLabel="Your community profile"
        style={[styles.meCard, { backgroundColor: colors.board, borderColor: colors.boardRule }]}
      >
        <CommunityAvatar profile={me} size={52} />
        <View style={styles.rowText}>
          <Text style={[styles.meName, { color: colors.boardText }]} numberOfLines={1}>
            {nameOf(me)}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.meHandle, { color: colors.boardRule }]}>
            @{me.handle}
          </Text>
        </View>
        <View style={styles.meCount}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.meCountValue, { color: colors.boardText }]}>
            {friends.length}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.meCountLabel, { color: colors.boardMuted }]}>
            {friends.length === 1 ? "FRIEND" : "FRIENDS"}
          </Text>
        </View>
        <Pressable
          onPress={() => navigation.navigate("CommunitySettings", {})}
          accessibilityRole="button"
          accessibilityLabel="Community settings and privacy"
          hitSlop={8}
          style={styles.gear}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color={colors.boardMuted} />
        </Pressable>
      </Pressable>

      <View style={styles.tiles}>
        {(
          [
            {
              route: "Chats",
              icon: "chat-outline",
              title: "Chats",
              hint: badges.requests
                ? `${badges.requests} new ${badges.requests === 1 ? "request" : "requests"}`
                : "Friends and groups",
              badge: badges.unread + badges.requests,
            },
            {
              route: "Groups",
              icon: "account-multiple-outline",
              title: "Groups",
              hint: "Clubs, leagues, teams",
              badge: 0,
            },
            {
              route: "RoutineLibrary",
              icon: "table-furniture",
              title: "Routines",
              hint: "Top, new, friends'",
              badge: 0,
            },
            { route: "Leaderboards", icon: "podium", title: "Leaderboards", hint: "Level, breaks, routines", badge: 0 },
          ] as const
        ).map((tile) => (
          <Pressable
            key={tile.route}
            onPress={() => navigation.navigate(tile.route)}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
            ]}
          >
            <View style={[styles.tileIcon, { backgroundColor: colors.board }]}>
              <MaterialCommunityIcons name={tile.icon} size={22} color={colors.boardRule} />
              {tile.badge ? (
                <View style={[styles.tileBadge, { backgroundColor: colors.danger, borderColor: colors.surface }]}>
                  <Text style={styles.tileBadgeText}>{tile.badge > 99 ? "99+" : tile.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.tileTitle, { color: colors.text }]}>{tile.title}</Text>
            <Text style={[styles.tileHint, { color: colors.textMuted }]} numberOfLines={1}>
              {tile.hint}
            </Text>
          </Pressable>
        ))}
      </View>

      <LiveNow onOpen={(matchId) => navigation.navigate("LiveMatch", { matchId })} />

      <View style={[styles.tour, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          onPress={() => navigation.navigate("TourNews")}
          accessibilityRole="button"
          accessibilityLabel="Pro tour news. See all"
          style={styles.tourHead}
        >
          <MaterialCommunityIcons name="trophy-variant-outline" size={18} color={colors.boardRule} />
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.tourKicker, { color: colors.text }]}>
            FROM THE PRO TOUR
          </Text>
          <Text style={[styles.tourMore, { color: colors.primary }]}>See all</Text>
        </Pressable>
        {tourNews[0] ? (
          <NewsRow item={tourNews[0]} summary={false} />
        ) : (
          <Text style={[styles.tourEmpty, { color: colors.textMuted }]}>The latest from WST and BBC Sport.</Text>
        )}
      </View>

      <View style={[styles.segments, { backgroundColor: colors.surfaceMuted }]} accessibilityRole="tablist">
        {(
          [
            { value: "friends", label: "Friends" },
            { value: "requests", label: "Requests", badge: incoming.length },
            { value: "find", label: "Find players" },
          ] as Array<{ value: Segment; label: string; badge?: number }>
        ).map((item) => {
          const selected = segment === item.value;
          return (
            <Pressable
              key={item.value}
              onPress={() => setSegment(item.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={[styles.segment, selected ? { backgroundColor: colors.surface } : null]}
            >
              <Text
                style={[styles.segmentText, { color: selected ? colors.text : colors.textMuted }]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
              {item.badge ? (
                <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                  <Text style={styles.badgeText}>{item.badge}</Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {segment === "find" ? (
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by name or @handle"
            placeholderTextColor={colors.textMuted}
            style={[styles.searchInput, { color: colors.text }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searching ? <ActivityIndicator size="small" color={colors.textMuted} /> : null}
        </View>
      ) : null}
    </View>
  );

  const empty = (
    icon: keyof typeof MaterialCommunityIcons.glyphMap,
    title: string,
    body: string,
    cta?: React.ReactNode
  ) => (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <MaterialCommunityIcons name={icon} size={30} color={colors.textMuted} />
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.textMuted }]}>{body}</Text>
      {cta}
    </View>
  );

  if (segment === "requests") {
    const received = incoming.map((item) => ({ item, profile: profiles[item.requester] })).filter((row) => row.profile);
    const sent = outgoing.map((item) => ({ item, profile: profiles[item.addressee] })).filter((row) => row.profile);
    return (
      <FlatList
        key="requests"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        data={[
          ...(received.length ? [{ kind: "title" as const, id: "t-received", label: "Asked to be your friend" }] : []),
          ...received.map((row) => ({ kind: "received" as const, id: row.item.id, ...row })),
          ...(sent.length ? [{ kind: "title" as const, id: "t-sent", label: "Waiting for them" }] : []),
          ...sent.map((row) => ({ kind: "sent" as const, id: row.item.id, ...row })),
        ]}
        keyExtractor={(row) => row.id}
        ListHeaderComponent={header}
        ListEmptyComponent={empty(
          "account-clock-outline",
          "No requests",
          "Friend requests you send and receive show here."
        )}
        renderItem={({ item: row }) =>
          row.kind === "title" ? (
            <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{row.label.toUpperCase()}</Text>
          ) : row.kind === "received" ? (
            <Row
              profile={row.profile!}
              right={
                busy === row.id ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <View style={styles.pair}>
                    <Pressable
                      onPress={() => act(row.id, () => removeFriendship(row.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`Decline ${nameOf(row.profile)}`}
                      style={({ pressed }) => [
                        styles.iconButton,
                        { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                      ]}
                    >
                      <MaterialCommunityIcons name="close" size={18} color={colors.text} />
                    </Pressable>
                    <Pressable
                      onPress={() => act(row.id, () => accept(row.id))}
                      accessibilityRole="button"
                      accessibilityLabel={`Accept ${nameOf(row.profile)}`}
                      style={({ pressed }) => [
                        styles.iconButton,
                        { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <MaterialCommunityIcons name="check" size={18} color={colors.onPrimary} />
                    </Pressable>
                  </View>
                )
              }
            />
          ) : (
            <Row
              profile={row.profile!}
              right={
                <Pressable
                  onPress={() => act(row.id, () => removeFriendship(row.id))}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.small,
                    { backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.7 : 1 },
                  ]}
                >
                  <Text style={[styles.smallText, { color: colors.text }]}>Cancel</Text>
                </Pressable>
              }
            />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
    );
  }

  if (segment === "find") {
    return (
      <FlatList
        key="find"
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        data={results}
        keyExtractor={(profile) => profile.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          query.trim().length < 2
            ? empty("account-search-outline", "Find the people you play", "Search by their name or @handle.")
            : searching
              ? null
              : empty(
                  "account-question-outline",
                  "Nobody found",
                  `No players match “${query.trim()}”. Check the spelling, or ask for their @handle.`
                )
        }
        renderItem={({ item }) => (
          <Row
            profile={item}
            right={<Action profile={item} relation={relationTo(userId, item.id, friendships, blocked)} />}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
      />
    );
  }

  return (
    <FlatList
      key="friends"
      style={{ backgroundColor: colors.background }}
      contentContainerStyle={styles.content}
      data={friends}
      keyExtractor={(row) => row.friendship.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty(
        "account-multiple-plus-outline",
        "No friends yet",
        "Add the people you play with to follow how they are getting on.",
        <Pressable
          onPress={() => setSegment("find")}
          accessibilityRole="button"
          style={({ pressed }) => [styles.primary, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
        >
          <MaterialCommunityIcons name="account-search-outline" size={20} color={colors.onPrimary} />
          <Text style={[styles.primaryText, { color: colors.onPrimary }]}>Find players</Text>
        </Pressable>
      )}
      renderItem={({ item }) => (
        <Row
          profile={item.profile!}
          right={<MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: SPACING.sm }} />}
    />
  );
};

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: "center", justifyContent: "center", gap: SPACING.md, padding: SPACING.xl },
  content: { padding: SPACING.lg, paddingBottom: SPACING.xxl, flexGrow: 1 },
  header: { gap: SPACING.md, marginBottom: SPACING.md },
  joinIcon: { width: 84, height: 84, borderRadius: 42, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  joinTitle: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  meCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  meName: { fontSize: 18, fontWeight: "800" },
  meHandle: { fontFamily: FONTS.boardLabel, fontSize: 15, letterSpacing: 0.5 },
  meCount: { alignItems: "center" },
  meCountValue: { fontFamily: FONTS.boardHeavy, fontSize: 28, lineHeight: 30 },
  meCountLabel: { fontFamily: FONTS.boardLabel, fontSize: 11, letterSpacing: 1 },
  gear: { minWidth: 32, minHeight: HIT_TARGET, alignItems: "flex-end", justifyContent: "center" },
  segments: { flexDirection: "row", borderRadius: RADIUS.md, padding: 3, gap: 3 },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  tour: { borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  tourHead: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28 },
  tourKicker: { flex: 1, fontFamily: FONTS.board, fontSize: 15, letterSpacing: 1.2 },
  tourMore: { fontSize: 14, fontWeight: "800" },
  tourEmpty: { fontSize: 13 },
  tile: { flexBasis: "47%", flexGrow: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.md, gap: 4 },
  tileBadge: {
    position: "absolute",
    top: -6,
    right: -8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  tileBadgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "900" },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  tileTitle: { fontSize: 16, fontWeight: "800" },
  tileHint: { fontSize: 12 },
  segment: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    minHeight: 40,
    borderRadius: RADIUS.sm,
  },
  segmentText: { fontSize: 14, fontWeight: "700" },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 4,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: SPACING.sm },
  sectionTitle: { fontFamily: FONTS.boardLabel, fontSize: 13, letterSpacing: 1.2, marginTop: SPACING.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
  },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontSize: 16, fontWeight: "800" },
  rowMeta: { fontSize: 13 },
  small: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 34,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.pill,
  },
  smallText: { fontSize: 13, fontWeight: "800" },
  pair: { flexDirection: "row", gap: SPACING.sm },
  iconButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  empty: { alignItems: "center", gap: SPACING.sm, borderWidth: 1, borderRadius: RADIUS.lg, padding: SPACING.xl },
  emptyTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  primary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 4,
    paddingHorizontal: SPACING.xl,
    borderRadius: RADIUS.md,
    marginTop: SPACING.sm,
  },
  primaryText: { fontSize: 16, fontWeight: "800" },
});
