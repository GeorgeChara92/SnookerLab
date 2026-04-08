import React, { useState, useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "./AppButton";

type CodeConfirmModalProps = {
  visible: boolean;
  title: string;
  message: string;
  code: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  onCodeChange: (code: string) => void;
  loading?: boolean;
  danger?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
};

export const CodeConfirmModal = ({
  visible,
  title,
  message,
  code,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  onCodeChange,
  loading = false,
  danger = false,
  icon,
}: CodeConfirmModalProps) => {
  const { colors } = useAppTheme();
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    if (!visible) {
      setInputValue("");
    }
  }, [visible]);

  const handleChange = (text: string) => {
    const upper = text.toUpperCase();
    setInputValue(upper);
    onCodeChange(upper);
  };

  const isValid = inputValue.trim().toUpperCase() === code;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.container} onPress={(e) => e.stopPropagation()}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {icon && (
              <View style={[styles.iconContainer, { backgroundColor: danger ? colors.danger + "15" : colors.primary + "15" }]}>
                <MaterialCommunityIcons
                  name={icon}
                  size={32}
                  color={danger ? colors.danger : colors.primary}
                />
              </View>
            )}
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            <Text style={[styles.message, { color: colors.textMuted }]}>{message}</Text>
            
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Enter this code to confirm:</Text>
            <Text style={[styles.codeDisplay, { color: danger ? colors.danger : colors.primary }]}>{code}</Text>
            
            <TextInput
              style={[styles.codeInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border, color: colors.text }]}
              placeholder="Enter code"
              placeholderTextColor={colors.textMuted}
              value={inputValue}
              onChangeText={handleChange}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
            />

            <View style={styles.actions}>
              <View style={styles.actionBtn}>
                <AppButton
                  label={cancelLabel}
                  variant="secondary"
                  onPress={onCancel}
                  disabled={loading}
                />
              </View>
              <View style={styles.actionBtn}>
                <AppButton
                  label={confirmLabel}
                  variant={danger ? "danger" : "primary"}
                  onPress={onConfirm}
                  loading={loading}
                  disabled={!isValid || loading}
                />
              </View>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  container: {
    width: "100%",
    maxWidth: 360,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    alignItems: "center",
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  codeLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  codeDisplay: {
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 16,
  },
  codeInput: {
    width: "100%",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  actionBtn: {
    flex: 1,
  },
});