/**
 * What the browser reports about the camera source, as the v2 capture header carries it. Genuine
 * cameras, virtual cameras, a capture card (which looks like a real camera: metadata can't catch
 * it), a canvas track, and Chromium's fake device.
 */
export interface SourceReport {
  /** `track.label`; the server matches it against a virtual-camera list and discards it. */
  readonly label: string;
  /** `getSettings().deviceId` was non-empty. */
  readonly deviceId: boolean;
  /** `Object.keys(getCapabilities()).length`. */
  readonly capabilities: number;
  /** `requestVideoFrameCallback` existed, and `metadata.captureTime` was ever present. */
  readonly rvfc: boolean;
  readonly captureTime: boolean;
  /** Median of `now − captureTime` over the run, ms; null when captureTime was absent. */
  readonly captureLagMs: number | null;
  readonly width: number;
  readonly height: number;
  readonly frameRate: number;
  /** `getSettings().displaySurface` existed: a screen capture fed to the camera. */
  readonly displaySurface: boolean;
  /** Milliseconds the document was hidden during the run. */
  readonly hiddenMs: number;
}

export const macbookFaceTime: SourceReport = {
  label: "MacBook Pro Camera (0000:0001)",
  deviceId: true,
  capabilities: 9,
  rvfc: true,
  captureTime: true,
  captureLagMs: 3,
  width: 640,
  height: 480,
  frameRate: 30,
  displaySurface: false,
  hiddenMs: 0,
};

export const logitechC920: SourceReport = {
  ...macbookFaceTime,
  label: "HD Pro Webcam C920 (046d:082d)",
  capabilities: 14,
  captureLagMs: 5,
};

export const androidChromeFront: SourceReport = {
  ...macbookFaceTime,
  label: "camera2 1, facing front",
  capabilities: 12,
  captureLagMs: 8,
  width: 480,
  height: 640,
};

export const obsVirtualCamera: SourceReport = {
  ...macbookFaceTime,
  label: "OBS Virtual Camera",
  capabilities: 4,
  captureLagMs: 0,
  width: 1280,
  height: 720,
};

/** An HDMI capture card: a real USB camera as far as the browser can tell. */
export const elgatoCamLink: SourceReport = {
  ...macbookFaceTime,
  label: "Cam Link 4K (0fd9:0066)",
  capabilities: 6,
  captureLagMs: 2,
  width: 1920,
  height: 1080,
  frameRate: 60,
};

export const canvasCapture: SourceReport = {
  label: "",
  deviceId: false,
  capabilities: 0,
  rvfc: true,
  captureTime: false,
  captureLagMs: null,
  width: 640,
  height: 480,
  frameRate: 30,
  displaySurface: false,
  hiddenMs: 0,
};

export const chromiumFakeDevice: SourceReport = {
  ...macbookFaceTime,
  label: "fake_device_0",
  capabilities: 5,
  captureLagMs: 0,
};

export const GENUINE_SOURCES = [macbookFaceTime, logitechC920, androidChromeFront] as const;
