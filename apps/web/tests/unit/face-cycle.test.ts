import { describe, expect, test } from "bun:test";
import { FACE_DISSOLVE_S, FACE_HOLD_S, dissolveOrder, faceMix } from "../../src/utils/faceCycle";

const PERIOD = FACE_HOLD_S + FACE_DISSOLVE_S;

describe("faceMix", () => {
  test("holds the first face, then dissolves into the next", () => {
    expect(faceMix(1, 3)).toEqual({ from: 0, to: 1, progress: 0 });
    const halfway = faceMix(FACE_HOLD_S + FACE_DISSOLVE_S / 2, 3);
    expect(halfway).toMatchObject({ from: 0, to: 1 });
    expect(halfway.progress).toBeCloseTo(0.5, 5);
  });

  test("loops back to the first face after the last", () => {
    expect(faceMix(2 * PERIOD + 1, 3)).toMatchObject({ from: 2, to: 0, progress: 0 });
    expect(faceMix(3 * PERIOD + 1, 3)).toMatchObject({ from: 0, to: 1, progress: 0 });
  });

  test("begins on the given face and still visits every face in order", () => {
    expect(faceMix(1, 3, 2)).toEqual({ from: 2, to: 0, progress: 0 });
    expect(faceMix(PERIOD + 1, 3, 2)).toMatchObject({ from: 0, to: 1 });
    expect(faceMix(2 * PERIOD + 1, 3, 2)).toMatchObject({ from: 1, to: 2 });
  });

  test("a single face never dissolves", () => {
    expect(faceMix(FACE_HOLD_S + 1, 1)).toEqual({ from: 0, to: 0, progress: 0 });
  });
});

describe("dissolveOrder", () => {
  test("stays within 0–1 and is the same for the same point", () => {
    for (let index = 0; index < 500; index++) {
      const order = dissolveOrder(index, 1.1 - (index % 23) / 10);
      expect(order).toBeGreaterThanOrEqual(0);
      expect(order).toBeLessThanOrEqual(1);
      expect(dissolveOrder(index, 1.1 - (index % 23) / 10)).toBe(order);
    }
  });
});
