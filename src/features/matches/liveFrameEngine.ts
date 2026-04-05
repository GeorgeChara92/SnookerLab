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
  phase: LivePhase;
  nextColorIndex: number;
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

const makeId = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const nowIso = () => new Date().toISOString();

const appendEvent = (state: LiveFrameState, event: Omit<LiveFrameEvent, "id" | "timestamp">): LiveFrameState => ({
  ...state,
  events: [{ id: makeId(), timestamp: nowIso(), ...event }, ...state.events],
});

const finalizeCurrentBreak = (
  state: LiveFrameState,
  endedBy: "visit_end" | "foul" | "switch" | "frame_end"
): LiveFrameState => {
  if (state.currentBreak <= 0) return state;

  const entry: BreakEntry = {
    player: state.atTable,
    points: state.currentBreak,
    endedBy,
    timestamp: nowIso(),
  };

  const highestBreakUser =
    state.atTable === "user" ? Math.max(state.highestBreakUser, state.currentBreak) : state.highestBreakUser;
  const highestBreakOpponent =
    state.atTable === "opponent" ? Math.max(state.highestBreakOpponent, state.currentBreak) : state.highestBreakOpponent;

  return {
    ...state,
    currentBreak: 0,
    highestBreakUser,
    highestBreakOpponent,
    breakHistory: [entry, ...state.breakHistory],
  };
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
  phase: "reds",
  nextColorIndex: 0,
});

export const getPointsRemaining = (state: LiveFrameState): number => {
  if (state.phase === "ended") return 0;
  if (state.phase === "reds") {
    return state.redsRemaining * 8 + 27;
  }
  return COLOR_SEQUENCE.slice(state.nextColorIndex).reduce((acc, color) => acc + BALL_POINTS[color], 0);
};

export const getSnookersRequired = (state: LiveFrameState):
  | { player: LiveSide; count: number; scoreDiff: number; pointsRemaining: number }
  | undefined => {
  const pointsRemaining = getPointsRemaining(state);
  const scoreDiff = Math.abs(state.userScore - state.opponentScore);
  if (scoreDiff <= pointsRemaining) return undefined;

  const trailing: LiveSide = state.userScore < state.opponentScore ? "user" : "opponent";
  const snookers = Math.ceil((scoreDiff - pointsRemaining) / 4);

  return {
    player: trailing,
    count: Math.max(1, snookers),
    scoreDiff,
    pointsRemaining,
  };
};

export const potBall = (state: LiveFrameState, ball: LiveBall): LiveFrameState => {
  if (state.phase === "ended") return state;

  if (state.phase === "colors") {
    const expected = COLOR_SEQUENCE[state.nextColorIndex];
    if (ball !== expected) return state;
  }

  const points = BALL_POINTS[ball];
  const scoreField = state.atTable === "user" ? "userScore" : "opponentScore";

  let next: LiveFrameState = {
    ...state,
    [scoreField]: state[scoreField] + points,
    currentBreak: state.currentBreak + points,
  } as LiveFrameState;

  if (ball === "red" && next.phase === "reds") {
    next.redsRemaining = Math.max(0, next.redsRemaining - 1);
    if (next.redsRemaining === 0) {
      next.phase = "colors";
      next.nextColorIndex = 0;
    }
  }

  if (next.phase === "colors") {
    const expected = COLOR_SEQUENCE[next.nextColorIndex];
    if (ball === expected) {
      next.nextColorIndex += 1;
      if (next.nextColorIndex >= COLOR_SEQUENCE.length) {
        next.phase = "ended";
        next = finalizeCurrentBreak(next, "frame_end");
      }
    }
  }

  next = appendEvent(next, { kind: "pot", player: state.atTable, ball, points });
  return next;
};

export const endVisit = (state: LiveFrameState): LiveFrameState => {
  let next = finalizeCurrentBreak(state, "visit_end");
  next = {
    ...next,
    atTable: next.atTable === "user" ? "opponent" : "user",
  };
  return appendEvent(next, { kind: "visit_end", player: state.atTable });
};

export const switchPlayer = (state: LiveFrameState): LiveFrameState => {
  let next = finalizeCurrentBreak(state, "switch");
  next = {
    ...next,
    atTable: next.atTable === "user" ? "opponent" : "user",
  };
  return appendEvent(next, { kind: "switch", player: state.atTable });
};

export const recordFoul = (
  state: LiveFrameState,
  foulValue: 4 | 5 | 6 | 7,
  foulType: LiveFoulType,
  note?: string
): LiveFrameState => {
  let next = finalizeCurrentBreak(state, "foul");

  if (state.atTable === "user") {
    next.opponentScore += foulValue;
    next.atTable = "opponent";
  } else {
    next.userScore += foulValue;
    next.atTable = "user";
  }

  return appendEvent(next, {
    kind: "foul",
    player: state.atTable,
    foulValue,
    foulType,
    note,
    points: foulValue,
  });
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
