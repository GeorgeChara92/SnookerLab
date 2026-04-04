import React from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useAuthStore } from "../../store";
import { AppButton } from "../../components/ui/AppButton";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";

type Props = NativeStackScreenProps<AuthStackParamList, "ConfirmEmail">;

export const ConfirmEmailScreen = ({ navigation, route }: Props) => {
  const { colors } = useAppTheme();
  const { resendEmailVerification, isLoading } = useAuthStore();

  const email = route.params.email;

  const handleResend = async () => {
    try {
      await resendEmailVerification(email);
      Alert.alert("Email sent", "We sent a new confirmation email. Check your inbox and spam folder.");
    } catch (error: any) {
      Alert.alert("Could not resend", getAuthEmailActionErrorMessage(error));
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}> 
          <Text style={[styles.title, { color: colors.text }]}>Confirm your email</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>We sent a confirmation link to:</Text>
          <Text style={[styles.email, { color: colors.primary }]}>{email}</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>Open that email and confirm your account before signing in.</Text>

          <AppButton
            label="I confirmed - Go to sign in"
            onPress={() =>
              navigation.navigate("Login", {
                notice: "Check your inbox, confirm your account, then sign in.",
                prefillEmail: email,
              })
            }
          />

          <View style={styles.spacer} />
          <AppButton label="Resend confirmation email" variant="secondary" onPress={handleResend} loading={isLoading} />

          <Pressable
            style={styles.backLink}
            onPress={() =>
              navigation.navigate("Login", {
                notice: "Account created. Confirm your email before signing in.",
                prefillEmail: email,
              })
            }
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
    marginTop: 10,
    fontSize: 14,
    lineHeight: 20,
  },
  email: {
    marginTop: 8,
    marginBottom: 2,
    fontSize: 15,
    fontWeight: "700",
  },
  spacer: { height: 8 },
  backLink: {
    marginTop: 14,
    alignSelf: "center",
  },
  backText: {
    fontWeight: "700",
    fontSize: 14,
  },
});
