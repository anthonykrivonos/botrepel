import { describe, expect, test } from "bun:test";
import { CaptureError, decodeFlashCapture } from "../../lib/liveness/decode";
import { heuristicAnalyzer, THRESHOLDS } from "../../lib/liveness/heuristic";
import { newSchedule } from "../../lib/liveness/schedule";
import {
  CROP,
  MAX_FLASH_UPLOAD_BYTES,
  packCapture,
  SCHEDULE_MS,
  SCHEDULE_STEP_MS,
  type FlashHeader,
} from "../../src/shared/liveness";
import { synthCapture } from "../fixtures/synth-face";

const schedule = newSchedule();

describe("the flash schedule", () => {
  test("is one-time, covers the full duration, and stays out of saturated red", () => {
    expect(schedule.colors).toHaveLength(SCHEDULE_MS / SCHEDULE_STEP_MS);
    expect(JSON.stringify(newSchedule())).not.toBe(JSON.stringify(schedule));
    for (const [r, g, b] of schedule.colors) {
      expect(r > 200 && g < 40 && b < 40).toBe(false);
    }
  });

  test("holds brightness steady except for at most two ramped dips (WCAG 2.3.1)", () => {
    for (let run = 0; run < 50; run++) {
      const colors = newSchedule().colors;
      const linear = (value: number): number =>
        value / 255 <= 0.04045 ? value / 255 / 12.92 : ((value / 255 + 0.055) / 1.055) ** 2.4;
      const luminance = colors.map(([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b));
      const peak = Math.max(...luminance);
      // The hue sweep keeps luminance above 88% of its peak; anything darker is a dip or its ramp.
      const dimmed = luminance.map((value) => value < peak * 0.85);
      const dips = dimmed.filter((isDim, i) => isDim && !dimmed[i - 1]).length;
      expect(dips).toBeGreaterThanOrEqual(1);
      expect(dips).toBeLessThanOrEqual(2);
      // WCAG counts a flash as a relative-luminance change of 0.1 or more; outside the dips there are none.
      const steady = luminance.filter((_, i) => !dimmed[i]);
      expect(Math.max(...steady) - Math.min(...steady)).toBeLessThan(0.1);
    }
  });
});

describe("the heuristic analyzer", () => {
  test("a 3D face reflecting the schedule in real time passes, through camera noise and sway", () => {
    const decision = heuristicAnalyzer.analyze(synthCapture(schedule, { realistic: true }), schedule);
    expect(decision.kind).toBe("pass");
    expect(decision.scores.correlation).toBeGreaterThan(0.9);
    expect(Math.abs(decision.scores.lagMs)).toBeLessThanOrEqual(35);
  });

  test("a flat print reflects uniformly and fails", () => {
    expect(heuristicAnalyzer.analyze(synthCapture(schedule, { shape: "flat", realistic: true }), schedule).kind).toBe(
      "fail",
    );
  });

  test("a flat print held inside the frame fails, though its edge meets an unlit background", () => {
    const capture = synthCapture(schedule, { shape: "flat", framing: { scale: 0.7, dx: 3, dy: -2 }, realistic: true });
    expect(heuristicAnalyzer.analyze(capture, schedule).kind).toBe("fail");
  });

  test("a real camera's latency, the screen shown before the check, and auto-exposure drift still pass", () => {
    // As a MacBook Pro's built-in camera behaves: 4 frames late, white before the schedule, brightening.
    const decision = heuristicAnalyzer.analyze(
      synthCapture(schedule, { delayFrames: 4, before: [255, 255, 255], exposureRamp: 0.1, realistic: true }),
      schedule,
    );
    expect(decision).toMatchObject({ kind: "pass" });
    expect(decision.scores.lagMs).toBeGreaterThan(100);
    expect(decision.scores.lagMs).toBeLessThan(170);
  });

  test("finds a face that sits small and off-center in the crop, in front of a skin-toned wall", () => {
    const decision = heuristicAnalyzer.analyze(
      synthCapture(schedule, { framing: { scale: 0.6, dx: 10, dy: -12 }, delayFrames: 4, realistic: true }),
      schedule,
    );
    expect(decision).toMatchObject({ kind: "pass" });
  });

  test("a reflection that trails past the accepted lag, as a slow relighting injector's would, fails", () => {
    const decision = heuristicAnalyzer.analyze(synthCapture(schedule, { delayFrames: 10, realistic: true }), schedule);
    expect(decision.kind).toBe("fail");
    expect(decision.scores.lagMs).toBeGreaterThan(THRESHOLDS.maxLagMs);
  });

  test("too little screen light asks for a retry instead of failing", () => {
    const decision = heuristicAnalyzer.analyze(synthCapture(schedule, { screenStrength: 0.01 }), schedule);
    expect(decision).toMatchObject({ kind: "retry", reason: "too-faint" });
  });

  test("a surface that isn't skin-colored asks to center the face", () => {
    const decision = heuristicAnalyzer.analyze(synthCapture(schedule, { albedo: [0.2, 0.3, 0.9] }), schedule);
    expect(decision).toMatchObject({ kind: "retry", reason: "no-face" });
  });

  test("passes across a range of skin tones", () => {
    for (const albedo of [
      [0.92, 0.72, 0.62],
      [0.62, 0.42, 0.32],
      [0.36, 0.24, 0.18],
    ] as const) {
      // The whole decision, so a failure shows its scores.
      expect(heuristicAnalyzer.analyze(synthCapture(schedule, { albedo, realistic: true }), schedule)).toMatchObject({
        kind: "pass",
      });
    }
  });
});

describe("decoding uploads", () => {
  const capture = synthCapture(schedule, { frames: 40 });
  const header: FlashHeader = {
    v: 2,
    times: capture.times,
    keyTimes: [],
    paintTimes: Array.from({ length: SCHEDULE_MS / SCHEDULE_STEP_MS }, (_, k) => k * SCHEDULE_STEP_MS),
    whiteBalanceLocked: true,
    exposureLocked: false,
    source: { label: "Test Camera", deviceId: true },
  };

  test("round-trips a packed, gzipped capture", () => {
    const decoded = decodeFlashCapture(Bun.gzipSync(packCapture(header, capture.pixels)));
    expect(decoded.frameCount).toBe(40);
    expect(decoded.exposureLocked).toBe(false);
    expect(decoded.pixels.length).toBe(40 * CROP * CROP * 3);
    expect(decoded.keyFrameCount).toBe(0);
    expect(decoded.source.label).toBe("Test Camera");
  });

  test("refuses a decompression bomb without inflating it", () => {
    const bomb = Bun.gzipSync(new Uint8Array(64 * 1024 * 1024));
    expect(bomb.length).toBeLessThan(MAX_FLASH_UPLOAD_BYTES);
    const started = performance.now();
    expect(() => decodeFlashCapture(bomb)).toThrow(CaptureError);
    expect(performance.now() - started).toBeLessThan(500);
  });

  test("rejects malformed captures with a CaptureError", () => {
    expect(() => decodeFlashCapture(new Uint8Array([1, 2, 3]))).toThrow(CaptureError);
    expect(() => decodeFlashCapture(Bun.gzipSync(packCapture(header, capture.pixels.subarray(0, 1000))))).toThrow(
      CaptureError,
    );
    const shuffled = { ...header, times: [...header.times].reverse() };
    expect(() => decodeFlashCapture(Bun.gzipSync(packCapture(shuffled, capture.pixels)))).toThrow(CaptureError);
    // Unknown header fields and the old protocol are refused outright.
    const stale = { ...header, v: 1 } as unknown as FlashHeader;
    expect(() => decodeFlashCapture(Bun.gzipSync(packCapture(stale, capture.pixels)))).toThrow(CaptureError);
    const extra = { ...header, extra: 1 } as unknown as FlashHeader;
    expect(() => decodeFlashCapture(Bun.gzipSync(packCapture(extra, capture.pixels)))).toThrow(CaptureError);
  });
});
