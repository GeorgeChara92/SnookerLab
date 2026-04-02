import React from "react";
import type { NativeStackNavigationOptions } from "@react-navigation/native-stack";
import { useAppTheme } from "../hooks/useAppTheme";
import { HeaderProfileButton } from "../components/profile/HeaderProfileButton";

export const useAppStackScreenOptions = (withProfileShortcut = true): NativeStackNavigationOptions => {
  const { colors } = useAppTheme();

  return {
    headerStyle: { backgroundColor: colors.surface },
    headerTintColor: colors.text,
    headerShadowVisible: false,
    headerTitleStyle: { fontWeight: "700" },
    headerRight: withProfileShortcut ? () => React.createElement(HeaderProfileButton) : undefined,
    contentStyle: { backgroundColor: colors.background },
  };
};
