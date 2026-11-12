import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  BALL_R,
  BAULK_Y,
  COLOURS,
  LOOK,
  PACK_FRONT_BEHIND_PINK,
  PACK_SIZES,
  POCKETS,
  RAIL,
  SPOTS,
  SPOT_COLOURS,
  TABLE,
  VIEW_H,
  VIEW_W,
  autoSpotBalls,
  fmt,
  fromView,
  isOnBed,
  linePositions,
  nextId,
  overlapping,
  packPositions,
  snapPoint,
  toView,
  type Ball,
  type Colour,
  type PackFacing,
  type Point,
  type Snapped,
  type SpotId,
} from "./geometry";
import "./builder.css";

export type Layout = {
  routineId: string;
  displayName: string;
  category: string;
  spotMarkers: SpotId[];
  notes: string;
  balls: Ball[];
};

type Tool = "select" | "place" | "line" | "diagonal" | "pack" | "measure";
type RefMode = "above" | "overlay" | "off";

const TOOLS: Array<{ value: Tool; label: string; key: string; hint: string }> = [
  { value: "select", label: "Select", key: "V", hint: "Click or box-select balls, then drag them" },
  { value: "place", label: "Place", key: "B", hint: "Click the table to drop a ball" },
  { value: "line", label: "Line", key: "L", hint: "Drag a straight row or column of balls" },
  { value: "diagonal", label: "Diagonal", key: "D", hint: "Drag a line of balls at any angle" },
  { value: "pack", label: "Pack", key: "P", hint: "Click the table to drop a pack of touching balls, with the click as its front ball" },
  { value: "measure", label: "Measure", key: "M", hint: "Click two points to measure between them" },
];
const SPACINGS: Array<[string, string]> = [
  ["52.5", "Touching"],
  ["105", "2 ball-widths"],
  ["157.5", "3 ball-widths"],
  ["custom", "Custom"],
];
const GRIDS: Array<[string, string]> = [
  ["0", "Off"],
  ["1", "1 mm"],
  ["5", "5 mm"],
  ["26.25", "½ ball"],
  ["52.5", "1 ball"],
];
const GUIDE = "#E3C15A";
const SNAP_PX = 8;

type Gesture =
  | { kind: "drag"; ids: string[]; grabId: string; start: Point; origin: Record<string, Point>; moved: boolean; pointer: number }
  | { kind: "marquee"; start: Point; now: Point; add: boolean; pointer: number }
  | { kind: "line"; start: Snapped; pointer: number };

type Props = {
  layout: Layout;
  saved: Layout;
  image: string | null;
  dirty: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onChange: (next: Layout, record: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  onToast: (text: string) => void;
};

export function RoutineEditor({ layout, saved, image, dirty, canUndo, canRedo, onChange, onUndo, onRedo, onSave, onToast }: Props) {
  const [tool, setTool] = useState<Tool>("select");
  const [colour, setColour] = useState<Colour>("red");
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [grid, setGrid] = useState("5");
  const [spacing, setSpacing] = useState("52.5");
  const [customSpacing, setCustomSpacing] = useState("52.5");
  const [count, setCount] = useState("");
  const [packSize, setPackSize] = useState<number>(15);
  const [packFacing, setPackFacing] = useState<PackFacing>("baulk");
  const [zoom, setZoom] = useState(1);
  const [refMode, setRefMode] = useState<RefMode>(image ? "above" : "off");
  const [refOpacity, setRefOpacity] = useState(45);
  const [refInset, setRefInset] = useState(0);
  const [measure, setMeasure] = useState<Point[]>([]);
  const svgRef = useRef<SVGSVGElement>(null);

  // Pointer events can arrive faster than React re-renders, so the handlers read the latest
  // gesture, pointer and layout from refs; the matching state is only there to redraw.
  const [hover, setHoverState] = useState<Snapped | null>(null);
  const hoverRef = useRef<Snapped | null>(null);
  const setHover = (next: Snapped | null) => {
    hoverRef.current = next;
    setHoverState(next);
  };
  const [gesture, setGestureState] = useState<Gesture | null>(null);
  const gestureRef = useRef<Gesture | null>(null);
  const setGesture = (next: Gesture | null) => {
    gestureRef.current = next;
    setGestureState(next);
  };
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  const balls = layout.balls;
  const autos = useMemo(() => autoSpotBalls(balls, layout.spotMarkers), [balls, layout.spotMarkers]);
  const clashes = useMemo(() => overlapping([...balls, ...autos]), [balls, autos]);
  const offBed = useMemo(() => new Set(balls.filter((b) => !isOnBed(b)).map((b) => b.id)), [balls]);
  const selected = balls.filter((b) => selection.has(b.id));
  const lineSpacing = spacing === "custom" ? Math.max(1, parseFloat(customSpacing) || TABLE.ball) : parseFloat(spacing);
  const fixedCount = (() => {
    const n = parseInt(count, 10);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, 40) : null;
  })();

  const update = (patch: Partial<Layout>, record = true) => {
    const next = { ...layoutRef.current, ...patch };
    layoutRef.current = next;
    onChange(next, record);
  };
  const setBalls = (next: Ball[], record = true) => update({ balls: next }, record);

  // ------------------------------------------------------------ pointer maths
  const mmPerPx = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect && rect.width ? VIEW_W / rect.width : 4;
  };
  const toTable = (event: { clientX: number; clientY: number }): Point => {
    const svg = svgRef.current!;
    const matrix = svg.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const pt = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return fromView({ x: pt.x, y: pt.y });
  };
  const gridSize = parseFloat(grid) || null;
  const resolve = (raw: Point, exclude: Set<string> = new Set()) => {
    const cur = layoutRef.current;
    return snapPoint(
      raw,
      [...cur.balls.filter((b) => !exclude.has(b.id)), ...autoSpotBalls(cur.balls, cur.spotMarkers)],
      SNAP_PX * mmPerPx(),
      gridSize
    );
  };

  const lineEnd = (start: Snapped, raw: Point): Snapped => {
    const end = resolve(raw);
    if (tool !== "line") return end;
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);
    return dx >= dy ? { x: end.x, y: start.y, guideX: null, guideY: start.y } : { x: start.x, y: end.y, guideX: start.x, guideY: null };
  };
  const packPreview = tool === "pack" && hover && !gesture ? packPositions(hover, packSize, packFacing) : [];
  const packFits = packPreview.every(isOnBed);

  /** Drops a pack with its front ball at `front`, and selects it so it can be dragged as one. */
  const placePack = (front: Point, facing: PackFacing = packFacing) => {
    const points = packPositions(front, packSize, facing);
    if (!points.every(isOnBed)) {
      onToast("That pack runs off the table there. Move it away from the cushion.");
      return;
    }
    const current = layoutRef.current.balls;
    const taken = new Set<string>();
    const added = points.map((p) => {
      const id = nextId(current, colour, taken);
      taken.add(id);
      return { id, color: colour, x: p.x, y: p.y };
    });
    setBalls([...current, ...added]);
    setSelection(new Set(added.map((b) => b.id)));
  };

  const linePreview = gesture?.kind === "line" && hover ? linePositions(gesture.start, lineEnd(gesture.start, hover), lineSpacing, fixedCount).filter(isOnBed) : [];

  const ballAt = (target: EventTarget | null) => {
    const el = (target as Element | null)?.closest?.("[data-ball]");
    return el ? el.getAttribute("data-ball") : null;
  };

  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (event.button !== 0) return;
    const raw = toTable(event);
    const hitId = ballAt(event.target);
    svgRef.current?.setPointerCapture(event.pointerId);

    if (tool === "measure") {
      const p = resolve(raw);
      setMeasure((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
      return;
    }
    if (tool === "line" || tool === "diagonal") {
      setGesture({ kind: "line", start: resolve(raw), pointer: event.pointerId });
      return;
    }

    const balls = layoutRef.current.balls;
    if (hitId) {
      // A ball the app drops on its spot by itself: grabbing it pins it as a real ball, so it can move.
      let current = balls;
      let id = hitId;
      if (hitId.startsWith("spot-")) {
        const auto = autoSpotBalls(balls, layoutRef.current.spotMarkers).find((b) => b.id === hitId);
        if (!auto) return;
        id = nextId(balls, auto.color);
        current = [...balls, { ...auto, id }];
        setBalls(current);
      }
      const pinned = id !== hitId;
      if (event.shiftKey && !pinned) {
        // Shift-click just adds or takes a ball out of the selection.
        const next = new Set(selection);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelection(next);
        return;
      }
      const ids = event.shiftKey ? [...selection, id] : selection.has(id) ? [...selection] : [id];
      setSelection(new Set(ids));
      const origin = Object.fromEntries(current.filter((b) => ids.includes(b.id)).map((b) => [b.id, { x: b.x, y: b.y }]));
      setGesture({ kind: "drag", ids, grabId: id, start: raw, origin, moved: pinned, pointer: event.pointerId });
      return;
    }

    if (tool === "pack") {
      placePack(resolve(raw));
      return;
    }
    if (tool === "place") {
      const p = resolve(raw);
      const id = nextId(balls, colour);
      setBalls([...balls, { id, color: colour, x: p.x, y: p.y }]);
      setSelection(new Set([id]));
      return;
    }
    setGesture({ kind: "marquee", start: raw, now: raw, add: event.shiftKey, pointer: event.pointerId });
    if (!event.shiftKey) setSelection(new Set());
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const raw = toTable(event);
    const gesture = gestureRef.current;
    const balls = layoutRef.current.balls;
    if (gesture?.kind === "drag") {
      const g = gesture;
      const from = g.origin[g.grabId];
      if (!from) return;
      if (!g.moved && Math.hypot(raw.x - g.start.x, raw.y - g.start.y) * (1 / mmPerPx()) < 3) return;
      // The grabbed ball keeps its offset from the pointer and snaps; the rest follow it.
      const target = resolve({ x: from.x + raw.x - g.start.x, y: from.y + raw.y - g.start.y }, new Set(g.ids));
      const dx = target.x - from.x;
      const dy = target.y - from.y;
      setHover(target);
      const next = balls.map((b) => {
        const from = g.origin[b.id];
        if (!from) return b;
        const moved = { x: from.x + dx, y: from.y + dy };
        return { ...b, x: Math.min(TABLE.width - BALL_R, Math.max(BALL_R, moved.x)), y: Math.min(TABLE.length - BALL_R, Math.max(BALL_R, moved.y)) };
      });
      setBalls(next, !g.moved);
      if (!g.moved) setGesture({ ...g, moved: true });
      return;
    }
    if (gesture?.kind === "marquee") {
      setGesture({ ...gesture, now: raw });
      return;
    }
    if (gesture?.kind === "line") {
      setHover(raw as Snapped);
      return;
    }
    setHover(tool === "select" ? null : resolve(raw));
  };

  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    svgRef.current?.releasePointerCapture?.(event.pointerId);
    const gesture = gestureRef.current;
    const hover = hoverRef.current;
    const balls = layoutRef.current.balls;
    // Cleared straight away, so a second pointerup for the same press can't place a line twice.
    gestureRef.current = null;
    if (gesture?.kind === "line") {
      const points = hover ? linePositions(gesture.start, lineEnd(gesture.start, hover), lineSpacing, fixedCount).filter(isOnBed) : [];
      if (points.length >= 2 || (fixedCount === 1 && points.length === 1)) {
        const taken = new Set<string>();
        const added = points.map((p) => {
          const id = nextId(balls, colour, taken);
          taken.add(id);
          return { id, color: colour, x: p.x, y: p.y };
        });
        setBalls([...balls, ...added]);
        setSelection(new Set(added.map((b) => b.id)));
      }
    }
    if (gesture?.kind === "marquee") {
      const { start, now, add } = gesture;
      const [x1, x2] = [Math.min(start.x, now.x), Math.max(start.x, now.x)];
      const [y1, y2] = [Math.min(start.y, now.y), Math.max(start.y, now.y)];
      if (x2 - x1 > 5 || y2 - y1 > 5) {
        const inside = balls.filter((b) => b.x >= x1 && b.x <= x2 && b.y >= y1 && b.y <= y2).map((b) => b.id);
        setSelection((prev) => new Set(add ? [...prev, ...inside] : inside));
      }
    }
    setGesture(null);
    if (tool === "select") setHover(null);
  };

  // ------------------------------------------------------------ actions
  const removeSelected = () => {
    if (!selection.size) return;
    setBalls(balls.filter((b) => !selection.has(b.id)));
    setSelection(new Set());
  };
  const nudge = (along: number, across: number) => {
    if (!selection.size) return;
    setBalls(
      balls.map((b) =>
        selection.has(b.id)
          ? { ...b, x: Math.min(TABLE.width - BALL_R, Math.max(BALL_R, b.x + across)), y: Math.min(TABLE.length - BALL_R, Math.max(BALL_R, b.y + along)) }
          : b
      )
    );
  };
  const recolour = (to: Colour) => setBalls(balls.map((b) => (selection.has(b.id) ? { ...b, color: to } : b)));
  const mirror = () => setBalls(balls.map((b) => (selection.has(b.id) ? { ...b, x: TABLE.width - b.x } : b)));
  const align = (axis: "x" | "y") => {
    const avg = selected.reduce((sum, b) => sum + b[axis], 0) / (selected.length || 1);
    setBalls(balls.map((b) => (selection.has(b.id) ? { ...b, [axis]: avg } : b)));
  };
  const setPosition = (id: string, axis: "along" | "across", value: number) => {
    if (!Number.isFinite(value)) return;
    setBalls(
      balls.map((b) =>
        b.id !== id
          ? b
          : axis === "along"
            ? { ...b, y: Math.min(TABLE.length - BALL_R, Math.max(BALL_R, value)) }
            : { ...b, x: Math.min(TABLE.width - BALL_R, Math.max(BALL_R, TABLE.width - value)) }
      )
    );
  };
  const toggleSpot = (c: (typeof SPOT_COLOURS)[number]) => {
    const id = `spot-${c}` as SpotId;
    const order = SPOT_COLOURS.map((s) => `spot-${s}` as SpotId);
    const next = layout.spotMarkers.includes(id) ? layout.spotMarkers.filter((s) => s !== id) : [...layout.spotMarkers, id];
    update({ spotMarkers: order.filter((s) => next.includes(s)) });
  };
  const allSpots = (on: boolean) => update({ spotMarkers: on ? SPOT_COLOURS.map((s) => `spot-${s}` as SpotId) : [] });
  const clearAll = () => {
    if (!balls.length) return;
    setBalls([]);
    setSelection(new Set());
    onToast("Cleared the table. Ctrl+Z brings it all back.");
  };
  const revert = () => {
    onChange(saved, true);
    setSelection(new Set());
  };

  // ------------------------------------------------------------ keyboard
  const live = useRef({ removeSelected, nudge, onUndo, onRedo, onSave, balls, gesture });
  live.current = { removeSelected, nudge, onUndo, onRedo, onSave, balls, gesture };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase() ?? "";
      if (["input", "textarea", "select"].includes(tag) || document.querySelector(".overlay")) return;
      const k = event.key.toLowerCase();
      const mod = event.ctrlKey || event.metaKey;
      const l = live.current;
      if (mod && k === "z") {
        event.preventDefault();
        if (event.shiftKey) l.onRedo();
        else l.onUndo();
      } else if (mod && k === "y") {
        event.preventDefault();
        l.onRedo();
      } else if (mod && k === "s") {
        event.preventDefault();
        l.onSave();
      } else if (mod && k === "a") {
        event.preventDefault();
        setSelection(new Set(l.balls.map((b) => b.id)));
      } else if (mod) {
        return;
      } else if (event.key === "Escape") {
        if (l.gesture) setGesture(null);
        else {
          setSelection(new Set());
          setMeasure([]);
        }
      } else if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        l.removeSelected();
      } else if (event.key.startsWith("Arrow")) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        // On screen the black end is left and yellow is at the top, so Right runs along the table
        // towards baulk and Up runs across towards the yellow-side cushion.
        if (event.key === "ArrowRight") l.nudge(step, 0);
        if (event.key === "ArrowLeft") l.nudge(-step, 0);
        if (event.key === "ArrowUp") l.nudge(0, step);
        if (event.key === "ArrowDown") l.nudge(0, -step);
      } else {
        const t = TOOLS.find((x) => x.key.toLowerCase() === k);
        if (t) {
          setTool(t.value);
          setMeasure([]);
          return;
        }
        const c = COLOURS.find((x) => LOOK[x].key === event.key);
        if (c) {
          setColour(c);
          setTool((prev) => (prev === "select" || prev === "measure" ? "place" : prev));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ------------------------------------------------------------ status line
  const status = (() => {
    if (gesture?.kind === "line") {
      const last = linePreview[linePreview.length - 1];
      const length = last ? Math.hypot(last.x - gesture.start.x, last.y - gesture.start.y) : 0;
      return `${linePreview.length} ${linePreview.length === 1 ? "ball" : "balls"}${fixedCount ? " (fixed)" : ""} · ${fmt(lineSpacing)} mm apart · ${fmt(length)} mm long. Let go to place them, Esc to cancel.`;
    }
    if (gesture?.kind === "drag" && gesture.moved && selected.length) {
      const b = selected.length === 1 ? selected[0] : null;
      return b ? `Along ${fmt(b.y)} mm · across ${fmt(TABLE.width - b.x)} mm from the top cushion.` : `Moving ${selected.length} balls.`;
    }
    if (tool === "measure") {
      if (measure.length === 2) {
        const [a, b] = measure;
        const d = Math.hypot(b.x - a.x, b.y - a.y);
        return `${fmt(d)} mm (${fmt(d / TABLE.ball)} ball-widths) · ${fmt(Math.abs(b.y - a.y))} along · ${fmt(Math.abs(b.x - a.x))} across. Click again to start over.`;
      }
      return measure.length ? "Now click the second point." : "Click the first point. It snaps to balls and spots.";
    }
    const t = TOOLS.find((x) => x.value === tool)!;
    if (tool === "place") return `${t.hint}: ${LOOK[colour].label.toLowerCase()}. Keys 1–8 pick a colour.`;
    if (tool === "pack") {
      if (hover && !packFits) return "That pack runs off the table there. Move it away from the cushion.";
      return `${t.hint}. ${packSize} ${LOOK[colour].label.toLowerCase()}${packSize === 1 ? "" : "s"}, pointing towards ${packFacing === "baulk" ? "baulk" : "the black"}. Once placed it's selected, so drag any ball in it to move the whole pack.`;
    }
    if (tool === "line" || tool === "diagonal") return `${t.hint} in ${LOOK[colour].label.toLowerCase()}. ${fixedCount ? `Always ${fixedCount}; the drag only aims it.` : "Drag further for more balls."}`;
    return `${t.hint}. Shift adds to the selection. Arrows nudge 1 mm, Shift+arrows 10 mm.`;
  })();

  // ------------------------------------------------------------ drawing
  const v = toView;
  const baulk = v({ x: 0, y: BAULK_Y }).x;
  const brown = v(SPOTS.brown);
  const marquee =
    gesture?.kind === "marquee"
      ? (() => {
          const a = v(gesture.start);
          const b = v(gesture.now);
          return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
        })()
      : null;
  const measureLive = tool === "measure" && measure.length === 1 && hover ? [measure[0], hover] : measure;
  const single = selected.length === 1 ? selected[0] : null;
  const inset = refInset;
  const overlay = image && refMode === "overlay";
  const empty = balls.length === 0;

  const drawBall = (b: Ball, kind: "real" | "auto" | "ghost") => {
    const c = v(b);
    const look = LOOK[b.color];
    const isSel = kind === "real" && selection.has(b.id);
    const bad = kind !== "ghost" && (clashes.has(b.id) || offBed.has(b.id));
    return (
      <g
        key={`${kind}-${b.id}`}
        data-ball={kind === "ghost" ? undefined : b.id}
        className={kind === "ghost" ? "rb-ghost" : tool === "line" || tool === "diagonal" || tool === "measure" ? "" : "rb-ball"}
        opacity={kind === "ghost" ? 0.5 : 1}
      >
        {kind !== "ghost" ? <title>{kind === "auto" ? `${look.label}, on its spot automatically. Drag to move it.` : `${look.label} · along ${fmt(b.y)} · across ${fmt(TABLE.width - b.x)}`}</title> : null}
        {isSel ? <circle cx={c.x} cy={c.y} r={BALL_R + 11} fill="none" stroke={GUIDE} strokeWidth={6} /> : null}
        {bad ? <circle cx={c.x} cy={c.y} r={BALL_R + 11} fill="none" stroke="#ff5a6e" strokeWidth={5} strokeDasharray="9 7" /> : null}
        <circle cx={c.x} cy={c.y} r={BALL_R} fill={look.fill} stroke={look.edge} strokeWidth={3} />
        {kind === "auto" ? <circle cx={c.x} cy={c.y} r={BALL_R * 0.32} fill="rgba(255,255,255,0.55)" /> : null}
        {/* A bigger, invisible hit area, so small balls are easy to grab. */}
        {kind !== "ghost" ? <circle cx={c.x} cy={c.y} r={BALL_R + 14} fill="transparent" /> : null}
      </g>
    );
  };

  return (
    <div className="rb-editor">
      <div className="rb-work">
        <div className="card rb-toolbar">
          <div className="rb-head">
            <div>
              <h2 className="card-title">{layout.displayName}</h2>
              <p className="card-sub rb-sub">
                {dirty ? <span className="rb-unsaved">Unsaved changes</span> : "Layout saved"} · {balls.length} placed
                {autos.length ? ` + ${autos.length} on spots` : ""}
              </p>
            </div>
            <div className="rb-head-actions">
              <button type="button" className="btn btn-sm" onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                Undo
              </button>
              <button type="button" className="btn btn-sm" onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Shift+Z)">
                Redo
              </button>
              <button type="button" className="btn btn-sm" onClick={revert} disabled={!dirty} title="Back to what's saved in the app">
                Revert
              </button>
              <button type="button" className="btn btn-sm btn-danger-ghost" onClick={clearAll} disabled={empty}>
                Clear
              </button>
            </div>
          </div>

          <div className="rb-tools">
            <div className="segmented" role="toolbar" aria-label="Tool">
              {TOOLS.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={tool === t.value}
                  aria-selected={tool === t.value}
                  title={`${t.hint} (${t.key})`}
                  onClick={() => {
                    setTool(t.value);
                    setMeasure([]);
                    setHover(null);
                  }}
                >
                  {t.label}
                  <kbd>{t.key}</kbd>
                </button>
              ))}
            </div>
            <div className="rb-palette" role="radiogroup" aria-label="Ball colour">
              {COLOURS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={colour === c}
                  aria-label={LOOK[c].label}
                  title={`${LOOK[c].label} (${LOOK[c].key})`}
                  className="rb-swatch"
                  style={{ background: LOOK[c].fill, borderColor: LOOK[c].edge }}
                  onClick={() => {
                    setColour(c);
                    if (tool === "select" || tool === "measure") setTool("place");
                  }}
                />
              ))}
            </div>
          </div>

          <div className="rb-options">
            {tool === "pack" ? (
              <>
                <label className="rb-opt">
                  <span>Size</span>
                  <select value={packSize} onChange={(event) => setPackSize(Number(event.target.value))}>
                    {PACK_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size} balls
                      </option>
                    ))}
                  </select>
                </label>
                <label className="rb-opt">
                  <span>Points to</span>
                  <select value={packFacing} onChange={(event) => setPackFacing(event.target.value as PackFacing)}>
                    <option value="baulk">Baulk (as racked)</option>
                    <option value="black">The black</option>
                  </select>
                </label>
                <button type="button" className="btn btn-sm" onClick={() => placePack(PACK_FRONT_BEHIND_PINK, "baulk")} title="The front ball just behind the pink spot">
                  Rack behind the pink
                </button>
              </>
            ) : null}
            {tool === "line" || tool === "diagonal" ? (
              <>
                <label className="rb-opt">
                  <span>Spacing</span>
                  <select value={spacing} onChange={(event) => setSpacing(event.target.value)}>
                    {SPACINGS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                {spacing === "custom" ? (
                  <label className="rb-opt">
                    <span>mm</span>
                    <input type="number" min={1} step={0.5} value={customSpacing} onChange={(event) => setCustomSpacing(event.target.value)} />
                  </label>
                ) : null}
                <label className="rb-opt">
                  <span>Count</span>
                  <input type="number" min={1} max={40} placeholder="Auto" value={count} onChange={(event) => setCount(event.target.value)} />
                </label>
              </>
            ) : null}
            <label className="rb-opt">
              <span>Grid</span>
              <select value={grid} onChange={(event) => setGrid(event.target.value)}>
                {GRIDS.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="rb-opt">
              <span>Zoom</span>
              <select value={zoom} onChange={(event) => setZoom(parseFloat(event.target.value))}>
                <option value={1}>Fit</option>
                <option value={1.5}>150%</option>
                <option value={2}>200%</option>
                <option value={3}>300%</option>
              </select>
            </label>
            {image ? (
              <>
                <label className="rb-opt">
                  <span>Reference</span>
                  <select value={refMode} onChange={(event) => setRefMode(event.target.value as RefMode)}>
                    <option value="above">Above the table</option>
                    <option value="overlay">Traced over it</option>
                    <option value="off">Hidden</option>
                  </select>
                </label>
                {overlay ? (
                  <>
                    <label className="rb-opt rb-range">
                      <span>See-through</span>
                      <input type="range" min={10} max={90} value={refOpacity} onChange={(event) => setRefOpacity(Number(event.target.value))} />
                    </label>
                    <label className="rb-opt rb-range">
                      <span>Fit</span>
                      <input type="range" min={-60} max={160} value={refInset} onChange={(event) => setRefInset(Number(event.target.value))} />
                    </label>
                  </>
                ) : null}
              </>
            ) : (
              <span className="rb-opt muted small">No reference image for this one</span>
            )}
          </div>
        </div>

        {image && refMode === "above" ? (
          <figure className="card rb-ref">
            <img src={image} alt={`Reference layout for ${layout.displayName}`} />
            <figcaption className="muted small">Reference picture, for tracing. It's a separate file: saving the layout doesn't change it, and the app draws the table from the layout instead whenever balls are placed.</figcaption>
          </figure>
        ) : null}

        <div className="card rb-table-card">
          <div className="rb-canvas" style={{ cursor: tool === "select" ? "default" : "crosshair" }}>
            <svg
              ref={svgRef}
              className="rb-svg"
              viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
              style={{ width: `${zoom * 100}%` }}
              role="application"
              aria-label={`Table layout for ${layout.displayName}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => setGesture(null)}
              onPointerLeave={() => {
                if (!gesture) setHover(null);
              }}
            >
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

              {overlay ? (
                <image
                  href={image!}
                  x={inset}
                  y={inset}
                  width={VIEW_W - inset * 2}
                  height={VIEW_H - inset * 2}
                  preserveAspectRatio="none"
                  opacity={refOpacity / 100}
                  pointerEvents="none"
                />
              ) : null}

              {hover && (gesture?.kind !== "marquee") ? (
                <g pointerEvents="none">
                  {hover.guideX !== null && hover.guideX !== undefined ? (
                    <line x1={RAIL} x2={RAIL + TABLE.length} y1={v({ x: hover.guideX, y: 0 }).y} y2={v({ x: hover.guideX, y: 0 }).y} stroke={GUIDE} strokeWidth={3} strokeDasharray="14 12" />
                  ) : null}
                  {hover.guideY !== null && hover.guideY !== undefined ? (
                    <line x1={v({ x: 0, y: hover.guideY }).x} x2={v({ x: 0, y: hover.guideY }).x} y1={RAIL} y2={RAIL + TABLE.width} stroke={GUIDE} strokeWidth={3} strokeDasharray="14 12" />
                  ) : null}
                </g>
              ) : null}

              {autos.map((b) => drawBall(b, "auto"))}
              {balls.map((b) => drawBall(b, "real"))}

              {tool === "place" && hover && !gesture ? drawBall({ id: "ghost", color: colour, x: hover.x, y: hover.y }, "ghost") : null}
              {packPreview.length ? (
                <g pointerEvents="none" opacity={packFits ? 1 : 0.35}>
                  {packPreview.map((p, i) => drawBall({ id: `pack-${i}`, color: colour, x: p.x, y: p.y }, "ghost"))}
                </g>
              ) : null}
              {gesture?.kind === "line" ? (
                <g pointerEvents="none">
                  {linePreview.map((p, i) => drawBall({ id: `preview-${i}`, color: colour, x: p.x, y: p.y }, "ghost"))}
                  <circle cx={v(gesture.start).x} cy={v(gesture.start).y} r={14} fill="none" stroke={GUIDE} strokeWidth={5} />
                </g>
              ) : null}

              {measureLive.length ? (
                <g pointerEvents="none">
                  {measureLive.length === 2 ? (
                    <line
                      x1={v(measureLive[0]).x}
                      y1={v(measureLive[0]).y}
                      x2={v(measureLive[1]).x}
                      y2={v(measureLive[1]).y}
                      stroke={GUIDE}
                      strokeWidth={6}
                      strokeDasharray="22 14"
                    />
                  ) : null}
                  {measureLive.map((p, i) => (
                    <circle key={i} cx={v(p).x} cy={v(p).y} r={14} fill="none" stroke={GUIDE} strokeWidth={5} />
                  ))}
                  {measureLive.length === 2 ? (
                    <text
                      className="rb-measure-label"
                      x={(v(measureLive[0]).x + v(measureLive[1]).x) / 2}
                      y={(v(measureLive[0]).y + v(measureLive[1]).y) / 2 - 30}
                      textAnchor="middle"
                    >
                      {fmt(Math.hypot(measureLive[1].x - measureLive[0].x, measureLive[1].y - measureLive[0].y))} mm
                    </text>
                  ) : null}
                </g>
              ) : null}

              {marquee ? <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(227,193,90,0.12)" stroke={GUIDE} strokeWidth={3} strokeDasharray="12 8" pointerEvents="none" /> : null}
            </svg>
          </div>
          <p className="rb-status" aria-live="polite">
            {status}
          </p>
          {empty ? (
            <p className="rb-note">
              Nothing placed yet. With no balls, the app shows this routine's reference image instead of a table.
            </p>
          ) : null}
        </div>
      </div>

      <aside className="rb-side">
        <section className="card rb-panel">
          <h3 className="section-title">{single ? LOOK[single.color].label : selected.length ? `${selected.length} balls` : "Selection"}</h3>
          {single ? (
            <>
              <div className="rb-xy">
                <label className="rb-field">
                  <span>Along</span>
                  <input
                    key={`along-${single.id}-${single.y}`}
                    type="number"
                    step={0.5}
                    defaultValue={fmt(single.y)}
                    onBlur={(event) => setPosition(single.id, "along", parseFloat(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                  />
                  <em>mm from the black end</em>
                </label>
                <label className="rb-field">
                  <span>Across</span>
                  <input
                    key={`across-${single.id}-${single.x}`}
                    type="number"
                    step={0.5}
                    defaultValue={fmt(TABLE.width - single.x)}
                    onBlur={(event) => setPosition(single.id, "across", parseFloat(event.target.value))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") (event.target as HTMLInputElement).blur();
                    }}
                  />
                  <em>mm from the top cushion</em>
                </label>
              </div>
              <dl className="rb-dist">
                <div>
                  <dt>Black-end cushion</dt>
                  <dd>{fmt(single.y)}</dd>
                </div>
                <div>
                  <dt>Baulk cushion</dt>
                  <dd>{fmt(TABLE.length - single.y)}</dd>
                </div>
                <div>
                  <dt>Top cushion</dt>
                  <dd>{fmt(TABLE.width - single.x)}</dd>
                </div>
                <div>
                  <dt>Bottom cushion</dt>
                  <dd>{fmt(single.x)}</dd>
                </div>
                <div>
                  <dt>Baulk line</dt>
                  <dd>{single.y > BAULK_Y ? `${fmt(single.y - BAULK_Y)} in baulk` : `${fmt(BAULK_Y - single.y)} up`}</dd>
                </div>
              </dl>
              <p className="rb-hint">Distances are to the ball's centre, in mm.</p>
            </>
          ) : selected.length ? null : (
            <p className="rb-hint">Click a ball to see exactly where it is, or drag a box around several to move them together.</p>
          )}
          {selected.length ? (
            <>
              <div className="rb-recolour" aria-label="Change colour">
                {COLOURS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="rb-swatch rb-swatch-sm"
                    style={{ background: LOOK[c].fill, borderColor: LOOK[c].edge }}
                    title={`Make ${selected.length === 1 ? "it" : "them"} ${LOOK[c].label.toLowerCase()}`}
                    aria-label={`Make ${selected.length === 1 ? "it" : "them"} ${LOOK[c].label.toLowerCase()}`}
                    onClick={() => recolour(c)}
                  />
                ))}
              </div>
              <div className="rb-actions">
                {selected.length > 1 ? (
                  <>
                    <button type="button" className="btn btn-sm" onClick={() => align("x")} title="Same distance from the top cushion">
                      Level in a row
                    </button>
                    <button type="button" className="btn btn-sm" onClick={() => align("y")} title="Same distance from the black end">
                      Level in a column
                    </button>
                  </>
                ) : null}
                <button type="button" className="btn btn-sm" onClick={mirror} title="Flip top to bottom across the middle of the table">
                  Mirror
                </button>
                <button type="button" className="btn btn-sm btn-danger-ghost" onClick={removeSelected}>
                  Delete
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="card rb-panel">
          <div className="rb-panel-head">
            <h3 className="section-title">Colours on their spots</h3>
            <div className="rb-mini">
              <button type="button" className="link-btn" onClick={() => allSpots(true)}>
                All
              </button>
              <button type="button" className="link-btn" onClick={() => allSpots(false)}>
                None
              </button>
            </div>
          </div>
          <div className="rb-spots">
            {SPOT_COLOURS.map((c) => {
              const on = layout.spotMarkers.includes(`spot-${c}`);
              const placed = balls.some((b) => b.color === c);
              return (
                <button key={c} type="button" className={on ? "rb-spot on" : "rb-spot"} aria-pressed={on} onClick={() => toggleSpot(c)} title={placed ? `${LOOK[c].label} is placed by hand, so its spot stays empty` : undefined}>
                  <span className="rb-spot-ball" style={{ background: LOOK[c].fill, borderColor: LOOK[c].edge }} />
                  {LOOK[c].label}
                  {on && placed ? <span className="rb-spot-note">placed</span> : null}
                </button>
              );
            })}
          </div>
          <p className="rb-hint">The app puts these on their spots unless you've placed that colour yourself.</p>
        </section>

        <section className="card rb-panel">
          <h3 className="section-title">
            Balls <span className="title-count">{balls.length}</span>
          </h3>
          {clashes.size || offBed.size ? (
            <p className="rb-warn">
              {clashes.size ? `${clashes.size} balls overlap. ` : ""}
              {offBed.size ? `${offBed.size} sit off the bed.` : ""}
            </p>
          ) : null}
          {balls.length ? (
            <ul className="rb-balls">
              {balls.map((b) => (
                <li key={b.id} className={selection.has(b.id) ? "on" : undefined}>
                  <button
                    type="button"
                    className="rb-ball-row"
                    onClick={(event) => setSelection(event.shiftKey ? new Set([...selection, b.id]) : new Set([b.id]))}
                  >
                    <span className="rb-spot-ball" style={{ background: LOOK[b.color].fill, borderColor: LOOK[b.color].edge }} />
                    <span className="rb-ball-name">{LOOK[b.color].label}</span>
                    <span className="rb-ball-pos">
                      {fmt(b.y)} · {fmt(TABLE.width - b.x)}
                    </span>
                    {clashes.has(b.id) || offBed.has(b.id) ? <span className="rb-flag">!</span> : null}
                  </button>
                  <button type="button" className="rb-del" aria-label={`Delete ${LOOK[b.color].label.toLowerCase()} ${b.id}`} onClick={() => setBalls(balls.filter((x) => x.id !== b.id))}>
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rb-hint">None yet. Pick Place or Line and click the table.</p>
          )}
        </section>

        <section className="card rb-panel">
          <label className="field">
            <span className="section-title">Notes</span>
            <textarea
              key={layout.routineId}
              rows={3}
              defaultValue={layout.notes}
              placeholder="Where these positions came from, for next time"
              onBlur={(event) => {
                if (event.target.value !== layout.notes) update({ notes: event.target.value });
              }}
            />
          </label>
        </section>
      </aside>
    </div>
  );
}
