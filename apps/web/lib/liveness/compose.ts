import type {
  FlashStage,
  GeometryStage,
  JudgeStage,
  KeyFrame,
  LivenessAnalyzer,
  PadStage,
  PoseAnalysis,
} from "./analyzer";
import type { PoseCapture } from "./decode";
import { heuristicFlash } from "./heuristic";
import { meshGeometry, skippedGeometry } from "./models/geometry";
import { miniFasPad } from "./models/pad";

/** The pose stages share this much time per upload; frames beyond it are dropped. */
export const MODEL_BUDGET_MS = 3000;

export interface AnalyzerParts {
  readonly flash: FlashStage;
  /** Null when a test leaves the stage out; production's stage skips itself when its model can't load. */
  readonly geometry: GeometryStage | null;
  readonly pad: PadStage | null;
  readonly judge: JudgeStage | null;
}

const KEY_FRAME_BYTES = (side: number): number => side * side * 3;

/** The frames worth a second opinion: the first, and the one the geometry stage saw most frontal. */
function keyFrames(capture: PoseCapture, frontal: number): KeyFrame[] {
  const bytes = KEY_FRAME_BYTES(capture.side);
  const picks = [...new Set([0, Math.max(0, Math.min(capture.frameCount - 1, frontal))])];
  return picks.map((f) => ({ pixels: capture.pixels.subarray(f * bytes, (f + 1) * bytes), side: capture.side }));
}

export function composeAnalyzer(parts: AnalyzerParts): LivenessAnalyzer {
  return {
    flash: (capture, emission) => parts.flash.analyze(capture, emission),
    async pose(capture, arc): Promise<PoseAnalysis> {
      const deadline = performance.now() + MODEL_BUDGET_MS;
      const geometry = parts.geometry ? await parts.geometry.analyze(capture, arc, deadline) : skippedGeometry(capture);
      const pad = parts.pad
        ? await parts.pad.analyze(capture, geometry.faces, deadline)
        : { verdict: "skip" as const, scores: { live: 0, frames: 0 } };
      return { geometry, pad, frames: keyFrames(capture, geometry.frontal ?? 0) };
    },
    judge: parts.judge,
  };
}

/** Production's analyzer: the flash heuristics, the face mesh's arc check, the anti-spoofing score; the judge is added when it ships. */
export const defaultAnalyzer = (): LivenessAnalyzer =>
  composeAnalyzer({ flash: heuristicFlash, geometry: meshGeometry, pad: miniFasPad, judge: null });
