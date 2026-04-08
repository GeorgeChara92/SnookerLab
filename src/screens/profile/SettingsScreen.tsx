import React, { useState } from "react";
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { useNavigation, useNavigationState, type NavigationProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { CodeConfirmModal } from "../../components/ui/CodeConfirmModal";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import { useAuthStore } from "../../store";
import type { ProfileStackParamList, RootStackParamList } from "../../types";
import { isBillingConfigured, openNativeSubscriptionSettings, presentCustomerCenter } from "../../services/billing";
import { getAuthEmailActionErrorMessage } from "../../utils/authErrors";

const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://snooker-lab.vercel.app/privacy";
const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? "https://snooker-lab.vercel.app/terms";
const SUPPORT_EMAIL = process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? "support@snookerlab.app";

const createChallenge = () => Math.random().toString(36).toUpperCase().slice(2, 8);

type SettingsRowProps = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  value?: string;
  onPress: () => void;
  danger?: boolean;
  chevron?: boolean;
};

const SettingsRow: React.FC<SettingsRowProps & { colors: any }> = ({ icon, label, value, onPress, danger, chevron = true, colors }) => (
  <Pressable
    style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.surfaceMuted : "transparent" }]}
    onPress={onPress}
  >
    <View style={[styles.rowIcon, { backgroundColor: danger ? colors.danger + "15" : colors.primary + "10" }]}>
      <MaterialCommunityIcons name={icon} size={20} color={danger ? colors.danger : colors.primary} />
    </View>
    <View style={styles.rowContent}>
      <Text style={[styles.rowLabel, { color: danger ? colors.danger : colors.text }]}>{label}</Text>
      {value && <Text style={[styles.rowValue, { color: colors.textMuted }]}>{value}</Text>}
    </View>
    {chevron && <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textMuted} />}
  </Pressable>
);

const SettingsSection: React.FC<{ title: string; children: React.ReactNode; colors: any }> = ({ title, children, colors }) => (
  <View style={styles.section}>
    <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{title}</Text>
    <View style={[styles.sectionContent, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {children}
    </View>
  </View>
);

export const SettingsScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp<ProfileStackParamList & RootStackParamList>>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();
  const { user, resetPassword, resendEmailVerification, deleteAccount, resetProfile, isLoading } = useAuthStore();
  
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetCode, setResetCode] = useState("");
  const [resetCodeInput, setResetCodeInput] = useState("");
  
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteCode, setDeleteCode] = useState("");
  const [deleteCodeInput, setDeleteCodeInput] = useState("");

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

  // Reset Profile Flow
  const startResetFlow = () => {
    setResetCode(createChallenge());
    setResetCodeInput("");
    setShowResetModal(true);
  };

  const handleResetFromModal = () => {
    setShowResetModal(false);
    setShowResetConfirm(true);
  };

  const confirmResetProfile = async () => {
    try {
      await resetProfile();
      setShowResetConfirm(false);
      // Reset navigation stack to Main tab
      navigation.reset({
        index: 0,
        routes: [{ name: "Main" }],
      });
    } catch (error: any) {
      Alert.alert("Reset failed", error?.message ?? "Could not reset profile. Please try again.");
    }
  };

  // Delete Account Flow
  const startDeleteFlow = () => {
    setDeleteCode(createChallenge());
    setDeleteCodeInput("");
    setShowDeleteModal(true);
  };

  const handleDeleteFromModal = () => {
    setShowDeleteModal(false);
    setShowDeleteConfirm(true);
  };

  const confirmDeleteAccount = async () => {
    try {
      await deleteAccount();
      setShowDeleteConfirm(false);
    } catch (error: any) {
      Alert.alert("Delete failed", error?.message ?? "Could not delete account. Please try again.");
    }
  };

  const matchesUsed = subscription.usage.matches;
  const matchesLimit = subscription.limits.matchesPerPeriod;
  const aiUsed = subscription.usage.aiAnalyses;
  const aiLimit = subscription.limits.aiAnalysesPerPeriod;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 110 : 90}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

        {/* Subscription Section */}
        <AppCard style={styles.subscriptionCard}>
          <View style={styles.planHeader}>
            <View style={styles.planInfo}>
              <Text style={[styles.planLabel, { color: colors.textMuted }]}>Current Plan</Text>
              <Text style={[styles.planName, { color: colors.text }]}>{subscription.tierLabel}</Text>
            </View>
            {subscription.tier !== "free" && (
              <View style={[styles.planBadge, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
                <MaterialCommunityIcons name="crown" size={14} color={colors.primary} />
                <Text style={[styles.planBadgeText, { color: colors.primary }]}>PRO</Text>
              </View>
            )}
          </View>

          {/* Usage Metrics */}
          <View style={styles.usageSection}>
            <View style={styles.usageRow}>
              <View style={styles.usageItem}>
                <Text style={[styles.usageLabel, { color: colors.textMuted }]}>Matches</Text>
                <Text style={[styles.usageValue, { color: colors.text }]}>
                  {matchesUsed}{matchesLimit !== null ? ` / ${matchesLimit}` : ""}
                </Text>
                {matchesLimit !== null && (
                  <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          backgroundColor: (matchesUsed / matchesLimit) > 0.9 ? colors.danger : colors.primary,
                          width: `${Math.min(100, (matchesUsed / matchesLimit) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
              <View style={styles.usageItem}>
                <Text style={[styles.usageLabel, { color: colors.textMuted }]}>AI Analyses</Text>
                <Text style={[styles.usageValue, { color: colors.text }]}>
                  {aiUsed}{aiLimit !== null ? ` / ${aiLimit}` : ""}
                </Text>
                {aiLimit !== null && (
                  <View style={[styles.usageBar, { backgroundColor: colors.surfaceMuted }]}>
                    <View
                      style={[
                        styles.usageBarFill,
                        {
                          backgroundColor: (aiUsed / aiLimit) > 0.9 ? colors.danger : colors.primary,
                          width: `${Math.min(100, (aiUsed / aiLimit) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                )}
              </View>
            </View>
            {subscription.tier === "free" && (
              <Text style={[styles.upgradeHint, { color: colors.textMuted }]}>
                Upgrade for unlimited matches and more features
              </Text>
            )}
          </View>

          <View style={styles.subscriptionActions}>
            <AppButton
              label="View Plans"
              onPress={() => navigation.navigate("SubscriptionPlans")}
            />
            {subscription.tier !== "free" && (
              <AppButton
                label="Manage"
                variant="secondary"
                onPress={openCustomerCenter}
              />
            )}
          </View>
        </AppCard>

        {/* Account Section */}
        <SettingsSection title="ACCOUNT" colors={colors}>
          <SettingsRow
            icon="email"
            label="Email"
            value={user?.email ?? "Not available"}
            onPress={() => {}}
            chevron={false}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="lock"
            label="Reset Password"
            onPress={handlePasswordReset}
            colors={colors}
          />
        </SettingsSection>

        {/* Support Section */}
        <SettingsSection title="SUPPORT & POLICIES" colors={colors}>
          <SettingsRow
            icon="shield-check"
            label="Privacy Policy"
            onPress={() => void openUrl(PRIVACY_URL, "Privacy Policy")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="file-document"
            label="Terms of Use"
            onPress={() => void openUrl(TERMS_URL, "Terms of Use")}
            colors={colors}
          />
          <View style={[styles.rowDivider, { backgroundColor: colors.border }]} />
          <SettingsRow
            icon="help-circle"
            label="Contact Support"
            onPress={() => void openSupportEmail()}
            colors={colors}
          />
        </SettingsSection>

        {/* Danger Zone */}
        <SettingsSection title="DATA MANAGEMENT" colors={colors}>
          <SettingsRow
            icon="refresh"
            label="Reset Profile"
            onPress={startResetFlow}
            colors={colors}
          />
        </SettingsSection>

        <SettingsSection title="DANGER ZONE" colors={colors}>
          <SettingsRow
            icon="account-remove"
            label="Delete Account"
            onPress={startDeleteFlow}
            danger
            colors={colors}
          />
        </SettingsSection>

        <Text style={[styles.footerText, { color: colors.textMuted }]}>
          SnookerLab v1.0.0
        </Text>

        <View style={{ height: Math.max(80, insets.bottom + 40) }} />
      </ScrollView>

      {/* Reset Profile Initial Modal */}
      <ConfirmModal
        visible={showResetModal}
        title="Reset Profile?"
        message="This will delete all your matches, practice sessions, and progress. Your account and login will remain unchanged."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        icon="refresh"
        onConfirm={handleResetFromModal}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Reset Profile Code Confirmation */}
      <CodeConfirmModal
        visible={showResetConfirm}
        title="Confirm Reset"
        message="Type the code below to permanently reset your profile data."
        code={resetCode}
        confirmLabel="Reset Profile"
        cancelLabel="Cancel"
        icon="alert-circle"
        danger
        loading={isLoading}
        onCodeChange={setResetCodeInput}
        onConfirm={confirmResetProfile}
        onCancel={() => setShowResetConfirm(false)}
      />

      {/* Delete Account Initial Modal */}
      <ConfirmModal
        visible={showDeleteModal}
        title="Delete Account?"
        message="This will permanently remove your account and all associated data. This action cannot be undone."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        icon="account-remove"
        danger
        onConfirm={handleDeleteFromModal}
        onCancel={() => setShowDeleteModal(false)}
      />

      {/* Delete Account Code Confirmation */}
      <CodeConfirmModal
        visible={showDeleteConfirm}
        title="Delete Account"
        message="Type the code below to permanently delete your account."
        code={deleteCode}
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        icon="alert"
        danger
        loading={isLoading}
        onCodeChange={setDeleteCodeInput}
        onConfirm={confirmDeleteAccount}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 28 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 20 },

  // Subscription Card
  subscriptionCard: { marginBottom: 20 },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  planInfo: { flex: 1 },
  planLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  planName: { fontSize: 22, fontWeight: "800" },
  planBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1 },
  planBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  usageSection: { marginBottom: 16 },
  usageRow: { flexDirection: "row", gap: 20 },
  usageItem: { flex: 1 },
  usageLabel: { fontSize: 12, marginBottom: 4 },
  usageValue: { fontSize: 18, fontWeight: "700", marginBottom: 6 },
  usageBar: { height: 6, borderRadius: 3, overflow: "hidden" },
  usageBarFill: { height: "100%", borderRadius: 3 },
  upgradeHint: { fontSize: 12, marginTop: 12, textAlign: "center" },
  subscriptionActions: { flexDirection: "row", gap: 10, marginTop: 4 },

  // Settings Sections
  section: { marginBottom: 20 },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 1, marginBottom: 8, marginLeft: 4 },
  sectionContent: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },

  // Settings Rows
  row: { flexDirection: "row", alignItems: "center", padding: 14 },
  rowIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginRight: 12 },
  rowContent: { flex: 1 },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  rowValue: { fontSize: 13, marginTop: 2 },
  rowDivider: { height: 1, marginHorizontal: 14 },

  footerText: { fontSize: 12, textAlign: "center", marginTop: 20 },
});