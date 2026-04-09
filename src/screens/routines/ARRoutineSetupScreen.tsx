import React from "react";
import { NativeModules, Platform, StyleSheet, Text, UIManager, View } from "react-native";
import { isNativeARKitViewAvailable } from "../../features/arkit/SnookerARKitView";

const hasRequiredViroModules = () => {
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.VRTMaterialManager) && Boolean(modules.VRTAnimationManager);
};

export const ARRoutineSetupScreen = () => {
  const hasNativeARKitView = isNativeARKitViewAvailable();
  const hasUIManager = typeof UIManager.getViewManagerConfig === "function";
  const managerConfig = hasUIManager ? UIManager.getViewManagerConfig("SnookerARKitViewManager") : null;
  const viewConfig = hasUIManager ? UIManager.getViewManagerConfig("SnookerARKitView") : null;

  if (Platform.OS === "ios") {
    if (hasNativeARKitView) {
      try {
        const { ARRoutineSetupARKitScreen } = require("./ARRoutineSetupARKitScreen") as {
          ARRoutineSetupARKitScreen: React.ComponentType;
        };
        return <ARRoutineSetupARKitScreen />;
      } catch {
        return (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyTitle}>ARKit init failed</Text>
            <Text style={styles.emptyText}>Restart the dev client after prebuild to load ARKit modules.</Text>
          </View>
        );
      }
    }

    return (
      <View style={styles.emptyWrap}>
        <Text style={styles.emptyTitle}>ARKit not detected</Text>
        <Text style={styles.emptyText}>This iOS screen is configured to use ARKit only. Rebuild the dev client so the SnookerARKitViewManager native module is included.</Text>
        {managerConfig === null && viewConfig ? (
          <Text style={styles.debugWarn}>Detected legacy SnookerARKitView only. Install a fresh dev build after cache-clear.</Text>
        ) : null}
        <View style={styles.debugPanel}>
          <Text style={styles.debugTitle}>AR Debug</Text>
          <Text style={styles.debugLine}>Platform: {Platform.OS}</Text>
          <Text style={styles.debugLine}>hasNativeARKitView: {String(hasNativeARKitView)}</Text>
          <Text style={styles.debugLine}>UIManager fn: {String(hasUIManager)}</Text>
          <Text style={styles.debugLine}>Manager cfg: {String(!!managerConfig)}</Text>
          <Text style={styles.debugLine}>View cfg: {String(!!viewConfig)}</Text>
        </View>
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
  debugPanel: {
    marginTop: 16,
    borderWidth: 1,
    borderColor: "rgba(59,130,246,0.45)",
    backgroundColor: "rgba(2,6,23,0.7)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: "100%",
    maxWidth: 360,
  },
  debugTitle: {
    color: "#93C5FD",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 6,
  },
  debugLine: {
    color: "#CBD5E1",
    fontSize: 12,
    marginBottom: 2,
  },
  debugWarn: {
    marginTop: 10,
    color: "#FCA5A5",
    fontSize: 12,
    textAlign: "center",
    maxWidth: 360,
  },
});
