import React, { useRef, useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAuthStore } from "../../store";
import type { ProfileStackParamList } from "../../types";
import { isBillingConfigured, openNativeSubscriptionSettings, presentCustomerCenter } from "../../services/billing";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snooker-lab.vercel.app/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snooker-lab.vercel.app/terms";
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@snookerlab.app";

const createDeleteChallenge = () => Math.random().toString(36).toUpperCase().slice(2, 8);

export const SettingsScreen = () => {
  const scrollRef = useRef<ScrollView>(null);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ProfileStackParamList>>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { user, resetPassword, resendEmailVerification, deleteAccount, isLoading } = useAuthStore();
  const [deleteChallenge, setDeleteChallenge] = useState("");
  const [deleteInput, setDeleteInput] = useState("");

  const openCustomerCenter = async () => {
    if (!isBillingConfigured()) {
      Alert.alert("Subscription unavailable", "Subscription management is not available in this build.");
      return;
    }

    try {
      await presentCustomerCenter();
    } catch (error: any) {
      Alert.alert("Subscription settings unavailable", typeof error?.message === "string" ? error.message : "Could not open subscription settings.", [
        { text: "Close", style: "cancel" },
        {
          text: "Open Store Subscriptions",
          onPress: () => {
            void openNativeSubscriptionSettings().catch(() => {
              Alert.alert("Unavailable", "Could not open store subscription settings.");
            });
          },
        },
      ]);
    }
  };

  const handlePasswordReset = async () => {
    const email = user?.email?.trim();
    if (!email) {
      Alert.alert("Email missing", "No account email is available for this profile.");
      return;
    }

    try {
      await resetPassword(email);
      Alert.alert("Check your inbox", "Password reset instructions were sent to your email.");
    } catch (error: any) {
      Alert.alert("Could not send reset", getAuthEmailActionErrorMessage(error));
    }
  };

  const handleResendVerification = async () => {
    const email = user?.email?.trim();
    if (!email) {
      Alert.alert("Email missing", "No account email is available for this profile.");
      return;
    }

    try {
      await resendEmailVerification(email);
      Alert.alert("Email sent", "A new verification email has been sent.");
    } catch (error: any) {
      Alert.alert("Could not send email", getAuthEmailActionErrorMessage(error));
    }
  };

  const openUrl = async (url: string, label: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", `Could not open ${label}.`);
    }
  };

  const openSupportEmail = async () => {
    const url = `mailto:${SUPPORT_EMAIL}?subject=SnookerLab%20Account%20Support`;
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) throw new Error("Cannot open URL");
      await Linking.openURL(url);
    } catch {
      Alert.alert("Unavailable", "Could not open your email app.");
    }
  };

  const startDeleteFlow = () => {
    const challenge = createDeleteChallenge();
    setDeleteChallenge(challenge);
    setDeleteInput("");
  };

  const confirmDeleteAccount = async () => {
    if (!deleteChallenge || deleteInput.trim().toUpperCase() !== deleteChallenge) {
      Alert.alert("Confirmation mismatch", "Type the exact confirmation code to delete your account.");
      return;
    }

    Alert.alert("Delete account permanently?", "This cannot be undone. All account data will be removed.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          void deleteAccount()
            .then(() => {
              Alert.alert("Account deleted", "Your account and data have been permanently removed.");
            })
            .catch((error: any) => {
              Alert.alert("Delete failed", error?.message ?? "Could not delete account. Please try again.");
            });
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 90}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.title, { color: colors.text }]}>Account Settings</Text>

      <AppCard>
        <Text style={[styles.label, { color: colors.text }]}>Membership</Text>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>Current plan: {subscription.tierLabel}. Your usage resets monthly on your renewal anchor date.</Text>
        <AppButton label="View Tier Benefits" onPress={() => navigation.navigate("SubscriptionPlans")} />
        <View style={styles.spacerSmall} />
        <AppButton label="Manage Subscription" variant="secondary" onPress={openCustomerCenter} />
      </AppCard>

      <View style={styles.spacer} />

      <AppCard>
        <Text style={[styles.label, { color: colors.text }]}>Security</Text>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>Email: {user?.email ?? "Not available"}</Text>
        <AppButton label="Reset Password" onPress={handlePasswordReset} loading={isLoading} />
        <View style={styles.spacerSmall} />
        <AppButton label="Resend Verification Email" variant="secondary" onPress={handleResendVerification} loading={isLoading} />
      </AppCard>

      <View style={styles.spacer} />

      <AppCard>
        <Text style={[styles.label, { color: colors.text }]}>Policies & Support</Text>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>Required account and privacy controls for Android and iOS store compliance.</Text>
        <AppButton label="Privacy Policy" variant="secondary" onPress={() => void openUrl(PRIVACY_URL, "Privacy Policy")} />
        <View style={styles.spacerSmall} />
        <AppButton label="Terms of Use" variant="secondary" onPress={() => void openUrl(TERMS_URL, "Terms of Use")} />
        <View style={styles.spacerSmall} />
        <AppButton label="Contact Support" variant="secondary" onPress={() => void openSupportEmail()} />
      </AppCard>

      <View style={styles.spacer} />

        <AppCard>
          <Text style={[styles.label, { color: colors.text }]}>Account Deletion</Text>
          <Text style={[styles.placeholder, { color: colors.textMuted }]}>Delete your account directly in-app. This permanently removes your account and associated data.</Text>
          {deleteChallenge ? (
            <>
              <Text style={[styles.confirmLabel, { color: colors.textMuted }]}>Type this code to confirm deletion:</Text>
              <Text style={[styles.confirmCode, { color: colors.danger }]}>{deleteChallenge}</Text>
              <TextInput
                style={[styles.confirmInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                placeholder="Enter confirmation code"
                placeholderTextColor={colors.textMuted}
                value={deleteInput}
                onChangeText={setDeleteInput}
                autoCapitalize="characters"
                autoCorrect={false}
                onFocus={() => {
                  setTimeout(() => {
                    scrollRef.current?.scrollToEnd({ animated: true });
                  }, 120);
                }}
              />
              <AppButton label="Delete Account Permanently" variant="danger" onPress={confirmDeleteAccount} loading={isLoading} />
              <View style={styles.spacerSmall} />
              <AppButton
                label="Cancel"
                variant="secondary"
                onPress={() => {
                  setDeleteChallenge("");
                  setDeleteInput("");
                }}
              />
            </>
          ) : (
            <AppButton label="Start Account Deletion" variant="danger" onPress={startDeleteFlow} />
          )}
        </AppCard>
        <View style={{ height: Math.max(120, insets.bottom + 80) }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 14 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  placeholder: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  confirmLabel: { fontSize: 13, marginBottom: 6 },
  confirmCode: { fontSize: 20, fontWeight: "800", letterSpacing: 1.6, marginBottom: 10 },
  confirmInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    fontSize: 15,
  },
  spacer: { height: 12 },
  spacerSmall: { height: 8 },
});
