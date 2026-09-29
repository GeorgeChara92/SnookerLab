import React, { useRef, useState } from "react";
import {
  FlatList,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ImageSourcePropType,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SPACING } from "../../constants";

type Page =
  | { kind: "welcome" }
  | { kind: "feature"; kicker: string; title: string; body: string; image: ImageSourcePropType }
  | { kind: "start" };

const PAGES: Page[] = [
  { kind: "welcome" },
  {
    kind: "feature",
    kicker: "SCORE",
    title: "Every frame, ball by ball",
    body: "Tap the balls as they go down. Breaks, fouls, the points left and snookers needed are all kept for you.",
    image: require("../../../assets/tour/live-scoring.jpg"),
  },
  {
    kind: "feature",
    kicker: "PRACTISE",
    title: "Practice with a point to it",
    body: "Routines with progress charts and personal bests. Build your own, plan your week and keep a streak going.",
    image: require("../../../assets/tour/routine.jpg"),
  },
  {
    kind: "feature",
    kicker: "PROGRESS",
    title: "See how you are getting on",
    body: "Your streak, your week and your form at a glance, with high breaks and head-to-heads behind them.",
    image: require("../../../assets/tour/stats.jpg"),
  },
  {
    kind: "feature",
    kicker: "IMPROVE",
    title: "A coach that watches you play",
    body: "Film a few shots and get feedback on your technique - what's working, what to fix first, and the routines that train it.",
    image: require("../../../assets/tour/ai-coach.jpg"),
  },
  {
    kind: "feature",
    kicker: "PLAY",
    title: "Your club, in your pocket",
    body: "Add friends, start a group for your league, chat, and follow each other's matches live.",
    image: require("../../../assets/tour/community.jpg"),
  },
  {
    kind: "feature",
    kicker: "SHARE",
    title: "Share the big moments",
    body: "A result card that leads with the century, the maximum or the comeback.",
    image: require("../../../assets/tour/share-card.jpg"),
  },
  { kind: "start" },
];

export type TourChoice = "match" | "practice" | "community" | null;

const CHOICES: Array<{ value: Exclude<TourChoice, null>; icon: string; title: string; body: string }> = [
  { value: "match", icon: "scoreboard-outline", title: "Score a match", body: "Play someone and score it live" },
  { value: "practice", icon: "target", title: "Start practising", body: "Pick a routine and log a score" },
  {
    value: "community",
    icon: "account-multiple-outline",
    title: "Find my friends",
    body: "Set up your profile and add people",
  },
];

/**
 * The welcome tour for someone new: what the app is, five things it does shown on real screens,
 * and where to start. Swipe or tap through; skip at any point.
 */
export const WelcomeTour = ({ visible, onDone }: { visible: boolean; onDone: (choice: TourChoice) => void }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const list = useRef<FlatList<Page>>(null);

  const last = PAGES.length - 1;
  // The screenshot fills what the words and buttons leave, and never gets too wide.
  const shotHeight = Math.max(260, Math.min(height * 0.52, (width - 96) * 2.17));
  const shotWidth = shotHeight / 2.17;

  const goTo = (index: number) => {
    setPage(index);
    list.current?.scrollToIndex({ index, animated: true });
  };

  const finish = (choice: TourChoice) => {
    setPage(0);
    onDone(choice);
  };

  const renderPage = ({ item }: { item: Page }) => {
    if (item.kind === "welcome") {
      return (
        <View style={[styles.page, { width }]}>
          <View style={styles.centre}>
            <Image source={require("../../../assets/icon.png")} style={styles.icon} accessibilityIgnoresInvertColors />
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
              WELCOME TO SNOOKERED
            </Text>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.hero, { color: colors.text }]}>
              Your snooker,{"\n"}on the scoreboard.
            </Text>
            <Text style={[styles.body, { color: colors.textMuted }]}>
              Score your matches, practise with a plan and play your friends. Here is a quick look round.
            </Text>
          </View>
        </View>
      );
    }
    if (item.kind === "start") {
      return (
        <View style={[styles.page, { width }]}>
          <View style={styles.startWrap}>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
              READY WHEN YOU ARE
            </Text>
            <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.title, { color: colors.text }]}>
              Where do you want to start?
            </Text>
            <View style={styles.choices}>
              {CHOICES.map((choice) => (
                <Pressable
                  key={choice.value}
                  onPress={() => finish(choice.value)}
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.choice,
                    { backgroundColor: pressed ? colors.surfaceMuted : colors.surface, borderColor: colors.border },
                  ]}
                >
                  <View style={[styles.choiceIcon, { backgroundColor: colors.board }]}>
                    <MaterialCommunityIcons name={choice.icon as any} size={22} color={colors.boardRule} />
                  </View>
                  <View style={styles.choiceText}>
                    <Text style={[styles.choiceTitle, { color: colors.text }]}>{choice.title}</Text>
                    <Text style={[styles.choiceBody, { color: colors.textMuted }]}>{choice.body}</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      );
    }
    return (
      <View style={[styles.page, { width }]}>
        <View style={[styles.stage, { height: shotHeight + 24 }]}>
          <View style={[styles.glow, { backgroundColor: colors.primary }]} />
          <View
            style={[
              styles.device,
              { width: shotWidth + 12, height: shotHeight + 12, backgroundColor: "#141b19", borderColor: "#3a4642" },
            ]}
          >
            <Image
              source={item.image}
              style={[styles.shot, { width: shotWidth, height: shotHeight }]}
              resizeMode="cover"
              accessibilityIgnoresInvertColors
            />
          </View>
        </View>
        <View style={styles.copy}>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.kicker, { color: colors.boardRule }]}>
            {item.kicker}
          </Text>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.title, { color: colors.text }]}>
            {item.title}
          </Text>
          <Text style={[styles.body, { color: colors.textMuted }]}>{item.body}</Text>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => finish(null)}>
      <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: insets.top }]}>
        <View style={styles.top}>
          {page < last ? (
            <Pressable
              onPress={() => finish(null)}
              accessibilityRole="button"
              accessibilityLabel="Skip the tour"
              hitSlop={10}
              style={styles.skip}
            >
              <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip</Text>
            </Pressable>
          ) : null}
        </View>

        <FlatList
          ref={list}
          data={PAGES}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, index) => String(index)}
          renderItem={renderPage}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          onMomentumScrollEnd={(event) => setPage(Math.round(event.nativeEvent.contentOffset.x / width))}
          style={styles.flex}
        />

        <View style={[styles.bottom, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.dots} accessibilityLabel={`Page ${page + 1} of ${PAGES.length}`}>
            {PAGES.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  index === page
                    ? { width: 22, backgroundColor: colors.boardRule }
                    : { backgroundColor: colors.border },
                ]}
              />
            ))}
          </View>
          {page < last ? (
            <Pressable
              onPress={() => goTo(page + 1)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.next, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            >
              <Text style={[styles.nextText, { color: colors.onPrimary }]}>{page === 0 ? "Show me" : "Next"}</Text>
              <MaterialCommunityIcons name="arrow-right" size={20} color={colors.onPrimary} />
            </Pressable>
          ) : (
            <Pressable onPress={() => finish(null)} accessibilityRole="button" style={styles.later}>
              <Text style={[styles.laterText, { color: colors.textMuted }]}>I'll look around myself</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1 },
  top: { height: HIT_TARGET, alignItems: "flex-end", justifyContent: "center", paddingHorizontal: SPACING.lg },
  skip: { minHeight: HIT_TARGET, justifyContent: "center" },
  skipText: { fontSize: 16, fontWeight: "700" },
  page: { flex: 1, paddingHorizontal: SPACING.lg, justifyContent: "center" },
  centre: { alignItems: "center", gap: SPACING.md },
  icon: { width: 112, height: 112, borderRadius: 26, marginBottom: SPACING.md },
  kicker: { fontFamily: FONTS.boardLabel, fontSize: 14, letterSpacing: 2 },
  hero: {
    fontFamily: FONTS.boardHeavy,
    fontSize: 44,
    lineHeight: 44,
    textAlign: "center",
    textTransform: "uppercase",
  },
  title: { fontFamily: FONTS.boardHeavy, fontSize: 34, lineHeight: 36, textTransform: "uppercase" },
  body: { fontSize: 16, lineHeight: 23, textAlign: "center", maxWidth: 340 },
  stage: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute", width: 220, height: 220, borderRadius: 110, opacity: 0.16, bottom: 30 },
  device: { borderRadius: 34, borderWidth: 1.5, padding: 5 },
  shot: { borderRadius: 28 },
  copy: { alignItems: "center", gap: 6, marginTop: SPACING.lg },
  startWrap: { gap: SPACING.md },
  choices: { gap: SPACING.sm, marginTop: SPACING.md },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    borderWidth: 1,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    minHeight: 72,
  },
  choiceIcon: { width: 44, height: 44, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  choiceText: { flex: 1, minWidth: 0 },
  choiceTitle: { fontSize: 17, fontWeight: "800" },
  choiceBody: { fontSize: 14, marginTop: 2 },
  bottom: { paddingHorizontal: SPACING.lg, gap: SPACING.md, paddingTop: SPACING.sm },
  dots: { flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  next: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    minHeight: HIT_TARGET + 8,
    borderRadius: RADIUS.md,
  },
  nextText: { fontSize: 17, fontWeight: "800" },
  later: { minHeight: HIT_TARGET + 8, alignItems: "center", justifyContent: "center" },
  laterText: { fontSize: 16, fontWeight: "700" },
});
