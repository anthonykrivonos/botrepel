import type { SpecularScores } from "./analyzer";
import { LINEAR, luma } from "./color";
import type { FlashCapture } from "./decode";
import { emittedColorAt, type Emission } from "./emission";
import type { FaceRegion } from "./face";
import { CROP, KEY_CROP } from "../../src/shared/liveness";

/**
 * Highlights on skin are reflections off its oil layer and carry the illuminant's own color;
 * diffuse skin carries illuminant × albedo. A relighting injector that re-tints every pixel by the
 * screen's color gets the diffuse part right and keeps the recorded room's highlights (SRI-Net,
 * ICLR 2026; Light2Lie, NDSS 2026).
 *
 * In each key frame the highlights' excess over mid-brightness skin is X = I_H − I_D. A key frame
 * taken during a dip, with the screen nearly off, holds the room's share of that excess (and any
 * stale highlight); subtracting it from the bright frames leaves what the screen added:
 * α·E_k + β·(E_k ⊙ albedo), a neutral part and a diffuse part. The background behind the person
 * isn't lit by the screen, so its color per frame gives the camera's gain and cancels exposure
 * and white-balance drift. β is geometry × strength, the same in every frame, so α and β are
 * fitted jointly over all bright frames. The score is α's share of the screen-following excess.
 */
export const SPECULAR = {
  /** Some pair of key frames must differ this much in chromaticity (L1 of r/g/b shares). */
  minContrast: 0.08,
  /** Key frames needed: one dark, two or more bright. */
  minFrames: 3,
  /** A key frame whose screen light is below this share of the brightest one is the dark reference. */
  darkShare: 0.35,
  /** The brightest share of forehead and nose pixels, in the brightest frame, that counts as highlight. */
  topShare: 0.015,
  minHighlightPixels: 40,
  minDiffusePixels: 400,
  /** Neutral share of the highlights' screen-following excess; to calibrate on real devices. */
  minGain: 0.15,
} as const;

const PIXEL_FLOOR = 6;
const PIXEL_CEILING = 250;
/** The face grid's top-middle and center cells: forehead and nose, where highlights sit. */
const HIGHLIGHT_CELLS = new Set(["cell-1", "cell-4"]);
/** Background pixels sampled for the camera gain; every so many. */
const BACKGROUND_STRIDE = 5;
const MIN_BACKGROUND_PIXELS = 200;

export const UNMEASURED: SpecularScores = { measured: false, gain: 0, contrast: 0, pixels: 0 };

type Vec = [number, number, number];

const chroma = ([r, g, b]: Vec): Vec => {
  const sum = r + g + b || 1;
  return [r / sum, g / sum, b / sum];
};
const size = (v: Vec): number => Math.hypot(v[0], v[1], v[2]);

/** A pixel's linear color in a key frame, or null when it's clipped or at the sensor floor. */
function linearAt(capture: FlashCapture, frame: number, offset: number): Vec | null {
  const i = frame * KEY_CROP * KEY_CROP * 3 + offset;
  const r = capture.keyPixels[i]!;
  const g = capture.keyPixels[i + 1]!;
  const b = capture.keyPixels[i + 2]!;
  if (Math.max(r, g, b) >= PIXEL_CEILING || Math.min(r, g, b) <= PIXEL_FLOOR) {
    return null;
  }
  return [LINEAR[r]!, LINEAR[g]!, LINEAR[b]!];
}

/** The mean linear color of `pixels` in a frame, when enough of them are usable. */
function meanColor(capture: FlashCapture, frame: number, pixels: readonly number[], minCount: number): Vec | null {
  const sum: Vec = [0, 0, 0];
  let count = 0;
  for (const offset of pixels) {
    const color = linearAt(capture, frame, offset);
    if (!color) {
      continue;
    }
    sum[0] += color[0];
    sum[1] += color[1];
    sum[2] += color[2];
    count++;
  }
  return count >= minCount ? [sum[0] / count, sum[1] / count, sum[2] / count] : null;
}

interface PixelSets {
  readonly highlight: number[];
  readonly diffuse: number[];
  readonly background: number[];
}

/** The sets, chosen in the brightest frame: the brightest forehead and nose pixels, mid-brightness skin, and the background. */
function selectSets(capture: FlashCapture, frame: number, face: readonly FaceRegion[]): PixelSets | null {
  const scale = KEY_CROP / CROP;
  const offsets: number[] = [];
  const candidate: boolean[] = [];
  const onFace = new Uint8Array(KEY_CROP * KEY_CROP);
  for (const region of face) {
    const isCandidate = HIGHLIGHT_CELLS.has(region.name);
    for (const p of region.pixels) {
      const row = Math.floor(p / CROP) * scale;
      const col = (p % CROP) * scale;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const pixel = (row + dy) * KEY_CROP + col + dx;
          onFace[pixel] = 1;
          offsets.push(pixel * 3);
          candidate.push(isCandidate);
        }
      }
    }
  }
  const brightness = offsets.map((offset) => {
    const color = linearAt(capture, frame, offset);
    return color ? luma(...color) : Number.NaN;
  });
  const sorted = brightness.filter((y) => !Number.isNaN(y)).sort((x, y) => x - y);
  if (sorted.length < SPECULAR.minDiffusePixels) {
    return null;
  }
  const at = (share: number): number => sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))]!;
  const top = at(1 - SPECULAR.topShare);
  const low = at(0.2);
  const high = at(0.8);
  const highlight: number[] = [];
  const diffuse: number[] = [];
  for (const [index, y] of brightness.entries()) {
    if (Number.isNaN(y)) {
      continue;
    }
    if (candidate[index] && y >= top) {
      highlight.push(offsets[index]!);
    } else if (y >= low && y <= high) {
      diffuse.push(offsets[index]!);
    }
  }
  // The background: well away from the face mask, so hair and shoulders stay out.
  const background: number[] = [];
  for (let pixel = 0; pixel < KEY_CROP * KEY_CROP; pixel += BACKGROUND_STRIDE) {
    const row = Math.floor(pixel / KEY_CROP);
    const col = pixel % KEY_CROP;
    let nearFace = false;
    for (let dy = -8; dy <= 8 && !nearFace; dy += 4) {
      for (let dx = -8; dx <= 8; dx += 4) {
        const r = row + dy;
        const c = col + dx;
        if (r >= 0 && r < KEY_CROP && c >= 0 && c < KEY_CROP && onFace[r * KEY_CROP + c]) {
          nearFace = true;
          break;
        }
      }
    }
    if (!nearFace) {
      background.push(pixel * 3);
    }
  }
  return highlight.length >= SPECULAR.minHighlightPixels && diffuse.length >= SPECULAR.minDiffusePixels
    ? { highlight, diffuse, background }
    : null;
}

/**
 * `face` are the flash-crop cells; `reflect` is the skin's measured reflectance per channel (the
 * flash stage's slopes, which give the albedo's color); `lagMs` places each key frame on the schedule.
 */
export function specularCheck(
  capture: FlashCapture,
  emission: Emission,
  lagMs: number,
  face: readonly FaceRegion[],
  reflect: Vec,
): SpecularScores {
  if (capture.keyFrameCount < SPECULAR.minFrames || Math.max(...reflect) <= 0) {
    return UNMEASURED;
  }
  const peak = Math.max(...reflect);
  const albedo: Vec = [reflect[0] / peak, reflect[1] / peak, reflect[2] / peak];
  const illuminants: Vec[] = capture.keyTimes.map((t) => {
    const [r, g, b] = emittedColorAt(emission, t - lagMs);
    return [LINEAR[Math.round(r)]!, LINEAR[Math.round(g)]!, LINEAR[Math.round(b)]!];
  });
  const levels = illuminants.map((e) => luma(...e));
  const top = Math.max(...levels);
  const brightest = levels.indexOf(top);
  const dark = levels.findIndex((level) => level < top * SPECULAR.darkShare);
  const brightFrames = levels.map((level, k) => (level >= top * SPECULAR.darkShare ? k : -1)).filter((k) => k >= 0);
  let contrast = 0;
  for (const i of brightFrames) {
    for (const j of brightFrames) {
      const ci = chroma(illuminants[i]!);
      const cj = chroma(illuminants[j]!);
      contrast = Math.max(contrast, Math.abs(ci[0] - cj[0]) + Math.abs(ci[1] - cj[1]) + Math.abs(ci[2] - cj[2]));
    }
  }
  const unmeasured = (pixels: number): SpecularScores => ({
    ...UNMEASURED,
    contrast: Math.round(contrast * 1000) / 1000,
    pixels,
  });
  if (dark < 0 || brightFrames.length < 2 || contrast < SPECULAR.minContrast) {
    return unmeasured(0);
  }
  const sets = selectSets(capture, brightest, face);
  if (!sets) {
    return unmeasured(0);
  }
  const excess = (frame: number): Vec | null => {
    const h = meanColor(capture, frame, sets.highlight, SPECULAR.minHighlightPixels / 2);
    const d = meanColor(capture, frame, sets.diffuse, SPECULAR.minDiffusePixels / 2);
    return h && d ? [h[0] - d[0], h[1] - d[1], h[2] - d[2]] : null;
  };
  // The camera's gain per frame, from the background; 1 when there is no background to read.
  const reference = meanColor(capture, dark, sets.background, MIN_BACKGROUND_PIXELS);
  const gainOf = (frame: number): Vec => {
    const wall = reference ? meanColor(capture, frame, sets.background, MIN_BACKGROUND_PIXELS) : null;
    return wall && reference ? [wall[0] / reference[0], wall[1] / reference[1], wall[2] / reference[2]] : [1, 1, 1];
  };
  const darkExcess = excess(dark);
  if (!darkExcess) {
    return unmeasured(sets.highlight.length);
  }
  const darkGain = gainOf(dark);
  const base: Vec = [darkExcess[0] / darkGain[0], darkExcess[1] / darkGain[1], darkExcess[2] / darkGain[2]];

  // Least squares for α, β over every bright frame: X'_k = α·E_k + β·(E_k ⊙ albedo).
  let uu = 0;
  let uv = 0;
  let vv = 0;
  let uy = 0;
  let vy = 0;
  let frames = 0;
  let meanIlluminant = 0;
  for (const k of brightFrames) {
    const x = excess(k);
    if (!x) {
      continue;
    }
    const gain = gainOf(k);
    const e = illuminants[k]!;
    for (let c = 0; c < 3; c++) {
      const y = x[c]! / gain[c]! - base[c]!;
      const u = e[c]!;
      const v = e[c]! * albedo[c]!;
      uu += u * u;
      uv += u * v;
      vv += v * v;
      uy += u * y;
      vy += v * y;
    }
    frames++;
    meanIlluminant += size(e);
  }
  if (frames < 2) {
    return unmeasured(sets.highlight.length);
  }
  meanIlluminant /= frames;
  const det = uu * vv - uv * uv;
  let alpha: number;
  let beta: number;
  if (det <= 1e-9 * uu * vv) {
    return unmeasured(sets.highlight.length);
  }
  alpha = (vv * uy - uv * vy) / det;
  beta = (uu * vy - uv * uy) / det;
  if (alpha < 0) {
    alpha = 0;
    beta = Math.max(0, vy / vv);
  } else if (beta < 0) {
    beta = 0;
    alpha = Math.max(0, uy / uu);
  }
  const neutral = alpha * meanIlluminant;
  const tinted = (beta * meanIlluminant * size(albedo)) / Math.sqrt(3);
  if (neutral + tinted === 0) {
    return unmeasured(sets.highlight.length);
  }
  return {
    measured: true,
    gain: Math.round((neutral / (neutral + tinted)) * 1000) / 1000,
    contrast: Math.round(contrast * 1000) / 1000,
    pixels: sets.highlight.length,
  };
}
