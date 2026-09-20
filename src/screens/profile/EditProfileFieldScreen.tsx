import React, { useLayoutEffect, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useRoute, useNavigation, type RouteProp } from "@react-navigation/native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAuthStore } from "../../store";
import { useAppTheme } from "../../hooks/useAppTheme";
import { AppButton } from "../../components/ui/AppButton";
import { AppCard } from "../../components/ui/AppCard";
import { useDialog } from "../../components/ui/DialogProvider";
import {
  COUNTRIES,
  getCountryByCode,
  SKILL_LEVELS,
  CUE_LENGTH_OPTIONS,
  CUE_FERRULE_OPTIONS,
  CUE_TIP_OPTIONS,
  CUE_WEIGHT_OPTIONS,
  buildCuePreferenceValue,
  getCuePreferenceLabel,
  parseCuePreferenceValue,
  type CueSetupSelection,
} from "../../constants/profileOptions";
import type { ProfileStackParamList, SkillLevel } from "../../types";
import { RADIUS, SCRIM, SPACING } from "../../constants";

type FieldRoute = RouteProp<ProfileStackParamList, "EditProfileField">;

const FIELD_CONFIG: Record<string, { label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; type: "skill" | "country" | "cue" }> = {
  skill_level: { label: "Skill Level", icon: "star-outline", type: "skill" },
  country_code: { label: "Country", icon: "flag-outline", type: "country" },
  cue_preference: { label: "Cue Setup", icon: "golf-tee", type: "cue" },
};

type CueFieldKey = keyof CueSetupSelection;

export const EditProfileFieldScreen = () => {
  const route = useRoute<FieldRoute>();
  const navigation = useNavigation();
  const { colors } = useAppTheme();
  const dialog = useDialog();
  const { user, updateProfile } = useAuthStore();

  const field = route.params.field;
  const config = FIELD_CONFIG[field];

  useLayoutEffect(() => {
    if (field !== "cue_preference") return;
    const rootNav = (navigation as any).getParent?.();
    rootNav?.setOptions?.({
      gestureEnabled: false,
      fullScreenGestureEnabled: false,
      presentation: "fullScreenModal",
    });
    return () => {
      rootNav?.setOptions?.({
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        presentation: "modal",
      });
    };
  }, [field, navigation]);

  const currentValue = user?.[field as keyof typeof user] ?? "";
  const [selectedValue, setSelectedValue] = useState<string>(currentValue?.toString() ?? "");
  const [cueSetup, setCueSetup] = useState<CueSetupSelection>(() => parseCuePreferenceValue(currentValue?.toString() ?? ""));
  const [activeCueField, setActiveCueField] = useState<CueFieldKey | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const cueFieldConfig: Record<CueFieldKey, { label: string; options: readonly string[]; format: (value: string) => string }> = {
    lengthIn: {
      label: "Length",
      options: CUE_LENGTH_OPTIONS,
      format: (value) => `${value} in`,
    },
    ferrule: {
      label: "Ferrule",
      options: CUE_FERRULE_OPTIONS,
      format: (value) => (value === "brass" ? "Brass" : "Titanium"),
    },
    tipMm: {
      label: "Tip",
      options: CUE_TIP_OPTIONS,
      format: (value) => `${value} mm`,
    },
    weightOz: {
      label: "Weight",
      options: CUE_WEIGHT_OPTIONS,
      format: (value) => `${value} oz`,
    },
  };

  const filteredCountries = searchQuery
    ? COUNTRIES.filter(
        (c) => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : COUNTRIES;

  const handleSave = async () => {
    if (!selectedValue) {
      dialog.alert({
        title: "Nothing selected yet",
        message: "Choose an option, then save.",
        icon: "cursor-default-click-outline",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (field === "skill_level") {
        await updateProfile({ skill_level: selectedValue as SkillLevel });
      } else if (field === "country_code") {
        await updateProfile({ country_code: selectedValue });
      } else if (field === "cue_preference") {
        await updateProfile({ cue_preference: buildCuePreferenceValue(cueSetup) });
      }
      navigation.goBack();
    } catch {
      dialog.alert({
        title: "Could not save your profile",
        message: "Your change was not saved. Check your connection and try again.",
        tone: "danger",
        icon: "alert-outline",
      });
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
      const cueSummary = getCuePreferenceLabel(buildCuePreferenceValue(cueSetup));
      return (
        <View style={styles.cueBuilderWrap}>
          <Text style={[styles.cueSummary, { color: colors.text }]}>{cueSummary}</Text>
          <View style={styles.cueRow}>
            <Pressable
              style={[styles.cueFieldButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setActiveCueField("lengthIn")}
            >
              <Text style={[styles.cueFieldLabel, { color: colors.textMuted }]}>Length</Text>
              <View style={styles.cueFieldValueRow}>
                <Text style={[styles.cueFieldValue, { color: colors.text }]}>{cueFieldConfig.lengthIn.format(cueSetup.lengthIn)}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
            <Pressable
              style={[styles.cueFieldButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setActiveCueField("ferrule")}
            >
              <Text style={[styles.cueFieldLabel, { color: colors.textMuted }]}>Ferrule</Text>
              <View style={styles.cueFieldValueRow}>
                <Text style={[styles.cueFieldValue, { color: colors.text }]}>{cueFieldConfig.ferrule.format(cueSetup.ferrule)}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>
          <View style={styles.cueRow}>
            <Pressable
              style={[styles.cueFieldButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setActiveCueField("tipMm")}
            >
              <Text style={[styles.cueFieldLabel, { color: colors.textMuted }]}>Tip</Text>
              <View style={styles.cueFieldValueRow}>
                <Text style={[styles.cueFieldValue, { color: colors.text }]}>{cueFieldConfig.tipMm.format(cueSetup.tipMm)}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
            <Pressable
              style={[styles.cueFieldButton, { borderColor: colors.border, backgroundColor: colors.surface }]}
              onPress={() => setActiveCueField("weightOz")}
            >
              <Text style={[styles.cueFieldLabel, { color: colors.textMuted }]}>Weight</Text>
              <View style={styles.cueFieldValueRow}>
                <Text style={[styles.cueFieldValue, { color: colors.text }]}>{cueFieldConfig.weightOz.format(cueSetup.weightOz)}</Text>
                <MaterialCommunityIcons name="chevron-down" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          </View>

          <Modal visible={activeCueField !== null} transparent animationType="fade" onRequestClose={() => setActiveCueField(null)}>
            <Pressable style={styles.modalOverlay} onPress={() => setActiveCueField(null)} accessibilityLabel="Close">
              <Pressable
                style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => null}
                accessibilityViewIsModal
              >
                <View style={[styles.modalAccentBar, { backgroundColor: colors.primary }]} />
                {activeCueField ? (
                  <View style={styles.modalBody}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>{cueFieldConfig[activeCueField].label}</Text>
                    <FlatList
                      data={cueFieldConfig[activeCueField].options}
                      keyExtractor={(item) => item}
                      renderItem={({ item }) => {
                        const isSelected = cueSetup[activeCueField] === item;
                        return (
                          <Pressable
                            style={[
                              styles.modalOption,
                              {
                                borderColor: isSelected ? colors.primary : colors.border,
                                backgroundColor: colors.surfaceMuted,
                              },
                            ]}
                            accessibilityRole="button"
                            accessibilityState={{ selected: isSelected }}
                            accessibilityLabel={cueFieldConfig[activeCueField].format(item)}
                            onPress={() => {
                              setCueSetup((prev) => ({ ...prev, [activeCueField]: item }));
                              setActiveCueField(null);
                            }}
                          >
                            <Text style={[styles.modalOptionText, { color: isSelected ? colors.primary : colors.text }]}>
                              {cueFieldConfig[activeCueField].format(item)}
                            </Text>
                            {isSelected ? <MaterialCommunityIcons name="check" size={18} color={colors.primary} /> : null}
                          </Pressable>
                        );
                      }}
                    />

                    <Pressable
                      onPress={() => setActiveCueField(null)}
                      accessibilityRole="button"
                      accessibilityLabel="Cancel"
                      style={styles.modalCancel}
                    >
                      <Text style={[styles.modalCancelText, { color: colors.textMuted }]}>Cancel</Text>
                    </Pressable>
                  </View>
                ) : null}
              </Pressable>
            </Pressable>
          </Modal>
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
          {field === "cue_preference" && "Set your usual cue specs (length, ferrule, tip size, and weight)."}
        </Text>
      </AppCard>

      {renderContent()}

      <View style={styles.footer}>
        <AppButton label={isSaving ? "Saving..." : "Save"} onPress={handleSave} disabled={isSaving || (config.type !== "cue" && !selectedValue)} />
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
  cueBuilderWrap: {
    padding: 16,
    gap: 12,
  },
  cueSummary: {
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 2,
  },
  cueRow: {
    flexDirection: "row",
    gap: 8,
  },
  cueFieldButton: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    minHeight: 72,
    justifyContent: "space-between",
  },
  cueFieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cueFieldValue: {
    fontSize: 16,
    fontWeight: "800",
    marginTop: 10,
  },
  cueFieldValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: SCRIM,
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    maxHeight: "72%",
  },
  modalAccentBar: {
    height: 4,
  },
  modalBody: {
    padding: SPACING.xl,
    flexShrink: 1,
  },
  modalTitle: {
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: SPACING.md,
  },
  modalOption: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    marginBottom: SPACING.sm,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  modalOptionText: {
    fontSize: 15,
    fontWeight: "700",
  },
});
