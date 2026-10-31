import type { Capture } from "../../lib/liveness/decode";
import { colorAt, CROP, type Rgb, type Schedule } from "../../src/shared/liveness";

export interface SynthOptions {
  /** A 3D face (an ellipsoid with a nose) or a flat print of one. */
  readonly shape?: "face" | "flat";
  /** The reflection trails the schedule by this many frames: camera and display latency, or an injected relight. */
  readonly delayFrames?: number;
  /** What the screen showed before the schedule started, which the camera sees until the latency passes. */
  readonly before?: Rgb;
  /** Auto-exposure brightening the image by this share over the capture, as an unlocked camera does. */
  readonly exposureRamp?: number;
  /**
   * A face this share of the crop's size, its center moved by `dx`, `dy` pixels, in front of a
   * bright skin-toned wall too far away for the screen to light. By default the face fills the crop.
   */
  readonly framing?: { readonly scale: number; readonly dx: number; readonly dy: number };
  /** How strongly the screen lights the face relative to ambient light. */
  readonly screenStrength?: number;
  readonly albedo?: readonly [number, number, number];
  readonly frames?: number;
  readonly seed?: number;
  /** A real camera: sensor noise, timestamp jitter, auto-exposure drift, and head sway. */
  readonly realistic?: boolean;
}

const FRAME_MS = 1000 / 30;
/** A sunlit wood or beige wall: skin-toned, and too far away for the screen to light it. */
const WALL = [0.8, 0.6, 0.45] as const;

const toLinear = (value: number): number => {
  const v = value / 255;
  return 255 * (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
};
const toSrgb = (value: number): number => {
  const v = Math.max(0, Math.min(1, value / 255));
  return 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);
};

/** Deterministic noise, so tests never flake. */
function noise(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    // Roughly Gaussian from the sum of uniforms, σ ≈ 1.
    return (((state >>> 0) / 2 ** 32) * 2 - 1) * 1.7;
  };
}

/** How directly a crop pixel faces the screen: an ellipsoid head with a nose, or a flat card. */
function facing(x: number, y: number, shape: "face" | "flat"): number {
  if (shape === "flat") {
    return 1;
  }
  const nx = (x - CROP / 2) / (CROP * 0.42);
  const ny = (y - CROP * 0.5) / (CROP * 0.52);
  const nose = Math.exp(-(((x - 48) / 5) ** 2) - ((y - 48) / 9) ** 2) * 0.35;
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  return Math.min(1, nz + nose);
}

/** A capture of a Lambertian surface lit by ambient light plus the schedule, gamma-encoded, with sensor noise. */
export function synthCapture(schedule: Schedule, options: SynthOptions = {}): Capture {
  const shape = options.shape ?? "face";
  const frames = options.frames ?? 60;
  const strength = options.screenStrength ?? 0.6;
  const albedo = options.albedo ?? [0.78, 0.56, 0.46];
  const delay = (options.delayFrames ?? 0) * FRAME_MS;
  const random = noise(options.seed ?? 7);
  const pixels = new Uint8Array(frames * CROP * CROP * 3);
  const times: number[] = [];
  // Linear light on the 0–255 scale; the camera gamma-encodes what it sees, as real ones do.
  const ambient = 60;
  const realistic = options.realistic ?? false;
  const sensorNoise = realistic ? 6 : 2;
  for (let f = 0; f < frames; f++) {
    // A real webcam reports capture times a few milliseconds off, and the exposure is never exactly constant.
    const jitter = realistic ? random() * 4 : 0;
    const t = 5 + f * FRAME_MS + jitter;
    times.push(t);
    const ramp = 1 + ((options.exposureRamp ?? 0) * f) / frames;
    const exposure = ramp * (realistic ? 1 + 0.04 * Math.sin(f / 9) + random() * 0.01 : 1);
    const swayX = realistic ? Math.round(1.5 * Math.sin(f / 7)) : 0;
    const swayY = realistic ? Math.round(Math.sin(f / 11)) : 0;
    const shown = 5 + f * FRAME_MS - delay;
    const [er, eg, eb] = shown < 0 && options.before ? options.before : colorAt(schedule, shown);
    for (let y = 0; y < CROP; y++) {
      for (let x = 0; x < CROP; x++) {
        const i = (f * CROP * CROP + y * CROP + x) * 3;
        const light = [toLinear(er), toLinear(eg), toLinear(eb)];
        const framing = options.framing;
        // Crop coordinates mapped onto the face model, which fills the crop at scale 1.
        const fx = framing ? CROP / 2 + (x - swayX - CROP / 2 - framing.dx) / framing.scale : x - swayX;
        const fy = framing ? CROP / 2 + (y - swayY - CROP / 2 - framing.dy) / framing.scale : y - swayY;
        const onFace = !framing || ((fx - CROP / 2) / (CROP * 0.42)) ** 2 + ((fy - CROP / 2) / (CROP * 0.52)) ** 2 < 1;
        const gain = onFace ? 0.25 + 0.75 * facing(fx, fy, shape) : 0;
        const surface = onFace ? albedo : WALL;
        const lit = onFace ? ambient : ambient * 1.8;
        for (let c = 0; c < 3; c++) {
          const value = toSrgb(exposure * surface[c]! * (lit + strength * gain * light[c]!)) + random() * sensorNoise;
          pixels[i + c] = Math.max(0, Math.min(255, Math.round(value)));
        }
      }
    }
  }
  return { times, whiteBalanceLocked: true, exposureLocked: true, pixels, frameCount: frames };
}
