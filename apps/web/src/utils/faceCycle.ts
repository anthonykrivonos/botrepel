/** How long each face holds, and how long one dissolves into the next, in seconds. */
export const FACE_HOLD_S = 9;
export const FACE_DISSOLVE_S = 1.4;

export interface FaceMix {
  /** The face showing, and the one it's dissolving into (the same index while it holds). */
  readonly from: number;
  readonly to: number;
  /** How far the dissolve has gone, 0–1, eased at both ends. */
  readonly progress: number;
}

/**
 * Which of `count` faces shows at `t` seconds, beginning with face `first`: each holds, then dissolves
 * into the next, in a loop.
 */
export function faceMix(t: number, count: number, first = 0): FaceMix {
  if (count < 2) {
    return { from: 0, to: 0, progress: 0 };
  }
  const period = FACE_HOLD_S + FACE_DISSOLVE_S;
  const cycle = Math.floor(Math.max(0, t) / period);
  const linear = Math.min(1, Math.max(0, (Math.max(0, t) - cycle * period - FACE_HOLD_S) / FACE_DISSOLVE_S));
  const from = (first + cycle) % count;
  return { from, to: (from + 1) % count, progress: linear * linear * (3 - 2 * linear) };
}

/**
 * The order points of a face dissolve in, 0–1: mostly random, with a gentle sweep from the top of
 * the head down, so the change reads as one figure turning into another. Deterministic per point.
 */
export function dissolveOrder(index: number, y: number): number {
  const random = (Math.sin(index * 12.9898) * 43_758.5453) % 1;
  const sweep = Math.min(1, Math.max(0, (1.1 - y) / 2.2));
  return 0.7 * Math.abs(random) + 0.3 * sweep;
}
