import React from "react";
import { Alert, View, StyleSheet, Text } from "react-native";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { useAppTheme } from "../../hooks/useAppTheme";

export const SettingsScreen = () => {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}> 
      <Text style={[styles.title, { color: colors.text }]}>Settings</Text>

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
});
