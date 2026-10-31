import { expect, test } from "bun:test";
import { bestShift } from "../../src/widget/pose-track";

const SIDE = 32;

/** Fixed, non-repeating texture, so no other shift matches as well as the true one. */
const texture = (u: number, v: number): number => {
  let h = Math.imul(u + 1000, 0x9e3779b1) ^ Math.imul(v + 1000, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d);
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39);
  return (h ^ (h >>> 15)) & 0xff;
};

/** The texture shifted by (dx, dy): what a face moving across the crop looks like. */
const frame = (dx: number, dy: number): Float32Array => {
  const pixels = new Float32Array(SIDE * SIDE);
  for (let y = 0; y < SIDE; y++) {
    for (let x = 0; x < SIDE; x++) {
      pixels[y * SIDE + x] = texture(x - dx, y - dy);
    }
  }
  return pixels;
};

test("the patch follows the face's move within the search window", () => {
  for (const [dx, dy] of [
    [0, 0],
    [3, 0],
    [-2, 1],
    [1, -3],
  ] as const) {
    expect(bestShift(frame(0, 0), frame(dx, dy), SIDE, 8, 8, 12, 4)).toEqual({ dx, dy });
  }
});

test("a uniform frame reads as still, and the search never leaves the frame", () => {
  const flat = new Float32Array(SIDE * SIDE).fill(90);
  expect(bestShift(flat, flat, SIDE, 8, 8, 12, 4)).toEqual({ dx: 0, dy: 0 });
  const shift = bestShift(frame(0, 0), frame(4, 4), SIDE, SIDE - 12, SIDE - 12, 12, 4);
  expect(shift.dx).toBeLessThanOrEqual(0);
  expect(shift.dy).toBeLessThanOrEqual(0);
});
