import { useEffect, useRef, useState, type RefObject } from "react";
import type { Arc } from "../shared/liveness";
import { ARC_NOT_STARTED, advanceArc, arcDone, toPoseArc } from "../shared/pose-arc";
import { headTracker } from "../widget/pose-track";

/** How often the tracker reads the preview: enough for a smooth ring, cheap on a phone. */
const SAMPLE_MS = 66;

/**
 * Degrees of `arc` the head has covered, from the preview in `video`, while `arc` is set. Calls
 * `onDone` once when the whole arc is covered. Feedback only: the server judges the pose frames.
 */
export function usePoseProgress(
  video: RefObject<HTMLVideoElement | null>,
  arc: Arc | null,
  onDone: () => void,
): number {
  const [progress, setProgress] = useState(ARC_NOT_STARTED);
  const done = useRef(onDone);
  done.current = onDone;

  useEffect(() => {
    setProgress(ARC_NOT_STARTED);
    const element = video.current;
    if (!arc || !element) {
      return;
    }
    const ring = toPoseArc(arc);
    const tracker = headTracker();
    let covered = ARC_NOT_STARTED;
    let finished = false;
    let last = 0;
    let frame = requestAnimationFrame(function sample(now) {
      frame = requestAnimationFrame(sample);
      if (now - last < SAMPLE_MS) {
        return;
      }
      last = now;
      const head = tracker.sample(element);
      if (!head) {
        return;
      }
      covered = advanceArc(ring, covered, head);
      setProgress(covered);
      if (!finished && arcDone(ring, covered)) {
        finished = true;
        done.current();
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [arc, video]);

  return progress;
}
