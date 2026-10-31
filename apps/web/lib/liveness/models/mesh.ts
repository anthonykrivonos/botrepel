import { ort, session } from "./runtime";
import { rgbUnit, wholeFrame } from "./tensor";

/** The face mesh model's contract (models/manifest.json). */
export const MESH = {
  size: 256,
  points: 478,
  input: "input_12",
  landmarks: "Identity",
  presence: "Identity_1",
  /** Presence below this and the frame holds no face the model trusts. */
  minScore: 0.5,
} as const;

export interface Mesh {
  /** The model's confidence that a face is there, 0–1. */
  readonly score: number;
  /** MESH.points × (x, y, z), in frame pixels; z is depth in the same scale, smaller toward the camera. */
  readonly points: Float32Array;
}

/** A buffer for `detectMesh` to resample frames into; zero it after the last frame. */
export const meshScratch = (): Float32Array => new Float32Array(MESH.size * MESH.size * 3);

const sigmoid = (logit: number): number => 1 / (1 + Math.exp(-logit));

/** The face's landmarks in a side × side RGB frame, or null when the model sees no face. */
export async function detectMesh(frame: Uint8Array, side: number, scratch: Float32Array): Promise<Mesh | null> {
  const model = await session("mesh");
  rgbUnit(frame, side, wholeFrame(side), MESH.size, scratch);
  const out = await model.run({ [MESH.input]: new ort.Tensor("float32", scratch, [1, MESH.size, MESH.size, 3]) });
  const score = sigmoid((out[MESH.presence]!.data as Float32Array)[0]!);
  if (score < MESH.minScore) {
    return null;
  }
  const raw = out[MESH.landmarks]!.data as Float32Array;
  const scale = side / MESH.size;
  const points = new Float32Array(MESH.points * 3);
  for (let i = 0; i < points.length; i++) {
    points[i] = raw[i]! * scale;
  }
  return { score, points };
}
