import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from "react";
import { Animated, Dimensions, Modal, Pressable, StyleSheet, Text, View, Easing } from "react-native";
import * as Haptics from "expo-haptics";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { ACHIEVEMENTS, type Achievement } from "../../constants/achievements";

type UnlockableItem = {
  id: string;
  type: "achievement" | "avatar" | "level" | "milestone";
  title: string;
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  tier?: "bronze" | "silver" | "gold" | "platinum";
  xpReward?: number;
};

type UnlockQueueContextType = {
  queue: UnlockableItem[];
  showUnlock: (item: UnlockableItem) => void;
  showAchievementUnlock: (achievementId: string) => void;
  showLevelUp: (level: number, title: string) => void;
  showAvatarUnlock: (avatarId: string, avatarLabel: string) => void;
  clearQueue: () => void;
};

const UnlockQueueContext = createContext<UnlockQueueContextType | null>(null);

export const useUnlockQueue = () => {
  const context = useContext(UnlockQueueContext);
  if (!context) {
    throw new Error("useUnlockQueue must be used within an UnlockQueueProvider");
  }
  return context;
};

const TIER_COLORS: Record<string, string> = {
  bronze: "#CD7F32",
  silver: "#C0C0C0",
  gold: "#FFD700",
  platinum: "#E5E4E2",
};

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const triggerHaptic = async () => {
  try {
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {}
};

export const UnlockQueueProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { colors } = useAppTheme();
  const [queue, setQueue] = useState<UnlockableItem[]>([]);
  const [currentItem, setCurrentItem] = useState<UnlockableItem | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const iconScaleAnim = useRef(new Animated.Value(0.5)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const textOpacityAnim = useRef(new Animated.Value(0)).current;
  const particleAnims = useRef([...Array(8)].map(() => ({
    translateX: new Animated.Value(0),
    translateY: new Animated.Value(0),
    scale: new Animated.Value(0),
    opacity: new Animated.Value(0),
  }))).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const shineAnim = useRef(new Animated.Value(0)).current;

  const animateIn = useCallback(() => {
    scaleAnim.setValue(0.8);
    opacityAnim.setValue(0);
    iconScaleAnim.setValue(0.5);
    glowAnim.setValue(0);
    textOpacityAnim.setValue(0);
    backdropOpacity.setValue(0);
    shineAnim.setValue(0);
    particleAnims.forEach(p => {
      p.translateX.setValue(0);
      p.translateY.setValue(0);
      p.scale.setValue(0);
      p.opacity.setValue(0);
    });

    backdropOpacity.setValue(0);
    Animated.timing(backdropOpacity, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();

    Animated.parallel([
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 7,
        tension: 100,
        useNativeDriver: true,
      }),
    ]).start();

    setTimeout(() => {
      void triggerHaptic();

      Animated.parallel([
        Animated.spring(iconScaleAnim, {
          toValue: 1.2,
          friction: 4,
          tension: 150,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();

      setTimeout(() => {
        Animated.spring(iconScaleAnim, {
          toValue: 1,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }).start();

        Animated.timing(textOpacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }, 150);

      const angles = [0, 45, 90, 135, 180, 225, 270, 315];
      particleAnims.forEach((particle, i) => {
        const angle = (angles[i] * Math.PI) / 180;
        const distance = 80 + Math.random() * 40;
        const duration = 600 + Math.random() * 200;

        particle.translateX.setValue(0);
        particle.translateY.setValue(0);
        particle.scale.setValue(0);
        particle.opacity.setValue(0);

        Animated.parallel([
          Animated.timing(particle.translateX, {
            toValue: Math.cos(angle) * distance,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(particle.translateY, {
            toValue: Math.sin(angle) * distance,
            duration,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(particle.scale, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(particle.scale, {
              toValue: 0,
              duration: 400,
              delay: 100,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(particle.opacity, {
              toValue: 1,
              duration: 100,
              useNativeDriver: true,
            }),
            Animated.timing(particle.opacity, {
              toValue: 0,
              duration: 400,
              delay: 100,
              useNativeDriver: true,
            }),
          ]),
        ]).start();
      });

      Animated.timing(shineAnim, {
        toValue: 1,
        duration: 800,
        delay: 100,
        useNativeDriver: true,
      }).start();
    }, 100);
  }, [scaleAnim, opacityAnim, iconScaleAnim, glowAnim, textOpacityAnim, backdropOpacity, particleAnims, shineAnim]);

  const animateOut = useCallback(() => {
    Animated.parallel([
      Animated.timing(opacityAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(scaleAnim, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(backdropOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, [opacityAnim, scaleAnim, backdropOpacity]);

  useEffect(() => {
    if (queue.length > 0 && !currentItem) {
      const nextItem = queue[0];
      setCurrentItem(nextItem);
      setQueue((prev) => prev.slice(1));
      setIsVisible(true);
      animateIn();
    }
  }, [queue, currentItem, animateIn]);

  const dismissCurrent = useCallback(() => {
    animateOut();
    setTimeout(() => {
      setIsVisible(false);
      setCurrentItem(null);
    }, 250);
  }, [animateOut]);

  const showUnlock = useCallback((item: UnlockableItem) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const showAchievementUnlock = useCallback((achievementId: string) => {
    const achievement = ACHIEVEMENTS.find((a: Achievement) => a.id === achievementId);
    if (achievement) {
      showUnlock({
        id: achievementId,
        type: "achievement",
        title: achievement.title,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        xpReward: achievement.xpReward,
      });
    }
  }, [showUnlock]);

  const showLevelUp = useCallback((level: number, title: string) => {
    showUnlock({
      id: `level-${level}`,
      type: "level",
      title: `Level ${level}`,
      description: title,
      icon: "star",
      xpReward: 0,
    });
  }, [showUnlock]);

  const showAvatarUnlock = useCallback((avatarId: string, avatarLabel: string) => {
    showUnlock({
      id: avatarId,
      type: "avatar",
      title: avatarLabel,
      description: "Avatar unlocked!",
      icon: "account-circle",
    });
  }, [showUnlock]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    setCurrentItem(null);
    setIsVisible(false);
  }, []);

  const handleBackdropPress = () => {
    dismissCurrent();
  };

  if (!currentItem) {
    return (
      <UnlockQueueContext.Provider value={{ queue, showUnlock, showAchievementUnlock, showLevelUp, showAvatarUnlock, clearQueue }}>
        {children}
      </UnlockQueueContext.Provider>
    );
  }

  const tierColor = currentItem.tier ? TIER_COLORS[currentItem.tier] : colors.primary;

  return (
    <UnlockQueueContext.Provider value={{ queue, showUnlock, showAchievementUnlock, showLevelUp, showAvatarUnlock, clearQueue }}>
      {children}
      <Modal visible={isVisible} transparent animationType="none" onRequestClose={handleBackdropPress} statusBarTranslucent>
        <Pressable style={styles.backdrop} onPress={handleBackdropPress}>
          <Animated.View style={[styles.backdropOverlay, { opacity: backdropOpacity }]} />
          
          <Pressable style={styles.modalContainer} onPress={(e) => e.stopPropagation()}>
            {particleAnims.map((particle, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.particle,
                  {
                    backgroundColor: tierColor,
                    transform: [
                      { translateX: particle.translateX },
                      { translateY: particle.translateY },
                      { scale: particle.scale },
                    ],
                    opacity: particle.opacity,
                  },
                ]}
              />
            ))}

            <Animated.View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: tierColor,
                  shadowColor: tierColor,
                  transform: [{ scale: scaleAnim }],
                  opacity: opacityAnim,
                },
              ]}
            >
              <Animated.View
                style={[
                  styles.iconContainer,
                  { backgroundColor: tierColor + "15" },
                  { transform: [{ scale: iconScaleAnim }] },
                ]}
              >
                <Animated.View style={[styles.iconGlow, { backgroundColor: tierColor, opacity: glowAnim }]} />
                <MaterialCommunityIcons name={currentItem.icon} size={48} color={tierColor} />
              </Animated.View>

              <Text style={[styles.typeLabel, { color: tierColor }]}>
                {currentItem.type === "achievement" 
                  ? "ACHIEVEMENT UNLOCKED" 
                  : currentItem.type === "level" 
                    ? "LEVEL UP" 
                    : currentItem.type === "avatar"
                      ? "AVATAR UNLOCKED"
                      : "MILESTONE REACHED"}
              </Text>

              <Animated.View style={{ opacity: textOpacityAnim }}>
                <Text style={[styles.title, { color: colors.text }]}>{currentItem.title}</Text>
                <Text style={[styles.description, { color: colors.textMuted }]}>{currentItem.description}</Text>

                {currentItem.xpReward !== undefined && currentItem.xpReward > 0 && (
                  <View style={[styles.xpBadge, { backgroundColor: tierColor + "20", borderColor: tierColor + "40" }]}>
                    <MaterialCommunityIcons name="star" size={14} color={tierColor} />
                    <Text style={[styles.xpText, { color: tierColor }]}>+{currentItem.xpReward} XP</Text>
                  </View>
                )}
              </Animated.View>

              <Pressable style={[styles.tapHint, { backgroundColor: colors.surfaceMuted }]} onPress={handleBackdropPress}>
                <Text style={[styles.tapHintText, { color: colors.textMuted }]}>Tap to continue</Text>
              </Pressable>
            </Animated.View>

            {currentItem.tier && (
              <Animated.View
                style={[
                  styles.glowRing,
                  {
                    borderColor: tierColor,
                    opacity: glowAnim,
                    transform: [{ scale: glowAnim }],
                  },
                ]}
                pointerEvents="none"
              >
                <View style={[styles.glowRingInner, { borderColor: tierColor + "60" }]} />
              </Animated.View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </UnlockQueueContext.Provider>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  backdropOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  modalContainer: {
    width: SCREEN_WIDTH * 0.88,
    maxWidth: 360,
    alignItems: "center",
  },
  particle: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  card: {
    width: "100%",
    borderRadius: 28,
    borderWidth: 2,
    padding: 28,
    alignItems: "center",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 16,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    overflow: "visible",
  },
  iconGlow: {
    position: "absolute",
    width: 120,
    height: 120,
    borderRadius: 60,
    opacity: 0.3,
  },
  typeLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 16,
  },
  xpBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  xpText: {
    fontSize: 15,
    fontWeight: "700",
  },
  tapHint: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
  },
  tapHintText: {
    fontSize: 13,
    fontWeight: "500",
  },
  glowRing: {
    position: "absolute",
    width: SCREEN_WIDTH * 1.2,
    height: SCREEN_WIDTH * 1.2,
    borderRadius: SCREEN_WIDTH * 0.6,
    borderWidth: 1.5,
    top: "50%",
    left: "50%",
    marginTop: -SCREEN_WIDTH * 0.6,
    marginLeft: -SCREEN_WIDTH * 0.6,
    opacity: 0.4,
  },
  glowRingInner: {
    position: "absolute",
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    borderRadius: SCREEN_WIDTH * 0.5,
    borderWidth: 1,
    top: SCREEN_WIDTH * 0.1,
    left: SCREEN_WIDTH * 0.1,
  },
});