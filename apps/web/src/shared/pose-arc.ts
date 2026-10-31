import { ARC_DEGREES, arcSpanDeg, type Arc } from "./liveness";

/**
 * Progress along the head-roll prompt, for the ring around the camera oval. Directions are degrees
 * on the mirrored preview, counterclockwise from the person's right: 0 right, 90 up, 180 left, 270 down.
 */
export interface PoseArc {
  readonly from: number;
  /** Degrees to sweep; positive turns counterclockwise. */
  readonly sweep: number;
}

/** The server's prompt as ring degrees: clockwise on screen sweeps toward decreasing degrees. */
export const toPoseArc = (arc: Arc): PoseArc => ({
  from: ARC_DEGREES[arc.from],
  sweep: arcSpanDeg(arc) * (arc.clockwise ? -1 : 1),
});

/**
 * Where the head points on the preview, and how far from center: a share of the crop for the preview's
 * patch tracker, degrees of turn for the server's face mesh.
 */
export interface HeadDirection {
  readonly angle: number;
  readonly magnitude: number;
}

export const RING_BARS = 60;
/** Progress before the head has pointed near the start: no bar is filled. */
export const ARC_NOT_STARTED = -1;
/** The head must lean at least this far (a share of the crop) for its angle to mean anything. */
export const MIN_HEAD_MAGNITUDE = 0.06;

/** How closely the head must follow the arc, in the units of the `HeadDirection` it is read from. */
export interface ArcTolerance {
  /** Leans below this have no direction. */
  readonly minMagnitude: number;
  /** The roll starts only once the head points this close to the start. */
  readonly startDeg: number;
  /** Then progress follows the head only near the frontier: this far behind it, or up to `aheadDeg` ahead. */
  readonly behindDeg: number;
  readonly aheadDeg: number;
}

/** The ring's own tolerance, for the preview's dense patch track. */
export const RING_TOLERANCE: ArcTolerance = {
  minMagnitude: MIN_HEAD_MAGNITUDE,
  startDeg: 15,
  behindDeg: 15,
  aheadDeg: 30,
};

const mod360 = (degrees: number): number => ((degrees % 360) + 360) % 360;

/** How far along the arc `angle` sits, in [0, 360). */
export function arcOffset(arc: PoseArc, angle: number): number {
  return mod360(arc.sweep >= 0 ? angle - arc.from : arc.from - angle);
}

/** The bar angles around the ring, counterclockwise from the person's right. */
export const barAngles = (count = RING_BARS): number[] => Array.from({ length: count }, (_, i) => (360 / count) * i);

/** Whether a bar at `angle` belongs to the arc; a full turn includes every bar. */
export const inArc = (arc: PoseArc, angle: number): boolean => arcOffset(arc, angle) <= Math.abs(arc.sweep);

/** Whether a bar at `angle` is filled once the head has covered `progress` degrees of the arc. */
export const barCovered = (arc: PoseArc, angle: number, progress: number): boolean =>
  inArc(arc, angle) && (arcDone(arc, progress) || arcOffset(arc, angle) <= progress);

/**
 * Advances progress along the arc when the head points just past the frontier. Pointing the wrong
 * way, jumping ahead, or holding still leaves it where it was.
 */
export function advanceArc(
  arc: PoseArc,
  progress: number,
  head: HeadDirection,
  tolerance: ArcTolerance = RING_TOLERANCE,
): number {
  if (head.magnitude < tolerance.minMagnitude) {
    return progress;
  }
  const span = Math.abs(arc.sweep);
  let offset = arcOffset(arc, head.angle);
  if (progress < 0) {
    // Just short of the start counts as the start; anywhere else hasn't started.
    return offset <= tolerance.startDeg ? offset : offset >= 360 - tolerance.startDeg ? 0 : progress;
  }
  // A full circle wraps: near the end, the start's angle reads as 0 again.
  if (offset < progress - tolerance.behindDeg && offset + 360 <= span + tolerance.behindDeg) {
    offset += 360;
  }
  if (offset > progress + tolerance.aheadDeg || offset < progress - tolerance.behindDeg) {
    return progress;
  }
  return Math.min(span, Math.max(progress, offset));
}

/** Whether the head has covered the whole arc, to within `endDeg` of its end (half a bar for the ring). */
export const arcDone = (arc: PoseArc, progress: number, endDeg = 360 / RING_BARS / 2): boolean =>
  progress >= Math.abs(arc.sweep) - endDeg;
