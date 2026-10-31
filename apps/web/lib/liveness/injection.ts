import type { InjectionScores } from "./analyzer";
import type { Capture } from "./decode";
import { pairDifferences } from "./frames";
import type { SourceSignals } from "../../src/shared/liveness";

/**
 * Labels virtual cameras announce themselves with. Matched case-insensitively as substrings, then
 * discarded: the label is never stored. A renamed device gets past this; that's why it's a score.
 */
export const VIRTUAL_CAMERA_LABELS = [
  "obs",
  "virtual",
  "manycam",
  "snap camera",
  "camtwist",
  "xsplit",
  "mmhmm",
  "v4l2loopback",
  "dummy",
  "unity video",
  "droidcam",
  "iriun",
  "epoccam",
  "ndi",
] as const;

/** A real sensor's frame intervals vary by a few percent; a file or a software source keeps a perfect beat. */
const REGULAR_INTERVAL_CV = 0.02;
/**
 * Consecutive frames this close are the same frame shown twice: a slow source padded to the
 * camera's rate. A repeated frame differs by exactly 0; a still face through a camera that
 * denoises over time (a MacBook Pro's) still differs by 0.26–1.1 per sampled byte.
 */
const DUPLICATE_MEAN_DIFF = 0.05;
const DUPLICATE_SHARE = 0.3;

export const INJECTION_WEIGHTS = {
  virtualLabel: 0.5,
  noDeviceId: 0.2,
  emptyCapabilities: 0.2,
  noCaptureTime: 0.2,
  regularTiming: 0.2,
  duplicates: 0.3,
  displaySurface: 0.5,
} as const;

/** How many consecutive frames are (nearly) identical. */
function duplicateShare(capture: Pick<Capture, "pixels" | "frameCount">): number {
  const diffs = pairDifferences(capture);
  return diffs.length ? diffs.filter((diff) => diff < DUPLICATE_MEAN_DIFF).length / diffs.length : 0;
}

/** Coefficient of variation of the intervals between capture times. */
export function intervalVariation(times: readonly number[]): number {
  if (times.length < 3) {
    return 1;
  }
  const intervals = times.slice(1).map((t, i) => t - times[i]!);
  const mean = intervals.reduce((sum, v) => sum + v, 0) / intervals.length;
  const variance = intervals.reduce((sum, v) => sum + (v - mean) ** 2, 0) / intervals.length;
  return mean > 0 ? Math.sqrt(variance) / mean : 1;
}

/**
 * `timing` is for camera-paced frames (the flash set); the widget paces pose frames itself, so
 * their regular beat says nothing.
 */
export function injectionScore(
  source: SourceSignals,
  capture: Pick<Capture, "times" | "pixels" | "frameCount">,
  options: { readonly timing?: boolean } = {},
): InjectionScores {
  const label = (source.label ?? "").toLowerCase();
  const virtualLabel = label.length > 0 && VIRTUAL_CAMERA_LABELS.some((known) => label.includes(known));
  const noDeviceId = source.deviceId === false;
  const emptyCapabilities = source.capabilities !== undefined && source.capabilities <= 2;
  const noCaptureTime = source.rvfc === true && source.captureTime === false;
  const displaySurface = source.displaySurface === true;
  const intervalCv = options.timing === false ? Number.NaN : intervalVariation(capture.times);
  const duplicates = duplicateShare(capture);
  const score = Math.min(
    1,
    (virtualLabel ? INJECTION_WEIGHTS.virtualLabel : 0) +
      (noDeviceId ? INJECTION_WEIGHTS.noDeviceId : 0) +
      (emptyCapabilities ? INJECTION_WEIGHTS.emptyCapabilities : 0) +
      (noCaptureTime ? INJECTION_WEIGHTS.noCaptureTime : 0) +
      (intervalCv < REGULAR_INTERVAL_CV ? INJECTION_WEIGHTS.regularTiming : 0) +
      (duplicates > DUPLICATE_SHARE ? INJECTION_WEIGHTS.duplicates : 0) +
      (displaySurface ? INJECTION_WEIGHTS.displaySurface : 0),
  );
  return {
    score: Math.round(score * 1000) / 1000,
    virtualLabel,
    noDeviceId,
    emptyCapabilities,
    noCaptureTime,
    displaySurface,
    intervalCv: Number.isNaN(intervalCv) ? 1 : Math.round(intervalCv * 10_000) / 10_000,
    duplicateShare: Math.round(duplicates * 1000) / 1000,
  };
}
