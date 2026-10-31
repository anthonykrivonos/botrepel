/**
 * Corpus sizes and the error budgets the light check must meet on them, in the vocabulary of
 * ISO/IEC 30107-3 and CEN/TS 18099: APCER (attacks accepted) per attack label, BPCER (genuine
 * rejected) and the retry rate for genuine captures. A retry is not a rejection; three are.
 *
 * `maxApcer: null` marks a label as report-only: the layer that would catch it isn't built yet, so
 * its rate is recorded and ratcheted against the committed baseline, not asserted.
 */
import type { AttackLabel } from "./synth-scene";

export type CorpusSize = "test" | "pr" | "nightly";

export const SIZES: Readonly<Record<CorpusSize, Readonly<Partial<Record<AttackLabel, number>>>>> = {
  /** Runs under `bun test`: small enough to stay fast, large enough that 0 means something. */
  test: {
    genuine: 12,
    print: 4,
    replay: 4,
    mask: 4,
    "relight-diffuse@0": 4,
    "relight-full@0": 4,
    "pose-static": 4,
    "canvas-track": 4,
    "virtual-camera": 4,
  },
  pr: Object.fromEntries([["genuine", 24], ...ALL_ATTACKS().map((label) => [label, 8])]) as Partial<
    Record<AttackLabel, number>
  >,
  nightly: Object.fromEntries([["genuine", 400], ...ALL_ATTACKS().map((label) => [label, 100])]) as Partial<
    Record<AttackLabel, number>
  >,
};

function ALL_ATTACKS(): AttackLabel[] {
  return [
    "print",
    "replay",
    "mask",
    "relight-diffuse@0",
    "relight-diffuse@1",
    "relight-diffuse@2",
    "relight-diffuse@3",
    "relight-full@0",
    "relight-full@1",
    "relight-full@2",
    "relight-full@3",
    "pose-static",
    "pose-wrong",
    "pose-early",
    "pose-flat-turn",
    "timing-regular",
    "canvas-track",
    "virtual-camera",
  ];
}

export interface GenuineBudget {
  /** Share of genuine captures that may end in `fail`. */
  readonly maxFail: number;
  /** Share that may end in `retry`. */
  readonly maxRetry: number;
}

export interface AttackBudget {
  /** Share of this label's captures that may end in `pass`; null means report-only. */
  readonly maxApcer: number | null;
}

/**
 * Rates, so the same budgets apply at every size; at the `test` size 0 means 0 of 4 and 0.25 means
 * at most 1 of 4. FIDO's face-verification profile demands FRR under 6% per demographic, so the
 * synthetic genuine set leaves headroom below that for real-device noise.
 */
export const BUDGETS: {
  readonly genuine: GenuineBudget;
  readonly attacks: Readonly<Record<Exclude<AttackLabel, "genuine">, AttackBudget>>;
} = {
  // Known breach at PR size (1 of 24): a bright window with weak screen light, where sway across
  // feature edges outweighs the screen's signal. The pose and specular layers are meant to let the
  // flash thresholds relax there; until then the baseline ratchet records it.
  genuine: { maxFail: 0.02, maxRetry: 0.17 },
  attacks: {
    // Known breaches at PR size: prints pass when weak screen light leaves per-cell gains in the
    // noise (the pose step's parallax check is the answer), and a glossy replay under weak light
    // correlates through its glass reflection (the specular check is the answer).
    print: { maxApcer: 0 },
    replay: { maxApcer: 0 },
    // A uniform gray mask passes the skin check's chromaticity band today; PAD and the judge are its layers.
    mask: { maxApcer: null },
    // The specular check (Phase 2) is what catches a diffuse-only relight at zero lag.
    "relight-diffuse@0": { maxApcer: null },
    "relight-diffuse@1": { maxApcer: null },
    "relight-diffuse@2": { maxApcer: null },
    "relight-diffuse@3": { maxApcer: null },
    // A physically complete relight within the lag window is the documented residual risk.
    "relight-full@0": { maxApcer: null },
    "relight-full@1": { maxApcer: null },
    "relight-full@2": { maxApcer: null },
    "relight-full@3": { maxApcer: null },
    // The pose verifier (Phase 3).
    "pose-static": { maxApcer: null },
    "pose-wrong": { maxApcer: null },
    "pose-early": { maxApcer: null },
    "pose-flat-turn": { maxApcer: null },
    // Injection scoring: a canvas track and a named virtual camera carry enough evidence to fail;
    // perfectly regular timing alone is only a hint (a capture card looks like a real camera).
    "timing-regular": { maxApcer: null },
    "canvas-track": { maxApcer: 0 },
    "virtual-camera": { maxApcer: 0 },
  },
};

/** How much a report-only rate may rise above the committed baseline before the nightly run fails. */
export const RATCHET_TOLERANCE = 0.05;
