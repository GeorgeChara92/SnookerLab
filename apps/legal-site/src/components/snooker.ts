export type Ball = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";

export const VALUE: Record<Ball, number> = { red: 1, yellow: 2, green: 3, brown: 4, blue: 5, pink: 6, black: 7 };
export const COLOURS: Ball[] = ["yellow", "green", "brown", "blue", "pink", "black"];

export type Frame = {
  reds: number;
  /** After a red, any colour is on; otherwise a red (or the next colour once the reds are gone). */
  colourOn: boolean;
  /** Once the reds are gone, the colours go down in order: this is the next one. */
  nextColour: number;
  score: number;
  currentBreak: number;
  highBreak: number;
  potted: Ball[];
  done: boolean;
};

export const newFrame = (reds = 15): Frame => ({
  reds,
  colourOn: false,
  nextColour: 0,
  score: 0,
  currentBreak: 0,
  highBreak: 0,
  potted: [],
  done: false,
});

/** Which balls can be potted next. */
export const onBalls = (frame: Frame): Ball[] => {
  if (frame.done) return [];
  if (frame.colourOn) return COLOURS;
  if (frame.reds > 0) return ["red"];
  return [COLOURS[frame.nextColour]];
};

/** Points still on the table: 8 for each red with its black, the colour after a red, then the colours. */
export const remaining = (frame: Frame): number => {
  const colours = COLOURS.slice(frame.nextColour).reduce((sum, ball) => sum + VALUE[ball], 0);
  return frame.reds * 8 + (frame.colourOn ? 7 : 0) + colours;
};

export const pot = (frame: Frame, ball: Ball): Frame => {
  if (!onBalls(frame).includes(ball)) return frame;
  const currentBreak = frame.currentBreak + VALUE[ball];
  const base = {
    ...frame,
    score: frame.score + VALUE[ball],
    currentBreak,
    highBreak: Math.max(frame.highBreak, currentBreak),
    potted: [...frame.potted, ball],
  };
  if (ball === "red") return { ...base, reds: frame.reds - 1, colourOn: true };
  if (frame.colourOn) return { ...base, colourOn: false };
  const nextColour = frame.nextColour + 1;
  return { ...base, nextColour, done: nextColour >= COLOURS.length };
};

/** A miss ends the break; the frame carries on. */
export const miss = (frame: Frame): Frame =>
  frame.done ? frame : { ...frame, colourOn: false, currentBreak: 0, potted: [] };
