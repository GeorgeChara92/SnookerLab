import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Match } from "../../types";
import type { MatchCardFrame } from "../../features/matches/breaks";
import { parseDateValue } from "../../utils/date";
import { FONTS } from "../../constants";

/**
 * A match result as a picture to share: the broadcast scoreboard, in the app's own colours,
 * whatever theme the phone is in - it is going to other people's screens.
 */

const INK = {
  board: "#0F2A22",
  raised: "#1A3D32",
  text: "#F4F1E8",
  muted: "#9DB5AC",
  brass: "#C9A44C",
};

/** The card is designed at this width and scaled to fit. Height is 5:4 of it, a post's shape. */
export const CARD_WIDTH = 340;
export const CARD_RATIO = 1.25;
/** Two rows of four; a longer match shows the first seven and how many more. */
const MAX_FRAMES_SHOWN = 8;

type Props = {
  match: Match;
  playerName: string;
  bestOf?: number;
  frames: MatchCardFrame[];
  highUser: number;
  highOpponent: number;
  width: number;
};

export const MatchResultCard = forwardRef<View, Props>(
  ({ match, playerName, bestOf, frames, highUser, highOpponent, width }, ref) => {
    const k = width / CARD_WIDTH;
    const u = (n: number) => Math.round(n * k * 10) / 10;
    const won = match.user_score > match.opponent_score;
    const lost = match.user_score < match.opponent_score;
    const result = won ? "WIN" : lost ? "DEFEAT" : "DRAW";
    const date = parseDateValue(match.date).toLocaleDateString(undefined, {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    const shown = frames.length > MAX_FRAMES_SHOWN ? frames.slice(0, MAX_FRAMES_SHOWN - 1) : frames;

    const side = (name: string, score: number, leading: boolean) => (
      <View style={[styles.side, { gap: u(4) }]}>
        <Text
          numberOfLines={2}
          allowFontScaling={false}
          style={[styles.name, { fontSize: u(15), lineHeight: u(17), color: leading ? INK.text : INK.muted }]}
        >
          {name.toUpperCase()}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.score, { fontSize: u(84), lineHeight: u(88), color: leading ? INK.text : INK.muted }]}
        >
          {score}
        </Text>
      </View>
    );

    return (
      <View
        ref={ref}
        collapsable={false}
        style={[
          styles.card,
          { width, height: width * CARD_RATIO, padding: u(22), borderTopWidth: u(3), borderBottomWidth: u(3) },
        ]}
      >
        <View style={styles.top}>
          <Text allowFontScaling={false} style={[styles.brand, { fontSize: u(13), letterSpacing: u(2.5) }]}>
            SNOOKER LAB
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.meta, { fontSize: u(11), maxWidth: u(170) }]}>
            {date}
          </Text>
        </View>

        <View style={[styles.middle, { gap: u(10) }]}>
          <Text allowFontScaling={false} style={[styles.result, { fontSize: u(15), letterSpacing: u(4) }]}>
            {result}
          </Text>
          <View style={[styles.strip, { borderRadius: u(10), paddingVertical: u(14), paddingHorizontal: u(14) }]}>
            {side(playerName, match.user_score, !lost)}
            <View style={[styles.bestOf, { borderRadius: u(6), paddingHorizontal: u(8), paddingVertical: u(4) }]}>
              <Text allowFontScaling={false} style={[styles.bestOfText, { fontSize: u(14) }]}>
                {bestOf ? `(${bestOf})` : "v"}
              </Text>
            </View>
            {side(match.opponent_name, match.opponent_score, !won)}
          </View>
          {match.location ? (
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.meta, { fontSize: u(12), textAlign: "center" }]}
            >
              {match.location}
            </Text>
          ) : null}
        </View>

        <View style={{ gap: u(10) }}>
          {shown.length ? (
            <View style={[styles.frames, { gap: u(6) }]}>
              {shown.map((frame) => (
                <View
                  key={frame.number}
                  style={[styles.frame, { borderRadius: u(6), paddingVertical: u(5), width: u(68) }]}
                >
                  <Text allowFontScaling={false} style={[styles.frameNumber, { fontSize: u(9), letterSpacing: u(1) }]}>
                    FRAME {frame.number}
                  </Text>
                  <Text allowFontScaling={false} style={[styles.frameScore, { fontSize: u(15) }]}>
                    <Text style={{ color: frame.winner === "user" ? INK.text : INK.muted }}>{frame.user}</Text>
                    <Text style={{ color: INK.muted }}>–</Text>
                    <Text style={{ color: frame.winner === "opponent" ? INK.text : INK.muted }}>{frame.opponent}</Text>
                  </Text>
                </View>
              ))}
              {frames.length > shown.length ? (
                <View
                  style={[
                    styles.frame,
                    { borderRadius: u(6), paddingVertical: u(5), width: u(68), justifyContent: "center" },
                  ]}
                >
                  <Text allowFontScaling={false} style={[styles.frameNumber, { fontSize: u(10) }]}>
                    +{frames.length - shown.length} MORE
                  </Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {highUser || highOpponent ? (
            <View style={[styles.highs, { paddingTop: u(10) }]}>
              <Text allowFontScaling={false} style={[styles.highLabel, { fontSize: u(11), letterSpacing: u(1.5) }]}>
                HIGH BREAK
              </Text>
              <Text allowFontScaling={false} style={[styles.highValue, { fontSize: u(22) }]}>
                <Text style={{ color: highUser >= highOpponent ? INK.brass : INK.text }}>{highUser}</Text>
                <Text style={{ color: INK.muted }}>{"  ·  "}</Text>
                <Text style={{ color: highOpponent > highUser ? INK.brass : INK.text }}>{highOpponent}</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>
    );
  }
);

MatchResultCard.displayName = "MatchResultCard";

const styles = StyleSheet.create({
  card: { backgroundColor: INK.board, borderColor: INK.brass, justifyContent: "space-between", overflow: "hidden" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  brand: { fontFamily: FONTS.boardHeavy, color: INK.brass },
  meta: { fontFamily: FONTS.boardLabel, color: INK.muted, letterSpacing: 0.5 },
  middle: { alignItems: "stretch" },
  result: { fontFamily: FONTS.boardHeavy, color: INK.brass, textAlign: "center" },
  strip: { flexDirection: "row", alignItems: "center", backgroundColor: INK.raised },
  side: { flex: 1, alignItems: "center", minWidth: 0 },
  name: { fontFamily: FONTS.boardLabel, textAlign: "center", letterSpacing: 1 },
  score: { fontFamily: FONTS.boardHeavy },
  bestOf: { backgroundColor: INK.board },
  bestOfText: { fontFamily: FONTS.board, color: INK.muted },
  frames: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center" },
  frame: { backgroundColor: INK.raised, alignItems: "center" },
  frameNumber: { fontFamily: FONTS.boardLabel, color: INK.muted },
  frameScore: { fontFamily: FONTS.board },
  highs: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: INK.raised,
  },
  highLabel: { fontFamily: FONTS.boardLabel, color: INK.muted },
  highValue: { fontFamily: FONTS.board },
});
