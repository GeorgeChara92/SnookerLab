export type LiveSide = "user" | "opponent";
export type LiveBall = "red" | "yellow" | "green" | "brown" | "blue" | "pink" | "black";
export type LivePhase = "reds" | "colors" | "ended";
export type LiveFoulType = "in_off" | "foul_and_miss" | "push_shot" | "touching_ball" | "wrong_ball" | "other";
export type LiveEventKind = "pot" | "foul" | "visit_end" | "switch" | "re_rack" | "frame_saved";

export type BreakEntry = {
  player: LiveSide;
  points: number;
  endedBy: "visit_end" | "foul" | "switch" | "frame_end";
  timestamp: string;
};

export type LiveFrameEvent = {
  id: string;
  kind: LiveEventKind;
  timestamp: string;
  player?: LiveSide;
  ball?: LiveBall;
  points?: number;
  foulValue?: 4 | 5 | 6 | 7;
  foulType?: LiveFoulType;
  note?: string;
};

export type LiveFrameState = {
  frameNumber: number;
  userScore: number;
  opponentScore: number;
  atTable: LiveSide;
  currentBreak: number;
  highestBreakUser: number;
  highestBreakOpponent: number;
  breakHistory: BreakEntry[];
  events: LiveFrameEvent[];
  redsRemaining: number;
  awaitingColorAfterRed: boolean;
  phase: LivePhase;
  nextColorIndex: number;
  /** Scores were level after the final black, so the black has been re-spotted. */
  respottedBlack?: boolean;
};

export const BALL_POINTS: Record<LiveBall, number> = {
  red: 1,
  yellow: 2,
  green: 3,
  brown: 4,
  blue: 5,
  pink: 6,
  black: 7,
};

export const COLOR_SEQUENCE: LiveBall[] = ["yellow", "green", "brown", "blue", "pink", "black"];

const FINAL_BLACK_INDEX = COLOR_SEQUENCE.length - 1;

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIso = () => new Date().toISOString();

const otherSide = (side: LiveSide): LiveSide => (side === "user" ? "opponent" : "user");

const appendEvent = (state: LiveFrameState, event: Omit<LiveFrameEvent, "id" | "timestamp">): LiveFrameState => ({
  ...state,
  events: [{ id: makeId(), timestamp: nowIso(), ...event }, ...state.events],
});

/**
 * Banks the break in progress. If the visit ends while a colour is on after a red, the
 * colour is no longer on; after the last red that means the clearance starts from yellow.
 * Always returns a fresh object, so callers may mutate the result.
 */
const finalizeCurrentBreak = (
  state: LiveFrameState,
  endedBy: "visit_end" | "foul" | "switch" | "frame_end"
): LiveFrameState => {
  const next: LiveFrameState = { ...state };

  if (endedBy !== "frame_end" && next.phase === "reds" && next.awaitingColorAfterRed) {
    next.awaitingColorAfterRed = false;
    if (next.redsRemaining === 0) {
      next.phase = "colors";
      next.nextColorIndex = 0;
    }
  }

  if (state.currentBreak <= 0) return next;

  const entry: BreakEntry = {
    player: state.atTable,
    points: state.currentBreak,
    endedBy,
    timestamp: nowIso(),
  };

  next.currentBreak = 0;
  next.breakHistory = [entry, ...state.breakHistory];
  if (state.atTable === "user") {
    next.highestBreakUser = Math.max(state.highestBreakUser, state.currentBreak);
  } else {
    next.highestBreakOpponent = Math.max(state.highestBreakOpponent, state.currentBreak);
  }

  return next;
};

/** Once the final black is potted or fouled: level scores mean a re-spotted black, otherwise the frame ends. */
const resolveFinalBlack = (state: LiveFrameState, endedBy: "visit_end" | "foul"): LiveFrameState => {
  if (state.userScore === state.opponentScore) {
    return {
      ...finalizeCurrentBreak(state, endedBy),
      phase: "colors",
      nextColorIndex: FINAL_BLACK_INDEX,
      respottedBlack: true,
    };
  }

  return { ...finalizeCurrentBreak(state, "frame_end"), phase: "ended" };
};

export const createInitialLiveFrameState = (frameNumber: number, atTable: LiveSide = "user"): LiveFrameState => ({
  frameNumber,
  userScore: 0,
  opponentScore: 0,
  atTable,
  currentBreak: 0,
  highestBreakUser: 0,
  highestBreakOpponent: 0,
  breakHistory: [],
  events: [],
  redsRemaining: 15,
  awaitingColorAfterRed: false,
  phase: "reds",
  nextColorIndex: 0,
  respottedBlack: false,
});

export const isBallOn = (state: LiveFrameState, ball: LiveBall): boolean => {
  if (state.phase === "ended") return false;
  if (state.phase === "reds") return state.awaitingColorAfterRed ? ball !== "red" : ball === "red";
  return ball === COLOR_SEQUENCE[state.nextColorIndex];
};

/** Minimum foul penalty for the ball currently on (never less than 4). */
export const getMinimumFoulValue = (state: LiveFrameState): 4 | 5 | 6 | 7 => {
  if (state.phase !== "colors") return 4;
  return Math.max(4, BALL_POINTS[COLOR_SEQUENCE[state.nextColorIndex]]) as 4 | 5 | 6 | 7;
};

export const getPointsRemaining = (state: LiveFrameState): number => {
  if (state.phase === "ended") return 0;
  if (state.phase === "reds") {
    return state.redsRemaining * 8 + 27 + (state.awaitingColorAfterRed ? 7 : 0);
  }
  return COLOR_SEQUENCE.slice(state.nextColorIndex).reduce((acc, color) => acc + BALL_POINTS[color], 0);
};

export const getSnookersRequired = (state: LiveFrameState):
  | { player: LiveSide; count: number; scoreDiff: number; pointsRemaining: number }
  | undefined => {
  if (state.phase === "ended") return undefined;

  const pointsRemaining = getPointsRemaining(state);
  const scoreDiff = Math.abs(state.userScore - state.opponentScore);
  if (scoreDiff <= pointsRemaining) return undefined;

  const trailing: LiveSide = state.userScore < state.opponentScore ? "user" : "opponent";
  const snookers = Math.ceil((scoreDiff - pointsRemaining) / getMinimumFoulValue(state));

  return {
    player: trailing,
    count: Math.max(1, snookers),
    scoreDiff,
    pointsRemaining,
  };
};

export const potBall = (state: LiveFrameState, ball: LiveBall): LiveFrameState => {
  if (!isBallOn(state, ball)) return state;

  const points = BALL_POINTS[ball];
  const scoreField = state.atTable === "user" ? "userScore" : "opponentScore";

  let next: LiveFrameState = {
    ...state,
    [scoreField]: state[scoreField] + points,
    currentBreak: state.currentBreak + points,
  };

  if (state.phase === "reds") {
    if (ball === "red") {
      next.redsRemaining = Math.max(0, next.redsRemaining - 1);
      next.awaitingColorAfterRed = true;
    } else {
      // The colour after a red is re-spotted; after the last red the clearance starts from yellow.
      next.awaitingColorAfterRed = false;
      if (next.redsRemaining === 0) {
        next.phase = "colors";
        next.nextColorIndex = 0;
      }
    }
  } else {
    next.nextColorIndex += 1;
    if (next.nextColorIndex > FINAL_BLACK_INDEX) {
      next = resolveFinalBlack(next, "visit_end");
    }
  }

  return appendEvent(next, { kind: "pot", player: state.atTable, ball, points });
};

export const endVisit = (state: LiveFrameState): LiveFrameState => {
  if (state.phase === "ended") return state;
  const next = finalizeCurrentBreak(state, "visit_end");
  next.atTable = otherSide(state.atTable);
  return appendEvent(next, { kind: "visit_end", player: state.atTable });
};

export const switchPlayer = (state: LiveFrameState): LiveFrameState => {
  if (state.phase === "ended") return state;
  const next = finalizeCurrentBreak(state, "switch");
  next.atTable = otherSide(state.atTable);
  return appendEvent(next, { kind: "switch", player: state.atTable });
};

export const recordFoul = (
  state: LiveFrameState,
  foulValue: 4 | 5 | 6 | 7,
  foulType: LiveFoulType,
  note?: string
): LiveFrameState => {
  if (state.phase === "ended") return state;

  const penalty = Math.max(foulValue, getMinimumFoulValue(state)) as 4 | 5 | 6 | 7;
  let next = finalizeCurrentBreak(state, "foul");

  if (state.atTable === "user") {
    next.opponentScore += penalty;
  } else {
    next.userScore += penalty;
  }
  next.atTable = otherSide(state.atTable);

  // With only the black left, a foul ends the frame (or forces a re-spotted black if level).
  if (state.phase === "colors" && state.nextColorIndex === FINAL_BLACK_INDEX) {
    next = resolveFinalBlack(next, "foul");
  }

  return appendEvent(next, {
    kind: "foul",
    player: state.atTable,
    foulValue: penalty,
    foulType,
    note,
    points: penalty,
  });
};

/** Ends the frame where it stands (concession or abandonment), banking any break in progress. */
export const concludeFrame = (state: LiveFrameState): LiveFrameState => {
  if (state.phase === "ended") return state;
  return { ...finalizeCurrentBreak(state, "frame_end"), phase: "ended" };
};

export const reRack = (state: LiveFrameState): LiveFrameState => {
  const reset = createInitialLiveFrameState(state.frameNumber, state.atTable);
  return appendEvent(reset, { kind: "re_rack", player: state.atTable });
};

export const getFrameWinner = (state: LiveFrameState): "user" | "opponent" | "draw" => {
  if (state.userScore > state.opponentScore) return "user";
  if (state.opponentScore > state.userScore) return "opponent";
  return "draw";
};

/**
 * The ball shown behind a player's score: the last ball they potted, if their last shot was a
 * pot, or the white if it was not - a miss, a safety, a foul or no shot yet this frame. A re-rack
 * starts everyone on the white again.
 */
export const lastBallFor = (events: LiveFrameEvent[], player: LiveSide): LiveBall | "cue" => {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index];
    if (event.kind === "re_rack") return "cue";
    if (event.player !== player) continue;
    if (event.kind === "pot" && event.ball) return event.ball;
    if (event.kind === "foul" || event.kind === "visit_end" || event.kind === "switch") return "cue";
  }
  return "cue";
};
