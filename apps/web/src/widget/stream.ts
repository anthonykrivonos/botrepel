import type { Arc, Rgb, StreamLine } from "../shared/liveness";

/** The schedule as it arrives: the paint loop reads it while the stream fills it. */
export interface ScheduleFeed {
  readonly colors: Rgb[];
  stepMs: number;
  /** The stream ended; `arc` is what it asked for, or null when it couldn't. */
  done: boolean;
  arc: Arc | null;
  windowMs: number;
}

export const newFeed = (stepMs: number): ScheduleFeed => ({ colors: [], stepMs, done: false, arc: null, windowMs: 0 });

/**
 * Reads the start stream (newline-delimited JSON) into `feed` line by line. Resolves when the
 * stream ends; rejects when it breaks or arrives out of order.
 */
export async function readSchedule(response: Response, feed: ScheduleFeed, signal: AbortSignal): Promise<void> {
  if (!response.ok || !response.body) {
    throw new Error("The check couldn't start.");
  }
  const reader = response.body.getReader();
  const abort = (): void => void reader.cancel().catch(() => undefined);
  signal.addEventListener("abort", abort, { once: true });
  const decoder = new TextDecoder();
  let buffered = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffered += decoder.decode(value, { stream: true });
      let newline = buffered.indexOf("\n");
      while (newline >= 0) {
        apply(feed, JSON.parse(buffered.slice(0, newline)) as StreamLine);
        buffered = buffered.slice(newline + 1);
        newline = buffered.indexOf("\n");
      }
    }
  } finally {
    signal.removeEventListener("abort", abort);
    feed.done = true;
  }
}

function apply(feed: ScheduleFeed, line: StreamLine): void {
  if ("colors" in line) {
    feed.stepMs = line.stepMs;
    feed.colors.push(...line.colors);
  } else if ("step" in line) {
    if (line.step !== feed.colors.length) {
      throw new Error("The schedule arrived out of order.");
    }
    feed.colors.push(line.color);
  } else if (line.end) {
    feed.arc = line.arc ?? null;
    feed.windowMs = line.windowMs ?? 0;
  }
}
