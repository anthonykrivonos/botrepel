import { useEffect, useRef, useState } from "react";
import { CROP_SHARE, openCamera, runCheck, type Camera } from "./capture";
import { PoseRing, RING_CLOSE_MS } from "./PoseRing";
import { newFeed, readSchedule } from "./stream";
import { Button } from "../components/Button";
import { usePoseProgress } from "../hooks/usePoseProgress";
import { arcMessage, RETRY_MESSAGES, SCHEDULE_STEP_MS, type Arc, type LivenessRetry } from "../shared/liveness";
import { toPoseArc } from "../shared/pose-arc";
import type { WidgetErrorCode } from "../shared/widget-protocol";

type Phase =
  | { readonly kind: "intro" }
  | { readonly kind: "camera" }
  | { readonly kind: "connecting" }
  | { readonly kind: "flashing" }
  | { readonly kind: "pose"; readonly arc: Arc }
  | { readonly kind: "captured"; readonly arc: Arc }
  | { readonly kind: "retry"; readonly reason: LivenessRetry }
  | { readonly kind: "blocked"; readonly message: string };

interface LivenessStepProps {
  readonly livenessId: string;
  /** `anchorId` comes with an especially clear pass: the person may create a Human Pass. */
  readonly onToken: (token: string, anchorId?: string) => void;
  readonly onFail: (code: WidgetErrorCode, message: string) => void;
}

type PoseOutcome =
  | { kind: "token"; token: string; anchorId?: string }
  | { kind: "retry"; reason: LivenessRetry; livenessId: string }
  | { kind: "fail" };

async function upload(
  path: string,
  livenessId: string,
  body: Blob,
): Promise<{ ok: boolean; status: number; data: unknown }> {
  const response = await fetch(`${path}?id=${encodeURIComponent(livenessId)}`, {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body,
  });
  return { ok: response.ok, status: response.status, data: (await response.json().catch(() => ({}))) as unknown };
}

/**
 * The flash check: a notice and consent, a camera preview with an oval guide, two seconds of
 * changing screen color while the camera watches how it lights the face, then a head roll along a
 * random arc, with a ring of bars that fills as the head follows it. Once the roll is captured, the
 * ring closes green and dances while the server judges, then the decision shows.
 * Each clip goes to the server once, is analyzed in memory, and is discarded.
 */
export function LivenessStep({ livenessId: initialId, onToken, onFail }: LivenessStepProps): React.JSX.Element {
  const [phase, setPhase] = useState<Phase>({ kind: "intro" });
  const [livenessId, setLivenessId] = useState(initialId);
  const video = useRef<HTMLVideoElement>(null);
  const screen = useRef<HTMLDivElement>(null);
  const camera = useRef<Camera | null>(null);
  const controller = useRef<AbortController | null>(null);
  const endPose = useRef<(() => void) | null>(null);
  const arc = phase.kind === "pose" ? phase.arc : null;
  // The ring stays through the captured phase, closed and dancing, after the tracker has stopped.
  const ringArc = phase.kind === "pose" || phase.kind === "captured" ? phase.arc : null;
  // Once the ring is full, the pose window closes early (after the server's minimum of frames).
  const progress = usePoseProgress(video, arc, () => endPose.current?.());

  useEffect(
    () => () => {
      controller.current?.abort();
      camera.current?.stop();
    },
    [],
  );

  const enableCamera = async (): Promise<void> => {
    try {
      camera.current ??= await openCamera();
      setPhase({ kind: "camera" });
    } catch {
      setPhase({ kind: "blocked", message: "Allow camera access for this check, then try again." });
    }
  };

  const live =
    phase.kind === "camera" ||
    phase.kind === "connecting" ||
    phase.kind === "flashing" ||
    phase.kind === "pose" ||
    phase.kind === "captured";
  useEffect(() => {
    if ((live || phase.kind === "retry") && video.current && camera.current) {
      // Reassigning the same stream reloads the video and interrupts the pending play().
      if (video.current.srcObject !== camera.current.stream) {
        video.current.srcObject = camera.current.stream;
      }
      // A load that a reset or unmount interrupts rejects the play; nothing to do about it.
      video.current.play().catch(() => undefined);
    }
  }, [live, phase.kind]);

  const start = async (): Promise<void> => {
    if (!video.current || !screen.current || !camera.current) {
      onFail("failed", "This check expired. Start again.");
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setPhase({ kind: "connecting" });
    let response: Response;
    try {
      response = await fetch("/v1/liveness/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ livenessId }),
        signal: abort.signal,
      });
    } catch {
      setPhase({ kind: "retry", reason: "network" });
      return;
    }
    if (!response.ok) {
      const { error } = (await response.json().catch(() => ({}))) as { error?: string };
      onFail("failed", error ?? "This check expired. Start again.");
      return;
    }
    // The schedule arrives while it plays; a broken stream ends the run.
    const feed = newFeed(SCHEDULE_STEP_MS);
    readSchedule(response, feed, abort.signal).catch(() => abort.abort());
    setPhase({ kind: "flashing" });
    const run = runCheck(
      video.current,
      screen.current,
      feed,
      camera.current,
      (arc) => setPhase({ kind: "pose", arc }),
      abort.signal,
    );
    endPose.current = run.endPose;
    // The flash upload goes up while the head turn is captured.
    const flash = run.flash.then((blob) => upload("/v1/liveness/submit", livenessId, blob));
    // A failed pose returns before this is awaited; its rejection must not surface as unhandled.
    flash.catch(() => undefined);
    let poseBlob: Blob;
    try {
      poseBlob = await run.pose;
    } catch {
      // The camera stays on, so the retry screen keeps its preview.
      setPhase({ kind: "retry", reason: "network" });
      return;
    }
    // The ring closes and dances for at least RING_CLOSE_MS while the uploads are judged; the decision waits for it.
    setPhase((current) => (current.kind === "pose" ? { kind: "captured", arc: current.arc } : current));
    const danced = new Promise<void>((resolve) => setTimeout(resolve, RING_CLOSE_MS));
    const flashed = await flash.catch(() => ({ ok: false, status: 0, data: {} }));
    if (!flashed.ok) {
      await danced;
      if (abort.signal.aborted) {
        return;
      }
      camera.current.stop();
      onFail(
        "failed",
        flashed.status === 410 ? "This check expired. Start again." : "We couldn't finish the check. Try again.",
      );
      return;
    }
    const result = await upload("/v1/liveness/pose", livenessId, poseBlob).catch(() => ({
      ok: false,
      status: 0,
      data: {},
    }));
    await danced;
    if (abort.signal.aborted) {
      // Reset or unmounted while the ring danced: nobody is listening for the decision.
      return;
    }
    const outcome = result.data as PoseOutcome;
    if (result.ok && outcome.kind === "token") {
      camera.current.stop();
      onToken(outcome.token, outcome.anchorId);
    } else if (result.ok && outcome.kind === "retry") {
      setLivenessId(outcome.livenessId);
      setPhase({ kind: "retry", reason: outcome.reason });
    } else {
      camera.current.stop();
      onFail("failed", "We couldn't confirm a live person. Try again later.");
    }
  };

  const retry = async (): Promise<void> => {
    if (!camera.current) {
      await enableCamera();
      if (!camera.current) {
        return;
      }
    }
    await start();
  };

  const noCamera = (): void => {
    camera.current?.stop();
    onFail("no-camera", "This check needs a camera. Ask the site for another way to continue.");
  };
  const noCameraLink = (
    <button
      type="button"
      onClick={noCamera}
      className="text-xs text-fg-subtle underline underline-offset-2 hover:text-fg"
    >
      Can't Use a Camera?
    </button>
  );

  const flashing = phase.kind === "flashing";
  const status =
    phase.kind === "flashing"
      ? "Hold still"
      : phase.kind === "pose"
        ? arcMessage(phase.arc)
        : phase.kind === "captured"
          ? "Got it"
          : phase.kind === "connecting"
            ? "Getting ready…"
            : phase.kind === "retry"
              ? RETRY_MESSAGES[phase.reason]
              : "Turn your screen brightness up and fit your face in the oval.";
  return (
    <div
      ref={screen}
      className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-surface p-6 text-center text-fg"
    >
      {phase.kind === "intro" && (
        <div className="flex max-w-sm flex-col gap-4">
          <h1 className="text-xl">Quick light check</h1>
          <p className="text-sm text-fg-muted">
            Your screen will change color for two seconds while your camera checks how the light reflects off your face,
            then you'll roll your head along the ring around the camera. The video is analyzed once and never stored,
            and it isn't used to identify you.
          </p>
          <p className="text-xs text-fg-subtle">
            The colors change slowly with no flashing, but skip this if light sensitivity affects you. By continuing,
            you agree to this processing as described in our{" "}
            <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-fg">
              privacy policy
            </a>
            .
          </p>
          <Button onClick={() => void enableCamera()}>Continue</Button>
          {noCameraLink}
        </div>
      )}
      {(live || phase.kind === "retry") && (
        <>
          {/* The schedule's colors are all mid-lightness, so dark text stays readable on every one. */}
          <p
            role="status"
            aria-live={phase.kind === "pose" ? "assertive" : "polite"}
            className={flashing ? "text-sm font-medium text-black/75" : "text-sm text-fg-muted"}
          >
            {status}
          </p>
          <div className="relative size-56">
            <div className="size-full overflow-hidden rounded-[50%] border-2 border-white/60">
              {/* Zoomed so the oval shows exactly the square that is captured; mirrored like a mirror. */}
              <video
                ref={video}
                muted
                playsInline
                className="size-full object-cover"
                style={{ transform: `scale(${-1 / CROP_SHARE}, ${1 / CROP_SHARE})` }}
              />
            </div>
            {ringArc && <PoseRing arc={toPoseArc(ringArc)} progress={progress} complete={phase.kind === "captured"} />}
          </div>
          {phase.kind === "camera" && <Button onClick={() => void start()}>Start</Button>}
          {phase.kind === "retry" && <Button onClick={() => void retry()}>Try Again</Button>}
        </>
      )}
      {phase.kind === "blocked" && (
        <div className="flex max-w-sm flex-col gap-4">
          <p role="alert" className="text-sm text-danger">
            {phase.message}
          </p>
          <Button variant="secondary" onClick={() => void enableCamera()}>
            Try Again
          </Button>
          {noCameraLink}
        </div>
      )}
    </div>
  );
}
