import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../../store";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { useDialog } from "../../components/ui/DialogProvider";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";
import { RADIUS, SCRIM, SPACING } from "../../constants";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

export const LoginScreen = ({ navigation, route }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [showResendModal, setShowResendModal] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendError, setResendError] = useState("");
  const { signIn, resendEmailVerification, isLoading } = useAuthStore();
  const { colors, isDark } = useAppTheme();
  const dialog = useDialog();

  useEffect(() => {
    const params = route.params;
    if (params?.prefillEmail) setEmail(params.prefillEmail);
    if (params?.notice) setNoticeMessage(params.notice);
  }, [route.params]);

  const openResendModal = () => {
    setResendEmail(email.trim());
    setResendError("");
    setShowResendModal(true);
  };

  const handleResendFromModal = async () => {
    const cleanEmail = resendEmail.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setResendError("Enter a valid email address.");
      return;
    }

    setResendError("");
    try {
      await resendEmailVerification(cleanEmail);
      setShowResendModal(false);
      setEmail(cleanEmail);
      setNoticeMessage("Confirmation email sent. Check inbox and spam.");
    } catch (error: any) {
      setResendError(getAuthEmailActionErrorMessage(error));
    }
  };

  const handleLogin = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMessage("Enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMessage("Password must be at least 6 characters.");
      return;
    }

    setErrorMessage("");

    try {
      await signIn(cleanEmail, password);
    } catch (error: any) {
      const message = error?.message ?? "Unable to sign in. Please try again.";
      const isEmailConfirmationIssue = /confirm|verified|verification/i.test(message);

      if (isEmailConfirmationIssue) {
        setNoticeMessage("Please confirm your email address before signing in.");
        setResendEmail(cleanEmail);
        setShowResendModal(true);
      }

      setErrorMessage(message);
      if (!isEmailConfirmationIssue) {
        dialog.alert({
          title: "Could not sign you in",
          message: "Check your email address and password, then try again.",
          tone: "danger",
          icon: "lock-outline",
          confirmLabel: "Try again",
        });
      }
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}> 
      <View
        style={[
          styles.backgroundOrbTop,
          { backgroundColor: isDark ? colors.primary : "#CFE6DC", opacity: isDark ? 0.25 : 0.75 },
        ]}
      />
      <View
        style={[
          styles.backgroundOrbBottom,
          { backgroundColor: isDark ? "#2F5A4D" : "#B9D5C9", opacity: isDark ? 0.2 : 0.65 },
        ]}
      />

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.content}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.brand, { color: colors.primary }]}>SNOOKERLAB</Text>
            <Text style={[styles.title, { color: colors.text }]}>Welcome back</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Track practice, matches and progress with pro-level clarity.</Text>

            {noticeMessage ? <Text style={[styles.noticeText, { color: colors.primary }]}>{noticeMessage}</Text> : null}
            {errorMessage ? <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text> : null}

            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Email"
              placeholderTextColor={colors.textMuted}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              returnKeyType="next"
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
              placeholder="Password"
              placeholderTextColor={colors.textMuted}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <AppButton label="Sign In" onPress={handleLogin} loading={isLoading} />

            <View style={styles.helpRow}>
              <Pressable style={styles.helpLink} onPress={openResendModal}>
                <Text style={[styles.forgotLinkText, { color: colors.primary }]}>Resend confirmation email</Text>
              </Pressable>
              <Pressable style={styles.helpLink} onPress={() => navigation.navigate("ForgotPassword")}>
                <Text style={[styles.forgotLinkText, { color: colors.primary }]}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable onPress={() => navigation.navigate("Register")}>
              <Text style={[styles.switchText, { color: colors.textMuted }]}>New here? <Text style={[styles.switchTextStrong, { color: colors.primary }]}>Create an account</Text></Text>
            </Pressable>

            <Text style={[styles.footnote, { color: colors.textMuted }]}>Private by design. Your data stays tied to your account only.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showResendModal} animationType="fade" transparent onRequestClose={() => setShowResendModal(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowResendModal(false)} accessibilityLabel="Close">
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => null}
            accessibilityViewIsModal
          >
            <View style={[styles.modalAccentBar, { backgroundColor: colors.primary }]} />

            <View style={styles.modalBody}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Resend the confirmation email</Text>
              <Text style={[styles.modalSubtitle, { color: colors.textMuted }]}>
                Give us your email address and a fresh verification link is on its way.
              </Text>

              {resendError ? <Text style={[styles.errorText, { color: colors.danger }]}>{resendError}</Text> : null}

              <TextInput
                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                placeholder="Email"
                placeholderTextColor={colors.textMuted}
                value={resendEmail}
                onChangeText={setResendEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoCorrect={false}
                returnKeyType="done"
                accessibilityLabel="Email address"
                onSubmitEditing={handleResendFromModal}
              />

              <Pressable
                onPress={handleResendFromModal}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityLabel="Send the confirmation email"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                style={({ pressed }) => [
                  styles.modalConfirm,
                  { backgroundColor: colors.primary, opacity: isLoading ? 0.65 : pressed ? 0.85 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.modalConfirmText, { color: colors.onPrimary }]}>Send confirmation email</Text>
                )}
              </Pressable>

              <Pressable
                onPress={() => setShowResendModal(false)}
                accessibilityRole="button"
                accessibilityLabel="Cancel"
                style={styles.modalCancel}
              >
                <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 20,
  },
  backgroundOrbTop: {
    position: "absolute",
    top: -80,
    right: -60,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  backgroundOrbBottom: {
    position: "absolute",
    bottom: -100,
    left: -50,
    width: 260,
    height: 260,
    borderRadius: 130,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
  },
  brand: {
    fontSize: 12,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: "uppercase",
    fontWeight: "800",
  },
  title: {
    fontSize: 31,
    fontWeight: "800",
  },
  subtitle: {
    marginTop: 6,
    marginBottom: 16,
    fontSize: 14,
    lineHeight: 20,
  },
  errorText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  noticeText: {
    marginBottom: 10,
    fontSize: 13,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    paddingVertical: 13,
    paddingHorizontal: 14,
    marginBottom: 12,
    borderRadius: 12,
    fontSize: 16,
  },
  helpRow: {
    marginTop: 12,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  helpLink: {
    paddingVertical: 2,
  },
  forgotLinkText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
  },
  modalAccentBar: {
    height: 4,
  },
  modalBody: {
    padding: SPACING.xl,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },
  modalSubtitle: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.lg,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  modalConfirm: {
    minHeight: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  modalConfirmText: {
    fontSize: 15,
    fontWeight: "800",
  },
  modalCancel: {
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  modalCancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  switchText: {
    textAlign: "center",
    fontSize: 14,
  },
  switchTextStrong: {
    fontWeight: "700",
  },
  footnote: {
    marginTop: 14,
    textAlign: "center",
    fontSize: 12,
  },
});
