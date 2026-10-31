/**
 * What the widget does, for integration tests: reads the schedule stream, renders a synthetic
 * capture against it, and packs the two uploads.
 */
import { renderCapture, scenario, type AttackLabel, type SyntheticCapture } from "./synth-scene";
import {
  packCapture,
  PROTOCOL_VERSION,
  SCHEDULE_STEP_MS,
  type FlashHeader,
  type Arc,
  type Rgb,
  type Schedule,
  type StreamLine,
} from "../../src/shared/liveness";

export interface StreamedSchedule {
  readonly schedule: Schedule;
  readonly arc: Arc | null;
  /** The lines in the order they arrived. */
  readonly lines: readonly StreamLine[];
}

/** Reads a start stream to its end and reassembles the schedule the way the widget does. */
export async function readSchedule(response: Response): Promise<StreamedSchedule> {
  const text = await response.text();
  const lines = text
    .split("\n")
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as StreamLine);
  const colors: Rgb[] = [];
  let stepMs = SCHEDULE_STEP_MS;
  let arc: Arc | null = null;
  for (const line of lines) {
    if ("colors" in line) {
      colors.push(...line.colors);
      stepMs = line.stepMs;
    } else if ("step" in line) {
      if (line.step !== colors.length) {
        throw new Error(`Step ${line.step} arrived out of order (expected ${colors.length}).`);
      }
      colors.push(line.color);
    } else if (line.end) {
      arc = line.arc ?? null;
    }
  }
  return { schedule: { stepMs, colors }, arc, lines };
}

/** A synthetic capture of `label` rendered against the streamed schedule, its head answering the streamed arc. */
export function captureFor(label: AttackLabel, streamed: StreamedSchedule, seed = 1): SyntheticCapture {
  const base = scenario(label, seed);
  const requested = streamed.arc ?? base.pose.requested;
  return renderCapture({ ...base, pose: { ...base.pose, requested } }, streamed.schedule);
}

const gzip = (bytes: Uint8Array<ArrayBuffer>): Uint8Array<ArrayBuffer> => new Uint8Array(Bun.gzipSync(bytes));

export function flashBody(capture: SyntheticCapture, overrides: Partial<FlashHeader> = {}): Uint8Array<ArrayBuffer> {
  const header: FlashHeader = {
    v: PROTOCOL_VERSION,
    times: capture.times,
    keyTimes: capture.keyTimes,
    paintTimes: capture.paintTimes,
    whiteBalanceLocked: capture.whiteBalanceLocked,
    exposureLocked: capture.exposureLocked,
    source: capture.source,
    ...overrides,
  };
  return gzip(packCapture(header, capture.pixels, capture.keyPixels));
}

export function poseBody(capture: SyntheticCapture): Uint8Array<ArrayBuffer> {
  return gzip(
    packCapture({ v: PROTOCOL_VERSION, times: capture.pose.times, source: capture.source }, capture.pose.pixels),
  );
}
