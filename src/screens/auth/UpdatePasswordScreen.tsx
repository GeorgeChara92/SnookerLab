import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { AppButton } from "../../components/ui/AppButton";

type Props = NativeStackScreenProps<AuthStackParamList, "UpdatePassword">;

export const UpdatePasswordScreen = ({ navigation }: Props) => {
  const { colors } = useAppTheme();
  const { updatePassword, signOut, isLoading } = useAuthStore();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleSavePassword = async () => {
    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setErrorMessage("");

    try {
      await updatePassword(password);
      Alert.alert("Password updated", "Your password has been changed successfully.");
    } catch (error: any) {
      setErrorMessage(error?.message ?? "Could not update your password.");
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Set new password</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Create a new password to complete your account recovery.</Text>

          {errorMessage ? <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text> : null}

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            placeholder="New password"
            placeholderTextColor={colors.textMuted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            placeholder="Confirm new password"
            placeholderTextColor={colors.textMuted}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleSavePassword}
          />

          <AppButton label="Save Password" onPress={handleSavePassword} loading={isLoading} />

          <Pressable
            style={styles.backLink}
            onPress={() => {
              void signOut().finally(() => navigation.navigate("Login"));
            }}
          >
            <Text style={[styles.backText, { color: colors.textMuted }]}>Back to sign in</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  backLink: {
    marginTop: 14,
    alignSelf: "center",
  },
  backText: {
    fontWeight: "700",
    fontSize: 14,
  },
});
