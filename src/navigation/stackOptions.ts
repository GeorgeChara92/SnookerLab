import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../hooks/useAppTheme";
import { HeaderProfileButton } from "../components/profile/HeaderProfileButton";
import { HeaderTierBadge } from "../components/subscription";

const HeaderBackArrow = ({ tintColor }: { tintColor?: string }) => {
  const navigation = useNavigation<any>();

  return React.createElement(
    Pressable,
    {
      onPress: () => navigation.goBack(),
      accessibilityRole: "button",
      accessibilityLabel: "Go back",
      style: styles.backButton,
    },
    React.createElement(MaterialCommunityIcons, {
      name: "chevron-left",
      size: 28,
      color: tintColor,
    })
  );
};

export const useAppStackScreenOptions = (withProfileShortcut = true): NativeStackNavigationOptions => {
  const { colors } = useAppTheme();

  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: "700" },
    headerLeft: withProfileShortcut
      ? (props) =>
          props.canGoBack
            ? React.createElement(HeaderBackArrow, { tintColor: props.tintColor ?? colors.text })
            : React.createElement(HeaderTierBadge)
      : undefined,
    headerRight: withProfileShortcut ? () => React.createElement(HeaderProfileButton) : undefined,
    contentStyle: { backgroundColor: colors.background },
  };
};

const styles = StyleSheet.create({
  backButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
