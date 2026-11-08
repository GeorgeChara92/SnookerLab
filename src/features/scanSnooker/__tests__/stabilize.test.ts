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

  it("does not throw the hold away for a single noisy reading - the closer-to-the-table case", () => {
    const s = new AimStabiliser();
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0, 0.8, 0), 150);
    // 6mm on its own: over the still radius raw, but a single raycast blip, not a real move.
    s.update(P(0.006, 0.8, 0), 300);
    s.update(P(0, 0.8, 0), 450);
    const state = s.update(P(0, 0.8, 0), 600);
    expect(state.progress).toBe(1);
    expect(state.locked).not.toBeNull();
  });
});

describe("a forgiving hold, for Record a Snooker", () => {
  const options = { stillRadiusMm: 8, resetRadiusMm: 30, windowMs: 700 };

  it("pauses on a wobble instead of emptying, then carries on filling", () => {
    const s = new AimStabiliser(options);
    s.update(P(0, 0.8, 0), 0);
    const before = s.update(P(0, 0.8, 0), 300).progress;
    // A 15mm twitch: past the still radius, nowhere near a real change of aim.
    const wobble = s.update(P(0.015, 0.8, 0), 350).progress;
    expect(wobble).toBeGreaterThanOrEqual(before);
    const after = s.update(P(0, 0.8, 0), 450).progress;
    expect(after).toBeGreaterThan(before);
  });

  it("never drops back while held near the same spot", () => {
    const s = new AimStabiliser(options);
    let last = 0;
    for (let t = 0; t <= 800; t += 50) {
      const jitter = ((t / 50) % 3) * 0.006 - 0.006; // up to 6mm either way
      const { progress } = s.update(P(jitter, 0.8, 0), t);
      expect(progress).toBeGreaterThanOrEqual(last);
      last = progress;
    }
    expect(last).toBe(1);
  });

  it("starts again when the aim really moves", () => {
    const s = new AimStabiliser(options);
    s.update(P(0, 0.8, 0), 0);
    s.update(P(0, 0.8, 0), 400);
    s.update(P(0.2, 0.8, 0), 450);
    expect(s.update(P(0.2, 0.8, 0), 460).progress).toBeLessThan(0.1);
  });
});

