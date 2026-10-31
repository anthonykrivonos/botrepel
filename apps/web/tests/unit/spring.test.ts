import { describe, expect, test } from "bun:test";
import { type Spring, stepSpring } from "../../src/utils/spring";

const run = (spring: Spring, target: number, seconds: number, limit = 1): Spring => {
  let state = spring;
  for (let step = 0; step < seconds * 60; step++) {
    state = stepSpring(state, target, 1 / 60, limit);
  }
  return state;
};

describe("stepSpring", () => {
  test("settles on its target", () => {
    const settled = run({ value: 0, velocity: 0 }, 0.2, 3);
    expect(settled.value).toBeCloseTo(0.2, 3);
    expect(Math.abs(settled.velocity)).toBeLessThan(1e-3);
  });

  test("keeps its momentum when the target changes", () => {
    const moving = run({ value: 0, velocity: 0 }, 0.2, 0.1);
    const next = stepSpring(moving, -0.2, 1 / 60, 1);
    expect(moving.velocity).toBeGreaterThan(0);
    expect(next.value).toBeGreaterThan(moving.value);
  });

  test("never passes its limit", () => {
    const pushed = run({ value: 0, velocity: 5 }, 1, 2, 0.26);
    expect(Math.abs(pushed.value)).toBeLessThanOrEqual(0.26);
  });
});
