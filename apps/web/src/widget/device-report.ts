import type { SourceSignals } from "../shared/liveness";

/** What the capture loop saw of the frames, for the source report. */
export interface FrameStats {
  count: number;
  withCaptureTime: number;
  /** `now − captureTime` per frame that had one, ms. */
  lags: number[];
  hiddenMs: number;
}

export const newFrameStats = (): FrameStats => ({ count: 0, withCaptureTime: 0, lags: [], hiddenMs: 0 });

const median = (values: readonly number[]): number | null => {
  if (!values.length) {
    return null;
  }
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[sorted.length >> 1]!;
};

const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));

/**
 * What the browser says about the camera source. The server scores it and never stores the label.
 * Every field is bounded here so a strange device can't make the upload invalid.
 */
export function sourceReport(track: MediaStreamTrack, stats: FrameStats): SourceSignals {
  const settings = track.getSettings() as MediaTrackSettings & { displaySurface?: string };
  const capabilities = typeof track.getCapabilities === "function" ? track.getCapabilities() : null;
  const report: SourceSignals = {
    label: track.label.slice(0, 64),
    deviceId: Boolean(settings.deviceId),
    rvfc: typeof HTMLVideoElement.prototype.requestVideoFrameCallback === "function",
    captureTime: stats.withCaptureTime > 0,
    captureLagMs: median(stats.lags) === null ? null : clamp(Math.round(median(stats.lags)!), -1000, 10_000),
    displaySurface: "displaySurface" in settings,
    hiddenMs: clamp(Math.round(stats.hiddenMs), 0, 600_000),
  };
  return {
    ...report,
    ...(capabilities ? { capabilities: Math.min(64, Object.keys(capabilities).length) } : {}),
    ...(settings.width ? { width: clamp(Math.round(settings.width), 1, 8192) } : {}),
    ...(settings.height ? { height: clamp(Math.round(settings.height), 1, 8192) } : {}),
    ...(settings.frameRate && settings.frameRate > 0 ? { frameRate: Math.min(240, settings.frameRate) } : {}),
  };
}
