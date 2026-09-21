import React, { useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  useFonts,
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_800ExtraBold,
} from "@expo-google-fonts/barlow-condensed";
import { AppNavigator } from "./src/navigation";
import { DialogProvider } from "./src/components/ui/DialogProvider";
import { BreakOffSplash } from "./src/components/splash/BreakOffSplash";
import { getThemeColors } from "./src/constants";

export default function App() {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);
  // The opening break-off plays once per launch, over the app as it loads underneath.
  const [showSplash, setShowSplash] = useState(true);
  const [fontsLoaded, fontError] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    BarlowCondensed_800ExtraBold,
  });

  // The scoreboard face loads from the bundle in a few milliseconds. Wait for it, so scores do
  // not flash in the system font first; if it fails, carry on in the system font regardless.
  const fontsReady = fontsLoaded || !!fontError;
  const splash = showSplash ? <BreakOffSplash fontsReady={fontsReady} onFinish={() => setShowSplash(false)} /> : null;

  if (!fontsReady) {
    return <View style={[styles.container, { backgroundColor: colors.background }]}>{splash}</View>;
  }

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <DialogProvider>
          <AppNavigator />
        </DialogProvider>
        {splash}
        <StatusBar style={showSplash || isDark ? "light" : "dark"} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
