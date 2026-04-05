import React from "react";
import { NativeModules, Platform, StyleSheet, Text, View } from "react-native";

const hasRequiredViroModules = () => {
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.VRTMaterialManager) && Boolean(modules.VRTAnimationManager);
};

export const ARRoutineSetupScreen = () => {
  if (Platform.OS !== "ios") {
    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>ARKit is iOS only</Text>
        <Text style={styles.emptyText}>Use an iPhone or iPad build to run AR routine setup.</Text>
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
    const { ARRoutineSetupViroScreen } = require("./ARRoutineSetupViroScreen") as {
      ARRoutineSetupViroScreen: React.ComponentType;
    };
    return <ARRoutineSetupViroScreen />;
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
  container: {
    flex: 1,
    backgroundColor: "#04070E",
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 12,
    right: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
    maxWidth: 190,
  },
  topButtons: {
    flexDirection: "row",
    gap: 6,
  },
  topButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(8,11,20,0.65)",
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },
  topButtonText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  bottomPanel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(3,6,14,0.58)",
  },
  instruction: {
    color: "#FFFFFF",
    textAlign: "center",
    fontSize: 16,
    fontWeight: "800",
  },
  metrics: {
    marginTop: 4,
    color: "#D1D5DB",
    textAlign: "center",
    fontSize: 12,
  },
  captureRow: {
    marginTop: 12,
    marginBottom: 2,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 14,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 999,
    borderWidth: 4,
    borderColor: "#FFFFFF",
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  captureDisabled: {
    opacity: 0.45,
  },
  captureCore: {
    width: 54,
    height: 54,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
  },
  sideButton: {
    minWidth: 72,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    backgroundColor: "rgba(12,18,31,0.68)",
    paddingVertical: 10,
    paddingHorizontal: 10,
    alignItems: "center",
  },
  sideButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
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
