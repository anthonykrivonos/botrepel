import { ort, session, withModelSlot } from "./runtime";
import { bgrByte, type Region } from "./tensor";
import type { PadScores, PadStage, StageResult } from "../analyzer";

/** MiniFASNet V2's contract (models/manifest.json): a 2.7× face crop at 80², BGR bytes as floats. */
export const PAD = {
  size: 80,
  scale: 2.7,
  input: "input",
  output: "output",
  /** The softmax index of the live-face class. */
  liveIndex: 1,
  /** Frames judged per capture: the first, middle and last with a face. */
  frames: 3,
} as const;

const softmax = (logits: Float32Array): number[] => {
  const peak = Math.max(...logits);
  const exp = Array.from(logits, (value) => Math.exp(value - peak));
  const sum = exp.reduce((acc, value) => acc + value, 0);
  return exp.map((value) => value / sum);
};

/** The crop MiniFASNet was trained on: `scale` × the face box, square, kept inside the frame. */
export function padRegion(box: { x: number; y: number; w: number; h: number }, side: number): Region {
  const span = Math.min(side, Math.round(Math.max(box.w, box.h) * side * PAD.scale));
  const clamp = (value: number): number => Math.min(side - span, Math.max(0, Math.round(value)));
  return { x: clamp((box.x + box.w / 2) * side - span / 2), y: clamp((box.y + box.h / 2) * side - span / 2), span };
}

const SKIPPED: StageResult<PadScores> = { verdict: "skip", scores: { live: 0, frames: 0 } };

/**
 * The anti-spoofing stage: MiniFASNet's live probability, averaged over a few pose frames with a
 * face. Score-only until it is calibrated on real devices (GATES.pad); the verdict is never a fail
 * here, fusion decides.
 */
export const miniFasPad: PadStage = {
  async analyze(capture, faces, deadline) {
    const withFace = faces.flatMap((box, f) => (box ? [f] : []));
    if (withFace.length === 0) {
      return SKIPPED;
    }
    const picks = [...new Set([0, Math.floor((withFace.length - 1) / 2), withFace.length - 1])].map(
      (i) => withFace[i]!,
    );
    const frameBytes = capture.side * capture.side * 3;
    const input = new Float32Array(3 * PAD.size * PAD.size);
    let live = 0;
    let frames = 0;
    try {
      await withModelSlot(async () => {
        const model = await session("pad");
        for (const f of picks) {
          if (performance.now() >= deadline) {
            break;
          }
          const frame = capture.pixels.subarray(f * frameBytes, (f + 1) * frameBytes);
          bgrByte(frame, capture.side, padRegion(faces[f]!, capture.side), PAD.size, input);
          const out = await model.run({ [PAD.input]: new ort.Tensor("float32", input, [1, 3, PAD.size, PAD.size]) });
          live += softmax(out[PAD.output]!.data as Float32Array)[PAD.liveIndex]!;
          frames++;
        }
      });
    } finally {
      input.fill(0);
    }
    if (frames === 0) {
      return SKIPPED;
    }
    return { verdict: "pass", scores: { live: Math.round((live / frames) * 1000) / 1000, frames } };
  },
};
