import { describe, expect, test } from "bun:test";
import {
  ARC_NOT_STARTED,
  MIN_HEAD_MAGNITUDE,
  advanceArc,
  arcDone,
  barAngles,
  barCovered,
  inArc,
  toPoseArc,
  type ArcTolerance,
  type PoseArc,
} from "../../src/shared/pose-arc";

const lean = (angle: number) => ({ angle, magnitude: MIN_HEAD_MAGNITUDE * 2 });

/** Points the head along `angles` in turn, starting from nothing covered. */
const roll = (arc: PoseArc, angles: number[]): number =>
  angles.reduce((progress, angle) => advanceArc(arc, progress, lean(angle)), ARC_NOT_STARTED);

describe("pose arc", () => {
  test("nothing is filled until the head points near the start", () => {
    const arc = { from: 180, sweep: -360 };
    expect(barAngles().some((angle) => barCovered(arc, angle, ARC_NOT_STARTED))).toBe(false);
    expect(roll(arc, [0, 90])).toBe(ARC_NOT_STARTED);
    expect(roll(arc, [180])).toBe(0);
  });

  test("a steady roll the right way goes all the way around, wrapping past the start", () => {
    const arc = { from: 90, sweep: 360 };
    const angles = Array.from({ length: 37 }, (_, k) => 90 + k * 10);
    const progress = roll(arc, angles);
    expect(arcDone(arc, progress)).toBe(true);
    expect(barAngles().every((angle) => barCovered(arc, angle, progress))).toBe(true);
  });

  test("the wrong sense, a jump ahead, or a head held near center leaves progress alone", () => {
    const arc = { from: 0, sweep: 360 };
    const started = roll(arc, [0, 20]);
    expect(started).toBe(20);
    expect(roll(arc, [0, 20, 350, 330, 310])).toBe(20);
    expect(advanceArc(arc, started, lean(180))).toBe(20);
    expect(advanceArc(arc, started, { angle: 40, magnitude: MIN_HEAD_MAGNITUDE / 2 })).toBe(20);
    expect(arcDone(arc, roll(arc, [0, 20, 40, 60]))).toBe(false);
  });

  test("a quarter turn fills only its own bars, and only in its sense", () => {
    // From left to up, clockwise as the person sees it.
    const arc = { from: 180, sweep: -90 };
    expect(roll(arc, [180, 160, 140])).toBe(40);
    expect(roll(arc, [180, 200, 220])).toBe(0);
    const progress = roll(arc, [180, 160, 140, 120, 100, 90]);
    expect(arcDone(arc, progress)).toBe(true);
    for (const angle of barAngles()) {
      expect(barCovered(arc, angle, progress)).toBe(inArc(arc, angle));
    }
    expect(barAngles().filter((angle) => inArc(arc, angle))).toHaveLength(16);
  });

  test("the server's prompts map to ring degrees in the sense the person sees", () => {
    expect(toPoseArc({ from: "left", to: "up", clockwise: true })).toEqual({ from: 180, sweep: -90 });
    expect(toPoseArc({ from: "up", to: "down", clockwise: false })).toEqual({ from: 90, sweep: 180 });
    expect(toPoseArc({ from: "right", to: "right", clockwise: true })).toEqual({ from: 0, sweep: -360 });
  });

  test("a looser tolerance follows sparser samples, in its own magnitude units", () => {
    const arc = { from: 0, sweep: 90 };
    const loose: ArcTolerance = { minMagnitude: 6, startDeg: 20, behindDeg: 20, aheadDeg: 60 };
    const sparse = [10, 55, 95].map((angle) => ({ angle, magnitude: 12 }));
    const follow = (tolerance?: ArcTolerance): number =>
      sparse.reduce((progress, head) => advanceArc(arc, progress, head, tolerance), ARC_NOT_STARTED);
    expect(arcDone(arc, follow(loose))).toBe(true);
    // The ring's own tolerance starts at 10° but won't jump 45° ahead.
    expect(follow()).toBe(10);
    expect(advanceArc(arc, 0, { angle: 30, magnitude: 5 }, loose)).toBe(0);
  });

  test("approaching the start from the wrong side fills only the start", () => {
    const arc = { from: 270, sweep: -360 };
    // Clockwise from down is toward the left; this head swings in from the right instead.
    expect(roll(arc, [320, 300, 290, 280, 270])).toBe(0);
    expect(barAngles().filter((angle) => barCovered(arc, angle, 0))).toEqual([270]);
  });
});
