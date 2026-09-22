import type { ReactNode } from "react";

/** A 12ft table in millimetres (the app's own template), drawn landscape with baulk on the left. */
export const T = { length: 3569, width: 1778, ball: 52.5, baulk: 737, d: 292, black: 324 };
const RAIL = 120;

export type TableBall = "cue" | "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

/** Table position (across the width, along the length from the black end) to drawing position. */
export const at = (acrossMm: number, alongMm: number) => ({ x: T.length - alongMm, y: acrossMm });

const mid = T.width / 2;
const baulkAlong = T.length - T.baulk;

export const SPOT = {
  yellow: at(mid + T.d, baulkAlong),
  green: at(mid - T.d, baulkAlong),
  brown: at(mid, baulkAlong),
  blue: at(mid, T.length / 2),
  pink: at(mid, T.length / 4),
  black: at(mid, T.black),
};

const BALL_FILL: Record<TableBall, [string, string, string]> = {
  cue: ["#ffffff", "#eeeae0", "#a9a595"],
  red: ["#ff6b6b", "#c8102e", "#5c0714"],
  yellow: ["#fff1a8", "#f2c230", "#8a6a0a"],
  green: ["#7fe0a8", "#1e8a4c", "#0a3d20"],
  brown: ["#c99470", "#7a4a2a", "#33190b"],
  blue: ["#8db8ff", "#1f5fbf", "#0a2552"],
  pink: ["#ffd0de", "#e8779a", "#8a2f4c"],
  black: ["#6e7a7c", "#15191a", "#000000"],
};

export function TableDefs() {
  return (
    <defs>
      {(Object.keys(BALL_FILL) as TableBall[]).map((ball) => (
        <radialGradient key={ball} id={`ball-${ball}`} cx="34%" cy="30%" r="70%">
          <stop offset="0%" stopColor={BALL_FILL[ball][0]} />
          <stop offset="48%" stopColor={BALL_FILL[ball][1]} />
          <stop offset="100%" stopColor={BALL_FILL[ball][2]} />
        </radialGradient>
      ))}
      <linearGradient id="cloth" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#1f8a57" />
        <stop offset="100%" stopColor="#146a41" />
      </linearGradient>
      <radialGradient id="cloth-light" cx="50%" cy="45%" r="60%">
        <stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
      </radialGradient>
    </defs>
  );
}

/** The table itself: cushions, pockets, baulk line, the D and the spots. Balls go in as children. */
export function Table({ children, className, label }: { children?: ReactNode; className?: string; label: string }) {
  const pockets = [
    [0, 0],
    [T.length / 2, -14],
    [T.length, 0],
    [0, T.width],
    [T.length / 2, T.width + 14],
    [T.length, T.width],
  ];
  return (
    <svg
      className={`table ${className ?? ""}`}
      viewBox={`${-RAIL} ${-RAIL} ${T.length + RAIL * 2} ${T.width + RAIL * 2}`}
      role="img"
      aria-label={label}
    >
      <TableDefs />
      <rect x={-RAIL} y={-RAIL} width={T.length + RAIL * 2} height={T.width + RAIL * 2} rx={70} fill="#4a2c18" />
      <rect x={-RAIL + 18} y={-RAIL + 18} width={T.length + RAIL * 2 - 36} height={T.width + RAIL * 2 - 36} rx={56} fill="#5b3620" />
      <rect x={-34} y={-34} width={T.length + 68} height={T.width + 68} rx={18} fill="#156b42" />
      <rect x={0} y={0} width={T.length} height={T.width} fill="url(#cloth)" />
      <rect x={0} y={0} width={T.length} height={T.width} fill="url(#cloth-light)" />
      {pockets.map(([x, y], index) => (
        <circle key={index} cx={x} cy={y} r={58} fill="#0a0d0c" />
      ))}
      <g stroke="rgba(255,255,255,0.55)" strokeWidth={5} fill="none">
        <line x1={T.baulk} y1={0} x2={T.baulk} y2={T.width} />
        <path d={`M ${T.baulk} ${mid - T.d} A ${T.d} ${T.d} 0 0 0 ${T.baulk} ${mid + T.d}`} />
      </g>
      {Object.values(SPOT).map((spot, index) => (
        <circle key={index} cx={spot.x} cy={spot.y} r={7} fill="rgba(255,255,255,0.6)" />
      ))}
      {children}
    </svg>
  );
}

export const R = T.ball / 2;
