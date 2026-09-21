import {
  concludeFrame,
  createInitialLiveFrameState,
  endVisit,
  getMinimumFoulValue,
  getPointsRemaining,
  getSnookersRequired,
  potBall,
  recordFoul,
  type LiveBall,
  type LiveFrameState,
  lastBallFor,
} from "../liveFrameEngine";

const pots = (state: LiveFrameState, balls: LiveBall[]) => balls.reduce(potBall, state);

/** Pots all 15 reds, each followed by a black: a 120 break for whoever is at the table. */
const redsAndBlacks = (state: LiveFrameState) => {
  let next = state;
  for (let i = 0; i < 15; i += 1) next = pots(next, ["red", "black"]);
  return next;
};

const COLOURS: LiveBall[] = ["yellow", "green", "brown", "blue", "pink", "black"];

describe("liveFrameEngine", () => {
  it("scores a maximum 147 and ends the frame", () => {
    const frame = pots(redsAndBlacks(createInitialLiveFrameState(1)), COLOURS);
    expect(frame.userScore).toBe(147);
    expect(frame.phase).toBe("ended");
    expect(frame.highestBreakUser).toBe(147);
    expect(frame.currentBreak).toBe(0);
  });

  it("enforces red then colour while reds remain", () => {
    const start = createInitialLiveFrameState(1);
    expect(potBall(start, "black")).toBe(start);
    const afterRed = potBall(start, "red");
    expect(potBall(afterRed, "red")).toBe(afterRed);
    expect(potBall(afterRed, "pink").userScore).toBe(7);
  });

  describe("fouls", () => {
    it("does not mutate the previous state, so undo restores it exactly", () => {
      // On the pink with no break in progress: previously the penalty leaked into the undo snapshot.
      let frame = redsAndBlacks(createInitialLiveFrameState(1));
      frame = endVisit(pots(frame, ["yellow", "green", "brown", "blue"]));
      const snapshot = JSON.parse(JSON.stringify(frame));

      const afterFoul = recordFoul(frame, 6, "other");

      expect(frame).toEqual(snapshot);
      expect(afterFoul.userScore).toBe(frame.userScore + 6);
      expect(afterFoul.atTable).toBe("user");
    });

    it("raises the penalty to the value of the ball on", () => {
      let frame = redsAndBlacks(createInitialLiveFrameState(1));
      frame = pots(frame, ["yellow", "green", "brown", "blue"]); // pink on
      expect(getMinimumFoulValue(frame)).toBe(6);
      const afterFoul = recordFoul(frame, 4, "other");
      expect(afterFoul.opponentScore).toBe(6);
      expect(afterFoul.events[0].foulValue).toBe(6);
    });

    it("banks the break in progress when a foul ends the visit", () => {
      const frame = recordFoul(pots(createInitialLiveFrameState(1), ["red", "black", "red"]), 4, "in_off");
      expect(frame.highestBreakUser).toBe(9);
      expect(frame.opponentScore).toBe(4);
      expect(frame.awaitingColorAfterRed).toBe(false);
    });
  });

  describe("after the last red", () => {
    const lastRedPotted = () => {
      let frame = createInitialLiveFrameState(1);
      for (let i = 0; i < 14; i += 1) frame = pots(frame, ["red", "black"]);
      return potBall(frame, "red");
    };

    it("moves to the yellow when the colour is missed", () => {
      const frame = endVisit(lastRedPotted());
      expect(frame.phase).toBe("colors");
      expect(potBall(frame, "black")).toBe(frame);
      expect(potBall(frame, "yellow").opponentScore).toBe(2);
      expect(getPointsRemaining(frame)).toBe(27);
    });

    it("does not skip the yellow when yellow is taken as the final colour", () => {
      const frame = potBall(lastRedPotted(), "yellow");
      expect(frame.phase).toBe("colors");
      expect(frame.nextColorIndex).toBe(0);
      expect(getPointsRemaining(frame)).toBe(27);
    });

    it("counts the colour still on in points remaining", () => {
      expect(getPointsRemaining(lastRedPotted())).toBe(34);
    });
  });

  describe("the final black", () => {
    const onTheBlack = (userScore: number, opponentScore: number) => ({
      ...createInitialLiveFrameState(1),
      phase: "colors" as const,
      redsRemaining: 0,
      nextColorIndex: 5,
      userScore,
      opponentScore,
    });

    it("re-spots the black when scores are level", () => {
      const frame = potBall(onTheBlack(50, 57), "black");
      expect(frame.phase).toBe("colors");
      expect(frame.respottedBlack).toBe(true);
      expect(frame.nextColorIndex).toBe(5);

      const decided = potBall(endVisit(frame), "black");
      expect(decided.phase).toBe("ended");
      expect(decided.opponentScore).toBe(64);
    });

    it("ends the frame on a foul", () => {
      const frame = recordFoul(onTheBlack(60, 40), 4, "other");
      expect(frame.phase).toBe("ended");
      expect(frame.opponentScore).toBe(47);
    });

    it("re-spots the black when a foul levels the scores", () => {
      const frame = recordFoul(onTheBlack(47, 40), 7, "other");
      expect(frame.phase).toBe("colors");
      expect(frame.respottedBlack).toBe(true);
    });
  });

  describe("concluding a frame", () => {
    it("banks the break in progress (e.g. a concession mid-century)", () => {
      let frame = createInitialLiveFrameState(1);
      for (let i = 0; i < 13; i += 1) frame = pots(frame, ["red", "black"]);
      expect(frame.currentBreak).toBe(104);

      const concluded = concludeFrame(frame);
      expect(concluded.phase).toBe("ended");
      expect(concluded.highestBreakUser).toBe(104);
      expect(concluded.breakHistory[0].endedBy).toBe("frame_end");
    });

    it("stops reporting snookers required once the frame has ended", () => {
      let frame = createInitialLiveFrameState(1);
      for (let i = 0; i < 13; i += 1) frame = pots(frame, ["red", "black"]);
      expect(getSnookersRequired(frame)?.player).toBe("opponent");
      expect(getSnookersRequired(concludeFrame(frame))).toBeUndefined();
    });
  });

  it("sizes snookers by the value of the ball on", () => {
    const frame = {
      ...createInitialLiveFrameState(1),
      phase: "colors" as const,
      redsRemaining: 0,
      nextColorIndex: 5,
      userScore: 30,
      opponentScore: 0,
    };
    // 30 ahead with 7 left: needs 23 from fouls worth 7 each.
    expect(getSnookersRequired(frame)?.count).toBe(4);
  });
});

describe("the ball behind each score", () => {
  it("follows the real frame: red, then the colour, then the white when the visit ends", () => {
    let frame = createInitialLiveFrameState(1);
    expect(lastBallFor(frame.events, "user")).toBe("cue");
    frame = potBall(frame, "red");
    expect(lastBallFor(frame.events, "user")).toBe("red");
    frame = potBall(frame, "blue");
    expect(lastBallFor(frame.events, "user")).toBe("blue");
    frame = potBall(frame, "red");
    frame = potBall(frame, "pink");
    expect(lastBallFor(frame.events, "user")).toBe("pink");
    frame = endVisit(frame);
    expect(lastBallFor(frame.events, "user")).toBe("cue");
  });

  it("is not changed by the other player's shots", () => {
    let frame = pots(createInitialLiveFrameState(1), ["red", "black"]);
    frame = endVisit(frame); // the opponent is at the table now
    frame = pots(frame, ["red", "yellow"]);
    expect(lastBallFor(frame.events, "opponent")).toBe("yellow");
    expect(lastBallFor(frame.events, "user")).toBe("cue");
  });

  it("goes back to the white after a foul", () => {
    const frame = recordFoul(potBall(createInitialLiveFrameState(1), "red"), 4, "other");
    expect(lastBallFor(frame.events, "user")).toBe("cue");
  });
});
