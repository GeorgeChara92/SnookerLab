import { AimStabiliser } from "../stabilize";

const P = (x: number, y: number, z: number) => ({ x, y, z });

describe("holding the aim steady", () => {
  it("does not lock on before the hold has lasted long enough", () => {
    const s = new AimStabiliser();
    let state = s.update(P(0, 0.8, 0), 0);
    expect(state.locked).toBeNull();
    expect(state.progress).toBe(0);

    state = s.update(P(0, 0.8, 0), 300);
    expect(state.locked).toBeNull();
    expect(state.progress).toBeGreaterThan(0);
    expect(state.progress).toBeLessThan(1);
  });

  it("locks on, to the average of the hold, once held still for long enough", () => {
    const s = new AimStabiliser();
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0.001, 0.8, 0), 200); // 1mm of tremor: well inside the still radius
    const state = s.update(P(-0.001, 0.8, 0), 600);
    expect(state.progress).toBe(1);
    expect(state.locked).not.toBeNull();
    expect(state.locked!.x).toBeCloseTo(0, 4);
    expect(state.locked!.z).toBeCloseTo(0, 4);
  });

  it("starts the hold over when the aim jumps away from it", () => {
    const s = new AimStabiliser();
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0, 0.8, 0), 400);
    // A 5cm jump - aiming somewhere else, not a shaky hand - resets the clock.
    const jumped = s.update(P(0.05, 0.8, 0), 500);
    expect(jumped).toEqual({ progress: 0, locked: null });

    const stillTooSoon = s.update(P(0.05, 0.8, 0), 700);
    expect(stillTooSoon.locked).toBeNull();
    expect(stillTooSoon.progress).toBeGreaterThan(0);
    expect(stillTooSoon.progress).toBeLessThan(1);
  });

  it("resets when the camera has nothing to aim at", () => {
    const s = new AimStabiliser();
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0, 0.8, 0), 400);
    const lost = s.update(null, 500);
    expect(lost).toEqual({ progress: 0, locked: null });

    // Aiming again afterwards starts a fresh hold, not one already part-way through.
    const resumed = s.update(P(0, 0.8, 0), 550);
    expect(resumed).toEqual({ progress: 0, locked: null });
    const later = s.update(P(0, 0.8, 0), 650);
    expect(later.progress).toBeGreaterThan(0);
    expect(later.progress).toBeLessThan(0.2);
  });

  it("reset() clears an in-progress hold", () => {
    const s = new AimStabiliser();
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0, 0.8, 0), 400);
    s.reset();
    const state = s.update(P(0, 0.8, 0), 420);
    expect(state).toEqual({ progress: 0, locked: null });
    const later = s.update(P(0, 0.8, 0), 470);
    expect(later.progress).toBeGreaterThan(0);
    expect(later.progress).toBeLessThan(0.2);
  });
});
