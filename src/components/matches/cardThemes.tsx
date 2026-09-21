import React from "react";
import Svg, { Circle, Defs, Ellipse, G, Line, Path, RadialGradient, Rect, Stop } from "react-native-svg";

/**
 * Backgrounds for the shared result card, drawn rather than photographed: they stay sharp at
 * any size, cost nothing to download and carry no image licence. Everything is laid out on the
 * card's design grid (340 by 425) and scaled with the card.
 */

export const GRID = { width: 340, height: 425 };

type BallColour = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black" | "white";

/** Each ball as base, lit and shadow tones, for a glossy look. */
const BALL: Record<BallColour, [string, string, string]> = {
  red: ["#C8102E", "#FF6B6B", "#5C0714"],
  yellow: ["#F2C230", "#FFF1A8", "#8A6A0A"],
  green: ["#1E8A4C", "#7FE0A8", "#0A3D20"],
  brown: ["#7A4A2A", "#C99470", "#33190B"],
  blue: ["#1F5FBF", "#8DB8FF", "#0A2552"],
  pink: ["#E8779A", "#FFD0DE", "#8A2F4C"],
  black: ["#15191A", "#6E7A7C", "#000000"],
  white: ["#F4F1E6", "#FFFFFF", "#A9A48F"],
};

const BallGradients = ({ id }: { id: string }) => (
  <>
    {(Object.keys(BALL) as BallColour[]).map((colour) => {
      const [base, lit, dark] = BALL[colour];
      return (
        <RadialGradient key={colour} id={`${id}-${colour}`} cx="36%" cy="30%" r="72%" fx="36%" fy="30%">
          <Stop offset="0" stopColor={lit} />
          <Stop offset="0.45" stopColor={base} />
          <Stop offset="1" stopColor={dark} />
        </RadialGradient>
      );
    })}
  </>
);

const Ball = ({ id, x, y, r, colour }: { id: string; x: number; y: number; r: number; colour: BallColour }) => (
  <G>
    <Ellipse cx={x + r * 0.3} cy={y + r * 0.85} rx={r * 0.95} ry={r * 0.32} fill="#000" opacity={0.35} />
    <Circle cx={x} cy={y} r={r} fill={`url(#${id}-${colour})`} />
    <Ellipse cx={x - r * 0.34} cy={y - r * 0.42} rx={r * 0.26} ry={r * 0.16} fill="#FFF" opacity={0.75} />
  </G>
);

/** The pack of fifteen reds, apex first, pointing along the given angle. */
const rackPositions = (apexX: number, apexY: number, r: number, angle: number) => {
  const spots: Array<[number, number]> = [];
  const step = r * 2 * 0.98;
  const [dx, dy] = [Math.cos(angle), Math.sin(angle)];
  const [px, py] = [-dy, dx];
  for (let row = 0; row < 5; row += 1) {
    for (let i = 0; i <= row; i += 1) {
      const along = row * step * 0.866;
      const across = (i - row / 2) * step;
      spots.push([apexX + dx * along + px * across, apexY + dy * along + py * across]);
    }
  }
  return spots;
};

export type CardTheme = {
  id: string;
  name: string;
  /** The highlight colour for the result and high break. */
  accent: string;
  /** The glass the scores sit on. */
  panel: string;
  text: string;
  muted: string;
  Background: (props: { id: string }) => React.ReactElement;
};

const Cloth = ({ id, centre, edge }: { id: string; centre: string; edge: string }) => (
  <>
    <Defs>
      <RadialGradient id={`${id}-cloth`} cx="50%" cy="38%" r="75%">
        <Stop offset="0" stopColor={centre} />
        <Stop offset="1" stopColor={edge} />
      </RadialGradient>
    </Defs>
    <Rect x={0} y={0} width={GRID.width} height={GRID.height} fill={`url(#${id}-cloth)`} />
  </>
);

export const CARD_THEMES: CardTheme[] = [
  {
    id: "baize",
    name: "Baize",
    accent: "#E3C15A",
    panel: "rgba(6,24,15,0.74)",
    text: "#F4F1E8",
    muted: "#A9C4B8",
    Background: ({ id }) => (
      <>
        <Cloth id={id} centre="#23874C" edge="#0B3A21" />
        <Defs>
          <BallGradients id={id} />
        </Defs>
        {/* The baulk line and the D, faint in the cloth */}
        <Line x1={0} y1={352} x2={GRID.width} y2={352} stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.2} />
        <Path d="M 118 352 A 52 52 0 0 0 222 352" stroke="#FFFFFF" strokeOpacity={0.16} strokeWidth={1.2} fill="none" />
        <Ball id={id} x={300} y={24} r={24} colour="red" />
        <Ball id={id} x={330} y={66} r={24} colour="red" />
        <Ball id={id} x={274} y={66} r={24} colour="red" />
        <Ball id={id} x={22} y={404} r={54} colour="black" />
        <Ball id={id} x={326} y={396} r={20} colour="white" />
      </>
    ),
  },
  {
    id: "rack",
    name: "The pack",
    accent: "#F0C75E",
    panel: "rgba(5,20,13,0.78)",
    text: "#F4F1E8",
    muted: "#9DB5AC",
    Background: ({ id }) => (
      <>
        <Cloth id={id} centre="#17663A" edge="#07281A" />
        <Defs>
          <BallGradients id={id} />
        </Defs>
        {rackPositions(236, 40, 19, Math.PI * 0.2).map(([x, y], index) => (
          <Ball key={index} id={id} x={x} y={y} r={19} colour="red" />
        ))}
        <Ball id={id} x={206} y={20} r={19} colour="pink" />
        <Ball id={id} x={60} y={402} r={22} colour="blue" />
      </>
    ),
  },
  {
    id: "black",
    name: "On the black",
    accent: "#D9B45A",
    panel: "rgba(10,12,12,0.72)",
    text: "#F4F1E8",
    muted: "#A3A9A7",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-glow`} cx="80%" cy="10%" r="90%">
            <Stop offset="0" stopColor="#3A3222" />
            <Stop offset="0.5" stopColor="#141715" />
            <Stop offset="1" stopColor="#070908" />
          </RadialGradient>
          <BallGradients id={id} />
        </Defs>
        <Rect x={0} y={0} width={GRID.width} height={GRID.height} fill={`url(#${id}-glow)`} />
        <Circle cx={300} cy={40} r={152} fill="none" stroke="#D9B45A" strokeOpacity={0.35} strokeWidth={2} />
        <Ball id={id} x={300} y={40} r={150} colour="black" />
      </>
    ),
  },
  {
    id: "broadcast",
    name: "Broadcast",
    accent: "#C9A44C",
    panel: "rgba(26,61,50,0.82)",
    text: "#F4F1E8",
    muted: "#9DB5AC",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-lights`} cx="50%" cy="0%" r="85%">
            <Stop offset="0" stopColor="#2E6B55" />
            <Stop offset="0.6" stopColor="#0F2A22" />
            <Stop offset="1" stopColor="#081812" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={GRID.width} height={GRID.height} fill={`url(#${id}-lights)`} />
        {/* The table from above, as the overhead camera sees it */}
        <Rect
          x={46}
          y={20}
          width={248}
          height={385}
          rx={10}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity={0.08}
          strokeWidth={10}
        />
        {[
          [46, 20],
          [294, 20],
          [46, 212],
          [294, 212],
          [46, 405],
          [294, 405],
        ].map(([x, y], index) => (
          <Circle key={index} cx={x} cy={y} r={9} fill="#000" opacity={0.35} />
        ))}
        <Rect x={0} y={0} width={GRID.width} height={4} fill="#C9A44C" />
        <Rect x={0} y={GRID.height - 4} width={GRID.width} height={4} fill="#C9A44C" />
      </>
    ),
  },
  {
    id: "century",
    name: "Century",
    accent: "#F5CF62",
    panel: "rgba(14,12,6,0.72)",
    text: "#FBF4DF",
    muted: "#C9BB92",
    Background: ({ id }) => (
      <>
        <Defs>
          <RadialGradient id={`${id}-gold`} cx="50%" cy="22%" r="80%">
            <Stop offset="0" stopColor="#6B5420" />
            <Stop offset="0.45" stopColor="#1E1A0E" />
            <Stop offset="1" stopColor="#0A0904" />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={GRID.width} height={GRID.height} fill={`url(#${id}-gold)`} />
        {Array.from({ length: 24 }, (_, index) => {
          const angle = (index / 24) * Math.PI * 2;
          return (
            <Line
              key={index}
              x1={170}
              y1={94}
              x2={170 + Math.cos(angle) * 420}
              y2={94 + Math.sin(angle) * 420}
              stroke="#F5CF62"
              strokeOpacity={index % 2 ? 0.05 : 0.1}
              strokeWidth={index % 2 ? 8 : 14}
            />
          );
        })}
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
