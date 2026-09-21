import React from "react";
import Svg, { Circle, Line, Path } from "react-native-svg";

/**
 * The builder's tools, each drawn with the balls it works on rather than a stock icon: reds in a
 * line, a racked triangle, the colours on their spots, a cue ball being moved.
 */

export type ToolGlyphName = "move" | "line" | "rack" | "spots";

const RED = "#D0142F";
const CUE = "#F7F4EA";
const COLOURS = ["#F2C230", "#1F8A4C", "#7A4B2A", "#1B6FD0", "#F29AC0", "#1A1E20"];

/** A ball with a little shine, so the glyphs read as balls and not as dots. */
const Ball = ({ x, y, r, fill, edge }: { x: number; y: number; r: number; fill: string; edge?: string }) => (
  <>
    <Circle cx={x} cy={y} r={r} fill={fill} stroke={edge ?? "rgba(0,0,0,0.35)"} strokeWidth={0.8} />
    <Circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="rgba(255,255,255,0.55)" />
  </>
);

export const ToolGlyph = ({
  name,
  size = 30,
  tint = "#FFFFFF",
}: {
  name: ToolGlyphName;
  size?: number;
  tint?: string;
}) => (
  <Svg width={size} height={size * 0.8} viewBox="0 0 40 32">
    {name === "move" ? (
      <>
        <Ball x={20} y={16} r={6.5} fill={CUE} edge="#9C9788" />
        {/* arrows out to each side: up, down, left, right */}
        <Path d="M20 2 L16.5 6.5 H23.5 Z" fill={tint} />
        <Path d="M20 30 L16.5 25.5 H23.5 Z" fill={tint} />
        <Path d="M5 16 L9.5 12.5 V19.5 Z" fill={tint} />
        <Path d="M35 16 L30.5 12.5 V19.5 Z" fill={tint} />
      </>
    ) : null}

    {name === "line" ? (
      <>
        <Line x1={4} y1={27} x2={36} y2={5} stroke={tint} strokeWidth={1.4} strokeDasharray="3 2.5" />
        <Ball x={9} y={23.5} r={4.6} fill={RED} />
        <Ball x={20} y={16} r={4.6} fill={RED} />
        <Ball x={31} y={8.5} r={4.6} fill={RED} />
      </>
    ) : null}

    {name === "rack" ? (
      <>
        {/* 1, 2 and 3: the front of a rack, apex at the bottom as it faces the pink */}
        <Ball x={20} y={25} r={4.4} fill={RED} />
        <Ball x={15.4} y={17} r={4.4} fill={RED} />
        <Ball x={24.6} y={17} r={4.4} fill={RED} />
        <Ball x={10.8} y={9} r={4.4} fill={RED} />
        <Ball x={20} y={9} r={4.4} fill={RED} />
        <Ball x={29.2} y={9} r={4.4} fill={RED} />
      </>
    ) : null}

    {name === "spots" ? (
      <>
        {/* the colours, yellow to black, on a gentle arc */}
        {COLOURS.map((fill, index) => {
          const x = 4.5 + index * 6.2;
          const y = 20 - Math.sin((index / (COLOURS.length - 1)) * Math.PI) * 8;
          return <Ball key={fill} x={x} y={y} r={3.9} fill={fill} edge={index === 5 ? "#6A6F72" : undefined} />;
        })}
      </>
    ) : null}
  </Svg>
);
