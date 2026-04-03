import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";

export const HeaderTierBadge = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();

  return (
    <Pressable
      onPress={() => navigation.navigate("ProfileModal", { screen: "SubscriptionPlans" })}
      style={styles.badge}
    >
      <Text style={[styles.text, { color: colors.primary }]}>{subscription.tierLabel}</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  badge: {
    minHeight: 34,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  text: {
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
});
