import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppTheme } from "../../hooks/useAppTheme";
import { PlayerAvatar } from "./PlayerAvatar";
import { faceSeeds, type AvatarSpec } from "../../features/profile/avatarSpec";
import { SPACING } from "../../constants";

/**
 * Every face to choose from, in one list you scroll rather than a shuffle button you keep
 * pressing. More load as you reach the bottom, so there is no end to it.
 */

const COLUMNS = 4;
const PAGE = 24;

type Props = {
  visible: boolean;
  onClose: () => void;
  /** Used to make the faces, so everyone gets their own set. */
  name: string;
  /** The avatar as it stands, so each face is shown in the chosen outfit. */
  draft: AvatarSpec;
  onPick: (seed: string) => void;
};

export const FacePickerSheet = ({ visible, onClose, name, draft, onPick }: Props) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [pages, setPages] = useState(2);

  const seeds = Array.from({ length: pages }, (_, round) => faceSeeds(name, round, PAGE)).flat();
  const tile = Math.floor((width - SPACING.lg * 2 - SPACING.sm * (COLUMNS - 1)) / COLUMNS);

  const loadMore = useCallback(() => setPages((value) => value + 1), []);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: colors.text }]}>Choose a face</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>Scroll for more. Tap one to use it.</Text>
          </View>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            hitSlop={10}
            style={[styles.close, { backgroundColor: colors.surfaceMuted }]}
          >
            <MaterialCommunityIcons name="close" size={20} color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          data={seeds}
          keyExtractor={(seed) => seed}
          numColumns={COLUMNS}
          columnWrapperStyle={styles.row}
          contentContainerStyle={[styles.grid, { paddingBottom: insets.bottom + SPACING.xl }]}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          initialNumToRender={PAGE}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          renderItem={({ item: seed }) => {
            const selected = draft.seed === seed;
            return (
              <Pressable
                onPress={() => {
                  onPick(seed);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel="Use this face"
                style={({ pressed }) => [
                  styles.tile,
                  {
                    width: tile,
                    height: tile,
                    borderRadius: tile / 2,
                    borderColor: selected ? colors.primary : "transparent",
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <PlayerAvatar spec={{ ...draft, seed }} size={tile - 10} showRing={false} />
              </Pressable>
            );
          }}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  sheet: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerText: { flex: 1 },
  title: { fontSize: 20, fontWeight: "800" },
  subtitle: { fontSize: 13, marginTop: 2 },
  close: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  grid: { padding: SPACING.lg, gap: SPACING.sm },
  row: { gap: SPACING.sm },
  tile: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
