import type { Capture } from "./decode";
import { CROP } from "../../src/shared/liveness";

/** Pixels sampled per frame when comparing neighbors; every so many bytes. */
const SAMPLE_STRIDE = 7;

/** Mean absolute difference between each flash frame and the one `lag` frames before it, over sampled bytes. */
export function pairDifferences(capture: Pick<Capture, "pixels" | "frameCount">, lag = 1): Float64Array {
  const frameBytes = CROP * CROP * 3;
  const diffs = new Float64Array(Math.max(0, capture.frameCount - lag));
  for (let f = lag; f < capture.frameCount; f++) {
    let diff = 0;
    let count = 0;
    for (let i = 0; i < frameBytes; i += SAMPLE_STRIDE) {
      diff += Math.abs(capture.pixels[f * frameBytes + i]! - capture.pixels[(f - lag) * frameBytes + i]!);
      count++;
    }
    diffs[f - lag] = count ? diff / count : 0;
  }
  return diffs;
}

export function median(values: Float64Array): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = Float64Array.from(values).sort();
  return sorted[sorted.length >> 1]!;
}

/**
 * How much the crop moved, beyond sensor noise: the change over two frames minus the change over
 * one. Noise is new in every frame, so it adds the same to both; a face that moves keeps moving,
 * so two frames apart it has moved about twice as far. The schedule's slow hue sweep adds little.
 */
export function motion(capture: Pick<Capture, "pixels" | "frameCount">): number {
  return Math.max(0, median(pairDifferences(capture, 2)) - median(pairDifferences(capture, 1)));
}
