import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type ARTopChromeProps = {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  rightLabel?: string;
  onRightPress?: () => void;
};

export const ARTopChrome: React.FC<ARTopChromeProps> = ({ title, subtitle, onBack, rightLabel, onRightPress }) => {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {onBack ? (
          <Pressable style={styles.iconButton} onPress={onBack}>
            <Text style={styles.iconText}>Back</Text>
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}

        <View style={styles.center}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>

        {rightLabel && onRightPress ? (
          <Pressable style={styles.iconButton} onPress={onRightPress}>
            <Text style={styles.iconText}>{rightLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.iconSpacer} />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.24)",
    backgroundColor: "rgba(6, 12, 22, 0.62)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  row: { flexDirection: "row", alignItems: "center" },
  iconButton: {
    minWidth: 54,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.26)",
    backgroundColor: "rgba(255,255,255,0.06)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
  },
  iconSpacer: { width: 54 },
  iconText: { color: "#E5E7EB", fontSize: 12, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
  title: { color: "#F8FAFC", fontSize: 14, fontWeight: "800" },
  subtitle: { color: "#B6C2D4", fontSize: 11, fontWeight: "600" },
});
