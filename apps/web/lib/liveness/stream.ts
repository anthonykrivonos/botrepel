import {
  arcWindowMs,
  SCHEDULE_MS,
  STREAM_LEAD_STEPS,
  type Arc,
  type Schedule,
  type StreamLine,
} from "../../src/shared/liveness";
import type { DomainResult } from "../../src/shared/result";

export interface StreamDeps {
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => number;
}

export const realClock: StreamDeps = {
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now: () => performance.now(),
};

/**
 * Plays the schedule to the widget just in time: the first STREAM_LEAD_STEPS colors at once, then
 * one per step, each sent STREAM_LEAD_STEPS steps before it is due, and after the schedule the
 * arc to ask for. The server stays the only holder of future colors; an injector learns at most
 * ~100 ms ahead. Newline-delimited JSON over a chunked response.
 */
export function scheduleStream(
  schedule: Schedule,
  issueArc: () => Promise<DomainResult<{ readonly arc: Arc }>>,
  signal: AbortSignal | undefined,
  deps: StreamDeps = realClock,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const line = (value: StreamLine): Uint8Array => encoder.encode(JSON.stringify(value) + "\n");
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const started = deps.now();
      const until = async (dueMs: number): Promise<void> => {
        const wait = started + dueMs - deps.now();
        if (wait > 0) {
          await deps.sleep(wait);
        }
      };
      try {
        controller.enqueue(line({ colors: schedule.colors.slice(0, STREAM_LEAD_STEPS), stepMs: schedule.stepMs }));
        for (let step = STREAM_LEAD_STEPS; step < schedule.colors.length; step++) {
          await until((step - STREAM_LEAD_STEPS) * schedule.stepMs);
          if (signal?.aborted) {
            controller.close();
            return;
          }
          controller.enqueue(line({ step, color: schedule.colors[step]! }));
        }
        // The prompt is unknowable during the flash: it leaves the server only once the colors are done.
        await until(SCHEDULE_MS);
        if (signal?.aborted) {
          controller.close();
          return;
        }
        const issued = await issueArc();
        controller.enqueue(
          line(
            issued.success
              ? { end: true, arc: issued.data.arc, windowMs: arcWindowMs(issued.data.arc) }
              : { end: true },
          ),
        );
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}
