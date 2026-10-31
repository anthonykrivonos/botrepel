import { gunzipSync } from "node:zlib";
import {
  CROP,
  KEY_CROP,
  MAX_FLASH_UPLOAD_BYTES,
  MAX_FRAMES,
  MAX_KEY_FRAMES,
  MAX_POSE_FRAMES,
  MAX_POSE_UPLOAD_BYTES,
  SCHEDULE_MS,
  type SourceSignals,
} from "../../src/shared/liveness";
import { FlashHeaderSchema, PoseHeaderSchema } from "../../src/shared/liveness-header";

/** The flash frames: `frameCount` frames of CROP×CROP RGB, row-major, with their capture times. */
export interface Capture {
  /** Capture time of each frame, in ms after the schedule started. */
  readonly times: readonly number[];
  readonly whiteBalanceLocked: boolean;
  readonly exposureLocked: boolean;
  readonly pixels: Uint8Array;
  readonly frameCount: number;
}

/** The flash upload: the flash frames plus the sharper key frames, the paint log and the source report. */
export interface FlashCapture extends Capture {
  readonly keyTimes: readonly number[];
  /** `keyFrameCount` frames of KEY_CROP×KEY_CROP RGB. */
  readonly keyPixels: Uint8Array;
  readonly keyFrameCount: number;
  /** When each schedule step was first painted, in the capture clock. */
  readonly paintTimes: readonly number[];
  readonly source: SourceSignals;
}

/** The pose upload: KEY_CROP×KEY_CROP frames with times after the prompt. */
export interface PoseCapture {
  readonly times: readonly number[];
  readonly pixels: Uint8Array;
  readonly frameCount: number;
  readonly side: number;
  readonly source: SourceSignals;
}

export class CaptureError extends Error {}

const FRAME_BYTES = CROP * CROP * 3;
const KEY_FRAME_BYTES = KEY_CROP * KEY_CROP * 3;
const HEADER_LIMIT = 64 * 1024;
const MAX_FLASH_RAW_BYTES = MAX_FRAMES * FRAME_BYTES + MAX_KEY_FRAMES * KEY_FRAME_BYTES + HEADER_LIMIT;
const MAX_POSE_RAW_BYTES = MAX_POSE_FRAMES * KEY_FRAME_BYTES + HEADER_LIMIT;
/** A key frame can't precede the schedule, and the widget stops a little after it ends. */
const KEY_TIME_SLACK_MS = 500;

/** Unzips and splits an upload; anything malformed is a CaptureError, never a crash. */
function unpack(body: Uint8Array, maxBody: number, maxRaw: number): { header: unknown; pixels: Uint8Array } {
  if (body.length > maxBody) {
    throw new CaptureError("The capture is too large.");
  }
  let raw: Uint8Array;
  try {
    // Capped while inflating: a small gzip body can expand to gigabytes.
    raw = gunzipSync(body, { maxOutputLength: maxRaw });
  } catch {
    throw new CaptureError("The capture isn't gzip data, or it unpacks too large.");
  }
  if (raw.length < 4) {
    throw new CaptureError("The capture has the wrong size.");
  }
  const headerLength = new DataView(raw.buffer, raw.byteOffset, raw.byteLength).getUint32(0, true);
  if (headerLength > HEADER_LIMIT || 4 + headerLength > raw.length) {
    throw new CaptureError("The capture header is malformed.");
  }
  let header: unknown;
  try {
    header = JSON.parse(new TextDecoder().decode(raw.subarray(4, 4 + headerLength)));
  } catch {
    throw new CaptureError("The capture header isn't JSON.");
  }
  return { header, pixels: raw.subarray(4 + headerLength) };
}

const increasing = (times: readonly number[]): boolean => times.every((t, i) => i === 0 || t > times[i - 1]!);

export function decodeFlashCapture(body: Uint8Array): FlashCapture {
  const { header, pixels } = unpack(body, MAX_FLASH_UPLOAD_BYTES, MAX_FLASH_RAW_BYTES);
  const parsed = FlashHeaderSchema.safeParse(header);
  if (!parsed.success) {
    throw new CaptureError(`The capture header is invalid: ${parsed.error.issues[0]?.message ?? "schema"}.`);
  }
  const { times, keyTimes, paintTimes } = parsed.data;
  if (!increasing(times)) {
    throw new CaptureError("Send one increasing capture time per frame.");
  }
  if (!increasing(keyTimes) || keyTimes.some((t) => t < 0 || t > SCHEDULE_MS + KEY_TIME_SLACK_MS)) {
    throw new CaptureError("Key frame times must increase within the schedule.");
  }
  if (paintTimes.some((t, i) => i > 0 && t < paintTimes[i - 1]!)) {
    throw new CaptureError("Paint times must not decrease.");
  }
  const flashBytes = times.length * FRAME_BYTES;
  if (pixels.length !== flashBytes + keyTimes.length * KEY_FRAME_BYTES) {
    throw new CaptureError(
      `Send ${times.length} frames of ${CROP}×${CROP} RGB and ${keyTimes.length} of ${KEY_CROP}×${KEY_CROP}.`,
    );
  }
  return {
    times,
    keyTimes,
    paintTimes,
    whiteBalanceLocked: parsed.data.whiteBalanceLocked,
    exposureLocked: parsed.data.exposureLocked,
    source: parsed.data.source,
    pixels: pixels.subarray(0, flashBytes),
    frameCount: times.length,
    keyPixels: pixels.subarray(flashBytes),
    keyFrameCount: keyTimes.length,
  };
}

export function decodePoseCapture(body: Uint8Array): PoseCapture {
  const { header, pixels } = unpack(body, MAX_POSE_UPLOAD_BYTES, MAX_POSE_RAW_BYTES);
  const parsed = PoseHeaderSchema.safeParse(header);
  if (!parsed.success) {
    throw new CaptureError(`The capture header is invalid: ${parsed.error.issues[0]?.message ?? "schema"}.`);
  }
  const { times } = parsed.data;
  if (!increasing(times) || times[0]! < 0) {
    throw new CaptureError("Send one increasing capture time per frame.");
  }
  if (pixels.length !== times.length * KEY_FRAME_BYTES) {
    throw new CaptureError(`Send ${times.length} frames of ${KEY_CROP}×${KEY_CROP} RGB.`);
  }
  return { times, pixels, frameCount: times.length, side: KEY_CROP, source: parsed.data.source };
}
