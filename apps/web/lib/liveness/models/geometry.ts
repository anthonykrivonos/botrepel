import { detectMesh, meshScratch, type Mesh } from "./mesh";
import { headDirection, headPose, headTurn, LANDMARK, type HeadPose } from "./pose";
import { ModelsBusyError, withModelSlot } from "./runtime";
import type { Arc } from "../../../src/shared/liveness";
import { advanceArc, ARC_NOT_STARTED, arcDone, toPoseArc, type ArcTolerance } from "../../../src/shared/pose-arc";
import { Logger } from "../../logger";
import type { FaceBox, GeometryResult, GeometryScores, GeometryStage, StageResult } from "../analyzer";
import type { PoseCapture } from "../decode";

/**
 * The server's reading of the head roll: the same arc rules the ring uses (pose-arc.ts), fed by how far
 * the face mesh says the head has turned since the prompt. The first frame with a face is the
 * reference: the person faces the screen when the prompt appears. The pose frames are sparser than
 * the preview and the mesh's angles noisier, so the frontier may be further ahead, the end a little
 * short, and a turn must reach `minTurnDeg` to count at all.
 */
export const GEOMETRY = {
  minTurnDeg: 6,
  startDeg: 25,
  behindDeg: 30,
  aheadDeg: 90,
  endDeg: 15,
  /** Fewer frames with a face than this share and there is nothing to judge. */
  minFaceShare: 0.5,
  /** This much of the arc covered in the opposite sense first is a sweep the wrong way. */
  wrongWayDeg: 90,
} as const;

const TOLERANCE: ArcTolerance = {
  minMagnitude: GEOMETRY.minTurnDeg,
  startDeg: GEOMETRY.startDeg,
  behindDeg: GEOMETRY.behindDeg,
  aheadDeg: GEOMETRY.aheadDeg,
};

export interface PoseFrame {
  /** Ms after the prompt. */
  readonly timeMs: number;
  /** The head's turn since the reference frame; null when the frame held no face. */
  readonly pose: HeadPose | null;
}

const logger = new Logger("liveness");

const EMPTY_SCORES: GeometryScores = {
  faceFrames: 0,
  yawStartDeg: 0,
  yawPeakDeg: 0,
  pitchPeakDeg: 0,
  hit: false,
  wrongWayFirst: false,
  poseMs: 0,
  jitterPx: 0,
};

/** The result when the stage can't run: no faces, no judgment. */
export const skippedGeometry = (capture: Pick<PoseCapture, "times">): GeometryResult => ({
  verdict: "skip",
  scores: EMPTY_SCORES,
  faces: capture.times.map(() => null),
});

/**
 * Judges a sequence of head turns against the arc: progress follows the ring's own rules, in the
 * requested sense and, until the arc is done, in the opposite one too. `reference` is the absolute
 * pose of the frame the turns are measured from, kept for calibration.
 */
export function verifyArc(frames: readonly PoseFrame[], arc: Arc, reference?: HeadPose): StageResult<GeometryScores> {
  const ring = toPoseArc(arc);
  const reverse = { from: ring.from, sweep: -ring.sweep };
  let progress = ARC_NOT_STARTED;
  let opposite = ARC_NOT_STARTED;
  let hit = false;
  let wrongWayFirst = false;
  let poseMs = 0;
  let yawPeakDeg = 0;
  let pitchPeakDeg = 0;
  let faceFrames = 0;
  for (const frame of frames) {
    if (!frame.pose) {
      continue;
    }
    faceFrames++;
    yawPeakDeg = Math.max(yawPeakDeg, Math.abs(frame.pose.yawDeg));
    pitchPeakDeg = Math.max(pitchPeakDeg, Math.abs(frame.pose.pitchDeg));
    const head = headDirection(frame.pose);
    progress = advanceArc(ring, progress, head, TOLERANCE);
    if (!hit && arcDone(ring, progress, GEOMETRY.endDeg)) {
      hit = true;
      poseMs = frame.timeMs;
    }
    if (!hit) {
      opposite = advanceArc(reverse, opposite, head, TOLERANCE);
      wrongWayFirst ||= opposite >= GEOMETRY.wrongWayDeg || arcDone(reverse, opposite, GEOMETRY.endDeg);
    }
  }
  const scores: GeometryScores = {
    faceFrames,
    yawStartDeg: Math.round((reference?.yawDeg ?? 0) * 10) / 10,
    yawPeakDeg: Math.round(yawPeakDeg * 10) / 10,
    pitchPeakDeg: Math.round(pitchPeakDeg * 10) / 10,
    hit,
    wrongWayFirst,
    poseMs: Math.round(poseMs),
    jitterPx: 0,
  };
  if (faceFrames < frames.length * GEOMETRY.minFaceShare) {
    return { verdict: "retry", reason: "no-face", scores };
  }
  return hit ? { verdict: "pass", scores } : { verdict: "retry", reason: "pose-missed", scores };
}

/** The face's box as shares of the frame, from its landmarks. */
function boxOf(mesh: Mesh, side: number): FaceBox {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < mesh.points.length; i += 3) {
    minX = Math.min(minX, mesh.points[i]!);
    maxX = Math.max(maxX, mesh.points[i]!);
    minY = Math.min(minY, mesh.points[i + 1]!);
    maxY = Math.max(maxY, mesh.points[i + 1]!);
  }
  return { x: minX / side, y: minY / side, w: (maxX - minX) / side, h: (maxY - minY) / side };
}

/** Whether a load failure means the stage can't run at all, as opposed to a bad frame. */
const unavailable = (error: unknown): boolean => error instanceof Error && !(error instanceof ModelsBusyError);

/**
 * The geometry stage: the mesh on every pose frame within the budget, each read as a turn from the
 * first frame with a face, then the arc rules. Frames past the deadline are dropped. When the model
 * can't load, the stage is skipped and the failure logged, so a broken deployment doesn't lock
 * everyone out; it never skips on a bad capture.
 */
export const meshGeometry: GeometryStage = {
  async analyze(capture, arc, deadline) {
    const frameBytes = capture.side * capture.side * 3;
    const scratch = meshScratch();
    const frames: PoseFrame[] = [];
    const faces: (FaceBox | null)[] = capture.times.map(() => null);
    let base: Mesh | null = null;
    let reference: HeadPose | undefined;
    let frontal = 0;
    let frontalMagnitude = Infinity;
    let jitter = 0;
    let jitterPairs = 0;
    let lastNose: readonly [number, number] | null = null;
    try {
      await withModelSlot(async () => {
        for (let f = 0; f < capture.frameCount && performance.now() < deadline; f++) {
          const frame = capture.pixels.subarray(f * frameBytes, (f + 1) * frameBytes);
          let mesh: Mesh | null;
          try {
            mesh = await detectMesh(frame, capture.side, scratch);
          } catch (error) {
            if (f === 0 && unavailable(error)) {
              logger.error("The pose models are unavailable; the pose stage is skipped", { cause: String(error) });
              return;
            }
            throw error;
          }
          if (!mesh) {
            frames.push({ timeMs: capture.times[f]!, pose: null });
            continue;
          }
          if (!base) {
            base = mesh;
            reference = headPose(mesh.points);
          }
          const pose = headTurn(base.points, mesh.points);
          frames.push({ timeMs: capture.times[f]!, pose });
          faces[f] = boxOf(mesh, capture.side);
          const magnitude = Math.hypot(pose.yawDeg, pose.pitchDeg);
          if (magnitude < frontalMagnitude) {
            frontalMagnitude = magnitude;
            frontal = f;
          }
          const nose = [mesh.points[LANDMARK.noseTip * 3]!, mesh.points[LANDMARK.noseTip * 3 + 1]!] as const;
          if (lastNose) {
            jitter += Math.hypot(nose[0] - lastNose[0], nose[1] - lastNose[1]);
            jitterPairs++;
          }
          lastNose = nose;
        }
      });
    } finally {
      scratch.fill(0);
    }
    if (frames.length === 0) {
      return { ...skippedGeometry(capture), frontal };
    }
    const result = verifyArc(frames, arc, reference);
    const jitterPx = jitterPairs ? Math.round((jitter / jitterPairs) * 10) / 10 : 0;
    return { ...result, scores: { ...result.scores, jitterPx }, faces, frontal };
  },
};
