import { colorAt, SCHEDULE_STEP_MS, SCHEDULE_STEPS, type Rgb, type Schedule } from "../../src/shared/liveness";

/**
 * What the screen showed and when. The server never trusts the client's colors, only its times:
 * `paintTimes[k]` is the client's time when schedule step k was first on screen, so a stream that
 * stalled still gets judged against the light that was there.
 */
export interface Emission {
  readonly schedule: Schedule;
  readonly paintTimes: readonly number[];
}

/** A healthy run: every step painted on its nominal beat. */
export function nominalEmission(schedule: Schedule): Emission {
  return { schedule, paintTimes: Array.from({ length: schedule.colors.length }, (_, k) => k * schedule.stepMs) };
}

/** The color on screen at client time `t`: the step painted by then, interpolated toward the next painted step. */
export function emittedColorAt(emission: Emission, t: number): Rgb {
  const { schedule, paintTimes } = emission;
  if (paintTimes.length === 0) {
    return colorAt(schedule, t);
  }
  // The last step painted by `t` (binary search; paint times never decrease).
  let low = 0;
  let high = paintTimes.length - 1;
  if (t < paintTimes[0]!) {
    return schedule.colors[0]!;
  }
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (paintTimes[mid]! <= t) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  const step = Math.min(low, schedule.colors.length - 1);
  const next = step + 1;
  if (next >= schedule.colors.length || next >= paintTimes.length) {
    return schedule.colors[step]!;
  }
  const span = paintTimes[next]! - paintTimes[step]!;
  const fraction = span > 0 ? Math.min(1, (t - paintTimes[step]!) / span) : 1;
  const a = schedule.colors[step]!;
  const b = schedule.colors[next]!;
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction, a[2] + (b[2] - a[2]) * fraction];
}

/**
 * A step paints on the next display frame after its beat, so consecutive paints are a frame
 * period apart at most beyond the 20 ms step: one 30 Hz frame of slack separates display timing
 * from a stalled stream. (A 60 Hz display measured 25/16 ms alternating gaps, 0 ms of stall.)
 */
const PAINT_SLACK_MS = 34;

/**
 * Stalls in the paint log. `maxMs` is how far behind its beat the screen ever fell: the extra
 * foresight an injector could have had beyond the stream's lead. `totalMs` is the time the stream
 * was actually stuck (gaps beyond a step plus display slack), plus any steps never painted.
 */
export function stalls(paintTimes: readonly number[]): { readonly totalMs: number; readonly maxMs: number } {
  const first = paintTimes[0] ?? 0;
  let totalMs = 0;
  let maxMs = 0;
  for (let k = 1; k < paintTimes.length; k++) {
    totalMs += Math.max(0, paintTimes[k]! - paintTimes[k - 1]! - SCHEDULE_STEP_MS - PAINT_SLACK_MS);
    maxMs = Math.max(maxMs, paintTimes[k]! - first - k * SCHEDULE_STEP_MS);
  }
  const unpainted = Math.max(0, SCHEDULE_STEPS - paintTimes.length) * SCHEDULE_STEP_MS;
  return { totalMs: totalMs + unpainted, maxMs: Math.max(maxMs, unpainted) };
}
