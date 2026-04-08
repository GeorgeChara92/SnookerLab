import React from "react";
import { NativeModules, Platform, StyleSheet, Text, View } from "react-native";

const hasRequiredViroModules = () => {
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.VRTMaterialManager) && Boolean(modules.VRTAnimationManager);
};

export const SnookerScanScreen = () => {
  if (Platform.OS !== "ios") {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>ARKit is iOS only</Text>
        <Text style={styles.emptyText}>Use an iPhone or iPad to run snooker scan AR features.</Text>
      </View>
    );
  }

  if (!hasRequiredViroModules()) {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>AR module not ready</Text>
        <Text style={styles.emptyText}>Build and run with a native dev client. Expo Go does not include ARKit native modules.</Text>
      </View>
    );
  }

  try {
    const { SnookerScanViroScreen } = require("./SnookerScanViroScreen") as {
      SnookerScanViroScreen: React.ComponentType;
    };
    return <SnookerScanViroScreen />;
  } catch {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>AR init failed</Text>
        <Text style={styles.emptyText}>Restart the dev client after prebuild to load ARKit modules.</Text>
      </View>
    );
  }
};

const styles = StyleSheet.create({
  emptyWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#070B14",
  },
  emptyTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 8,
    color: "#9CA3AF",
    fontSize: 14,
    textAlign: "center",
  },
});