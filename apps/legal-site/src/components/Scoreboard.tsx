import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useInView, useReducedMotion } from "motion/react";
import { VALUE, type Ball } from "./snooker";

type Side = { name: string; points: number; frames: number; atTable?: boolean };

type BoardProps = {
  you: Side;
  them: Side;
  frame: number;
  bestOf: number;
  currentBreak: number;
  balls: Ball[];
  live?: boolean;
  compact?: boolean;
};

/** A number that rolls when it changes, like a broadcast graphic. */
function Rolling({ value, className }: { value: number; className?: string }) {
  return (
    <span className={`roll ${className ?? ""}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          initial={{ y: "-60%", opacity: 0, filter: "blur(4px)" }}
          animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
          exit={{ y: "60%", opacity: 0, filter: "blur(4px)" }}
          transition={{ type: "spring", duration: 0.35, bounce: 0 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

/** The TV-style scoreboard: names at either end of the rows, frames large, the break underneath. */
export function Board({ you, them, frame, bestOf, currentBreak, balls, live = true, compact }: BoardProps) {
  return (
    <div className={`board ${compact ? "compact" : ""}`}>
      <div className="board-head">
        {live ? (
          <span className="live-pill">
            <i />
            Live
          </span>
        ) : (
          <span />
        )}
        <span className="board-meta">
          Frame <b className="num">{frame}</b> · Best of {bestOf}
        </span>
      </div>
      {[you, them].map((side) => (
        <div className="board-row" key={side.name}>
          <span className={`at-table ${side.atTable ? "on" : ""}`} />
          <span className="board-name">{side.name}</span>
          <Rolling value={side.points} className="board-points" />
          <Rolling value={side.frames} className="board-frames" />
        </div>
      ))}
      <div className="board-break">
        <span className="board-break-label">
          Break <Rolling value={currentBreak} className="board-break-value" />
        </span>
        <span className="board-balls" aria-hidden="true">
          <AnimatePresence initial={false}>
            {balls.map((ball, index) => (
              <motion.i
                key={`${index}-${ball}`}
                className={`ball ${ball}`}
                initial={{ scale: 0.25, opacity: 0, filter: "blur(4px)" }}
                animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, transition: { duration: 0.15 } }}
                transition={{ type: "spring", duration: 0.3, bounce: 0 }}
              />
            ))}
          </AnimatePresence>
        </span>
      </div>
    </div>
  );
}

// A 76 break: reds with colours, mostly the black.
const BREAK: Ball[] = ["red", "black", "red", "black", "red", "pink", "red", "black", "red", "black",
  "red", "blue", "red", "black", "red", "black", "red", "pink", "red", "black"];

/** The hero's scoreboard, building a break ball by ball while it is on screen. */
export function LiveBoard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const reduced = useReducedMotion();
  const [step, setStep] = useState(reduced ? 12 : 0);
  const [won, setWon] = useState(false);

  useEffect(() => {
    if (!inView || reduced) return;
    if (step >= BREAK.length) {
      setWon(true);
      const again = setTimeout(() => {
        setWon(false);
        setStep(0);
      }, 3200);
      return () => clearTimeout(again);
    }
    const next = setTimeout(() => setStep((current) => current + 1), step === 0 ? 900 : BREAK[step - 1] === "red" ? 650 : 900);
    return () => clearTimeout(next);
  }, [inView, reduced, step]);

  const balls = BREAK.slice(0, step);
  const points = balls.reduce((sum, ball) => sum + VALUE[ball], 0);
  return (
    <div ref={ref} role="img" aria-label="A live scoreboard: a break building, ball by ball">
      <Board
        you={{ name: "You", points, frames: won ? 3 : 2, atTable: !won }}
        them={{ name: "Danny", points: 38, frames: 1 }}
        frame={4}
        bestOf={7}
        currentBreak={points}
        balls={balls}
      />
    </div>
  );
}
