import React, { forwardRef } from "react";
import { StyleSheet, Text, View } from "react-native";
import type { Match, MatchType } from "../../types";
import type { MatchCardFrame } from "../../features/matches/breaks";
import { parseDateValue } from "../../utils/date";
import { FONTS } from "../../constants";
import { GRID, ThemeBackground, type CardTheme } from "./cardThemes";
import type { Highlight } from "../../features/matches/highlights";

/**
 * A match result as a picture to share. A drawn background (the player picks it), and on it
 * the result, the scoreboard, the frames and the high breaks, laid out on a 340 by 425 grid
 * and scaled to whatever size it is drawn at.
 */

export const CARD_WIDTH = GRID.width;
export const CARD_RATIO = GRID.height / GRID.width;
/** Two rows of four; a longer match shows the first seven and how many more. */
const MAX_FRAMES_SHOWN = 8;
/** With a highlight banner there is room for one row of frames. */
const MAX_FRAMES_WITH_BANNER = 4;

const TYPE: Record<MatchType, string> = {
  casual: "FRIENDLY",
  league: "LEAGUE",
  tournament: "TOURNAMENT",
  practice: "PRACTICE",
};

export type CardOptions = { frames: boolean; highBreaks: boolean; highlights: boolean };

type Props = {
  match: Match;
  playerName: string;
  bestOf?: number;
  frames: MatchCardFrame[];
  highUser: number;
  highOpponent: number;
  width: number;
  theme: CardTheme;
  options: CardOptions;
  /** What made the match special, most remarkable first. */
  highlights: Highlight[];
  /** Unique on screen, for the background's gradients. */
  id: string;
};

export const MatchResultCard = forwardRef<View, Props>(
  ({ match, playerName, bestOf, frames, highUser, highOpponent, width, theme, options, highlights, id }, ref) => {
    const k = width / CARD_WIDTH;
    const u = (n: number) => Math.round(n * k * 10) / 10;
    const height = width * CARD_RATIO;
    const won = match.user_score > match.opponent_score;
    const lost = match.user_score < match.opponent_score;
    const result = won ? "WIN" : lost ? "DEFEAT" : "DRAW";
    const date = parseDateValue(match.date)
      .toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
      .toUpperCase();
    const [lead, ...others] = options.highlights ? highlights : [];
    const personalBest = options.highlights && highlights.some((item) => item.kind === "personal-best");
    const shownFrames = options.frames ? frames : [];
    const maxFrames = lead ? MAX_FRAMES_WITH_BANNER : MAX_FRAMES_SHOWN;
    const shown = shownFrames.length > maxFrames ? shownFrames.slice(0, maxFrames - 1) : shownFrames;
    const showHighs = options.highBreaks && (highUser > 0 || highOpponent > 0);

    const row = (name: string, score: number, leading: boolean, first: boolean) => (
      <View
        style={[
          styles.row,
          { paddingVertical: u(7), paddingLeft: u(12), paddingRight: u(16), gap: u(10) },
          !first ? { borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.08)" } : null,
        ]}
      >
        <View
          style={{
            width: u(4),
            height: u(32),
            borderRadius: u(2),
            backgroundColor: leading ? theme.accent : "transparent",
          }}
        />
        <Text
          numberOfLines={1}
          allowFontScaling={false}
          style={[styles.name, { fontSize: u(19), letterSpacing: u(1.2), color: leading ? theme.text : theme.muted }]}
        >
          {name.toUpperCase()}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.score, { fontSize: u(46), lineHeight: u(50), color: leading ? theme.text : theme.muted }]}
        >
          {score}
        </Text>
      </View>
    );

    return (
      <View ref={ref} collapsable={false} style={[styles.card, { width, height }]}>
        <View style={StyleSheet.absoluteFill}>
          <ThemeBackground theme={theme} width={width} height={height} id={id} />
        </View>

        <View style={[styles.content, { padding: u(22), gap: u(10) }]}>
          <View>
            <Text
              allowFontScaling={false}
              style={[styles.brand, { fontSize: u(14), letterSpacing: u(3), color: theme.accent }]}
            >
              SNOOKERED
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.meta, { fontSize: u(11), letterSpacing: u(1), color: theme.muted }]}
            >
              {TYPE[match.match_type] ?? "MATCH"} · {date}
            </Text>
          </View>

          <View style={{ gap: u(8) }}>
            {lead ? (
              <View
                style={[
                  styles.banner,
                  {
                    backgroundColor: theme.accent,
                    borderRadius: u(8),
                    paddingVertical: u(6),
                    paddingHorizontal: u(12),
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  numberOfLines={1}
                  style={[styles.bannerText, { fontSize: u(18), letterSpacing: u(1.5) }]}
                >
                  {"\u2605 "}
                  {lead.label}
                </Text>
                {others.length ? (
                  <Text
                    allowFontScaling={false}
                    numberOfLines={1}
                    style={[styles.bannerMore, { fontSize: u(10), letterSpacing: u(1.2) }]}
                  >
                    {others
                      .slice(0, 2)
                      .map((item) => item.label)
                      .join("  \u00b7  ")}
                  </Text>
                ) : null}
              </View>
            ) : null}
            <Text
              allowFontScaling={false}
              style={[
                styles.result,
                lead
                  ? { fontSize: u(30), lineHeight: u(32), letterSpacing: u(4), color: theme.accent }
                  : { fontSize: u(44), lineHeight: u(46), letterSpacing: u(5), color: theme.accent },
              ]}
            >
              {result}
            </Text>
            <View
              style={[
                styles.panel,
                {
                  backgroundColor: theme.panel,
                  borderRadius: u(12),
                  borderTopWidth: u(2),
                  borderTopColor: theme.accent,
                },
              ]}
            >
              {row(playerName, match.user_score, !lost, true)}
              {row(match.opponent_name, match.opponent_score, !won, false)}
            </View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.meta, { fontSize: u(11), letterSpacing: u(1.5), color: theme.muted }]}
            >
              {bestOf
                ? `BEST OF ${bestOf}`
                : `${match.frames_played} ${match.frames_played === 1 ? "FRAME" : "FRAMES"}`}
              {match.location ? ` · ${match.location.toUpperCase()}` : ""}
            </Text>
          </View>

          <View style={{ gap: u(8) }}>
            {shown.length ? (
              <View style={[styles.frames, { gap: u(6) }]}>
                {shown.map((frame) => (
                  <View
                    key={frame.number}
                    style={[
                      styles.frame,
                      { backgroundColor: theme.panel, borderRadius: u(6), paddingVertical: u(4), width: u(68) },
                    ]}
                  >
                    <Text
                      allowFontScaling={false}
                      style={[styles.meta, { fontSize: u(9), letterSpacing: u(1), color: theme.muted }]}
                    >
                      FRAME {frame.number}
                    </Text>
                    <Text allowFontScaling={false} style={[styles.frameScore, { fontSize: u(15) }]}>
                      <Text style={{ color: frame.winner === "user" ? theme.text : theme.muted }}>{frame.user}</Text>
                      <Text style={{ color: theme.muted }}>–</Text>
                      <Text style={{ color: frame.winner === "opponent" ? theme.text : theme.muted }}>
                        {frame.opponent}
                      </Text>
                    </Text>
                  </View>
                ))}
                {shownFrames.length > shown.length ? (
                  <View
                    style={[
                      styles.frame,
                      { backgroundColor: theme.panel, borderRadius: u(6), width: u(68), justifyContent: "center" },
                    ]}
                  >
                    <Text allowFontScaling={false} style={[styles.meta, { fontSize: u(10), color: theme.muted }]}>
                      +{shownFrames.length - shown.length} MORE
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {showHighs ? (
              <View
                style={[
                  styles.highs,
                  {
                    backgroundColor: theme.panel,
                    borderRadius: u(10),
                    paddingHorizontal: u(14),
                    paddingVertical: u(6),
                  },
                ]}
              >
                <Text
                  allowFontScaling={false}
                  style={[styles.meta, { fontSize: u(11), letterSpacing: u(1.5), color: theme.muted }]}
                >
                  HIGH BREAK
                </Text>
                <Text allowFontScaling={false} style={[styles.highValue, { fontSize: u(24) }]}>
                  {personalBest ? <Text style={{ color: theme.accent, fontSize: u(12) }}>{"PB  "}</Text> : null}
                  <Text style={{ color: highUser >= highOpponent ? theme.accent : theme.text }}>{highUser}</Text>
                  <Text style={{ color: theme.muted }}>{"  ·  "}</Text>
                  <Text style={{ color: highOpponent > highUser ? theme.accent : theme.text }}>{highOpponent}</Text>
                </Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  }
);

MatchResultCard.displayName = "MatchResultCard";

const styles = StyleSheet.create({
  card: { overflow: "hidden", backgroundColor: "#0F2A22" },
  content: { flex: 1, justifyContent: "space-between" },
  brand: { fontFamily: FONTS.boardHeavy },
  meta: { fontFamily: FONTS.boardLabel },
  result: { fontFamily: FONTS.boardHeavy },
  panel: { overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center" },
  name: { flex: 1, fontFamily: FONTS.boardLabel },
  score: { fontFamily: FONTS.boardHeavy, textAlign: "right" },
  frames: { flexDirection: "row", flexWrap: "wrap" },
  frame: { alignItems: "center" },
  frameScore: { fontFamily: FONTS.board },
  highs: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  highValue: { fontFamily: FONTS.board },
  banner: { alignItems: "center" },
  bannerText: { fontFamily: FONTS.boardHeavy, color: "#10140F" },
  bannerMore: { fontFamily: FONTS.boardLabel, color: "#10140F", opacity: 0.75, marginTop: 1 },
});
