/**
 * The flash check's shared contract (protocol 2). The server streams a one-time color schedule just
 * in time; the widget paints it, crops the face from each camera frame to CROP×CROP, keeps a few
 * KEY_CROP×KEY_CROP key frames, and uploads that set with its capture times. The stream ends with a
 * pose prompt; the widget then uploads KEY_CROP×KEY_CROP pose frames. Both uploads carry what the
 * browser reports about the camera source. The server compares how the light reflected with what
 * it sent, checks the head turn, and judges.
 */

export const PROTOCOL_VERSION = 2;
/** Side of the square face crop for the flash frames. */
export const CROP = 96;
/** Side of the sharper crops: key frames during the flash (highlights) and the pose frames. */
export const KEY_CROP = 192;
export const SCHEDULE_MS = 2000;
/** The schedule is sampled this often; the widget interpolates between samples. */
export const SCHEDULE_STEP_MS = 20;
export const SCHEDULE_STEPS = SCHEDULE_MS / SCHEDULE_STEP_MS;
/**
 * Steps the stream sends ahead of their time: enough to ride out network jitter, little enough
 * that an injector learns the colors about 100 ms early at most, not two seconds.
 */
export const STREAM_LEAD_STEPS = 5;
/** Flash frames the server accepts; 30 fps over the schedule plus slack. */
export const MAX_FRAMES = 90;
export const MIN_FRAMES = 30;
export const MAX_KEY_FRAMES = 4;
/**
 * Key frames go where they tell the most: right after each dark dip, when the screen's light is
 * nearly off and the room's light alone shows (the specular check's reference), and at two bright
 * moments. The widget can't know a device's latency, so it assumes a typical one.
 */
export const KEY_FRAME_LAG_MS = 130;
/** Bright moments to keep key frames at, in order of preference, when they don't crowd a dip's. */
export const BRIGHT_KEY_TIMES_MS = [600, 1500, 1000, 1800, 400] as const;
/** Below this share of the schedule's peak luminance a step counts as a dip. */
const DIP_SHARE = 0.5;
/** Key frames closer than this tell the same story. */
const KEY_FRAME_SPACING_MS = 150;

function dips(colors: readonly Rgb[], stepMs: number, closeAtEnd: boolean): number[] {
  const luminance = colors.map(([r, g, b]) => 0.299 * r + 0.587 * g + 0.114 * b);
  const peak = Math.max(...luminance);
  const centers: number[] = [];
  let start = -1;
  for (let step = 0; step <= colors.length; step++) {
    const dark = step < colors.length && luminance[step]! < peak * DIP_SHARE;
    if (dark && start < 0) {
      start = step;
    } else if (!dark && start >= 0 && (step < colors.length || closeAtEnd)) {
      centers.push(((start + step - 1) / 2) * stepMs);
      start = -1;
    }
  }
  return centers;
}

/** The centers of the schedule's dark dips, in ms, over the whole schedule. */
export const dipCenters = (colors: readonly Rgb[], stepMs: number): number[] => dips(colors, stepMs, true);

/**
 * The dips a brighter step has already ended, from the colors streamed so far. A dip still
 * arriving has no center yet: its first steps would place it too early.
 */
export const settledDipCenters = (colors: readonly Rgb[], stepMs: number): number[] => dips(colors, stepMs, false);

/** When to keep key frames for a schedule: after each dip (at most two), then bright moments, MAX_KEY_FRAMES in all. */
export function keyFrameTimes(colors: readonly Rgb[], stepMs: number): number[] {
  const times = dipCenters(colors, stepMs)
    .slice(0, 2)
    .map((center) => center + KEY_FRAME_LAG_MS);
  for (const bright of BRIGHT_KEY_TIMES_MS) {
    if (times.length >= MAX_KEY_FRAMES) {
      break;
    }
    if (times.every((t) => Math.abs(t - bright) >= KEY_FRAME_SPACING_MS)) {
      times.push(bright);
    }
  }
  return times.sort((a, b) => a - b);
}

/** The pose window for a quarter or half turn, and for a full circle. */
export const POSE_WINDOW_MS = 3000;
export const FULL_TURN_WINDOW_MS = 5000;
export const MIN_POSE_FRAMES = 8;
export const MAX_POSE_FRAMES = 25;
/** Raw sizes: 90 flash + 4 key frames are 2.9 MB, 25 pose frames 2.8 MB; gzip only shrinks them. */
export const MAX_FLASH_UPLOAD_BYTES = 3.5 * 1024 * 1024;
export const MAX_POSE_UPLOAD_BYTES = 3 * 1024 * 1024;

/**
 * The head-pose step: after the colors, the server asks for an arc around the ring that frames
 * the oval, from one direction to another, clockwise or counterclockwise, or a full circle
 * (`from === to`). Directions are as the person sees the mirrored preview: their left is on the
 * left. The server maps them to the unmirrored frames it receives.
 */
export const DIRECTIONS = ["right", "up", "left", "down"] as const;
export type Direction = (typeof DIRECTIONS)[number];
/** Where each direction sits on the ring: degrees counterclockwise from the right, as on a clock face turned to math. */
export const ARC_DEGREES: Readonly<Record<Direction, number>> = { right: 0, up: 90, left: 180, down: 270 };

export interface Arc {
  readonly from: Direction;
  readonly to: Direction;
  /** Clockwise as seen on screen: from up toward right. */
  readonly clockwise: boolean;
}

/** Degrees the head sweeps: 90, 180 or, for `from === to`, 360. */
export function arcSpanDeg(arc: Arc): number {
  if (arc.from === arc.to) {
    return 360;
  }
  const counterclockwise = (ARC_DEGREES[arc.to] - ARC_DEGREES[arc.from] + 360) % 360;
  return arc.clockwise ? 360 - counterclockwise : counterclockwise;
}

/** The ring angle (degrees) `progress` of the way (0–1) along the arc. */
export function arcAngleAt(arc: Arc, progress: number): number {
  const sweep = arcSpanDeg(arc) * (arc.clockwise ? -1 : 1);
  return (((ARC_DEGREES[arc.from] + sweep * progress) % 360) + 360) % 360;
}

export const arcWindowMs = (arc: Arc): number => (arcSpanDeg(arc) >= 360 ? FULL_TURN_WINDOW_MS : POSE_WINDOW_MS);

/** Pose frames are spaced so that the window holds at most MAX_POSE_FRAMES of them. */
export const poseFrameIntervalMs = (windowMs: number): number => Math.ceil(windowMs / (MAX_POSE_FRAMES - 1));

export function arcMessage(arc: Arc): string {
  const sense = arc.clockwise ? "clockwise" : "counterclockwise";
  return arc.from === arc.to
    ? `Roll your head in a full circle from ${arc.from}, ${sense}`
    : `Roll your head from ${arc.from} to ${arc.to}, ${sense}`;
}

export type Rgb = readonly [number, number, number];

export interface Schedule {
  readonly stepMs: number;
  /** One color per step, 0–255 per channel. */
  readonly colors: readonly Rgb[];
}

/** The color shown at `t` ms after the schedule starts, linearly interpolated. */
export function colorAt(schedule: Schedule, t: number): Rgb {
  const position = Math.max(0, Math.min(schedule.colors.length - 1, t / schedule.stepMs));
  const index = Math.floor(position);
  const next = Math.min(schedule.colors.length - 1, index + 1);
  const fraction = position - index;
  const a = schedule.colors[index]!;
  const b = schedule.colors[next]!;
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction, a[2] + (b[2] - a[2]) * fraction];
}

/** One line of the start stream (newline-delimited JSON). */
export type StreamLine =
  /** The first line: the first STREAM_LEAD_STEPS colors. */
  | { readonly colors: readonly Rgb[]; readonly stepMs: number }
  /** One step, sent STREAM_LEAD_STEPS × SCHEDULE_STEP_MS before it is due. */
  | { readonly step: number; readonly color: Rgb }
  /** After the last color: the arc to ask for. Without `arc`, the check can't continue. */
  | { readonly end: true; readonly arc?: Arc; readonly windowMs?: number };

/**
 * What the browser says about the camera source. Each field can only raise risk; the server
 * matches the label against known virtual cameras and never stores it.
 */
export interface SourceSignals {
  readonly label?: string;
  /** `getSettings().deviceId` was non-empty. */
  readonly deviceId?: boolean;
  /** `Object.keys(getCapabilities()).length`. */
  readonly capabilities?: number;
  /** `requestVideoFrameCallback` existed, and `metadata.captureTime` was ever present. */
  readonly rvfc?: boolean;
  readonly captureTime?: boolean;
  /** Median of `now − captureTime`, ms; null when captureTime was absent. */
  readonly captureLagMs?: number | null;
  readonly width?: number;
  readonly height?: number;
  readonly frameRate?: number;
  /** `getSettings().displaySurface` existed: a screen capture fed to the camera. */
  readonly displaySurface?: boolean;
  /** Milliseconds the document was hidden during the run. */
  readonly hiddenMs?: number;
}

export interface FlashHeader {
  readonly v: typeof PROTOCOL_VERSION;
  /** Capture time of each flash frame, in ms after the schedule started. */
  readonly times: readonly number[];
  /** Capture time of each key frame; the key frames follow the flash frames in the body. */
  readonly keyTimes: readonly number[];
  /** When each schedule step was first on screen, in the same clock. */
  readonly paintTimes: readonly number[];
  /** Whether the browser locked white balance and exposure (both help; neither is required). */
  readonly whiteBalanceLocked: boolean;
  readonly exposureLocked: boolean;
  readonly source: SourceSignals;
}

export interface PoseHeader {
  readonly v: typeof PROTOCOL_VERSION;
  /** Capture time of each pose frame, in ms after the pose prompt was received. */
  readonly times: readonly number[];
  readonly source: SourceSignals;
}

/** Upload format: a 4-byte little-endian header length, the header as JSON, then the RGB frames in order. */
export function packCapture(
  header: FlashHeader | PoseHeader,
  ...frames: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> {
  const json = new TextEncoder().encode(JSON.stringify(header));
  const total = frames.reduce((sum, set) => sum + set.length, 0);
  const out = new Uint8Array(4 + json.length + total);
  new DataView(out.buffer).setUint32(0, json.length, true);
  out.set(json, 4);
  let offset = 4 + json.length;
  for (const set of frames) {
    out.set(set, offset);
    offset += set.length;
  }
  return out;
}

export type LivenessRetry = "too-faint" | "too-dark" | "moved" | "no-face" | "pose-missed" | "network" | "unconfirmed";

export const RETRY_MESSAGES: Readonly<Record<LivenessRetry, string>> = {
  "too-faint": "Turn up your screen brightness or move closer, then try again.",
  "too-dark": "Find a little more light, but not bright light behind you.",
  moved: "Hold still with your face inside the oval, then try again.",
  "no-face": "Center your face in the oval, then try again.",
  "pose-missed": "Follow the ring with your head a little further next time, keeping your face in the oval.",
  network: "Your connection stuttered during the check. Try again.",
  unconfirmed: "We couldn't confirm it's you yet. Face the screen in even light and try again.",
};
