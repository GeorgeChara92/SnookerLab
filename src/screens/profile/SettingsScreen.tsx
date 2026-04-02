import React from "react";
import { Alert, View, StyleSheet, Text } from "react-native";
import { useNavigation, type NavigationProp } from "@react-navigation/native";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";
import { useSubscriptionAccess } from "../../hooks/useSubscriptionAccess";
import type { ProfileStackParamList } from "../../types";
import { isBillingConfigured, presentCustomerCenter } from "../../services/billing";

export const SettingsScreen = () => {
  const navigation = useNavigation<NavigationProp<ProfileStackParamList>>();
  const { colors } = useAppTheme();
  const subscription = useSubscriptionAccess();

  const openCustomerCenter = async () => {
    if (!isBillingConfigured()) {
      Alert.alert("Billing not configured", "RevenueCat keys are missing for this build.");
      return;
    }

    try {
      await presentCustomerCenter();
    } catch (error: any) {
      Alert.alert(
        "Customer Center unavailable",
        typeof error?.message === "string" ? error.message : "Could not open Customer Center."
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

      <AppCard>
        <Text style={[styles.label, { color: colors.text }]}>Membership</Text>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>Current plan: {subscription.tierLabel}. Billing cycle resets monthly on your renewal anchor date.</Text>
        <AppButton label="View Tier Benefits" onPress={() => navigation.navigate("SubscriptionPlans")} />
        <View style={styles.spacerSmall} />
        <AppButton label="Manage Subscription" variant="secondary" onPress={openCustomerCenter} />
      </AppCard>

      <View style={styles.spacer} />

      <AppCard>
        <Text style={[styles.label, { color: colors.text }]}>Local Data</Text>
        <Text style={[styles.placeholder, { color: colors.textMuted }]}>Reset local cached data if the app gets out of sync.</Text>
        <AppButton
          label="Clear Local Data"
          variant="secondary"
          onPress={() => Alert.alert("Coming soon", "Data reset controls will be available soon.")}
        />
      </AppCard>

    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 28, fontWeight: "800", marginBottom: 14 },
  label: { fontSize: 16, fontWeight: "700", marginBottom: 6 },
  placeholder: { fontSize: 14, marginBottom: 14, lineHeight: 20 },
  spacer: { height: 12 },
  spacerSmall: { height: 8 },
});
