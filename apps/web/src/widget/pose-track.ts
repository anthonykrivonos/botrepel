import { CROP_SHARE } from "./capture";
import type { HeadDirection } from "../shared/pose-arc";

/** Side of the grayscale frame the tracker reads. */
const SIDE = 64;
/** The inner face (eyes, nose, mouth): what moves when the head turns. */
const PATCH = 24;
/** Pixels a patch may move between two frames. */
const SEARCH = 4;

/**
 * The shift of the `patch`-pixel square at (x, y) in `prev` that best matches `next`, by the sum of
 * absolute differences, within `search` pixels each way. Both frames are `side` wide.
 */
export function bestShift(
  prev: Float32Array,
  next: Float32Array,
  side: number,
  x: number,
  y: number,
  patch: number,
  search: number,
): { readonly dx: number; readonly dy: number } {
  let best = { dx: 0, dy: 0 };
  let bestCost = Infinity;
  for (let dy = -search; dy <= search; dy++) {
    for (let dx = -search; dx <= search; dx++) {
      if (x + dx < 0 || y + dy < 0 || x + dx + patch > side || y + dy + patch > side) {
        continue;
      }
      let cost = 0;
      // Stops once this shift is worse; a tie is read in full, so only a true tie counts as one.
      for (let row = 0; row < patch && cost <= bestCost; row++) {
        const from = (y + row) * side + x;
        const to = (y + dy + row) * side + x + dx;
        for (let column = 0; column < patch; column++) {
          cost += Math.abs(prev[from + column]! - next[to + column]!);
        }
      }
      // Ties keep the smaller move, so a still frame reads as still.
      if (cost < bestCost || (cost === bestCost && Math.hypot(dx, dy) < Math.hypot(best.dx, best.dy))) {
        bestCost = cost;
        best = { dx, dy };
      }
    }
  }
  return best;
}

/**
 * Feedback only: which way the head points on the mirrored preview, from how far the inner face has
 * moved since the tracker started. The server judges the turn from the uploaded frames.
 */
export function headTracker(): { sample(video: HTMLVideoElement): HeadDirection | null } {
  const canvas = document.createElement("canvas");
  canvas.width = SIDE;
  canvas.height = SIDE;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  // Mirrored like the preview, so right on the frame is right on screen.
  context.setTransform(-1, 0, 0, 1, SIDE, 0);
  const start = (SIDE - PATCH) / 2;
  let prev: Float32Array | null = null;
  let x = start;
  let y = start;

  return {
    sample(video) {
      if (!video.videoWidth) {
        return null;
      }
      const span = Math.min(video.videoWidth, video.videoHeight) * CROP_SHARE;
      context.drawImage(
        video,
        (video.videoWidth - span) / 2,
        (video.videoHeight - span) / 2,
        span,
        span,
        0,
        0,
        SIDE,
        SIDE,
      );
      const { data } = context.getImageData(0, 0, SIDE, SIDE);
      const next = new Float32Array(SIDE * SIDE);
      for (let i = 0; i < next.length; i++) {
        next[i] = data[i * 4]! * 0.299 + data[i * 4 + 1]! * 0.587 + data[i * 4 + 2]! * 0.114;
      }
      if (prev) {
        const { dx, dy } = bestShift(prev, next, SIDE, x, y, PATCH, SEARCH);
        x = Math.min(SIDE - PATCH, Math.max(0, x + dx));
        y = Math.min(SIDE - PATCH, Math.max(0, y + dy));
      }
      prev = next;
      const right = (x - start) / SIDE;
      const up = (start - y) / SIDE;
      return { angle: ((Math.atan2(up, right) * 180) / Math.PI + 360) % 360, magnitude: Math.hypot(right, up) };
    },
  };
}
