import { describe, expect, test } from "bun:test";
import { stalls } from "../../lib/liveness/emission";
import { heuristicAnalyzer, THRESHOLDS } from "../../lib/liveness/heuristic";
import { injectionScore } from "../../lib/liveness/injection";
import { CROP, dipCenters, SCHEDULE_STEP_MS, SCHEDULE_STEPS, settledDipCenters } from "../../src/shared/liveness";
import { macbookFaceTime } from "../fixtures/device-reports";
import { scheduleFor } from "../fixtures/metrics";
import { renderCapture, scenario, type SyntheticCapture } from "../fixtures/synth-scene";

/** Paint times as a display at `hz` produces them: each step on the first frame after its beat. */
function paintsAt(hz: number, stall?: { readonly atStep: number; readonly ms: number }): number[] {
  const frame = 1000 / hz;
  const paints: number[] = [];
  let step = 0;
  for (let t = 0; step < SCHEDULE_STEPS; t += frame) {
    const shown = stall && step >= stall.atStep && t < stall.atStep * SCHEDULE_STEP_MS + stall.ms ? -1 : t;
    while (shown >= 0 && step * SCHEDULE_STEP_MS <= shown && step < SCHEDULE_STEPS) {
      paints.push(shown);
      step++;
    }
  }
  return paints;
}

describe("the paint log", () => {
  test("display timing on a 60 Hz or 30 Hz screen is not a stall", () => {
    for (const hz of [60, 30, 120]) {
      const { totalMs, maxMs } = stalls(paintsAt(hz));
      expect(totalMs).toBe(0);
      expect(maxMs).toBeLessThan(1000 / hz + 1);
      expect(maxMs).toBeLessThan(THRESHOLDS.maxStallSingleMs);
    }
  });

  test("a stuck stream shows as the time stuck and how far the screen fell behind", () => {
    const { totalMs, maxMs } = stalls(paintsAt(60, { atStep: 40, ms: 300 }));
    expect(maxMs).toBeGreaterThanOrEqual(300);
    expect(maxMs).toBeLessThan(340);
    expect(totalMs).toBeGreaterThanOrEqual(240);
    expect(totalMs).toBeLessThan(300);
    expect(maxMs).toBeGreaterThan(THRESHOLDS.maxStallSingleMs);
  });

  test("steps never painted count as a stall at the end", () => {
    const { totalMs, maxMs } = stalls(paintsAt(60).slice(0, 80));
    expect(totalMs).toBeGreaterThanOrEqual(20 * SCHEDULE_STEP_MS);
    expect(maxMs).toBeGreaterThanOrEqual(20 * SCHEDULE_STEP_MS);
  });
});

describe("dips in a streamed schedule", () => {
  const bright = [200, 200, 200] as const;
  const dark = [40, 40, 40] as const;
  const colors = [bright, bright, bright, dark, dark, dark, bright, bright, dark, dark];

  test("a dip still arriving has no center yet; the whole schedule closes it", () => {
    expect(dipCenters(colors, SCHEDULE_STEP_MS)).toEqual([80, 170]);
    expect(settledDipCenters(colors, SCHEDULE_STEP_MS)).toEqual([80]);
    expect(settledDipCenters(colors.slice(0, 5), SCHEDULE_STEP_MS)).toEqual([]);
    expect(settledDipCenters(colors.slice(0, 7), SCHEDULE_STEP_MS)).toEqual([80]);
  });
});

/** The frames swaying side to side by a dozen pixels every second or so, as a face moving about does. */
function jostled(capture: SyntheticCapture): SyntheticCapture {
  const frameBytes = CROP * CROP * 3;
  const pixels = new Uint8Array(capture.pixels.length);
  for (let f = 0; f < capture.frameCount; f++) {
    const shift = Math.round(14 * Math.sin(f / 3));
    for (let y = 0; y < CROP; y++) {
      for (let x = 0; x < CROP; x++) {
        const source = f * frameBytes + (y * CROP + Math.min(CROP - 1, Math.max(0, x - shift))) * 3;
        pixels.set(capture.pixels.subarray(source, source + 3), f * frameBytes + (y * CROP + x) * 3);
      }
    }
  }
  return { ...capture, pixels };
}

describe("frame-to-frame change", () => {
  const replay = scenario("replay", 11);
  const capture = renderCapture(replay, scheduleFor(replay));

  test("light that doesn't follow the schedule fails when the face held still", () => {
    const decision = heuristicAnalyzer.analyze(capture, scheduleFor(replay));
    expect(decision.kind).toBe("fail");
  });

  test("but asks a face that moved about to hold still instead", () => {
    const decision = heuristicAnalyzer.analyze(jostled(capture), scheduleFor(replay));
    expect(decision).toMatchObject({ kind: "retry", reason: "moved" });
  });

  test("a still face through a denoising camera is not a padded source", () => {
    // Consecutive frames that differ by well under one code per byte, never by exactly nothing.
    const frameBytes = CROP * CROP * 3;
    const frames = 40;
    const pixels = new Uint8Array(frames * frameBytes).fill(120);
    for (let f = 0; f < frames; f++) {
      for (let i = f % 3; i < frameBytes; i += 3) {
        pixels[f * frameBytes + i] = 121;
      }
    }
    const times = Array.from({ length: frames }, (_, f) => 10 + f * 33.3 + (f % 2) * 1.5);
    const quiet = injectionScore(macbookFaceTime, { times, pixels, frameCount: frames });
    expect(quiet.duplicateShare).toBe(0);
    const padded = injectionScore(macbookFaceTime, {
      times,
      pixels: new Uint8Array(frames * frameBytes).fill(120),
      frameCount: frames,
    });
    expect(padded.duplicateShare).toBe(1);
    expect(padded.score).toBeGreaterThanOrEqual(0.3);
  });
});
