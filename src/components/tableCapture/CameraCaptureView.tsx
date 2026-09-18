import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

type Props = {
  children?: React.ReactNode;
};

export const CameraCaptureView: React.FC<Props> = ({ children }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const hasPermission = permission?.granted ?? false;

  React.useEffect(() => {
    if (!hasPermission) {
      requestPermission().catch(() => {});
    }
  }, [hasPermission, requestPermission]);

  if (!hasPermission) {
    return (
      <View style={styles.centered}>
        <Text style={styles.title}>Camera permission required</Text>
        <Text style={styles.subtitle}>Allow camera access to capture table position.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={StyleSheet.absoluteFill} facing="back" />
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#030712" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#030712",
  },
  title: { color: "#F8FAFC", fontWeight: "700", fontSize: 18, marginBottom: 8 },
  subtitle: { color: "#94A3B8", fontSize: 14, textAlign: "center", marginTop: 8 },
});
