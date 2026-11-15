import React from "react";
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Backgrounds for the shared result card, drawn rather than photographed: they stay sharp at
 * any size, cost nothing to download and carry no image licence. Everything is laid out on the
 * card's design grid (340 by 425) and scaled with the card.
 */

export const GRID = { width: 340, height: 425 };

export type CardTheme = {
  id: string;
  name: string;
  /** The highlight colour for the result and high break. */
  accent: string;
  /** Text on the accent, in the highlight banner. */
  onAccent: string;
  /** The glass the scores sit on. */
  panel: string;
  text: string;
  muted: string;
  Background: (props: { id: string }) => React.ReactElement;
};

/*
 * The backgrounds, redrawn on 2026-11-15: the first set leaned on large glossy balls cropped at
 * the corners, which read as clip art beside the rest of the app. These carry one idea each -
 * a material or a light - and leave the result to do the talking.
 */

const W = GRID.width;
const H = GRID.height;

/** Fine diagonal threads, a whisper of cloth weave. */
const Weave = ({ opacity = 0.03 }: { opacity?: number }) => (
  <G opacity={opacity}>
    {Array.from({ length: 64 }, (_, index) => {
      const x = -H + index * 12;
      return <Line key={index} x1={x} y1={H} x2={x + H} y2={0} stroke="#FFFFFF" strokeWidth={1} />;
    })}
  </G>
);

/** Darkens the edges, as a lit table falls off into shadow. */
const Vignette = ({ id, strength = 0.55 }: { id: string; strength?: number }) => (
  <>
    <Defs>
      <RadialGradient id={`${id}-vignette`} cx="50%" cy="45%" r="75%">
        <Stop offset="0.55" stopColor="#000000" stopOpacity={0} />
        <Stop offset="1" stopColor="#000000" stopOpacity={strength} />
      </RadialGradient>
    </Defs>
    <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-vignette)`} />
  </>
);

/** The baulk line and the D, faint, at the foot of the card. */
const Baulk = ({ y = 360, opacity = 0.14 }: { y?: number; opacity?: number }) => (
  <G opacity={opacity}>
    <Line x1={0} y1={y} x2={W} y2={y} stroke="#FFFFFF" strokeWidth={1.2} />
    <Path d={`M 118 ${y} A 52 52 0 0 0 222 ${y}`} stroke="#FFFFFF" strokeWidth={1.2} fill="none" />
    <Circle cx={170} cy={y} r={2} fill="#FFFFFF" />
  </G>
);

export const CARD_THEMES: CardTheme[] = [
  {
    id: "baize",
    name: "Baize",
    accent: "#E3C15A",
    onAccent: "#10140F",
    panel: "rgba(6,24,15,0.72)",
    text: "#F4F1E8",
    muted: "#A9C4B8",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-cloth`} cx="50%" cy="34%" r="80%">
            <Stop offset="0" stopColor="#24874E" />
            <Stop offset="1" stopColor="#0C3B22" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-cloth)`} />
        <Weave />
        <Baulk />
        <Vignette id={id} strength={0.45} />
      </>
    ),
  },
  {
    id: "table",
    name: "The table",
    accent: "#E8C463",
    onAccent: "#10140F",
    panel: "rgba(6,22,14,0.74)",
    text: "#F4F1E8",
    muted: "#A9C4B8",
    Background: ({ id }) => {
      const rail = 16;
      const pockets: Array<[number, number]> = [
        [rail, rail],
        [W - rail, rail],
        [rail, H / 2],
        [W - rail, H / 2],
        [rail, H - rail],
        [W - rail, H - rail],
      ];
      return (
        <>
          <Defs>
            <LinearGradient id={`${id}-wood`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#6B3A1E" />
              <Stop offset="0.5" stopColor="#4A2410" />
              <Stop offset="1" stopColor="#2E1407" />
            </LinearGradient>
            <RadialGradient id={`${id}-bed`} cx="50%" cy="38%" r="78%">
              <Stop offset="0" stopColor="#228049" />
              <Stop offset="1" stopColor="#0D3D23" />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-wood)`} />
          <Rect x={rail} y={rail} width={W - rail * 2} height={H - rail * 2} rx={4} fill={`url(#${id}-bed)`} />
          {/* The cushion's lit edge, along the inside of the rail */}
          <Rect
            x={rail + 1}
            y={rail + 1}
            width={W - rail * 2 - 2}
            height={H - rail * 2 - 2}
            rx={4}
            fill="none"
            stroke="#FFFFFF"
            strokeOpacity={0.1}
            strokeWidth={2}
          />
          <Weave opacity={0.025} />
          <Baulk y={350} opacity={0.12} />
          {pockets.map(([x, y], index) => (
            <Circle key={index} cx={x} cy={y} r={11} fill="#050505" />
          ))}
        </>
      );
    },
  },
  {
    id: "scoreboard",
    name: "Scoreboard",
    accent: "#C9A44C",
    onAccent: "#10140F",
    panel: "rgba(255,255,255,0.06)",
    text: "#F4F1E8",
    muted: "#9DB5AC",
    Background: ({ id }) => (
      <>
        <Defs>
          <LinearGradient id={`${id}-board`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#163F33" />
            <Stop offset="1" stopColor="#081812" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-board)`} />
        {/* The broadcast board's fine lines and its two gold rules */}
        <G opacity={0.035}>
          {Array.from({ length: Math.ceil(H / 5) }, (_, index) => (
            <Line key={index} x1={0} y1={index * 5} x2={W} y2={index * 5} stroke="#FFFFFF" strokeWidth={1} />
          ))}
        </G>
        <Rect x={0} y={12} width={W} height={1.5} fill="#C9A44C" />
        <Rect x={0} y={H - 13.5} width={W} height={1.5} fill="#C9A44C" />
      </>
    ),
  },
  {
    id: "spotlight",
    name: "Spotlight",
    accent: "#EBCB6E",
    onAccent: "#10140F",
    panel: "rgba(4,10,8,0.66)",
    text: "#F7F4EC",
    muted: "#A7B6AF",
    Background: ({ id }) => (
      <>
        <Defs>
          {/* The pool of light on the cloth, falling off into a dark room */}
          <RadialGradient id={`${id}-pool`} cx="50%" cy="58%" r="62%">
            <Stop offset="0" stopColor="#2A9358" />
            <Stop offset="0.55" stopColor="#14532F" />
            <Stop offset="1" stopColor="#050806" />
          </RadialGradient>
          <RadialGradient id={`${id}-lamp`} cx="50%" cy="0%" r="70%">
            <Stop offset="0" stopColor="#FFF6D8" stopOpacity={0.22} />
            <Stop offset="1" stopColor="#FFF6D8" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-pool)`} />
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-lamp)`} />
        <Weave opacity={0.02} />
      </>
    ),
  },
  {
    id: "ivory",
    name: "Ivory",
    accent: "#0F5A43",
    onAccent: "#F7F2E4",
    panel: "rgba(15,42,34,0.07)",
    text: "#13231D",
    muted: "#5E6E66",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-paper`} cx="50%" cy="30%" r="85%">
            <Stop offset="0" stopColor="#FBF7EC" />
            <Stop offset="1" stopColor="#ECE4D0" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-paper)`} />
        {/* A fine double rule, like a printed card */}
        <Rect x={10} y={10} width={W - 20} height={H - 20} fill="none" stroke="#0F5A43" strokeOpacity={0.35} strokeWidth={1} />
        <Rect x={14} y={14} width={W - 28} height={H - 28} fill="none" stroke="#0F5A43" strokeOpacity={0.18} strokeWidth={0.75} />
      </>
    ),
  },
  {
    id: "century",
    name: "Century",
    accent: "#F2CC63",
    onAccent: "#14100A",
    panel: "rgba(20,16,8,0.72)",
    text: "#FBF4DF",
    muted: "#C9BB92",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="50%" cy="18%" r="80%">
            <Stop offset="0" stopColor="#4A3B17" />
            <Stop offset="0.5" stopColor="#15120A" />
            <Stop offset="1" stopColor="#070604" />
          </RadialGradient>
          <LinearGradient id={`${id}-foil`} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#F7DC8A" />
            <Stop offset="0.5" stopColor="#B88A2E" />
            <Stop offset="1" stopColor="#F2CC63" />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={W} height={H} fill={`url(#${id}-glow)`} />
        {/* A gold-foil frame */}
        <Rect x={9} y={9} width={W - 18} height={H - 18} rx={3} fill="none" stroke={`url(#${id}-foil)`} strokeWidth={2} />
        <Rect x={14} y={14} width={W - 28} height={H - 28} rx={2} fill="none" stroke={`url(#${id}-foil)`} strokeOpacity={0.45} strokeWidth={0.75} />
      </>
    ),
  },
];

export const themeById = (id: string | undefined) => CARD_THEMES.find((theme) => theme.id === id) ?? CARD_THEMES[0];

/** A theme's background at any size, for the card and for the little swatches that pick it. */
export const ThemeBackground = ({
  theme,
  width,
  height,
  id,
}: {
  theme: CardTheme;
  width: number;
  height: number;
  /** Unique on screen: gradients are looked up by id. */
  id: string;
}) => (
  <Svg width={width} height={height} viewBox={`0 0 ${GRID.width} ${GRID.height}`} preserveAspectRatio="xMidYMid slice">
    <theme.Background id={id} />
  </Svg>
);
