import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppNavigator } from "./src/navigation";
import { DialogProvider } from "./src/components/ui/DialogProvider";
import { getThemeColors } from "./src/constants";

export default function App() {
  const isDark = useColorScheme() === "dark";
  const colors = getThemeColors(isDark);

  return (
    <SafeAreaProvider>
      <View style={[styles.container, { backgroundColor: colors.background }]}> 
        <DialogProvider>
          <AppNavigator />
        </DialogProvider>
        <StatusBar style={isDark ? "light" : "dark"} />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
