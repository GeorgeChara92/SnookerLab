import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { AppButton } from "../../components/ui/AppButton";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const { colors } = useAppTheme();
  const { resetPassword, isLoading } = useAuthStore();

  const handleReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      Alert.alert("Invalid email", "Please enter a valid email address.");
      return;
    }

    try {
      await resetPassword(cleanEmail);
      Alert.alert("Check your inbox", "If this email exists, a reset link has been sent.", [
        { text: "Back to Sign In", onPress: () => navigation.navigate("Login") },
      ]);
    } catch (error: any) {
      Alert.alert("Unable to reset", getAuthEmailActionErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Reset password</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Enter your account email to receive a reset link.</Text>

          <TextInput
            style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
            placeholder="Email"
            placeholderTextColor={colors.textMuted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={handleReset}
          />

          <AppButton label="Send Reset Link" onPress={handleReset} loading={isLoading} />

          <Pressable style={styles.backLink} onPress={() => navigation.navigate("Login")}>
            <Text style={[styles.backText, { color: colors.primary }]}>Back to Sign In</Text>
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
    marginBottom: 18,
    fontSize: 14,
    lineHeight: 20,
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
