import React from "react";
import { NativeModules, Platform, StyleSheet, Text, UIManager, View } from "react-native";
import { isNativeARKitViewAvailable } from "../../features/arkit/SnookerARKitView";

const hasRequiredViroModules = () => {
  const modules = NativeModules as Record<string, unknown>;
  return Boolean(modules.VRTMaterialManager) && Boolean(modules.VRTAnimationManager);
};

export const SnookerScanScreen = () => {
  const hasNativeARKitView = isNativeARKitViewAvailable();
  const hasUIManager = typeof UIManager.getViewManagerConfig === "function";
  const managerConfig = hasUIManager ? UIManager.getViewManagerConfig("SnookerARKitViewManager") : null;
  const viewConfig = hasUIManager ? UIManager.getViewManagerConfig("SnookerARKitView") : null;

  if (Platform.OS === "ios") {
    if (hasNativeARKitView) {
      try {
        const { SnookerScanARKitScreen } = require("./SnookerScanARKitScreen") as {
          SnookerScanARKitScreen: React.ComponentType;
        };
        return <SnookerScanARKitScreen />;
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
        <Text style={styles.emptyText}>Build and run with a native dev client. Expo Go does not include required AR native modules.</Text>
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
