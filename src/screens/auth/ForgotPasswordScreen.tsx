import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { AppButton } from "../../components/ui/AppButton";
import { AuthBanner, AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";
import { HIT_TARGET, SPACING } from "../../constants";

type Props = NativeStackScreenProps<AuthStackParamList, "ForgotPassword">;

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [email, setEmail] = useState("");
  const [problem, setProblem] = useState("");
  const [sentTo, setSentTo] = useState("");
  const { colors } = useAppTheme();
  const { resetPassword, isLoading } = useAuthStore();

  const handleReset = async () => {
    const cleanEmail = email.trim();
    if (!looksLikeEmail(cleanEmail)) {
      setProblem("Enter the email address you signed up with.");
      return;
    }
    setProblem("");
    try {
      await resetPassword(cleanEmail);
      setSentTo(cleanEmail);
    } catch (error: any) {
      setProblem(getAuthEmailActionErrorMessage(error));
    }
  };

  return (
    <AuthShell
      strapline="BACK TO THE TABLE"
      title="Reset your password"
      subtitle="Enter your account email and we will send you a link to choose a new password."
    >
      {sentTo ? (
        <AuthBanner
          tone="info"
          message={`If an account uses ${sentTo}, a reset link is on its way. Check your inbox, and your spam folder too.`}
        />
      ) : null}
      {problem ? <AuthBanner tone="danger" message={problem} /> : null}

      <AuthField
        label="Email"
        icon="email-outline"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        returnKeyType="send"
        onSubmitEditing={handleReset}
        invalid={!!problem}
      />

      <AppButton label={sentTo ? "Send the link again" : "Send reset link"} onPress={handleReset} loading={isLoading} />

      <Pressable
        onPress={() => navigation.navigate("Login", sentTo ? { prefillEmail: sentTo } : undefined)}
        accessibilityRole="button"
        style={styles.back}
      >
        <Text style={[styles.link, { color: colors.primary }]}>Back to sign in</Text>
      </Pressable>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  back: { marginTop: SPACING.lg, minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center" },
  link: { fontSize: 15, fontWeight: "700" },
});
