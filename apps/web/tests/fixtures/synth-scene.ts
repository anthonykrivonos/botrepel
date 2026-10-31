/**
 * Physically shaded synthetic captures for the light check: a head (see heads.ts) under room light
 * plus the screen's one-time schedule, with specular highlights, a camera model (gamma, noise,
 * auto-exposure and white-balance drift, sway, rolling shutter, latency), attacks (print, replay,
 * relighting injectors at various lags), a pose step, and the browser's source report.
 * Deterministic from a seed, so a corpus is reproducible and its metrics comparable over time.
 */
import { createHash } from "node:crypto";
import { GENUINE_SOURCES, canvasCapture, obsVirtualCamera, type SourceReport } from "./device-reports";
import { flatBuffer, gBuffer, MATERIAL, type Framing, type GBuffer, type HeadName, type Pose } from "./heads";
import { pickArc } from "../../lib/liveness/arc";
import type { Capture } from "../../lib/liveness/decode";
import { newSchedule } from "../../lib/liveness/schedule";
import {
  colorAt,
  CROP,
  KEY_CROP,
  arcAngleAt,
  arcSpanDeg,
  arcWindowMs,
  keyFrameTimes,
  MAX_FRAMES,
  SCHEDULE_MS,
  SCHEDULE_STEP_MS,
  type Arc,
  type Rgb,
  type Schedule,
} from "../../src/shared/liveness";

export const POSE_FRAMES = 12;
/** How far a genuine turn goes, degrees. */
const TURN_DEG = 20;

export type Rng = () => number;

/** mulberry32: small, fast, and good enough for fixtures. */
export function seededRandom(seed: number): Rng {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

/** Roughly Gaussian with σ 1. */
const gaussian = (rng: Rng): number => (rng() + rng() + rng() - 1.5) * 2;

/** Sensor noise comes from a fixed table, entered at a random offset per frame: millions of samples, few RNG calls. */
const NOISE_MASK = 0xffff;
const NOISE = ((): Float32Array => {
  const rng = seededRandom(0x5eed);
  return Float32Array.from({ length: NOISE_MASK + 1 }, () => gaussian(rng));
})();

export interface SceneOptions {
  readonly head: HeadName;
  /** Linear skin albedo per channel; the head's own scalar albedo multiplies it. */
  readonly skin: Rgb;
  readonly framing: Framing;
  /** Room light level in linear 0–255 terms, and its color (a window is cool, a lamp warm). */
  readonly ambient: number;
  readonly ambientChroma: Rgb;
  /** How brightly the background is lit relative to the face (a window behind: high). */
  readonly background: number;
  /** The screen's light on the face relative to full white, 0–1. */
  readonly screenStrength: number;
  /** Blinn-Phong highlights; null for a matte surface. Skin is about ks 0.04, shininess 30. */
  readonly specular: { readonly ks: number; readonly shininess: number } | null;
  /** Display and sensor latency between painting a color and the frame that shows it. */
  readonly baseLagMs: number;
  readonly fps: 24 | 30 | 60;
  /** Every Nth frame is missing (0: none). */
  readonly dropFrames: number;
  /** Auto-exposure brightening over the capture, as a share. */
  readonly exposureRamp: number;
  /** Slow per-channel gain wobble from auto white balance. */
  readonly awbDrift: number;
  /** Head translation in pixels. */
  readonly sway: number;
  /** Sensor readout time; rows sample the light progressively later (0: global shutter). */
  readonly rollingShutterMs: number;
  /** Sensor noise σ in sRGB codes. */
  readonly sensorNoise: number;
  /** What the screen showed before the schedule started. */
  readonly before: Rgb | null;
  readonly seed: number;
}

export type Attack =
  | { readonly kind: "none" }
  /** The head's albedo on paper: the schedule reflects uniformly, nothing is 3D. */
  | { readonly kind: "print" }
  /** A screen playing a recording under another schedule; its glass reflects a little of the real one. */
  | {
      readonly kind: "replay";
      readonly replaySchedule: Schedule;
      readonly moire: number;
      readonly glossReflect: number;
    }
  /**
   * A relighting injector: it knows the head's shape, so the diffuse response is exactly right,
   * driven by the schedule it read `lagFrames` ago. Its highlights keep the recorded room's color
   * ("stale") or follow the screen too ("recolored", a physically complete relight).
   */
  | { readonly kind: "relight"; readonly lagFrames: 0 | 1 | 2 | 3; readonly specular: "stale" | "recolored" }
  /** A 3D surface with a uniform non-skin albedo. */
  | { readonly kind: "mask" };

export interface PoseScenario {
  readonly requested: Arc;
  /** How the frames answer: a real turn, no motion, the opposite way, a turn that happened before the prompt, or a card rotated. */
  readonly response: "genuine" | "static" | "wrong" | "early" | "flat-turn";
}

export const ATTACK_LABELS = [
  "genuine",
  "print",
  "replay",
  "mask",
  "relight-diffuse@0",
  "relight-diffuse@1",
  "relight-diffuse@2",
  "relight-diffuse@3",
  "relight-full@0",
  "relight-full@1",
  "relight-full@2",
  "relight-full@3",
  "pose-static",
  "pose-wrong",
  "pose-early",
  "pose-flat-turn",
  "timing-regular",
  "canvas-track",
  "virtual-camera",
] as const;
export type AttackLabel = (typeof ATTACK_LABELS)[number];

export interface Scenario {
  readonly id: string;
  readonly label: AttackLabel;
  readonly scene: SceneOptions;
  readonly attack: Attack;
  readonly pose: PoseScenario;
  readonly source: SourceReport;
  /** Frame times are exact multiples of the frame period, as a file or virtual camera paces them. */
  readonly regularTiming: boolean;
}

/** Everything the submit endpoints receive, before packing, plus the ground truth tests need. */
export interface SyntheticCapture extends Capture {
  readonly keyTimes: number[];
  /** `keyTimes.length` frames of KEY_CROP² RGB. */
  readonly keyPixels: Uint8Array;
  /** Client time each schedule step was first painted. */
  readonly paintTimes: number[];
  readonly pose: {
    readonly arc: Arc;
    readonly promptAtMs: number;
    readonly times: number[];
    /** `times.length` frames of KEY_CROP² RGB. */
    readonly pixels: Uint8Array;
    readonly truth: Pose[];
  };
  readonly source: SourceReport;
}

// Linear-light helpers: the schedule's sRGB colors and the camera's encoding.
const LINEAR = Float64Array.from({ length: 256 }, (_, v) => {
  const s = v / 255;
  return 255 * (s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4);
});
const LUT_SIZE = 4096;
const ENCODE = Uint8Array.from({ length: LUT_SIZE + 1 }, (_, i) => {
  const v = i / LUT_SIZE;
  return Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055));
});
const encode = (linear: number): number =>
  ENCODE[Math.max(0, Math.min(LUT_SIZE, Math.round((linear / 255) * LUT_SIZE)))]!;
const linearRgb = ([r, g, b]: Rgb): [number, number, number] => [
  LINEAR[Math.round(r)]!,
  LINEAR[Math.round(g)]!,
  LINEAR[Math.round(b)]!,
];

/** The screen sits a little above and left of the eyes (as the site's LightStage has it); the camera looks straight on. */
const LIGHT = ((): [number, number, number] => {
  const [x, y, z] = [-0.28, 0.32, 0.9];
  const size = Math.hypot(x, y, z);
  return [x / size, y / size, z / size];
})();
const HALF = ((): [number, number, number] => {
  const [x, y, z] = [LIGHT[0], LIGHT[1], LIGHT[2] + 1];
  const size = Math.hypot(x, y, z);
  return [x / size, y / size, z / size];
})();
/** A far wall or window behind the person: lit by the room only, never by the screen. */
const WALL: Rgb = [0.8, 0.6, 0.45];
const MASK_ALBEDO: Rgb = [0.55, 0.55, 0.55];

interface Shading {
  /** Diffuse term per pixel: max(0, n·l). */
  readonly ndl: Float32Array;
  /** Specular term per pixel: (n·h)^shininess. */
  readonly ndhS: Float32Array;
}

const shadings = new WeakMap<GBuffer, Map<number, Shading>>();

function shading(g: GBuffer, shininess: number): Shading {
  let byShininess = shadings.get(g);
  if (!byShininess) {
    byShininess = new Map();
    shadings.set(g, byShininess);
  }
  let cached = byShininess.get(shininess);
  if (!cached) {
    const n = g.width * g.height;
    const ndl = new Float32Array(n);
    const ndhS = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      if (g.material[i] === MATERIAL.background) {
        continue;
      }
      ndl[i] = Math.max(0, g.nx[i]! * LIGHT[0] + g.ny[i]! * LIGHT[1] + g.nz[i]! * LIGHT[2]);
      ndhS[i] = Math.max(0, g.nx[i]! * HALF[0] + g.ny[i]! * HALF[1] + g.nz[i]! * HALF[2]) ** shininess;
    }
    cached = { ndl, ndhS };
    byShininess.set(shininess, cached);
  }
  return cached;
}

interface FrameLight {
  /** Linear illuminant per row (rows × 3): what the screen sent, as seen by that row's sample time. */
  readonly diffuse: Float32Array;
  /** The color the highlights carry per row. */
  readonly specular: Float32Array;
}

interface FrameCamera {
  readonly exposure: number;
  readonly awb: readonly [number, number, number];
  readonly swayX: number;
  readonly swayY: number;
}

/** Shades one frame into `out` at `offset`: diffuse + specular in linear light, then the camera. */
function shadeFrame(
  g: GBuffer,
  scene: SceneOptions,
  albedo: Rgb,
  light: FrameLight,
  camera: FrameCamera,
  out: Uint8Array,
  offset: number,
  rng: Rng,
): void {
  const { width, height } = g;
  const spec = scene.specular;
  const sh = shading(g, spec?.shininess ?? 1);
  const ks = spec?.ks ?? 0;
  const ambient: [number, number, number] = [
    scene.ambient * scene.ambientChroma[0],
    scene.ambient * scene.ambientChroma[1],
    scene.ambient * scene.ambientChroma[2],
  ];
  const wallLight = scene.background;
  let ni = Math.floor(rng() * NOISE_MASK);
  for (let row = 0; row < height; row++) {
    const lr = light.diffuse[row * 3]!;
    const lg = light.diffuse[row * 3 + 1]!;
    const lb = light.diffuse[row * 3 + 2]!;
    const sr = light.specular[row * 3]!;
    const sg = light.specular[row * 3 + 1]!;
    const sb = light.specular[row * 3 + 2]!;
    const srcRow = row - camera.swayY;
    for (let col = 0; col < width; col++) {
      const srcCol = col - camera.swayX;
      const o = offset + (row * width + col) * 3;
      const inside = srcRow >= 0 && srcRow < height && srcCol >= 0 && srcCol < width;
      const i = inside ? srcRow * width + srcCol : -1;
      if (i < 0 || g.material[i] === MATERIAL.background) {
        out[o] = encode(
          camera.exposure * camera.awb[0] * WALL[0] * ambient[0] * wallLight +
            NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
        );
        out[o + 1] = encode(
          camera.exposure * camera.awb[1] * WALL[1] * ambient[1] * wallLight +
            NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
        );
        out[o + 2] = encode(
          camera.exposure * camera.awb[2] * WALL[2] * ambient[2] * wallLight +
            NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
        );
        continue;
      }
      const a = g.albedo[i]!;
      const ndl = sh.ndl[i]! * scene.screenStrength;
      const s = ks * sh.ndhS[i]!;
      out[o] = encode(
        camera.exposure * camera.awb[0] * (a * albedo[0] * (ambient[0] + ndl * lr) + s * sr) +
          NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
      );
      out[o + 1] = encode(
        camera.exposure * camera.awb[1] * (a * albedo[1] * (ambient[1] + ndl * lg) + s * sg) +
          NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
      );
      out[o + 2] = encode(
        camera.exposure * camera.awb[2] * (a * albedo[2] * (ambient[2] + ndl * lb) + s * sb) +
          NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
      );
    }
  }
}

/** What the screen sent at `t` ms after its schedule started, in linear light. */
function sent(schedule: Schedule, before: Rgb | null, t: number): [number, number, number] {
  return linearRgb(t < 0 && before ? before : colorAt(schedule, t));
}

/** Per-row illuminant for a frame captured at `captureMs`, allowing for latency and rolling shutter. */
function frameLight(
  schedule: Schedule,
  scene: SceneOptions,
  rows: number,
  captureMs: number,
  lagMs: number,
  specular: "same" | "stale",
): FrameLight {
  const diffuse = new Float32Array(rows * 3);
  const spec = new Float32Array(rows * 3);
  const stale: [number, number, number] = [
    scene.ambient * scene.ambientChroma[0],
    scene.ambient * scene.ambientChroma[1],
    scene.ambient * scene.ambientChroma[2],
  ];
  const sampled = (row: number): [number, number, number] =>
    sent(schedule, scene.before, captureMs - lagMs + (scene.rollingShutterMs * row) / rows);
  const one = scene.rollingShutterMs === 0 ? sampled(0) : null;
  for (let row = 0; row < rows; row++) {
    const e = one ?? sampled(row);
    diffuse[row * 3] = e[0];
    diffuse[row * 3 + 1] = e[1];
    diffuse[row * 3 + 2] = e[2];
    const s = specular === "same" ? e : stale;
    spec[row * 3] = s[0];
    spec[row * 3 + 1] = s[1];
    spec[row * 3 + 2] = s[2];
  }
  return { diffuse, specular: spec };
}

function cameraAt(scene: SceneOptions, frame: number, frames: number, rng: Rng): FrameCamera {
  const share = frame / Math.max(1, frames - 1);
  const exposure = (1 + scene.exposureRamp * share) * (1 + 0.01 * Math.sin(frame / 9)) + gaussian(rng) * 0.003;
  const drift = (phase: number): number => 1 + scene.awbDrift * Math.sin(frame / 7 + phase);
  return {
    exposure,
    awb: [drift(0), drift(2.1), drift(4.2)],
    swayX: Math.round(scene.sway * Math.sin(frame / 7)),
    swayY: Math.round(scene.sway * 0.6 * Math.sin(frame / 11)),
  };
}

/** Capture times over the schedule: the camera's cadence, jitter, drops, and the first frame's offset. */
function captureTimes(scene: SceneOptions, regular: boolean, rng: Rng): number[] {
  const period = 1000 / scene.fps;
  const first = regular ? 0 : 5 + rng() * 25;
  const times: number[] = [];
  for (let f = 0; times.length < MAX_FRAMES; f++) {
    const t = first + f * period + (regular ? 0 : gaussian(rng) * 1.5);
    if (t > SCHEDULE_MS) {
      break;
    }
    if (scene.dropFrames && f % scene.dropFrames === scene.dropFrames - 1) {
      continue;
    }
    if (times.length && t <= times[times.length - 1]!) {
      continue;
    }
    times.push(t);
  }
  return times;
}

const faceAlbedo = (scene: SceneOptions, attack: Attack): Rgb => (attack.kind === "mask" ? MASK_ALBEDO : scene.skin);

/** The flash frames (96²) and key frames (192²) for a scenario under `schedule`. */
function renderFlash(
  scenario: Scenario,
  schedule: Schedule,
  rng: Rng,
): { times: number[]; pixels: Uint8Array; keyTimes: number[]; keyPixels: Uint8Array } {
  const { scene, attack } = scenario;
  const times = captureTimes(scene, scenario.regularTiming, rng);
  const keyTimes = keyFrameTimes(schedule.colors, schedule.stepMs).map((t) => t + gaussian(rng) * 2);
  const pixels = new Uint8Array(times.length * CROP * CROP * 3);
  const keyPixels = new Uint8Array(keyTimes.length * KEY_CROP * KEY_CROP * 3);
  const flat = attack.kind === "print" || attack.kind === "replay";
  const small = flat
    ? flatBuffer(scene.head, { yawDeg: 0, pitchDeg: 0 }, CROP, CROP, scene.framing)
    : gBuffer(scene.head, undefined, CROP, CROP, scene.framing);
  const large = flat
    ? flatBuffer(scene.head, { yawDeg: 0, pitchDeg: 0 }, KEY_CROP, KEY_CROP, scene.framing)
    : gBuffer(scene.head, undefined, KEY_CROP, KEY_CROP, scene.framing);
  const albedo = faceAlbedo(scene, attack);
  const lagMs = scene.baseLagMs + (attack.kind === "relight" ? (attack.lagFrames * 1000) / scene.fps : 0);
  const specular: "same" | "stale" = attack.kind === "relight" && attack.specular === "stale" ? "stale" : "same";

  const draw = (
    g: GBuffer,
    side: number,
    captureMs: number,
    frame: number,
    frames: number,
    out: Uint8Array,
    offset: number,
  ): void => {
    const camera = cameraAt(scene, frame, frames, rng);
    if (attack.kind === "replay") {
      // The screen shows a recording made under another schedule; its glass adds a little of the real light.
      const content = new Uint8Array(side * side * 3);
      const still: FrameCamera = { exposure: 1, awb: [1, 1, 1], swayX: 0, swayY: 0 };
      const recorded = gBuffer(scene.head, undefined, side, side, scene.framing);
      shadeFrame(
        recorded,
        { ...scene, rollingShutterMs: 0, sensorNoise: 1 },
        scene.skin,
        frameLight(attack.replaySchedule, scene, side, captureMs, scene.baseLagMs, "same"),
        still,
        content,
        0,
        rng,
      );
      const real = frameLight(schedule, scene, side, captureMs, scene.baseLagMs, "same");
      let ni = Math.floor(rng() * NOISE_MASK);
      for (let row = 0; row < side; row++) {
        for (let col = 0; col < side; col++) {
          const i = (row * side + col) * 3;
          const moire = 1 + attack.moire * Math.sin(col * 2.9) * Math.sin(row * 3.1);
          for (let c = 0; c < 3; c++) {
            const emitted = 0.85 * LINEAR[content[i + c]!]! * moire + attack.glossReflect * real.diffuse[row * 3 + c]!;
            out[offset + i + c] = encode(
              camera.exposure * camera.awb[c]! * emitted + NOISE[(ni = (ni + 1) & NOISE_MASK)]! * scene.sensorNoise,
            );
          }
        }
      }
      return;
    }
    shadeFrame(
      g,
      scene,
      albedo,
      frameLight(schedule, scene, side, captureMs, lagMs, specular),
      camera,
      out,
      offset,
      rng,
    );
  };
  for (const [f, t] of times.entries()) {
    draw(small, CROP, t, f, times.length, pixels, f * CROP * CROP * 3);
  }
  for (const [k, t] of keyTimes.entries()) {
    draw(
      large,
      KEY_CROP,
      t,
      Math.round((t / SCHEDULE_MS) * times.length),
      times.length,
      keyPixels,
      k * KEY_CROP * KEY_CROP * 3,
    );
  }
  return { times, pixels, keyTimes, keyPixels };
}

const unit = (value: number): number => Math.max(0, Math.min(1, value));

/**
 * The head facing a ring angle (degrees counterclockwise from the right, as the person sees the
 * mirrored preview) at `deg` from center. The person's left is the camera's right: a positive yaw
 * in heads.ts turns the nose toward +x.
 */
function facing(angleDeg: number, deg: number): Pose {
  const angle = (angleDeg * Math.PI) / 180;
  return { yawDeg: -deg * Math.cos(angle), pitchDeg: deg * Math.sin(angle) };
}

/** After the reaction time, the head leans from the screen to the arc's start over this long, then sweeps. */
const APPROACH_MS = 200;

/** The head's pose `t` ms after the pose prompt, for the scenario's response. */
function poseAt(pose: PoseScenario, t: number, reactionMs: number, turnMs: number): Pose {
  const arc = pose.requested;
  const along = (progress: number, clockwise = arc.clockwise): Pose =>
    facing(arcAngleAt({ ...arc, clockwise }, progress), TURN_DEG);
  // Facing the screen until the reaction time, then leaning to the arc's start, then along it.
  const lean = unit((t - reactionMs) / APPROACH_MS);
  const start = facing(arcAngleAt(arc, 0), TURN_DEG * lean);
  const progress = unit((t - reactionMs - APPROACH_MS) / turnMs);
  switch (pose.response) {
    case "static":
      return { yawDeg: 0, pitchDeg: 0 };
    case "wrong":
      // The same start, the opposite sense.
      return lean < 1 ? start : along(progress, !arc.clockwise);
    case "early":
      // Already at the arc's end when the prompt arrives, settling back to center.
      return facing(arcAngleAt(arc, 1), TURN_DEG * (1 - unit(t / 800)));
    case "genuine":
    case "flat-turn":
      return lean < 1 ? start : along(progress);
  }
}

/** The pose step's frames: the screen is neutral, the head answers the prompt (or doesn't). */
function renderPose(scenario: Scenario, rng: Rng): SyntheticCapture["pose"] {
  const { scene, pose } = scenario;
  const period = arcWindowMs(pose.requested) / POSE_FRAMES;
  const reactionMs = 250 + rng() * 250;
  // A quarter turn takes under a second; a full circle, proportionally longer.
  const turnMs = ((600 + rng() * 300) * arcSpanDeg(pose.requested)) / 90;
  const times: number[] = [];
  const truth: Pose[] = [];
  const pixels = new Uint8Array(POSE_FRAMES * KEY_CROP * KEY_CROP * 3);
  const white: FrameLight = {
    diffuse: Float32Array.from({ length: KEY_CROP * 3 }, () => 190),
    specular: Float32Array.from({ length: KEY_CROP * 3 }, () => 190),
  };
  const flat = pose.response === "flat-turn" || scenario.attack.kind === "print";
  for (let k = 0; k < POSE_FRAMES; k++) {
    const t = Math.max(times[k - 1] ?? -1, 0) + (k === 0 ? 10 + rng() * 20 : period + gaussian(rng) * 2);
    times.push(t);
    const p = poseAt(pose, t, reactionMs, turnMs);
    // Quantized, so the memoized buffers are shared across frames and scenarios.
    const quantized: Pose = { yawDeg: Math.round(p.yawDeg), pitchDeg: Math.round(p.pitchDeg) };
    truth.push(quantized);
    const g = flat
      ? flatBuffer(scene.head, quantized, KEY_CROP, KEY_CROP, scene.framing)
      : gBuffer(scene.head, quantized, KEY_CROP, KEY_CROP, scene.framing);
    shadeFrame(
      g,
      { ...scene, screenStrength: 0.5 },
      faceAlbedo(scene, scenario.attack),
      white,
      cameraAt(scene, k, POSE_FRAMES, rng),
      pixels,
      k * KEY_CROP * KEY_CROP * 3,
      rng,
    );
  }
  return { arc: pose.requested, promptAtMs: SCHEDULE_MS, times, pixels, truth };
}

/** Everything the server receives for a scenario, deterministic from the scenario and the schedule. */
export function renderCapture(scenario: Scenario, schedule: Schedule): SyntheticCapture {
  const rng = seededRandom(scenario.scene.seed);
  const flash = renderFlash(scenario, schedule, rng);
  const steps = SCHEDULE_MS / SCHEDULE_STEP_MS;
  return {
    times: flash.times,
    pixels: flash.pixels,
    frameCount: flash.times.length,
    whiteBalanceLocked: false,
    exposureLocked: false,
    keyTimes: flash.keyTimes,
    keyPixels: flash.keyPixels,
    paintTimes: Array.from({ length: steps }, (_, k) => k * SCHEDULE_STEP_MS),
    pose: renderPose(scenario, rng),
    source: scenario.source,
  };
}

const SKIN_TONES: readonly Rgb[] = [
  [0.92, 0.72, 0.62],
  [0.78, 0.56, 0.46],
  [0.62, 0.42, 0.32],
  [0.36, 0.24, 0.18],
];
const HEADS: readonly HeadName[] = ["asian-woman", "black-man", "white-woman", "ellipsoid"];
const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;
const between = (rng: Rng, low: number, high: number): number => low + rng() * (high - low);

/** A plausible genuine scene: devices, rooms, framings and skin tones real users bring. */
export function genuineScene(seed: number): SceneOptions {
  const rng = seededRandom(seed * 7919 + 17);
  const tone = pick(rng, SKIN_TONES);
  const vary = (v: number): number => v * between(rng, 0.9, 1.1);
  const window = rng() < 0.2;
  return {
    head: pick(rng, HEADS),
    skin: [vary(tone[0]), vary(tone[1]), vary(tone[2])],
    framing: {
      scale: between(rng, 0.7, 1.05),
      dx: Math.round(between(rng, -8, 8)),
      dy: Math.round(between(rng, -8, 8)),
    },
    ambient: window ? between(rng, 120, 160) : between(rng, 40, 110),
    ambientChroma: window
      ? [0.9, 0.96, 1.1]
      : pick(rng, [
          [1, 1, 1],
          [1.05, 1, 0.9],
          [0.97, 1, 1.03],
        ] as const),
    background: window ? between(rng, 1.6, 2.2) : between(rng, 0.8, 1.4),
    screenStrength: window ? between(rng, 0.15, 0.3) : between(rng, 0.25, 0.8),
    specular: { ks: between(rng, 0.03, 0.06), shininess: between(rng, 20, 40) },
    baseLagMs: between(rng, 40, 200),
    fps: pick(rng, [30, 30, 30, 30, 30, 30, 30, 60, 24, 24] as const),
    dropFrames: rng() < 0.15 ? 7 : 0,
    exposureRamp: between(rng, 0, 0.15),
    awbDrift: between(rng, 0, 0.04),
    sway: between(rng, 0, 2),
    rollingShutterMs: rng() < 0.5 ? 0 : between(rng, 10, 34),
    sensorNoise: between(rng, 2, 8),
    before: rng() < 0.5 ? [255, 255, 255] : null,
    seed,
  };
}

/** One scenario of a label, from the genuine distribution plus the label's attack or quirk. */
export function scenario(label: AttackLabel, seed: number): Scenario {
  const rng = seededRandom(seed * 104_729 + 3);
  const scene = genuineScene(seed);
  const source = pick(rng, GENUINE_SOURCES);
  // Its own stream, so adding the arc did not reshuffle every scene's other draws.
  const requested = pickArc(seededRandom(seed * 7919 + 11));
  const base: Scenario = {
    id: `${label}#${seed}`,
    label,
    scene,
    attack: { kind: "none" },
    pose: { requested, response: "genuine" },
    source,
    regularTiming: false,
  };
  const relight = (lagFrames: 0 | 1 | 2 | 3, specular: "stale" | "recolored"): Scenario => ({
    ...base,
    attack: { kind: "relight", lagFrames, specular },
    source: rng() < 0.5 ? obsVirtualCamera : source,
  });
  switch (label) {
    case "genuine":
      return base;
    case "print":
      return { ...base, attack: { kind: "print" }, pose: { requested, response: "flat-turn" } };
    case "replay":
      return {
        ...base,
        attack: {
          kind: "replay",
          replaySchedule: replaySchedule(rng),
          moire: between(rng, 0, 0.04),
          glossReflect: between(rng, 0.01, 0.05),
        },
        pose: { requested, response: rng() < 0.5 ? "early" : "static" },
      };
    case "mask":
      return { ...base, attack: { kind: "mask" } };
    case "relight-diffuse@0":
      return relight(0, "stale");
    case "relight-diffuse@1":
      return relight(1, "stale");
    case "relight-diffuse@2":
      return relight(2, "stale");
    case "relight-diffuse@3":
      return relight(3, "stale");
    case "relight-full@0":
      return relight(0, "recolored");
    case "relight-full@1":
      return relight(1, "recolored");
    case "relight-full@2":
      return relight(2, "recolored");
    case "relight-full@3":
      return relight(3, "recolored");
    case "pose-static":
      return { ...base, pose: { requested, response: "static" } };
    case "pose-wrong":
      return { ...base, pose: { requested, response: "wrong" } };
    case "pose-early":
      return { ...base, pose: { requested, response: "early" } };
    case "pose-flat-turn":
      return { ...base, pose: { requested, response: "flat-turn" } };
    case "timing-regular":
      return { ...base, regularTiming: true, source: { ...source, captureTime: false, captureLagMs: null } };
    case "canvas-track":
      // A canvas track is paced by a timer, so its frames keep a perfect beat and arrive almost at once.
      return {
        ...base,
        source: canvasCapture,
        regularTiming: true,
        scene: { ...scene, baseLagMs: between(rng, 0, 20) },
      };
    case "virtual-camera":
      return { ...base, source: obsVirtualCamera, regularTiming: true };
  }
}

/** Another one-time schedule, as a recording would have been made under. */
const replaySchedule = (rng: Rng): Schedule => newSchedule(rng);

/** Scenarios for each label, `counts[label]` of them, with distinct seeds. */
export function corpus(seed: number, counts: Partial<Record<AttackLabel, number>>): Scenario[] {
  const out: Scenario[] = [];
  for (const label of ATTACK_LABELS) {
    const n = counts[label] ?? 0;
    for (let i = 0; i < n; i++) {
      out.push(scenario(label, seed * 1000 + ATTACK_LABELS.indexOf(label) * 100_000 + i));
    }
  }
  return out;
}

/** Identifies a corpus in metrics artifacts: the same hash means the same inputs. */
export function corpusHash(scenarios: readonly Scenario[]): string {
  const hash = createHash("sha256");
  for (const s of scenarios) {
    hash.update(
      JSON.stringify({
        ...s,
        attack:
          s.attack.kind === "replay"
            ? { ...s.attack, replaySchedule: s.attack.replaySchedule.colors.length }
            : s.attack,
      }),
    );
  }
  return hash.digest("hex").slice(0, 16);
}
