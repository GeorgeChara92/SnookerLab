import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useAuthStore } from "../../store";
import type { AuthStackParamList } from "../../types";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AuthBanner, AuthShell } from "../../components/auth/AuthShell";
import { AuthField } from "../../components/auth/AuthField";
import { getAuthEmailActionErrorMessage, getAuthErrorMessage } from "../../utils/authErrors";
import { HIT_TARGET, RADIUS, SCRIM, SPACING } from "../../constants";

type Props = NativeStackScreenProps<AuthStackParamList, "Login">;

const looksLikeEmail = (value: string) => /^\S+@\S+\.\S+$/.test(value);

export const LoginScreen = ({ navigation, route }: Props) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [problem, setProblem] = useState<{ field?: "email" | "password"; message: string } | null>(null);
  const [notice, setNotice] = useState("");
  const [showResend, setShowResend] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resendError, setResendError] = useState("");
  const { signIn, resendEmailVerification, isLoading } = useAuthStore();
  const { colors } = useAppTheme();
  const passwordRef = useRef<TextInput>(null);

  useEffect(() => {
    const params = route.params;
    if (params?.prefillEmail) setEmail(params.prefillEmail);
    if (params?.notice) setNotice(params.notice);
  }, [route.params]);

  const openResend = () => {
    setResendEmail(email.trim());
    setResendError("");
    setShowResend(true);
  };

  const sendConfirmation = async () => {
    const cleanEmail = resendEmail.trim();
    if (!looksLikeEmail(cleanEmail)) {
      setResendError("Enter the email address you signed up with.");
      return;
    }
    setResendError("");
    try {
      await resendEmailVerification(cleanEmail);
      setShowResend(false);
      setEmail(cleanEmail);
      setProblem(null);
      setNotice(`Confirmation email sent to ${cleanEmail}. Check your inbox, and your spam folder too.`);
    } catch (error: any) {
      setResendError(getAuthEmailActionErrorMessage(error));
    }
  };

  const handleSignIn = async () => {
    const cleanEmail = email.trim();
    if (!looksLikeEmail(cleanEmail)) {
      setProblem({ field: "email", message: "Enter the email address you signed up with." });
      return;
    }
    if (password.length < 6) {
      setProblem({ field: "password", message: "Passwords are at least 6 characters." });
      passwordRef.current?.focus();
      return;
    }

    setProblem(null);
    try {
      await signIn(cleanEmail, password);
    } catch (error: any) {
      const message = getAuthErrorMessage(error, "sign-in");
      setProblem({ message });
      // Not confirmed yet: offer to send the link again straight away.
      if (/confirm|verif/i.test(error?.message ?? "")) {
        setResendEmail(cleanEmail);
        setShowResend(true);
      }
    }
  };

  return (
    <AuthShell strapline="YOUR GAME, FRAME BY FRAME" title="Welcome back" subtitle="Sign in to pick up where you left off.">
      {notice && !problem ? <AuthBanner tone="info" message={notice} /> : null}
      {problem ? <AuthBanner tone="danger" message={problem.message} /> : null}

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
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        invalid={problem?.field === "email"}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        icon="lock-outline"
        value={password}
        onChangeText={setPassword}
        revealable
        textContentType="password"
        autoComplete="current-password"
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
        invalid={problem?.field === "password"}
      />
      <Pressable
        onPress={() => navigation.navigate("ForgotPassword")}
        accessibilityRole="button"
        hitSlop={8}
        style={styles.forgot}
      >
        <Text style={[styles.link, { color: colors.primary }]}>Forgot password?</Text>
      </Pressable>

      <AppButton label="Sign in" onPress={handleSignIn} loading={isLoading} />

      <View style={styles.dividerRow}>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.textMuted }]}>New to Snooker Lab?</Text>
        <View style={[styles.rule, { backgroundColor: colors.border }]} />
      </View>

      <AppButton label="Create an account" variant="secondary" onPress={() => navigation.navigate("Register")} />

      <Pressable onPress={openResend} accessibilityRole="button" style={styles.resend}>
        <Text style={[styles.quiet, { color: colors.textMuted }]}>
          Didn't get your confirmation email? <Text style={[styles.link, { color: colors.primary }]}>Send it again</Text>
        </Text>
      </Pressable>

      {/* ------------------------------------------------ resend the confirmation */}
      <Modal visible={showResend} animationType="fade" transparent onRequestClose={() => setShowResend(false)}>
        <Pressable style={styles.backdrop} onPress={() => setShowResend(false)} accessibilityLabel="Close">
          <Pressable
            style={[styles.sheet, { backgroundColor: colors.background, borderColor: colors.border }]}
            onPress={() => null}
            accessibilityViewIsModal
          >
            <View style={[styles.sheetBar, { backgroundColor: colors.primary }]} />
            <View style={styles.sheetBody}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>Send the confirmation email again</Text>
              <Text style={[styles.sheetText, { color: colors.textMuted }]}>
                We will send a fresh link to confirm your address. It can take a minute to arrive.
              </Text>

              <AuthField
                label="Email"
                icon="email-outline"
                value={resendEmail}
                onChangeText={setResendEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="send"
                onSubmitEditing={sendConfirmation}
                invalid={!!resendError}
                hint={resendError || undefined}
              />

              <Pressable
                onPress={sendConfirmation}
                disabled={isLoading}
                accessibilityRole="button"
                accessibilityState={{ disabled: isLoading, busy: isLoading }}
                style={({ pressed }) => [
                  styles.sheetButton,
                  { backgroundColor: colors.primary, opacity: isLoading ? 0.65 : pressed ? 0.85 : 1 },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.sheetButtonText, { color: colors.onPrimary }]}>Send confirmation email</Text>
                )}
              </Pressable>
              <Pressable onPress={() => setShowResend(false)} accessibilityRole="button" style={styles.sheetCancel}>
                <Text style={[styles.quiet, { color: colors.textMuted }]}>Cancel</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </AuthShell>
  );
};

const styles = StyleSheet.create({
  forgot: { alignSelf: "flex-end", marginTop: -SPACING.xs, marginBottom: SPACING.lg },
  link: { fontSize: 14, fontWeight: "700" },
  quiet: { fontSize: 14, textAlign: "center", lineHeight: 20 },

  dividerRow: { flexDirection: "row", alignItems: "center", gap: SPACING.md, marginVertical: SPACING.xl },
  rule: { flex: 1, height: StyleSheet.hairlineWidth },
  dividerText: { fontSize: 13, fontWeight: "600" },

  resend: { marginTop: SPACING.xl, minHeight: HIT_TARGET, justifyContent: "center" },

  backdrop: { flex: 1, backgroundColor: SCRIM, justifyContent: "center", paddingHorizontal: SPACING.lg },
  sheet: { borderWidth: 1, borderRadius: RADIUS.xl, overflow: "hidden" },
  sheetBar: { height: 4 },
  sheetBody: { padding: SPACING.xl },
  sheetTitle: { fontSize: 19, fontWeight: "800" },
  sheetText: { fontSize: 14, lineHeight: 20, marginTop: SPACING.xs, marginBottom: SPACING.lg },
  sheetButton: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.xs,
  },
  sheetButtonText: { fontSize: 16, fontWeight: "800" },
  sheetCancel: { minHeight: HIT_TARGET, alignItems: "center", justifyContent: "center", marginTop: SPACING.xs },
});
