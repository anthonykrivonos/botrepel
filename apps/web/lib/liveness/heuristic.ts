import type { FlashScores, FlashStage, LivenessDecision, LivenessScores, StageResult } from "./analyzer";
import { LINEAR, toSrgb } from "./color";
import type { Capture, FlashCapture } from "./decode";
import { emittedColorAt, nominalEmission, stalls, type Emission } from "./emission";
import { CENTER_REGION, findFaceRegions, MIN_FACE_REGIONS, type FaceRegion } from "./face";
import { motion as measureMotion } from "./frames";
import { correlation, detrend, mean, slope, standardDeviation, variation, type Series } from "./series";
import { specularCheck, UNMEASURED } from "./specular";
import { CROP, SCHEDULE_MS, SCHEDULE_STEPS, type Schedule } from "../../src/shared/liveness";

/**
 * Thresholds from synthetic captures and one real device (a MacBook Pro's built-in camera); they
 * need tuning on more devices. Stored scores (livenessStat) are what that tuning will use.
 */
export const THRESHOLDS = {
  /**
   * At the measured lag, with frames from before the light arrived dropped and auto-exposure
   * drift removed: a MacBook Pro camera scores 0.88–0.95; synthetic replays stay well below.
   */
  minCorrelation: 0.85,
  /**
   * The face's brightness must also follow the dark dips: a MacBook Pro camera scores 0.95+. A
   * replay's dips fall elsewhere, so this stops replays whose colors correlate by chance.
   */
  minDipCorrelation: 0.8,
  /**
   * Accepted delay between painting a color and the camera reporting its reflection. A MacBook
   * Pro's built-in camera measures 120–135 ms (display scan-out, sensor exposure, and processing
   * that the reported capture time doesn't include); 250 ms leaves room for slower webcams.
   * Slightly negative allows for clock offsets between the paint and capture timestamps.
   */
  minLagMs: -30,
  maxLagMs: 250,
  /** Synthetic faces give about 0.03 and flat prints 0; real faces need measuring. */
  minGainSpread: 0.02,
  /**
   * Explained modulation, in linear light: a real face at full brightness gives 0.018 (a bright
   * window behind) to 0.076; a nearly-off synthetic screen stays under 0.01.
   */
  minDepth: 0.015,
  minBrightness: 25,
  maxBrightness: 235,
  /**
   * A stream that was stuck this long in total, or whose screen fell this far behind its beat,
   * gets a retry rather than a judgment. The single bound also caps an injector's foresight: the
   * stream's lead plus this. A paint log is the client's word, so a late-reported paint can shift
   * the measured lag by up to this much too.
   */
  maxStallTotalMs: 400,
  maxStallSingleMs: 200,
  /**
   * Motion past which a failed correlation reads as a face that moved, not a forgery: a MacBook
   * Pro camera on a still face measures 0.3, on a person tilting and pulling faces 3.2; the
   * synthetic corpus, with its noisier sensor and exposure drift, stays under 2.3.
   */
  maxMotion: 2.5,
} as const;

/** The lag search reaches past the accepted range, so a late peak is found and rejected, not clipped. */
const LAG_SEARCH = { fromMs: -100, toMs: 400, stepMs: 5 } as const;
/** How far the color check may move from the lag the dips measured. */
const LAG_REFINE_MS = 30;
/** Fewer usable frames than this at some lag and that lag can't be judged. */
const MIN_ALIGNED_FRAMES = 20;

/** Pixels this dark or bright carry no color information (sensor floor, clipping). */
const PIXEL_FLOOR = 6;
const PIXEL_CEILING = 250;

interface RegionSeries {
  readonly r: Series;
  readonly g: Series;
  readonly b: Series;
  readonly y: Series;
  readonly meanY: number;
}

/** Per frame: the region's linear brightness and color, over usable pixels only. */
function regionSeries(capture: Capture, region: FaceRegion, frames: readonly number[]): RegionSeries {
  const n = frames.length;
  const rs = new Float64Array(n);
  const gs = new Float64Array(n);
  const bs = new Float64Array(n);
  const y = new Float64Array(n);
  for (const [k, f] of frames.entries()) {
    let r = 0;
    let g = 0;
    let b = 0;
    let count = 0;
    const frame = f * CROP * CROP * 3;
    for (const pixel of region.pixels) {
      const i = frame + pixel * 3;
      const pr = capture.pixels[i]!;
      const pg = capture.pixels[i + 1]!;
      const pb = capture.pixels[i + 2]!;
      const max = Math.max(pr, pg, pb);
      if (max >= PIXEL_CEILING || max <= PIXEL_FLOOR) {
        continue;
      }
      r += LINEAR[pr]!;
      g += LINEAR[pg]!;
      b += LINEAR[pb]!;
      count++;
    }
    rs[k] = count ? r / count : 0;
    gs[k] = count ? g / count : 0;
    bs[k] = count ? b / count : 0;
    y[k] = count ? (0.299 * r + 0.587 * g + 0.114 * b) / count : 0;
  }
  return { r: rs, g: gs, b: bs, y, meanY: mean(y) };
}

/** Every frame's series for a region, computed once and subset per candidate lag. */
const allFrames = (capture: Capture): number[] => Array.from({ length: capture.frameCount }, (_, f) => f);

/** The values of a per-frame series at `frames`. */
const pick = (values: Series, frames: readonly number[]): Series => Float64Array.from(frames, (f) => values[f]!);

/** What the screen emitted `lagMs` before each frame's capture time, in the same (linear) terms. */
function expectedSeries(
  capture: Capture,
  emission: Emission,
  frames: readonly number[],
  lagMs: number,
): { r: Series; g: Series; b: Series; y: Series } {
  const n = frames.length;
  const rs = new Float64Array(n);
  const gs = new Float64Array(n);
  const bs = new Float64Array(n);
  const y = new Float64Array(n);
  for (const [k, f] of frames.entries()) {
    const [sr, sg, sb] = emittedColorAt(emission, capture.times[f]! - lagMs);
    const r = LINEAR[Math.round(sr)]!;
    const g = LINEAR[Math.round(sg)]!;
    const b = LINEAR[Math.round(sb)]!;
    rs[k] = r;
    gs[k] = g;
    bs[k] = b;
    y[k] = 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return { r: rs, g: gs, b: bs, y };
}

const timesOf = (capture: Capture, frames: readonly number[]): Series =>
  Float64Array.from(frames, (f) => capture.times[f]!);

/**
 * Frames whose light, `lagMs` earlier, came from the schedule. Earlier frames still show
 * whatever was on screen before it started.
 */
function alignedFrames(capture: Capture, lagMs: number): number[] {
  const frames: number[] = [];
  for (let f = 0; f < capture.frameCount; f++) {
    const t = capture.times[f]! - lagMs;
    if (t >= 0 && t <= SCHEDULE_MS) {
      frames.push(f);
    }
  }
  return frames;
}

/**
 * This run's delay between paint and capture, from the face's brightness. The dark dips are the
 * schedule's sharp edges, so they fix the timing; the slow hue changes would leave it vague.
 */
function measureLag(
  capture: Capture,
  emission: Emission,
  regions: readonly RegionSeries[],
): { lagMs: number; correlation: number } {
  const pooled = new Float64Array(capture.frameCount);
  for (const region of regions) {
    for (let f = 0; f < capture.frameCount; f++) {
      pooled[f]! += region.y[f]! / regions.length;
    }
  }
  let best = { lagMs: 0, correlation: -Infinity };
  for (let lagMs = LAG_SEARCH.fromMs; lagMs <= LAG_SEARCH.toMs; lagMs += LAG_SEARCH.stepMs) {
    const frames = alignedFrames(capture, lagMs);
    if (frames.length < MIN_ALIGNED_FRAMES) {
      continue;
    }
    const times = timesOf(capture, frames);
    const expected = expectedSeries(capture, emission, frames, lagMs);
    const score = correlation(detrend(pick(pooled, frames), times), detrend(expected.y, times));
    if (score > best.correlation) {
      best = { lagMs, correlation: score };
    }
  }
  return best;
}

type Channel = "r" | "g" | "b";

interface Alignment {
  readonly lagMs: number;
  /** Weighted channel correlation of the whole face's light with the schedule's. */
  readonly agreement: number;
  /** Detrended series per region, with raw levels for ratios. */
  readonly regions: readonly (Record<Channel | "y", Series> & {
    readonly level: Record<Channel, number>;
    readonly meanY: number;
  })[];
  readonly expected: Record<Channel | "y", Series>;
  readonly channels: readonly { readonly channel: Channel; readonly weight: number }[];
  readonly totalWeight: number;
}

/**
 * How well each region's color channels follow the schedule at `lagMs`. Each camera channel
 * responds linearly to the same channel of the screen's light (the diagonal model,
 * I_c = E_c × R_c), so channels are compared one by one. A channel the schedule barely moves
 * carries mostly noise, so each counts by how much it varies.
 */
function channelAgreement(
  capture: Capture,
  emission: Emission,
  face: readonly RegionSeries[],
  lagMs: number,
): Alignment {
  const frames = alignedFrames(capture, lagMs);
  const times = timesOf(capture, frames);
  const rawExpected = expectedSeries(capture, emission, frames, lagMs);
  // Covariances use drift-free series; levels (brightness, depth's denominator) use the raw ones.
  const regions = face.map((full) => {
    const raw = { r: pick(full.r, frames), g: pick(full.g, frames), b: pick(full.b, frames), y: pick(full.y, frames) };
    return {
      r: detrend(raw.r, times),
      g: detrend(raw.g, times),
      b: detrend(raw.b, times),
      y: detrend(raw.y, times),
      level: { r: mean(raw.r), g: mean(raw.g), b: mean(raw.b) },
      meanY: mean(raw.y),
    };
  });
  const expected = {
    r: detrend(rawExpected.r, times),
    g: detrend(rawExpected.g, times),
    b: detrend(rawExpected.b, times),
    y: detrend(rawExpected.y, times),
  };
  const channels = (["r", "g", "b"] as const).map((channel) => ({ channel, weight: variation(rawExpected[channel]) }));
  const totalWeight = channels.reduce((sum, { weight }) => sum + weight, 0) || 1;
  // Judged on the whole face: each grid cell alone is too noisy when room light swamps the screen's.
  const pooled = (channel: Channel): Series => {
    const sum = new Float64Array(frames.length);
    for (const region of regions) {
      for (let k = 0; k < frames.length; k++) {
        sum[k]! += region[channel][k]! / regions.length;
      }
    }
    return sum;
  };
  const agreement =
    frames.length < MIN_ALIGNED_FRAMES
      ? 0
      : channels.reduce(
          (acc, { channel, weight }) => acc + weight * correlation(pooled(channel), expected[channel]),
          0,
        ) / totalWeight;
  return { lagMs, agreement, regions, expected, channels, totalWeight };
}

/**
 * Skin reflectance chromaticity spans a narrow band across skin tones (tone mostly changes
 * brightness), but the camera's white balance scales it: under blue window light a MacBook Pro
 * boosts red and cuts blue, and a real face measured red 0.72–0.75, blue 0.06–0.08. The band is
 * wide enough for that and still refuses blue or green surfaces; it is a sanity check that earns
 * a retry, never a security gate (the pose layer is what catches flat media).
 */
const isSkinLike = (rg: number, bg: number): boolean => rg > 0.28 && rg < 0.8 && bg > 0.03 && bg < 0.4;

/** Flash scores with nothing measured, for early returns. */
const emptyScores = (stallMs: number, motion = 0): FlashScores => ({
  correlation: 0,
  lagMs: 0,
  gainSpread: 0,
  depth: 0,
  brightness: 0,
  skinLike: false,
  skin: { rg: 0, bg: 0 },
  dipCorrelation: 0,
  specular: UNMEASURED,
  stallMs,
  motion,
});

/**
 * The flash stage. It asks of the reflected light:
 *   1. Did the stream actually play (stalls)?
 *   2. Does each color channel follow what was on screen (correlation), promptly (lag, measured
 *      per run from the dark dips)?
 *   3. Do face regions reflect differently, as a 3D face does (gain spread)?
 *   4. Is there enough signal to judge (depth, brightness)?
 *   5. Is the reflecting surface skin-colored, and do its highlights carry the screen's color?
 */
function flash(capture: FlashCapture, emission: Emission): StageResult<FlashScores> {
  const stall = stalls(emission.paintTimes);
  if (
    emission.paintTimes.length < SCHEDULE_STEPS ||
    stall.totalMs > THRESHOLDS.maxStallTotalMs ||
    stall.maxMs > THRESHOLDS.maxStallSingleMs
  ) {
    return { verdict: "retry", reason: "network", scores: emptyScores(stall.totalMs) };
  }
  const motion = Math.round(measureMotion(capture) * 1000) / 1000;
  // The dips fix the lag to within a frame; the colors may settle a frame later on some cameras.
  // The center of the crop gives a first lag, which says how strongly each patch responds.
  const firstLag = measureLag(capture, emission, [regionSeries(capture, CENTER_REGION, allFrames(capture))]).lagMs;
  const firstFrames = alignedFrames(capture, firstLag);
  const face = findFaceRegions(
    capture,
    firstFrames,
    detrend(expectedSeries(capture, emission, firstFrames, firstLag).y, timesOf(capture, firstFrames)),
  );
  if (face.length < MIN_FACE_REGIONS) {
    return { verdict: "retry", reason: "no-face", scores: emptyScores(stall.totalMs, motion) };
  }
  const series = face.map((region) => regionSeries(capture, region, allFrames(capture)));
  const dips = measureLag(capture, emission, series);
  const dipLagMs = dips.lagMs;
  let best = channelAgreement(capture, emission, series, dipLagMs);
  for (let lagMs = dipLagMs - LAG_REFINE_MS; lagMs <= dipLagMs + LAG_REFINE_MS; lagMs += LAG_SEARCH.stepMs) {
    const candidate = channelAgreement(capture, emission, series, lagMs);
    if (candidate.agreement > best.agreement) {
      best = candidate;
    }
  }
  const { lagMs, agreement, regions, expected, channels, totalWeight } = best;

  const gains = regions.map((region) => slope(region.y, expected.y) / Math.max(1, region.meanY));
  const gainMean = gains.reduce((sum, gain) => sum + gain, 0) / gains.length;
  const gainSpread =
    gainMean > 0
      ? Math.sqrt(gains.reduce((sum, gain) => sum + (gain - gainMean) ** 2, 0) / gains.length) / gainMean
      : 0;
  const brightness = toSrgb(regions.reduce((sum, region) => sum + region.meanY, 0) / regions.length);
  // How much of each region's light the schedule explains (slope × the schedule's swing, as a
  // share of the region's level). Camera noise and exposure drift don't count, so a dim screen
  // reads as "too faint" rather than as a failed check.
  const depth =
    regions.reduce(
      (sum, region) =>
        sum +
        channels.reduce(
          (acc, { channel, weight }) =>
            acc +
            (weight * Math.abs(slope(region[channel], expected[channel])) * standardDeviation(expected[channel])) /
              Math.max(1, region.level[channel]),
          0,
        ) /
          totalWeight,
      0,
    ) / regions.length;
  // The screen is a known light, so each channel's response to it is the surface's own
  // reflectance, whatever the room's lighting (Face Flashing's illuminant-ratio idea).
  const reflect: [number, number, number] = [0, 0, 0];
  for (const region of regions) {
    reflect[0] += Math.max(0, slope(region.r, expected.r));
    reflect[1] += Math.max(0, slope(region.g, expected.g));
    reflect[2] += Math.max(0, slope(region.b, expected.b));
  }
  const reflectSum = reflect[0] + reflect[1] + reflect[2];
  const skin = {
    rg: reflectSum > 0 ? Math.round((reflect[0] / reflectSum) * 1000) / 1000 : 0,
    bg: reflectSum > 0 ? Math.round((reflect[2] / reflectSum) * 1000) / 1000 : 0,
  };
  const skinLike = reflectSum > 0 && isSkinLike(reflect[0] / reflectSum, reflect[2] / reflectSum);

  const scores: FlashScores = {
    correlation: Math.round(agreement * 1000) / 1000,
    lagMs,
    gainSpread: Math.round(gainSpread * 1000) / 1000,
    depth: Math.round(depth * 10000) / 10000,
    brightness: Math.round(brightness),
    skinLike,
    skin,
    dipCorrelation: Math.round(dips.correlation * 1000) / 1000,
    specular: specularCheck(capture, emission, lagMs, face, reflect),
    stallMs: stall.totalMs,
    motion,
  };

  if (brightness < THRESHOLDS.minBrightness) {
    return { verdict: "retry", reason: "too-dark", scores };
  }
  if (brightness > THRESHOLDS.maxBrightness) {
    return { verdict: "retry", reason: "moved", scores };
  }
  if (depth < THRESHOLDS.minDepth) {
    return { verdict: "retry", reason: "too-faint", scores };
  }
  // Light that doesn't follow the schedule is a replay or a forgery, whatever surface shows it,
  // unless the face itself was moving too much to be read: that earns one more try, not a pass.
  if (agreement < THRESHOLDS.minCorrelation || dips.correlation < THRESHOLDS.minDipCorrelation) {
    return motion >= THRESHOLDS.maxMotion ? { verdict: "retry", reason: "moved", scores } : { verdict: "fail", scores };
  }
  if (!skinLike) {
    return { verdict: "retry", reason: "no-face", scores };
  }
  const prompt = lagMs >= THRESHOLDS.minLagMs && lagMs <= THRESHOLDS.maxLagMs;
  if (prompt && gainSpread >= THRESHOLDS.minGainSpread) {
    return { verdict: "pass", scores };
  }
  return { verdict: "fail", scores };
}

export const heuristicFlash: FlashStage = {
  analyze: (capture, emission) => Promise.resolve(flash(capture, emission)),
};

/** A flash capture from what a test or the metrics corpus provides: key frames and paint log when present. */
export function asFlashCapture(capture: Capture & Partial<FlashCapture>): FlashCapture {
  return {
    ...capture,
    keyTimes: capture.keyTimes ?? [],
    keyPixels: capture.keyPixels ?? new Uint8Array(),
    keyFrameCount: capture.keyFrameCount ?? capture.keyTimes?.length ?? 0,
    paintTimes: capture.paintTimes ?? [],
    source: capture.source ?? {},
  };
}

/**
 * The flash stage alone, judged against a schedule as the first version of the check was. Tests
 * and the metrics corpus drive it; production composes the stages (compose.ts).
 */
export const heuristicAnalyzer = {
  analyze(capture: Capture & Partial<FlashCapture>, schedule: Schedule): LivenessDecision {
    const full = asFlashCapture(capture);
    const emission: Emission = full.paintTimes.length
      ? { schedule, paintTimes: full.paintTimes }
      : nominalEmission(schedule);
    const result = flash(full, emission);
    const scores: LivenessScores = {
      correlation: result.scores.correlation,
      lagMs: result.scores.lagMs,
      gainSpread: result.scores.gainSpread,
      depth: result.scores.depth,
      brightness: result.scores.brightness,
      skinLike: result.scores.skinLike,
    };
    if (result.verdict === "retry") {
      return { kind: "retry", reason: result.reason ?? "moved", scores };
    }
    return { kind: result.verdict === "pass" ? "pass" : "fail", scores };
  },
};
