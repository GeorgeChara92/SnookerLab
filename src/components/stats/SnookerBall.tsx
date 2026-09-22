import React from "react";
import { Circle, Defs, Ellipse, G, RadialGradient, Stop } from "react-native-svg";
import type { BallName } from "../../features/stats/activity";

/** Each ball as base, lit and shadow tones, so a small ball still reads as glossy. */
export const BALL_TONES: Record<BallName, [string, string, string]> = {
  red: ["#C8102E", "#FF6B6B", "#5C0714"],
  yellow: ["#F2C230", "#FFF1A8", "#8A6A0A"],
  green: ["#1E8A4C", "#7FE0A8", "#0A3D20"],
  brown: ["#7A4A2A", "#C99470", "#33190B"],
  blue: ["#1F5FBF", "#8DB8FF", "#0A2552"],
  pink: ["#E8779A", "#FFD0DE", "#8A2F4C"],
  black: ["#15191A", "#6E7A7C", "#000000"],
};

/** The gradients the balls use; put once inside an Svg, with an id unique on the screen. */
export const BallDefs = ({ id }: { id: string }) => (
  <Defs>
    {(Object.keys(BALL_TONES) as BallName[]).map((name) => {
      const [base, lit, dark] = BALL_TONES[name];
      return (
        <RadialGradient key={name} id={`${id}-${name}`} cx="36%" cy="30%" r="72%" fx="36%" fy="30%">
          <Stop offset="0" stopColor={lit} />
          <Stop offset="0.45" stopColor={base} />
          <Stop offset="1" stopColor={dark} />
        </RadialGradient>
      );
    })}
  </Defs>
);

/** One ball at (x, y). A rim keeps the black visible on the dark board. */
export const SvgBall = ({
  id,
  name,
  x,
  y,
  r,
  rim,
}: {
  id: string;
  name: BallName;
  x: number;
  y: number;
  r: number;
  rim?: string;
}) => (
  <G>
    <Circle cx={x} cy={y} r={r} fill={`url(#${id}-${name})`} stroke={rim} strokeWidth={rim ? 0.75 : 0} />
    {r >= 4 ? (
      <Ellipse cx={x - r * 0.34} cy={y - r * 0.42} rx={r * 0.26} ry={r * 0.16} fill="#FFF" opacity={0.7} />
    ) : null}
  </G>
);
