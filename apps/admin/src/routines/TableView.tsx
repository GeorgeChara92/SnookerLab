import { useRef } from "react";
import { BALL_R, BAULK_Y, LOOK, POCKETS, RAIL, SPOTS, TABLE, VIEW_H, VIEW_W, autoSpotBalls, toView, type Ball } from "./geometry";
import type { Layout } from "./RoutineEditor";

/**
 * A routine's saved layout, drawn the way the app draws it (TableDiagram, landscape): every
 * placed ball plus the colours the app drops on their spots. Read-only; the builder edits it.
 */
export function TableView({ layout, label, svgRef }: { layout: Layout; label: string; svgRef?: React.Ref<SVGSVGElement> }) {
  const v = toView;
  const baulk = v({ x: 0, y: BAULK_Y }).x;
  const brown = v(SPOTS.brown);
  const all: Ball[] = [...autoSpotBalls(layout.balls, layout.spotMarkers), ...layout.balls];
  return (
    <svg ref={svgRef} className="tv-svg" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} role="img" aria-label={label} xmlns="http://www.w3.org/2000/svg">
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} rx={RAIL * 0.8} fill="#3E2616" />
      <rect x={RAIL} y={RAIL} width={TABLE.length} height={TABLE.width} fill="#0F4A33" />
      <rect x={RAIL} y={RAIL} width={TABLE.length} height={TABLE.width} fill="none" stroke="#0B3324" strokeWidth={14} />
      {POCKETS.map((p, i) => {
        const c = v(p);
        return <circle key={i} cx={c.x} cy={c.y} r={TABLE.ball * 0.95} fill="#030605" />;
      })}
      <line x1={baulk} y1={RAIL} x2={baulk} y2={RAIL + TABLE.width} stroke="rgba(255,255,255,0.45)" strokeWidth={4} />
      <path
        d={`M ${brown.x} ${brown.y - TABLE.dRadius} A ${TABLE.dRadius} ${TABLE.dRadius} 0 0 1 ${brown.x} ${brown.y + TABLE.dRadius}`}
        fill="none"
        stroke="rgba(255,255,255,0.45)"
        strokeWidth={4}
      />
      {Object.values(SPOTS).map((p, i) => {
        const c = v(p);
        return <circle key={i} cx={c.x} cy={c.y} r={7} fill="rgba(255,255,255,0.55)" />;
      })}
      {all.map((b) => {
        const c = v(b);
        const look = LOOK[b.color];
        return <circle key={b.id} cx={c.x} cy={c.y} r={BALL_R} fill={look.fill} stroke={look.edge} strokeWidth={3} />;
      })}
    </svg>
  );
}

/** The drawing above as a PNG, 1800 px wide, ready to save as the routine's reference picture. */
export async function tableToPng(svg: SVGSVGElement, width = 1800): Promise<Blob> {
  const height = Math.round((width * VIEW_H) / VIEW_W);
  const text = new XMLSerializer().serializeToString(svg);
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.width = width;
    img.height = height;
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Couldn't draw the table."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Couldn't make the picture."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Keeps a ref to the drawing so it can be turned into a picture. */
export const useTableRef = () => useRef<SVGSVGElement>(null);
