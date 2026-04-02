import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { getThemeColors } from "../constants";

export const useAppTheme = () => {
  const scheme = useColorScheme();
  const isDark = scheme === "dark";
  const colors = useMemo(() => getThemeColors(isDark), [isDark]);

  return { isDark, colors };
};
