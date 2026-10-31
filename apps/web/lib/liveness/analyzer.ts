import type { FlashCapture, PoseCapture } from "./decode";
import type { Emission } from "./emission";
import type { Arc, LivenessRetry } from "../../src/shared/liveness";

/** Scalar, non-biometric measurements of the flash: safe to keep for tuning thresholds. */
export interface LivenessScores {
  /** Correlation between the light sent and the light reflected, at the best lag. */
  readonly correlation: number;
  /** That lag in ms, measured from the dark dips; positive means the reflection arrived late. */
  readonly lagMs: number;
  /** How differently face regions reflect (coefficient of variation of their gains); flat media is uniform. */
  readonly gainSpread: number;
  /** Reflected modulation the schedule explains, as a share of brightness; too small means a dim screen or a far face. */
  readonly depth: number;
  /** Mean brightness, 0–255. */
  readonly brightness: number;
  readonly skinLike: boolean;
}

/** Whether the highlights carry the screen's own color, as skin's do and a diffuse re-tint's don't. */
export interface SpecularScores {
  /** False when the key frames gave too little contrast or too few highlight pixels to judge. */
  readonly measured: boolean;
  /** Neutral share of the highlights' response minus the diffuse skin's. */
  readonly gain: number;
  readonly contrast: number;
  readonly pixels: number;
}

export interface FlashScores extends LivenessScores {
  readonly dipCorrelation: number;
  readonly specular: SpecularScores;
  /** Time the stream was stuck, in ms. */
  readonly stallMs: number;
  /** The measured reflectance's chromaticity (red and blue shares), what `skinLike` judges. */
  readonly skin: { readonly rg: number; readonly bg: number };
  /** How much the crop moved beyond sensor noise (frames.ts); a still face is under 1. */
  readonly motion: number;
}

/** Evidence that the frames came from software rather than a camera. Each term only raises the score. */
export interface InjectionScores {
  readonly score: number;
  readonly virtualLabel: boolean;
  readonly noDeviceId: boolean;
  readonly emptyCapabilities: boolean;
  readonly noCaptureTime: boolean;
  readonly displaySurface: boolean;
  /** Coefficient of variation of the frame intervals; real sensors jitter, files don't. */
  readonly intervalCv: number;
  /** Share of consecutive frames that are identical, as a slow source duplicated to 30 fps is. */
  readonly duplicateShare: number;
}

export interface GeometryScores {
  readonly faceFrames: number;
  readonly yawStartDeg: number;
  readonly yawPeakDeg: number;
  readonly pitchPeakDeg: number;
  /** The requested turn was made. */
  readonly hit: boolean;
  /** The opposite direction came first, as a recorded sweep would. */
  readonly wrongWayFirst: boolean;
  /** When the turn first satisfied the prompt, in ms after it. */
  readonly poseMs: number;
  readonly jitterPx: number;
}

export interface PadScores {
  /** Probability the surface is a live face rather than print or screen, from the anti-spoofing model. */
  readonly live: number;
  /** Frames judged; 0 when the model didn't run. */
  readonly frames: number;
}

export interface JudgeScores {
  readonly ran: boolean;
  readonly live: number | null;
  readonly ms: number;
}

export type StageVerdict = "pass" | "fail" | "retry" | "skip";

export interface StageResult<S> {
  readonly verdict: StageVerdict;
  readonly reason?: LivenessRetry;
  readonly scores: S;
}

/** A face's place in a frame, as shares of the crop. */
export interface FaceBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface KeyFrame {
  readonly pixels: Uint8Array;
  readonly side: number;
}

export interface FlashStage {
  analyze(capture: FlashCapture, emission: Emission): Promise<StageResult<FlashScores>>;
}

export interface GeometryResult extends StageResult<GeometryScores> {
  /** Where the face was in each pose frame; null where there was none. */
  readonly faces: readonly (FaceBox | null)[];
  /** The frame that faced the camera most squarely, for the judge's second opinion. */
  readonly frontal?: number;
}

export interface GeometryStage {
  analyze(capture: PoseCapture, arc: Arc, deadline: number): Promise<GeometryResult>;
}

export interface PadStage {
  analyze(capture: PoseCapture, faces: readonly (FaceBox | null)[], deadline: number): Promise<StageResult<PadScores>>;
}

export interface JudgeStage {
  judge(frames: readonly KeyFrame[], context: { readonly siteId: string }): Promise<StageResult<JudgeScores>>;
}

export interface PoseAnalysis {
  readonly geometry: StageResult<GeometryScores>;
  readonly pad: StageResult<PadScores>;
  /** The frames worth a second opinion: the first and the most frontal. */
  readonly frames: readonly KeyFrame[];
}

/** The seam for the stages: tests inject fakes, production composes the real ones. */
export interface LivenessAnalyzer {
  flash(capture: FlashCapture, emission: Emission): Promise<StageResult<FlashScores>>;
  pose(capture: PoseCapture, arc: Arc): Promise<PoseAnalysis>;
  readonly judge: JudgeStage | null;
}

/** The flash stage's own decision, in the shape the first version of the check used. */
export type LivenessDecision =
  | { readonly kind: "pass"; readonly scores: LivenessScores }
  | { readonly kind: "retry"; readonly reason: LivenessRetry; readonly scores: LivenessScores }
  | { readonly kind: "fail"; readonly scores: LivenessScores };
