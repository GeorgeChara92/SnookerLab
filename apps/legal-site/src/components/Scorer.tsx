import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { RotateCcw } from "lucide-react";
import { Board } from "./Scoreboard";
import { COLOURS, VALUE, miss, newFrame, onBalls, pot, remaining, type Ball } from "./snooker";

const ALL: Ball[] = ["red", ...COLOURS];
const LABEL: Record<Ball, string> = {
  red: "Red",
  yellow: "Yellow",
  green: "Green",
  brown: "Brown",
  blue: "Blue",
  pink: "Pink",
  black: "Black",
};

/** Have a go: score a break the way the app does, one tap per ball. */
export function Scorer() {
  const [frame, setFrame] = useState(() => newFrame());
  const on = onBalls(frame);
  const left = remaining(frame);

  const hint = frame.done
    ? `Frame over. You scored ${frame.score}, with a high break of ${frame.highBreak}.`
    : frame.colourOn
      ? "Red down. Now any colour."
      : frame.reds > 0
        ? frame.potted.length === 0
          ? "Tap a red to start the break."
          : "Colour down and respotted. Back on a red."
        : `The reds are gone. The ${LABEL[on[0]].toLowerCase()} is next.`;

  return (
    <div className="scorer">
      <Board
        you={{ name: "You", points: frame.score, frames: 0, atTable: !frame.done }}
        them={{ name: "Danny", points: 0, frames: 0 }}
        frame={1}
        bestOf={1}
        currentBreak={frame.currentBreak}
        balls={frame.potted}
        live={false}
        compact
      />

      <div className="scorer-stats" aria-live="polite">
        <div>
          <span>Reds left</span>
          <b className="num">{frame.reds}</b>
        </div>
        <div>
          <span>On the table</span>
          <b className="num">{left}</b>
        </div>
        <div>
          <span>High break</span>
          <b className="num">{frame.highBreak}</b>
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={hint}
          className="scorer-hint"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
        >
          {hint}
        </motion.p>
      </AnimatePresence>

      <div className="scorer-balls" role="group" aria-label="Pot a ball">
        {ALL.map((ball) => {
          const enabled = on.includes(ball);
          return (
            <button
              key={ball}
              type="button"
              className={`scorer-ball ${ball}`}
              disabled={!enabled}
              aria-label={`Pot the ${LABEL[ball].toLowerCase()}, ${VALUE[ball]} point${VALUE[ball] > 1 ? "s" : ""}`}
              onClick={() => setFrame((current) => pot(current, ball))}
            >
              <span className="ball" />
              <span className="scorer-value num">{VALUE[ball]}</span>
            </button>
          );
        })}
      </div>

      <div className="scorer-actions">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setFrame((current) => miss(current))}
          disabled={frame.done || frame.currentBreak === 0}
        >
          Missed it
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setFrame(newFrame())}>
          <RotateCcw aria-hidden="true" strokeWidth={2} />
          Re-rack
        </button>
      </div>
    </div>
  );
}
