import React, { createContext, useContext, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { HELP_TOPICS, ROUTE_TOPICS, type HelpTopic, type HelpTopicId } from "../../features/help/helpTopics";
import { useHelpSeenStore } from "../../store/helpSeenStore";
import { useOnboardingStore } from "../../store/onboardingStore";
import { navigationRef } from "../../navigation/navigationRef";
import { DISPLAY_TEXT_SCALE, FONTS, HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

/** Opens the help sheet in the nearest host. */
const HelpContext = createContext<((topicId: HelpTopicId) => void) | null>(null);

/**
 * Hosts the help sheet for everything inside it. Mounted by DialogProvider, so wherever pop-ups
 * can show (the app root, and each sheet presented over it) help can too. The sheet lives here,
 * not inside the "?" - a pop-up rendered from inside a native header bar can stop responding.
 */
export const HelpProvider = ({ children }: { children: React.ReactNode }) => {
  const [topicId, setTopicId] = useState<HelpTopicId | null>(null);
  // The last topic stays on screen while the sheet slides away.
  const [shown, setShown] = useState<HelpTopicId | null>(null);
  const open = (id: HelpTopicId) => {
    setShown(id);
    setTopicId(id);
  };
  return (
    <HelpContext.Provider value={open}>
      {children}
      {shown ? <HelpSheet topicId={shown} visible={topicId !== null} onClose={() => setTopicId(null)} /> : null}
    </HelpContext.Provider>
  );
};

/**
 * The "?" in a screen's header: what this part of the app is for, how to use it, and a few tips,
 * in a sheet over the screen so nobody loses their place. Wears a small dot until its topic has
 * been opened once. Renders nothing for a screen with no topic (see ROUTE_TOPICS).
 */
export const HelpButton = ({ routeName, color, size = 23 }: { routeName: string; color?: string; size?: number }) => {
  const { colors } = useAppTheme();
  const topicId = ROUTE_TOPICS[routeName];
  const seen = useHelpSeenStore((state) => (topicId ? state.seen.includes(topicId) : true));
  const markSeen = useHelpSeenStore((state) => state.markSeen);
  const openHelp = useContext(HelpContext);
  if (!topicId || !openHelp) return null;
  const topic: HelpTopic = HELP_TOPICS[topicId];
  return (
    <>
      <Pressable
        onPress={() => {
          openHelp(topicId);
          markSeen(topicId);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Help with ${topic.title}`}
        hitSlop={6}
        style={styles.button}
      >
        <MaterialCommunityIcons name="help-circle-outline" size={size} color={color ?? colors.textMuted} />
        {!seen ? <View style={[styles.dot, { backgroundColor: colors.primary, borderColor: colors.surface }]} /> : null}
      </Pressable>
    </>
  );
};

export const HelpSheet = ({ topicId, visible, onClose }: { topicId: HelpTopicId; visible: boolean; onClose: () => void }) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const topic: HelpTopic = HELP_TOPICS[topicId];

  // After the sheet has slid away: a second modal opening while this one closes is swallowed on iOS.
  const after = (action: () => void) => {
    onClose();
    setTimeout(action, 350);
  };
  const replayTour = () => after(() => useOnboardingStore.getState().openTour(topic.audience));
  const sendFeedback = () =>
    after(() => {
      if (navigationRef.isReady()) navigationRef.navigate("ProfileModal", { screen: "Feedback" });
    });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: SCRIM }]} onPress={onClose} accessibilityLabel="Close help" />
      <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border, paddingBottom: insets.bottom + SPACING.md }]}>
        <View style={[styles.grabber, { backgroundColor: colors.border }]} />
        <View style={styles.head}>
          <View style={[styles.headIcon, { backgroundColor: colors.board }]}>
            <MaterialCommunityIcons name="help" size={18} color={colors.boardRule} />
          </View>
          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.title, { color: colors.text }]} accessibilityRole="header">
            {topic.title}
          </Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10}>
            <MaterialCommunityIcons name="close" size={22} color={colors.textMuted} />
          </Pressable>
        </View>
        <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
          <Text style={[styles.purpose, { color: colors.text }]}>{topic.purpose}</Text>

          <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.textMuted }]}>
            HOW IT WORKS
          </Text>
          {topic.steps.map((step, index) => (
            <View key={index} style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: colors.primary }]}>
                <Text style={[styles.stepNumberText, { color: colors.onPrimary }]}>{index + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: colors.text }]}>{step}</Text>
            </View>
          ))}

          {topic.tips?.length ? (
            <View style={[styles.tips, { backgroundColor: colors.surfaceMuted }]}>
              <Text maxFontSizeMultiplier={DISPLAY_TEXT_SCALE} style={[styles.label, { color: colors.accent, marginTop: 0 }]}>
                TIPS
              </Text>
              {topic.tips.map((tip, index) => (
                <View key={index} style={styles.tip}>
                  <MaterialCommunityIcons name="lightbulb-on-outline" size={16} color={colors.accent} style={styles.tipIcon} />
                  <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </ScrollView>
        <View style={styles.actions}>
          <Pressable onPress={replayTour} accessibilityRole="button" style={[styles.action, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="play-circle-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Replay the tour</Text>
          </Pressable>
          <Pressable onPress={sendFeedback} accessibilityRole="button" style={[styles.action, { borderColor: colors.border }]}>
            <MaterialCommunityIcons name="message-text-outline" size={18} color={colors.primary} />
            <Text style={[styles.actionText, { color: colors.text }]}>Send feedback</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  button: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 5, right: 5, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  sheet: { marginTop: "auto", maxHeight: "85%", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, paddingTop: SPACING.sm, paddingHorizontal: SPACING.lg },
  grabber: { alignSelf: "center", width: 40, height: 4, borderRadius: RADIUS.pill, marginBottom: SPACING.md },
  head: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, marginBottom: SPACING.sm },
  headIcon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 21, fontWeight: "800" },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: SPACING.md },
  purpose: { fontSize: 16, lineHeight: 23 },
  label: { fontFamily: FONTS.boardLabel, fontSize: 12, letterSpacing: 1.1, marginTop: SPACING.lg, marginBottom: SPACING.sm },
  step: { flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.sm },
  stepNumber: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", marginTop: 1 },
  stepNumberText: { fontSize: 12, fontWeight: "800" },
  stepText: { flex: 1, fontSize: 15, lineHeight: 22 },
  tips: { borderRadius: RADIUS.lg, padding: SPACING.md, marginTop: SPACING.md, gap: SPACING.xs },
  tip: { flexDirection: "row", gap: SPACING.sm },
  tipIcon: { marginTop: 3 },
  tipText: { flex: 1, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", gap: SPACING.sm, paddingTop: SPACING.sm },
  action: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: RADIUS.md, minHeight: HIT_TARGET },
  actionText: { fontSize: 14, fontWeight: "700" },
});
