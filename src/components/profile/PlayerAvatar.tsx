import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { SvgXml } from "react-native-svg";
import { createAvatar } from "@dicebear/core";
import * as notionists from "@dicebear/notionists";
import { useAppTheme } from "../../hooks/useAppTheme";
import { SnookerPresetAvatar } from "./SnookerPresetAvatar";
import { SNOOKER_PRESET_AVATARS } from "../../constants/profileAvatars";
import {
  ballColour,
  isGeneratedAvatar,
  outfitBody,
  parseAvatar,
  topBallFor,
  type AvatarSpec,
} from "../../features/profile/avatarSpec";

/**
 * A player's avatar: their face in their outfit, inside a ring in the colour of the ball their
 * level has earned. Faces are generated on the phone, so they work offline and cost nothing.
 */

// Generating a face means building a few kilobytes of SVG. Lists show the same few faces
// over and over, so each one is built once.
const faceCache = new Map<string, string>();

export const faceXml = (seed: string, body: string) => {
  const key = `${seed}|${body}`;
  const cached = faceCache.get(key);
  if (cached) return cached;

  const xml = createAvatar(notionists, {
    seed,
    body: [body] as any,
    // No waving, no phone in hand, and no graphic on the shirt: dressed for the table, not the street.
    gestureProbability: 0,
    bodyIconProbability: 0,
  })
    .toString()
    // The metadata block carries licence details in RDF, which the SVG renderer does not need.
    .replace(/<metadata[\s\S]*?<\/metadata>/, "");

  faceCache.set(key, xml);
  return xml;
};

// The old icon presets, still drawn for anyone who chose one before faces existed.
const LEGACY_PRESETS = new Set(SNOOKER_PRESET_AVATARS.map((avatar) => avatar.id));

type Props = {
  /** What is stored in the user's avatar_preset. */
  preset?: string | null;
  /** Used to make a face for anyone who has not chosen one. */
  name?: string;
  size?: number;
  /** Their level, which decides the ring for someone who has not chosen a colour yet. */
  level?: number;
  /** Override the stored choice, for previews in the picker. */
  spec?: AvatarSpec;
  showRing?: boolean;
};

export const PlayerAvatar = ({ preset, name = "", size = 44, level = 1, spec, showRing = true }: Props) => {
  const { colors } = useAppTheme();

  const legacy = !spec && preset && !isGeneratedAvatar(preset) && LEGACY_PRESETS.has(preset);

  const chosen = useMemo<AvatarSpec>(() => {
    if (spec) return spec;
    const parsed = parseAvatar(preset, name);
    // Someone who has never chosen gets the ring their level has earned.
    return isGeneratedAvatar(preset) ? parsed : { ...parsed, ball: topBallFor(level) };
  }, [level, name, preset, spec]);

  const xml = useMemo(
    () => (legacy ? null : faceXml(chosen.seed, outfitBody(chosen.outfit))),
    [chosen.outfit, chosen.seed, legacy]
  );

  if (legacy) return <SnookerPresetAvatar presetId={preset ?? undefined} size={size} />;

  const ring = showRing ? Math.max(2, Math.round(size * 0.07)) : 0;
  const inner = size - ring * 2;
  const colour = ballColour(chosen.ball);

  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          padding: ring,
          backgroundColor: showRing ? colour : "transparent",
          // A black ring disappears on a dark screen without a hairline around it.
          borderWidth: showRing && chosen.ball === "black" ? 1 : 0,
          borderColor: colors.boardMuted,
        },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.face,
          { width: inner, height: inner, borderRadius: inner / 2, backgroundColor: colors.boardRaised },
        ]}
      >
        {xml ? <SvgXml xml={xml} width={inner} height={inner} /> : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  ring: { alignItems: "center", justifyContent: "center" },
  face: { overflow: "hidden", alignItems: "center", justifyContent: "center" },
});
