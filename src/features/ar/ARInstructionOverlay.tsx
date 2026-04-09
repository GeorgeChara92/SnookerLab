import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { ARConfidenceStatus } from "./ARConfidenceState";

type Action = {
  label: string;
  onPress: () => void;
  primary?: boolean;
  disabled?: boolean;
};

type ARInstructionOverlayProps = {
  title: string;
  subtitle: string;
  confidence: ARConfidenceStatus;
  actions: Action[];
  footer?: string;
};

const confidenceStyleMap: Record<ARConfidenceStatus["state"], { bg: string; fg: string }> = {
  scanning: { bg: "rgba(96,165,250,0.2)", fg: "#BFDBFE" },
  poor: { bg: "rgba(248,113,113,0.2)", fg: "#FECACA" },
  usable: { bg: "rgba(251,191,36,0.2)", fg: "#FDE68A" },
  locked: { bg: "rgba(52,211,153,0.2)", fg: "#A7F3D0" },
  drift: { bg: "rgba(251,113,133,0.2)", fg: "#FECDD3" },
};

export const ARInstructionOverlay: React.FC<ARInstructionOverlayProps> = ({
  title,
  subtitle,
  confidence,
  actions,
  footer,
}) => {
  const confidenceStyle = confidenceStyleMap[confidence.state];

  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={[styles.pill, { backgroundColor: confidenceStyle.bg }]}> 
        <Text style={[styles.pillText, { color: confidenceStyle.fg }]}>{confidence.label} · {confidence.score}%</Text>
      </View>
      <Text style={styles.guidance}>{confidence.guidance}</Text>

      <View style={styles.actionRow}>
        {actions.map((action) => (
          <Pressable
            key={action.label}
            style={[styles.actionButton, action.primary ? styles.actionPrimary : styles.actionSecondary, action.disabled && styles.actionDisabled]}
            onPress={action.onPress}
            disabled={action.disabled}
          >
            <Text style={[styles.actionText, action.primary ? styles.actionTextPrimary : styles.actionTextSecondary]}>{action.label}</Text>
          </Pressable>
        ))}
      </View>

      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  panel: {
    borderRadius: 16,
    backgroundColor: "rgba(4, 8, 16, 0.86)",
    borderWidth: 1,
    borderColor: "rgba(148, 163, 184, 0.22)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 7,
  },
  title: { color: "#F8FAFC", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "#D1D5DB", fontSize: 12, lineHeight: 17 },
  pill: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 11, fontWeight: "800" },
  guidance: { color: "#B6C2D4", fontSize: 11 },
  actionRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    minWidth: 92,
    alignItems: "center",
  },
  actionPrimary: { backgroundColor: "rgba(16,185,129,0.24)", borderColor: "rgba(16,185,129,0.5)" },
  actionSecondary: { backgroundColor: "rgba(255,255,255,0.06)", borderColor: "rgba(255,255,255,0.16)" },
  actionDisabled: { opacity: 0.45 },
  actionText: { fontSize: 12, fontWeight: "800" },
  actionTextPrimary: { color: "#A7F3D0" },
  actionTextSecondary: { color: "#E5E7EB" },
  footer: { color: "#93A0B5", fontSize: 10 },
});
