import { expect, test } from "bun:test";
import {
  advanceRippleField,
  createRippleField,
  disturbRippleField,
  rippleDotOpacity,
} from "../../src/utils/ripple-field";

test("dot opacity falls exponentially from the pointer to a uniform baseline without rings", () => {
  const baseline = rippleDotOpacity(0, 0);
  expect(baseline).toBe(0.09);
  expect(rippleDotOpacity(0)).toBe(0.52);
  for (let distance = 0; distance < 1600; distance += 80) {
    const near = rippleDotOpacity(distance);
    const far = rippleDotOpacity(distance + 80);
    expect(far).toBeLessThan(near);
    expect(far).toBeGreaterThan(baseline);
    expect((far - baseline) / (near - baseline)).toBeCloseTo(Math.exp(-0.5), 10);
    expect(rippleDotOpacity(distance, 0)).toBe(baseline);
  }
  expect(rippleDotOpacity(1600)).toBeCloseTo(baseline, 4);
});

test("a stationary pointer leaves the water at rest", () => {
  const field = createRippleField(800, 500);
  disturbRippleField(field, { x: 300, y: 200 }, { x: 300, y: 200 });
  for (let step = 0; step < 30; step++) {
    advanceRippleField(field);
  }
  expect(field.heights.every((height) => height === 0)).toBe(true);
  expect(field.velocities.every((velocity) => velocity === 0)).toBe(true);
});

test("a moving disturbance propagates beyond the pointer trail and dissipates", () => {
  const field = createRippleField(1200, 600);
  disturbRippleField(field, { x: 240, y: 300 }, { x: 320, y: 300 });
  const energy = () => field.heights.reduce((sum, height) => sum + height * height, 0);
  const initialEnergy = energy();
  const distant = Math.round(300 / field.spacing) * field.columns + Math.round(600 / field.spacing);
  expect(field.heights[distant]).toBe(0);
  for (let step = 0; step < 60; step++) {
    advanceRippleField(field);
  }
  expect(Math.abs(field.heights[distant]!)).toBeGreaterThan(0.0001);
  for (let step = 0; step < 600; step++) {
    advanceRippleField(field);
  }
  expect(energy()).toBeLessThan(initialEnergy * 0.01);
});

test("large surfaces remain bounded and repeated fast gestures stay finite", () => {
  for (const [width, height] of [
    [390, 1800],
    [1920, 800],
    [5120, 2880],
  ] as const) {
    const field = createRippleField(width, height);
    expect(field.heights.length).toBeLessThan(4500);
    for (let step = 0; step < 90; step++) {
      const from = { x: (step % 2 ? 0.1 : 0.9) * width, y: height / 2 };
      const to = { x: width - from.x, y: height / 2 };
      disturbRippleField(field, from, to);
      advanceRippleField(field);
    }
    expect(field.heights.every(Number.isFinite)).toBe(true);
    expect(Math.max(...field.heights.map(Math.abs))).toBeLessThan(6);
  }
});
