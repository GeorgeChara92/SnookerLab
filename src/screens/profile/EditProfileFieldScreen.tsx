import React, { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { COUNTRIES, getCountryByCode, SKILL_LEVELS, CUE_PREFERENCES } from "../../constants/profileOptions";
import type { ProfileStackParamList, SkillLevel } from "../../types";

type FieldRoute = RouteProp<ProfileStackParamList, "EditProfileField">;

const FIELD_CONFIG: Record<string, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; type: "skill" | "country" | "cue" }> = {
  skill_level: { label: "Skill Level", icon: "star-outline", type: "skill" },
  country_code: { label: "Country", icon: "flag-outline", type: "country" },
  cue_preference: { label: "Cue Preference", icon: "golf-tee", type: "cue" },
};

export const EditProfileFieldScreen = () => {
  const route = useRoute<FieldRoute>();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const { user, updateProfile } = useAuthStore();

  const field = route.params.field;
  const config = FIELD_CONFIG[field];

  const currentValue = user?.[field as keyof typeof user] ?? "";
  const [selectedValue, setSelectedValue] = useState<string>(currentValue?.toString() ?? "");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const filteredCountries = searchQuery
    ? COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : COUNTRIES;

  const handleSave = async () => {
    if (!selectedValue) {
      Alert.alert("Required", "Please select a value.");
      return;
    }

    setIsSaving(true);
    try {
      if (field === "skill_level") {
        await updateProfile({ skill_level: selectedValue as SkillLevel });
      } else if (field === "country_code") {
        await updateProfile({ country_code: selectedValue });
      } else if (field === "cue_preference") {
        await updateProfile({ cue_preference: selectedValue });
      }
      navigation.goBack();
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Failed to update profile.");
    } finally {
      setIsSaving(false);
    }
  };

  if (!config) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ color: colors.text }}>Invalid field</Text>
      </View>
    );
  }

  const renderContent = () => {
    if (config.type === "skill") {
      return (
        <View style={styles.optionsList}>
          {SKILL_LEVELS.map((option) => {
            const isSelected = selectedValue === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.optionItem, { backgroundColor: isSelected ? colors.primary + "15" : colors.surface, borderColor: isSelected ? colors.primary : colors.border }]}
                onPress={() => setSelectedValue(option.value)}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, { color: isSelected ? colors.primary : colors.text }]}>{option.label}</Text>
                </View>
                {isSelected && <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      );
    }

    if (config.type === "cue") {
      return (
        <View style={styles.optionsList}>
          {CUE_PREFERENCES.map((option) => {
            const isSelected = selectedValue === option.value;
            return (
              <Pressable
                key={option.value}
                style={[styles.optionItem, { backgroundColor: isSelected ? colors.primary + "15" : colors.surface, borderColor: isSelected ? colors.primary : colors.border }]}
                onPress={() => setSelectedValue(option.value)}
              >
                <View style={styles.optionContent}>
                  <Text style={[styles.optionLabel, { color: isSelected ? colors.primary : colors.text }]}>{option.label}</Text>
                </View>
                {isSelected && <MaterialCommunityIcons name="check-circle" size={22} color={colors.primary} />}
              </Pressable>
            );
          })}
        </View>
      );
    }

    const selectedCountry = getCountryByCode(selectedValue);

    return (
      <View style={styles.countryContainer}>
        <View style={[styles.searchInput, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.textMuted} />
          <TextInput
            style={[styles.searchText, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search countries..."
            placeholderTextColor={colors.textMuted}
          />
          {searchQuery ? (
            <Pressable onPress={() => setSearchQuery("")}>
              <MaterialCommunityIcons name="close-circle" size={20} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {selectedCountry && !searchQuery && (
          <View style={[styles.selectedCountry, { backgroundColor: colors.primary + "15", borderColor: colors.primary }]}>
            <Text style={styles.countryEmoji}>{selectedCountry.emoji}</Text>
            <Text style={[styles.countryName, { color: colors.text }]}>{selectedCountry.name}</Text>
            <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />
          </View>
        )}

        <FlatList
          data={filteredCountries}
          keyExtractor={(item) => item.code}
          style={styles.countryList}
          contentContainerStyle={styles.countryListContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const isSelected = selectedValue === item.code;
            return (
              <Pressable
                style={[styles.countryItem, { backgroundColor: isSelected ? colors.primary + "10" : colors.surface, borderColor: colors.border }]}
                onPress={() => {
                  setSelectedValue(item.code);
                  setSearchQuery("");
                }}
              >
                <Text style={styles.countryEmoji}>{item.emoji}</Text>
                <Text style={[styles.countryName, { color: colors.text }]}>{item.name}</Text>
                {isSelected && <MaterialCommunityIcons name="check-circle" size={20} color={colors.primary} />}
              </Pressable>
            );
          }}
        />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <AppCard style={styles.headerCard}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name={config.icon} size={32} color={colors.primary} />
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{config.label}</Text>
        <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
          {field === "skill_level" && "Your skill level helps match you with similar players in global leaderboards."}
          {field === "country_code" && "Represent your country in worldwide rankings and challenges."}
          {field === "cue_preference" && "Your preferred cue type for match recording and recommendations."}
        </Text>
      </AppCard>

      {renderContent()}

      <View style={styles.footer}>
        <AppButton label={isSaving ? "Saving..." : "Save"} onPress={handleSave} disabled={isSaving || !selectedValue} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerCard: { alignItems: "center", margin: 16, marginBottom: 8 },
  headerIcon: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", marginBottom: 4 },
  headerSubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },
  optionsList: { padding: 16, gap: 10 },
  optionItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 12, borderWidth: 1.5, padding: 14 },
  optionContent: { flex: 1 },
  optionLabel: { fontSize: 15, fontWeight: "600" },
  footer: { padding: 16, paddingTop: 8 },

  // Country styles
  countryContainer: { flex: 1, padding: 16, paddingTop: 8 },
  searchInput: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, paddingVertical: 10, marginBottom: 8 },
  searchText: { flex: 1, marginLeft: 8, fontSize: 16 },
  selectedCountry: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1.5, gap: 10, marginBottom: 8 },
  countryList: { flex: 1 },
  countryListContent: { paddingBottom: 16 },
  countryItem: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 10, borderWidth: 1, gap: 10, marginBottom: 6 },
  countryEmoji: { fontSize: 24 },
  countryName: { flex: 1, fontSize: 15, fontWeight: "500" },
});