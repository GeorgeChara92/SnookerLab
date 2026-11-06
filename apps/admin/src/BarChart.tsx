import { useState } from "react";

type Point = { day: string; value: number };

const W = 600;
const H = 180;
const PAD = { top: 12, right: 8, bottom: 24, left: 32 };
const GAP = 2;
const RADIUS = 4;

/** "2026-11-05" read as midday local time, so it never slips to the day before. */
const toDate = (day: string) => new Date(`${day}T12:00:00`);
const dayLabel = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });
const weekday = new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short" });

/** A bar with only its top corners rounded, so it sits flat on the baseline. */
const barPath = (x: number, y: number, w: number, h: number) => {
  const r = Math.min(RADIUS, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
};

/** A nice round top for the y axis: 1, 2, 5, 10, 20, 50… */
const niceMax = (value: number) => {
  if (value <= 4) return Math.max(value, 1) <= 2 ? 2 : 4;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value) ?? 10;
  return step * power;
};

/** One series of daily counts. Hover (or focus) a day to see its exact number. */
export function BarChart({ points, unit }: { points: Point[]; unit: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / Math.max(points.length, 1);
  const barW = Math.max(slot - GAP, 1);
  const y = (value: number) => PAD.top + innerH - (value / max) * innerH;
  const ticks = [0, max / 2, max];
  const active = hover === null ? null : points[hover];

  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Bar chart, ${points.length} days`} onMouseLeave={() => setHover(null)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(tick)} y2={y(tick)} className="chart-grid" />
            <text x={PAD.left - 6} y={y(tick)} className="chart-axis" textAnchor="end" dominantBaseline="middle">
              {Number.isInteger(tick) ? tick : tick.toFixed(1)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = PAD.left + index * slot + GAP / 2;
          const h = Math.max(PAD.top + innerH - y(point.value), point.value > 0 ? 2 : 0);
          return (
            <g key={point.day}>
              {h > 0 ? <path d={barPath(x, PAD.top + innerH - h, barW, h)} className={hover === index ? "chart-bar on" : "chart-bar"} /> : null}
              {/* The hover target is the whole column, not just the bar. */}
              <rect
                x={PAD.left + index * slot}
                y={PAD.top}
                width={slot}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${weekday.format(toDate(point.day))}: ${point.value}`}
                onMouseEnter={() => setHover(index)}
                onFocus={() => setHover(index)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
        {points.length
          ? [0, Math.floor((points.length - 1) / 2), points.length - 1].map((index) => (
              <text
                key={index}
                x={PAD.left + index * slot + slot / 2}
                y={H - 6}
                className="chart-axis"
                textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"}
              >
                {dayLabel.format(toDate(points[index].day))}
              </text>
            ))
          : null}
      </svg>
      {active && hover !== null ? (
        <div className="chart-tip" style={{ left: `${((PAD.left + hover * slot + slot / 2) / W) * 100}%` }}>
          <strong>{active.value.toLocaleString()}</strong> {active.value === 1 ? unit : `${unit}s`}
          <span>{weekday.format(toDate(active.day))}</span>
        </div>
      ) : null}
    </div>
  );
}
