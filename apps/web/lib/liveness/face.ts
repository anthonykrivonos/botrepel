import type { Capture } from "./decode";
import { detrend, mean, slope, type Series } from "./series";
import { CROP } from "../../src/shared/liveness";

/** Blocks this many pixels square make up the face mask. */
const BLOCK = 4;
const GRID = CROP / BLOCK;
/** The face's bounding box is cut into GRID_CELLS × GRID_CELLS regions. */
const GRID_CELLS = 3;
/** Smaller cells carry too few pixels to measure. */
const MIN_CELL_BLOCKS = 3;
/** Share of the center's brightness a block needs; hair, clothing, and shadow fall below it. */
const MIN_RELATIVE_LUMA = 0.55;
/** Share of the center's response to the screen a block needs; distant backgrounds fall below it. */
const MIN_RELATIVE_RESPONSE = 0.35;
/** Fewer usable cells and there isn't enough face to judge. */
export const MIN_FACE_REGIONS = 4;

/** A patch of face in crop coordinates, as pixel offsets (`row * CROP + col`). */
export interface FaceRegion {
  readonly name: string;
  readonly pixels: readonly number[];
}

const blockPixels = (block: number): number[] => {
  const bx = (block % GRID) * BLOCK;
  const by = Math.floor(block / GRID) * BLOCK;
  return Array.from({ length: BLOCK * BLOCK }, (_, k) => (by + Math.floor(k / BLOCK)) * CROP + bx + (k % BLOCK));
};

/** The middle of the crop, which is face whenever the face is anywhere near the oval. */
export const CENTER_REGION: FaceRegion = {
  name: "center",
  pixels: Array.from({ length: CROP * CROP }, (_, p) => p).filter(
    (p) => Math.hypot((p % CROP) - CROP / 2, Math.floor(p / CROP) - CROP / 2) <= CROP / 6,
  ),
};

/**
 * Finds the face in the capture instead of assuming where it sits in the oval: the connected
 * patch around the center that is both bright and lit by the screen, cut into a grid of regions
 * that face the screen at different angles.
 *
 * Hair and dark clothing fall below the brightness bar. Backgrounds, even skin-colored ones like
 * wood or a beige wall, are told apart by distance: the screen's light falls off with its square,
 * so they barely respond. Response is measured as the size of a block's reflection, never how
 * well it follows the schedule, so the choice of regions can't flatter a replay. Whether the
 * surface is skin is the analyzer's reflectance check.
 *
 * `frames` are the frames lit by the schedule at a first lag estimate, with `expectedY` the
 * detrended brightness the screen sent for them.
 */
export function findFaceRegions(capture: Capture, frames: readonly number[], expectedY: Series): FaceRegion[] {
  const times = Float64Array.from(frames, (f) => capture.times[f]!);
  const luma = new Float64Array(GRID * GRID);
  const responses = new Float64Array(GRID * GRID);
  const series = new Float64Array(frames.length);
  for (let block = 0; block < GRID * GRID; block++) {
    const pixels = blockPixels(block);
    for (const [k, f] of frames.entries()) {
      const frame = f * CROP * CROP * 3;
      let sum = 0;
      for (const pixel of pixels) {
        const i = frame + pixel * 3;
        sum += 0.299 * capture.pixels[i]! + 0.587 * capture.pixels[i + 1]! + 0.114 * capture.pixels[i + 2]!;
      }
      series[k] = sum / pixels.length;
    }
    luma[block] = mean(series);
    responses[block] = Math.abs(slope(detrend(series, times), expectedY)) / Math.max(1, luma[block]!);
  }

  // Each bar is a share of the median at the center, so it adapts to skin tone and lighting.
  const center = (GRID - 1) / 2;
  const distance = (block: number): number => Math.hypot((block % GRID) - center, Math.floor(block / GRID) - center);
  const centralMedian = (values: Float64Array): number => {
    const central = [...values.keys()]
      .filter((block) => distance(block) <= GRID / 6)
      .map((block) => values[block]!)
      .sort((a, b) => a - b);
    return central[central.length >> 1] ?? 0;
  };
  const minLuma = centralMedian(luma) * MIN_RELATIVE_LUMA;
  const minResponse = centralMedian(responses) * MIN_RELATIVE_RESPONSE;
  const mask = [...luma.keys()].map((block) => luma[block]! >= minLuma && responses[block]! >= minResponse);

  // Grow from the qualifying block nearest the center, so nothing disconnected from the face joins.
  let seed = -1;
  for (let block = 0; block < mask.length; block++) {
    if (mask[block] && distance(block) <= GRID / 4 && (seed < 0 || distance(block) < distance(seed))) {
      seed = block;
    }
  }
  if (seed < 0) {
    return [];
  }
  const face = new Set<number>([seed]);
  const queue = [seed];
  while (queue.length) {
    const block = queue.pop()!;
    const bx = block % GRID;
    const by = Math.floor(block / GRID);
    for (const [nx, ny] of [
      [bx - 1, by],
      [bx + 1, by],
      [bx, by - 1],
      [bx, by + 1],
    ] as const) {
      const next = ny * GRID + nx;
      if (nx >= 0 && nx < GRID && ny >= 0 && ny < GRID && mask[next] && !face.has(next)) {
        face.add(next);
        queue.push(next);
      }
    }
  }

  // Blocks on the patch's edge straddle whatever lies beyond it, and that mix would vary the
  // response from block to block even on a flat print, so only the interior is measured.
  const inside = (block: number): boolean => face.has(block);
  const interiorRemoved = new Set<number>();
  for (const block of [...face]) {
    const bx = block % GRID;
    const by = Math.floor(block / GRID);
    const edge =
      bx === 0 ||
      by === 0 ||
      bx === GRID - 1 ||
      by === GRID - 1 ||
      !inside(block - 1) ||
      !inside(block + 1) ||
      !inside(block - GRID) ||
      !inside(block + GRID);
    if (edge) {
      interiorRemoved.add(block);
    }
  }
  for (const block of interiorRemoved) {
    face.delete(block);
  }
  if (!face.size) {
    return [];
  }

  const xs = [...face].map((block) => block % GRID);
  const ys = [...face].map((block) => Math.floor(block / GRID));
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const width = Math.max(...xs) - left + 1;
  const height = Math.max(...ys) - top + 1;
  const cells = Array.from({ length: GRID_CELLS * GRID_CELLS }, () => [] as number[]);
  for (const block of face) {
    const cx = Math.min(GRID_CELLS - 1, Math.floor((((block % GRID) - left) * GRID_CELLS) / width));
    const cy = Math.min(GRID_CELLS - 1, Math.floor(((Math.floor(block / GRID) - top) * GRID_CELLS) / height));
    cells[cy * GRID_CELLS + cx]!.push(block);
  }
  return cells.flatMap((blocks, index) =>
    blocks.length < MIN_CELL_BLOCKS
      ? []
      : [
          {
            name: `cell-${index}`,
            pixels: blocks.flatMap(blockPixels),
          },
        ],
  );
}
