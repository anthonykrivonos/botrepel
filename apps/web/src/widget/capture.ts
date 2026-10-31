import { newFrameStats, sourceReport } from "./device-report";
import type { ScheduleFeed } from "./stream";
import {
  arcWindowMs,
  BRIGHT_KEY_TIMES_MS,
  colorAt,
  CROP,
  KEY_CROP,
  KEY_FRAME_LAG_MS,
  keyFrameTimes,
  MAX_FRAMES,
  MAX_KEY_FRAMES,
  MAX_POSE_FRAMES,
  MIN_POSE_FRAMES,
  packCapture,
  POSE_WINDOW_MS,
  poseFrameIntervalMs,
  PROTOCOL_VERSION,
  SCHEDULE_MS,
  SCHEDULE_STEP_MS,
  SCHEDULE_STEPS,
  settledDipCenters,
  type Arc,
  type SourceSignals,
} from "../shared/liveness";

/** The face crop: a centered square this share of the shorter side, under the oval guide. */
export const CROP_SHARE = 0.62;
/** Playback starts once this much of the schedule is buffered; the server sends ~100 ms ahead. */
const MIN_BUFFER_MS = 60;
/** A stream that stops for this long mid-run is abandoned (the server would call it a stall anyway). */
const STALL_ABORT_MS = 600;
/**
 * Key-frame candidates: one after each of up to two dips plus every bright moment. Which of them
 * are kept is decided once the whole schedule is known, the same way the server plans them.
 */
const KEY_CANDIDATES = 2 + BRIGHT_KEY_TIMES_MS.length;
/** A frame this close to a planned key time serves it: a dropped camera frame leaves a 66 ms gap. */
const KEY_TOLERANCE_MS = 4 * SCHEDULE_STEP_MS;

export interface Camera {
  readonly stream: MediaStream;
  readonly whiteBalanceLocked: boolean;
  readonly exposureLocked: boolean;
  stop(): void;
}

/** Locks are a bonus: auto white balance and exposure fight the color signal, but most webcams ignore the request. */
async function tryLock(track: MediaStreamTrack): Promise<{ whiteBalanceLocked: boolean; exposureLocked: boolean }> {
  const capabilities = (track.getCapabilities?.() ?? {}) as { whiteBalanceMode?: string[]; exposureMode?: string[] };
  const advanced: Record<string, string>[] = [];
  if (capabilities.whiteBalanceMode?.includes("manual")) {
    advanced.push({ whiteBalanceMode: "manual" });
  }
  if (capabilities.exposureMode?.includes("manual")) {
    advanced.push({ exposureMode: "manual" });
  }
  if (advanced.length) {
    try {
      await track.applyConstraints({ advanced } as MediaTrackConstraints);
    } catch {
      // Unsupported here; the analysis tolerates drift.
    }
  }
  const settings = track.getSettings() as { whiteBalanceMode?: string; exposureMode?: string };
  return {
    whiteBalanceLocked: settings.whiteBalanceMode === "manual",
    exposureLocked: settings.exposureMode === "manual",
  };
}

export async function openCamera(): Promise<Camera> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
  });
  const track = stream.getVideoTracks()[0]!;
  const locks = await tryLock(track);
  return {
    stream,
    ...locks,
    stop: () => {
      for (const t of stream.getTracks()) {
        t.stop();
      }
    },
  };
}

interface VideoFrameMetadata {
  readonly captureTime?: number;
  readonly expectedDisplayTime: number;
}

type FrameVideo = HTMLVideoElement & {
  requestVideoFrameCallback?: (callback: (now: number, metadata: VideoFrameMetadata) => void) => number;
};

/** A canvas that crops the face square out of the video at `side` pixels. */
function cropper(side: number): { grab(video: HTMLVideoElement): Uint8ClampedArray } {
  const canvas = document.createElement("canvas");
  canvas.width = side;
  canvas.height = side;
  const context = canvas.getContext("2d", { willReadFrequently: true })!;
  return {
    grab(video) {
      const span = Math.min(video.videoWidth, video.videoHeight) * CROP_SHARE;
      context.drawImage(
        video,
        (video.videoWidth - span) / 2,
        (video.videoHeight - span) / 2,
        span,
        span,
        0,
        0,
        side,
        side,
      );
      return context.getImageData(0, 0, side, side).data;
    },
  };
}

/** Copies the RGB of an RGBA image into `out` at `offset`. */
function copyRgb(rgba: Uint8ClampedArray, out: Uint8Array, offset: number): void {
  for (let i = 0, j = offset; i < rgba.length; i += 4, j += 3) {
    out[j] = rgba[i]!;
    out[j + 1] = rgba[i + 1]!;
    out[j + 2] = rgba[i + 2]!;
  }
}

const gzip = async (bytes: Uint8Array<ArrayBuffer>): Promise<Blob> =>
  new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream("gzip"))).blob();

export interface CheckRun {
  /** The flash upload, ready as soon as the colors are done. */
  readonly flash: Promise<Blob>;
  /** The pose upload, ready after the pose window; rejects when the stream gave no prompt. */
  readonly pose: Promise<Blob>;
  /** Closes the pose window early, once the arc looks covered; at least MIN_POSE_FRAMES are still taken. */
  endPose(): void;
}

export class StalledError extends Error {}

/**
 * Plays the streamed schedule on `screen`, captures the face crop of every camera frame with its
 * capture time, keeps sharper key frames after each dip and at bright moments, then shows the
 * arc prompt (through `onArc`) and captures the pose frames. Each upload resolves as soon as
 * its frames are in, packed and gzipped.
 */
export function runCheck(
  video: FrameVideo,
  screen: HTMLElement,
  feed: ScheduleFeed,
  camera: Camera,
  onArc: (arc: Arc) => void,
  signal: AbortSignal,
): CheckRun {
  const small = cropper(CROP);
  const large = cropper(KEY_CROP);
  const frames = new Uint8Array(MAX_FRAMES * CROP * CROP * 3);
  const candidates = new Uint8Array(KEY_CANDIDATES * KEY_CROP * KEY_CROP * 3);
  const poseFrames = new Uint8Array(MAX_POSE_FRAMES * KEY_CROP * KEY_CROP * 3);
  const times: number[] = [];
  const candidateTimes: number[] = [];
  /** The planned key time each candidate was taken for. */
  const candidatePlans: number[] = [];
  const poseTimes: number[] = [];
  const paintTimes: number[] = [];
  const stats = newFrameStats();
  const track = camera.stream.getVideoTracks()[0]!;
  let hiddenSince: number | null = null;
  const onVisibility = (): void => {
    if (document.hidden) {
      hiddenSince = performance.now();
    } else if (hiddenSince !== null) {
      stats.hiddenMs += performance.now() - hiddenSince;
      hiddenSince = null;
    }
  };
  document.addEventListener("visibilitychange", onVisibility);
  const cleanup = (): void => document.removeEventListener("visibilitychange", onVisibility);

  let start = 0;
  let lastPaintAt = 0;
  let phase: "flash" | "pose" | "done" = "flash";
  let poseStart = 0;
  let poseWindowMs = POSE_WINDOW_MS;
  let poseFrameMs = poseFrameIntervalMs(POSE_WINDOW_MS);
  let poseEnded = false;
  let lastPoseFrameAt = -Infinity;

  let settleFlash!: (blob: Blob) => void;
  let failFlash!: (error: Error) => void;
  let settlePose!: (blob: Blob) => void;
  let failPose!: (error: Error) => void;
  const flash = new Promise<Blob>((resolve, reject) => {
    settleFlash = resolve;
    failFlash = reject;
  });
  const pose = new Promise<Blob>((resolve, reject) => {
    settlePose = resolve;
    failPose = reject;
  });
  // A rejection nobody awaits yet must not surface as unhandled.
  pose.catch(() => undefined);
  flash.catch(() => undefined);

  const abort = (error: Error): void => {
    if (phase === "done") {
      return;
    }
    phase = "done";
    cleanup();
    // A check cut off mid-flash must not leave the screen tinted.
    screen.style.backgroundColor = "";
    frames.fill(0);
    candidates.fill(0);
    poseFrames.fill(0);
    failFlash(error);
    failPose(error);
  };
  signal.addEventListener("abort", () => abort(new StalledError("The check was interrupted.")), { once: true });

  const source = (): SourceSignals => sourceReport(track, stats);

  /**
   * The planned key time a frame at `t` serves, if any: after a dip the stream has fully revealed,
   * or at a bright moment. Each plan takes one candidate, the first frame within a step of it.
   */
  const keyPlanAt = (t: number): number | undefined => {
    if (candidateTimes.length >= KEY_CANDIDATES) {
      return undefined;
    }
    const plans = [
      ...settledDipCenters(feed.colors, feed.stepMs)
        .slice(0, 2)
        .map((center) => center + KEY_FRAME_LAG_MS),
      ...BRIGHT_KEY_TIMES_MS,
    ];
    // The first frame from a step before the plan to three after it; a dropped frame leaves a 66 ms gap.
    return plans.find(
      (plan) => t >= plan - feed.stepMs && t <= plan + 3 * feed.stepMs && !candidatePlans.includes(plan),
    );
  };

  const grabFlash = (time: number): void => {
    const t = time - start;
    if (t < 0 || t > SCHEDULE_MS || times.length >= MAX_FRAMES || (times.length && t <= times.at(-1)!)) {
      return;
    }
    copyRgb(small.grab(video), frames, times.length * CROP * CROP * 3);
    times.push(t);
    const plan = keyPlanAt(t);
    if (plan !== undefined) {
      copyRgb(large.grab(video), candidates, candidateTimes.length * KEY_CROP * KEY_CROP * 3);
      candidateTimes.push(t);
      candidatePlans.push(plan);
    }
  };

  /** The key frames to send: the candidates nearest the server's plan for the full schedule, in time order. */
  const chooseKeyFrames = (): { keyTimes: number[]; keyPixels: Uint8Array } => {
    const chosen: number[] = [];
    for (const plan of keyFrameTimes(feed.colors, feed.stepMs)) {
      let best = -1;
      for (let i = 0; i < candidateTimes.length; i++) {
        const distance = Math.abs(candidateTimes[i]! - plan);
        if (
          distance <= KEY_TOLERANCE_MS &&
          !chosen.includes(i) &&
          (best < 0 || distance < Math.abs(candidateTimes[best]! - plan))
        ) {
          best = i;
        }
      }
      if (best >= 0 && chosen.length < MAX_KEY_FRAMES) {
        chosen.push(best);
      }
    }
    chosen.sort((a, b) => candidateTimes[a]! - candidateTimes[b]!);
    const frameBytes = KEY_CROP * KEY_CROP * 3;
    const keyPixels = new Uint8Array(chosen.length * frameBytes);
    for (const [k, i] of chosen.entries()) {
      keyPixels.set(candidates.subarray(i * frameBytes, (i + 1) * frameBytes), k * frameBytes);
    }
    return { keyTimes: chosen.map((i) => candidateTimes[i]!), keyPixels };
  };

  const grabPose = (time: number): void => {
    const t = time - poseStart;
    if (t < 0 || t > poseWindowMs || poseTimes.length >= MAX_POSE_FRAMES || time - lastPoseFrameAt < poseFrameMs) {
      return;
    }
    lastPoseFrameAt = time;
    copyRgb(large.grab(video), poseFrames, poseTimes.length * KEY_CROP * KEY_CROP * 3);
    poseTimes.push(t);
  };

  const finishFlash = (): void => {
    const { keyTimes, keyPixels } = chooseKeyFrames();
    const used = packCapture(
      {
        v: PROTOCOL_VERSION,
        times,
        keyTimes,
        paintTimes,
        whiteBalanceLocked: camera.whiteBalanceLocked,
        exposureLocked: camera.exposureLocked,
        source: source(),
      },
      frames.subarray(0, times.length * CROP * CROP * 3),
      keyPixels,
    );
    frames.fill(0);
    candidates.fill(0);
    keyPixels.fill(0);
    void gzip(used).then(settleFlash, failFlash);
  };

  const finishPose = (): void => {
    phase = "done";
    cleanup();
    const used = packCapture(
      { v: PROTOCOL_VERSION, times: poseTimes, source: source() },
      poseFrames.subarray(0, poseTimes.length * KEY_CROP * KEY_CROP * 3),
    );
    poseFrames.fill(0);
    void gzip(used).then(settlePose, failPose);
  };

  // Each camera frame with the time the sensor captured it, where the browser reports it.
  const onFrame = (now: number, metadata: VideoFrameMetadata): void => {
    if (phase === "done") {
      return;
    }
    stats.count++;
    if (metadata.captureTime !== undefined) {
      stats.withCaptureTime++;
      stats.lags.push(now - metadata.captureTime);
    }
    const time = metadata.captureTime ?? now;
    if (phase === "flash") {
      grabFlash(time);
    } else {
      grabPose(time);
    }
    video.requestVideoFrameCallback?.(onFrame);
  };

  const paint = (now: number): void => {
    if (phase === "done") {
      return;
    }
    if (phase === "pose") {
      if (!video.requestVideoFrameCallback) {
        grabPose(now);
      }
      if (now - poseStart > poseWindowMs || (poseEnded && poseTimes.length >= MIN_POSE_FRAMES)) {
        finishPose();
        return;
      }
      requestAnimationFrame(paint);
      return;
    }
    if (!start) {
      // Wait for a little buffer, so the first steps never stall.
      if (feed.colors.length * feed.stepMs < MIN_BUFFER_MS && !feed.done) {
        requestAnimationFrame(paint);
        return;
      }
      start = now;
      lastPaintAt = now;
      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(onFrame);
      }
    }
    const elapsed = now - start;
    const step = Math.min(SCHEDULE_STEPS - 1, Math.floor(elapsed / feed.stepMs));
    if (step < feed.colors.length) {
      // The first paint of each step, in the capture clock; a stalled stream leaves gaps here.
      for (let k = paintTimes.length; k <= step; k++) {
        paintTimes.push(elapsed);
      }
      lastPaintAt = now;
    } else if (now - lastPaintAt > STALL_ABORT_MS || (feed.done && feed.colors.length < SCHEDULE_STEPS)) {
      abort(new StalledError("The connection stalled during the check."));
      return;
    }
    const [r, g, b] = colorAt({ stepMs: feed.stepMs, colors: feed.colors }, elapsed);
    screen.style.backgroundColor = `rgb(${Math.round(r)} ${Math.round(g)} ${Math.round(b)})`;
    if (!video.requestVideoFrameCallback) {
      grabFlash(now);
    }
    if (elapsed <= SCHEDULE_MS || !feed.done) {
      requestAnimationFrame(paint);
      return;
    }
    finishFlash();
    if (!feed.arc) {
      abort(new StalledError("The check couldn't continue."));
      return;
    }
    phase = "pose";
    poseStart = now;
    poseWindowMs = feed.windowMs || arcWindowMs(feed.arc);
    poseFrameMs = poseFrameIntervalMs(poseWindowMs);
    screen.style.backgroundColor = "";
    onArc(feed.arc);
    requestAnimationFrame(paint);
  };
  requestAnimationFrame(paint);
  return {
    flash,
    pose,
    endPose: () => {
      poseEnded = true;
    },
  };
}
