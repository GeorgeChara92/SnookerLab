import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { Check, Play, QrCode, Undo2, Sparkles } from "lucide-react";
import { R, SPOT, T, Table, at, type TableBall } from "./Table";

const mid = T.width / 2;
const SPRING = { type: "spring", duration: 0.45, bounce: 0 } as const;
const fromCentre = { transformBox: "fill-box", transformOrigin: "center" } as const;

/** Runs a looping sequence of steps while on screen; a still, finished frame for reduced motion. */
function useSequence(steps: number, delays: (step: number) => number) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.35 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (reduced) {
      setStep(steps - 1);
      return;
    }
    if (!inView) return;
    const timer = setTimeout(() => setStep((current) => (current + 1) % steps), delays(step));
    return () => clearTimeout(timer);
  }, [inView, reduced, step, steps, delays]);
  return { ref, step };
}

// ---------------------------------------------------------------- routine builder

type Placed = { ball: TableBall; x: number; y: number };

// A line-up: reds down the middle of the table between the blue and the black, colours on their spots.
const LINE_UP: Placed[] = [
  { ball: "black", ...SPOT.black },
  { ball: "pink", ...SPOT.pink },
  { ball: "blue", ...SPOT.blue },
  ...[560, 720, 1050, 1210, 1370, 1530].map((along) => ({ ball: "red" as const, ...at(mid, along) })),
  { ball: "brown", ...SPOT.brown },
  { ball: "green", ...SPOT.green },
  { ball: "yellow", ...SPOT.yellow },
  { ball: "cue", ...at(mid + 120, T.length - T.baulk + 160) },
];

const PALETTE: TableBall[] = ["red", "yellow", "green", "brown", "blue", "pink", "black", "cue"];
const builderDelay = (step: number) => (step === 0 ? 700 : step >= LINE_UP.length ? 2600 : 420);

export function RoutineBuilderDemo() {
  const { ref, step } = useSequence(LINE_UP.length + 1, builderDelay);
  const placed = LINE_UP.slice(0, step);
  const current = LINE_UP[Math.min(step, LINE_UP.length - 1)].ball;
  const done = step >= LINE_UP.length;

  return (
    <div className="demo builder" ref={ref}>
      <div className="demo-bar">
        <span className="demo-title">New routine</span>
        <span className="demo-chip">
          <Undo2 aria-hidden="true" strokeWidth={2} /> Undo
        </span>
      </div>
      <Table label="A routine being built: the line-up, with the reds down the middle and the colours on their spots">
        <AnimatePresence>
          {placed.map((item, index) => (
            <motion.circle
              key={index}
              cx={item.x}
              cy={item.y}
              r={R * 1.25}
              fill={`url(#ball-${item.ball})`}
              style={fromCentre}
              initial={{ scale: 0.25, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.2 } }}
              transition={SPRING}
            />
          ))}
        </AnimatePresence>
        {done && (
          <motion.path
            d={`M ${LINE_UP[LINE_UP.length - 1].x} ${LINE_UP[LINE_UP.length - 1].y} L ${LINE_UP[8].x + 40} ${LINE_UP[8].y}`}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={8}
            strokeDasharray="22 20"
            fill="none"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
          />
        )}
      </Table>
      <div className="demo-palette" aria-hidden="true">
        {PALETTE.map((ball) => (
          <span key={ball} className={`palette-ball ${ball === current && !done ? "on" : ""}`}>
            <i className={`ball ${ball}`} />
          </span>
        ))}
      </div>
      <div className="demo-foot">
        <span>
          Line-up · target <b className="num">40</b>
        </span>
        <AnimatePresence>
          {done && (
            <motion.span
              className="demo-chip ok"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={SPRING}
            >
              <QrCode aria-hidden="true" strokeWidth={2} /> Share
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- scan snooker

type Pos = { ball: TableBall; x: number; y: number };

// Where the balls were when the snooker was laid, and where they ended up after the miss.
const BEFORE: Pos[] = [
  { ball: "cue", ...at(420, 900) },
  { ball: "red", ...at(1180, 1150) },
  { ball: "red", ...at(1320, 1480) },
  { ball: "blue", ...at(mid, T.length / 2) },
  { ball: "black", ...at(760, 420) },
  { ball: "pink", ...at(1050, 830) },
];
const AFTER: Pos[] = [
  { ball: "cue", ...at(1460, 2350) },
  { ball: "red", ...at(1230, 1380) },
  { ball: "red", ...at(1320, 1480) },
  { ball: "blue", ...at(760, 1990) },
  { ball: "black", ...at(760, 420) },
  { ball: "pink", ...at(1180, 960) },
];

const PHASES = ["Record", "Miss", "Replace", "Done"] as const;
const scanDelay = (step: number) => [1800, 1500, 1700, 2400][step];

export function ScanDemo({ caption = true }: { caption?: boolean }) {
  const { ref, step } = useSequence(PHASES.length, scanDelay);
  const moved = step === 1 || step === 2;
  const ghosts = step >= 2;

  return (
    <div className="demo scan" ref={ref}>
      <div className="viewfinder">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        <div className="scan-tilt">
          <Table label="Scan Snooker: the balls are recorded, moved by a miss, then put back where they were using ghosts on the table">
            {ghosts &&
              BEFORE.map((ball, index) => (
                <motion.g key={`ghost-${index}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <circle cx={ball.x} cy={ball.y} r={R * 1.9} fill="rgba(255,255,255,0.08)" stroke="#e9f7ef" strokeWidth={7} strokeDasharray="14 10" />
                </motion.g>
              ))}
            {BEFORE.map((ball, index) => {
              const where = moved ? AFTER[index] : ball;
              return (
                <motion.circle
                  key={index}
                  r={R * 1.25}
                  fill={`url(#ball-${ball.ball})`}
                  initial={false}
                  animate={{ cx: where.x, cy: where.y }}
                  transition={{ type: "spring", duration: step === 1 ? 0.9 : 0.7, bounce: 0 }}
                />
              );
            })}
            {step === 0 && (
              <motion.rect
                x={-120}
                y={-120}
                width={T.length + 240}
                height={T.width + 240}
                fill="#ffffff"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6 }}
              />
            )}
          </Table>
        </div>
      </div>
      {caption && (
        <ol className="scan-steps" aria-hidden="true">
          {PHASES.slice(0, 3).map((phase, index) => (
            <li key={phase} className={step === index || (step === 3 && index === 2) ? "on" : ""}>
              <span className="num">{index + 1}</span>
              {phase}
              {step === 3 && index === 2 && <Check aria-hidden="true" strokeWidth={2.5} />}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Setting a routine up for real: ghosts show where each ball goes on the actual table. */
export function ArRoutineDemo() {
  const { ref, step } = useSequence(LINE_UP.length + 2, (s) => (s === 0 ? 900 : s > LINE_UP.length ? 2400 : 380));
  return (
    <div className="demo scan" ref={ref}>
      <div className="viewfinder">
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        <div className="scan-tilt">
          <Table label="Setting up a routine: ghosts on the real table show where each ball goes">
            {LINE_UP.map((item, index) => (
              <circle key={`g-${index}`} cx={item.x} cy={item.y} r={R * 1.9} fill="rgba(255,255,255,0.07)" stroke="#e9f7ef" strokeWidth={6} strokeDasharray="14 10" />
            ))}
            <AnimatePresence>
              {LINE_UP.slice(0, Math.max(0, step - 1)).map((item, index) => (
                <motion.circle
                  key={index}
                  cx={item.x}
                  cy={item.y}
                  r={R * 1.25}
                  fill={`url(#ball-${item.ball})`}
                  style={fromCentre}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={SPRING}
                />
              ))}
            </AnimatePresence>
          </Table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- ai coach

const FINDINGS = [
  { time: "0:04", area: "Stance", text: "Back foot drifts before the cue arm settles. Set your feet first, then go down." },
  { time: "0:11", area: "Cue action", text: "The elbow drops on the follow-through, pushing the cue ball off line on longer pots." },
  { time: "0:19", area: "Position", text: "Two of the three misses came from landing on the wrong side of the blue." },
];

/** An illustration of a coach report, with the parts the real one has: clip, moments, focus, routines. */
export function CoachReport() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.3 });
  return (
    <div className="coach-report" ref={ref}>
      <div className="coach-head">
        <span className="coach-badge">
          <Sparkles aria-hidden="true" strokeWidth={2} /> AI coach report
        </span>
        <span className="coach-example">Example</span>
      </div>
      <div className="coach-clip" aria-hidden="true">
        <Table label="" className="coach-table">
          <circle cx={SPOT.blue.x} cy={SPOT.blue.y} r={R * 1.3} fill="url(#ball-blue)" />
          <circle cx={SPOT.pink.x + 120} cy={SPOT.pink.y - 180} r={R * 1.3} fill="url(#ball-red)" />
          <circle cx={SPOT.brown.x - 300} cy={SPOT.brown.y + 120} r={R * 1.3} fill="url(#ball-cue)" />
        </Table>
        <span className="coach-play">
          <Play aria-hidden="true" strokeWidth={2.25} />
        </span>
        <span className="coach-scrub">
          {[16, 44, 76].map((left) => (
            <i key={left} style={{ left: `${left}%` }} />
          ))}
        </span>
      </div>
      <ul className="coach-findings">
        {FINDINGS.map((finding, index) => (
          <motion.li
            key={finding.time}
            initial={{ opacity: 0, y: 10 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ delay: 0.2 + index * 0.12, duration: 0.45, ease: [0.2, 0, 0, 1] }}
          >
            <span className="coach-time num">{finding.time}</span>
            <span>
              <strong>{finding.area}</strong>
              {finding.text}
            </span>
          </motion.li>
        ))}
      </ul>
      <motion.div
        className="coach-focus"
        initial={{ opacity: 0, y: 10 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ delay: 0.6, duration: 0.45, ease: [0.2, 0, 0, 1] }}
      >
        <span>Routines for you</span>
        <div>
          <em>Straight pots</em>
          <em>Stance drill</em>
          <em>Blue to pink</em>
        </div>
      </motion.div>
    </div>
  );
}
