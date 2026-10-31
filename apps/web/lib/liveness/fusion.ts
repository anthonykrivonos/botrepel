import type { FlashScores, GeometryScores, InjectionScores, JudgeScores, PadScores, StageResult } from "./analyzer";
import { THRESHOLDS } from "./heuristic";
import { SPECULAR } from "./specular";
import type { LivenessRetry } from "../../src/shared/liveness";

/**
 * Checks that count once their real-device quantiles are known. Both are computed and recorded on
 * every capture (livenessStat, /admin/liveness) but, until calibrated, neither adds risk nor gates:
 * on the synthetic corpus the specular score doesn't yet separate a face from a diffuse re-tint, and
 * the anti-spoofing model hasn't been measured on real webcams, where a wrong floor would lock
 * people out. Penalizing either would also block every Human Pass anchor.
 */
export const GATES = {
  specular: false,
  pad: false,
} as const;

export const FUSION = {
  /** The anti-spoofing model's live probability below which a capture fails, and below which it adds risk. */
  padHardFail: 0.15,
  padSoft: 0.6,
  padStrict: 0.8,
  specularRisk: 0.3,
  judgeRiskWeight: 0.4,
  continuityWeight: 0.2,
  /** Soft evidence past this sum fails the capture. */
  riskFail: 0.6,
  /** A pass with this much soft evidence gets the judge's second opinion. */
  judgeBorderlineRisk: 0.25,
  strictRisk: 0.15,
  strictInjection: 0.2,
  strictPoseMs: 1500,
  judgeStrictLive: 0.7,
} as const;

/** What the Human Pass anchor needs of the flash, beyond a plain pass. */
export const ANCHOR_THRESHOLDS = {
  minCorrelation: 0.92,
  minGainSpread: THRESHOLDS.minGainSpread * 1.25,
} as const;

export interface StageResults {
  readonly flash: StageResult<FlashScores>;
  readonly injection: InjectionScores;
  /** Null while the stage isn't built or its model failed to load. */
  readonly geometry: StageResult<GeometryScores> | null;
  readonly pad: StageResult<PadScores> | null;
  readonly judge: StageResult<JudgeScores> | null;
  /** Agreement between the flash face and the pose face, 0–1; null when unmeasured. */
  readonly continuity: number | null;
}

export interface Scores {
  readonly flash: FlashScores;
  readonly injection: InjectionScores;
  readonly geometry: GeometryScores | null;
  readonly pad: PadScores | null;
  readonly judge: JudgeScores | null;
  readonly continuity: number | null;
  /** The soft evidence against the capture, 0–1. */
  readonly risk: number;
}

export type LivenessVerdict =
  | { readonly kind: "pass"; readonly scores: Scores }
  | { readonly kind: "retry"; readonly reason: LivenessRetry; readonly scores: Scores }
  | { readonly kind: "fail"; readonly scores: Scores };

const ran = <S>(stage: StageResult<S> | null): stage is StageResult<S> => stage !== null && stage.verdict !== "skip";

/** The soft evidence: each term only adds, so no stage can rescue a capture another one doubted. */
export function riskOf(stages: StageResults): number {
  const { flash, injection, pad, judge, continuity } = stages;
  let risk = injection.score;
  if (GATES.pad && ran(pad) && pad.scores.live < FUSION.padSoft) {
    risk += 0.5 * (1 - pad.scores.live);
  }
  if (GATES.specular && flash.scores.specular.measured && flash.scores.specular.gain < SPECULAR.minGain) {
    risk += FUSION.specularRisk;
  }
  if (judge?.scores.ran && judge.scores.live !== null) {
    risk += FUSION.judgeRiskWeight * (1 - judge.scores.live);
  }
  if (continuity !== null) {
    risk += FUSION.continuityWeight * (1 - continuity);
  }
  return Math.round(Math.min(1, risk) * 1000) / 1000;
}

const scoresOf = (stages: StageResults, risk: number): Scores => ({
  flash: stages.flash.scores,
  injection: stages.injection,
  geometry: ran(stages.geometry) ? stages.geometry.scores : null,
  pad: ran(stages.pad) ? stages.pad.scores : null,
  judge: stages.judge?.scores ?? null,
  continuity: stages.continuity,
  risk,
});

/**
 * Hard gates first (a replay that is also dim must fail, not retry), then conditions worth a
 * retry, then the soft evidence.
 */
export function fuse(stages: StageResults): LivenessVerdict {
  const { flash, geometry, pad } = stages;
  const risk = riskOf(stages);
  const scores = scoresOf(stages, risk);
  const hardFail =
    flash.verdict === "fail" ||
    geometry?.verdict === "fail" ||
    (GATES.pad && ran(pad) && pad.scores.live < FUSION.padHardFail) ||
    (GATES.specular && flash.scores.specular.measured && flash.scores.specular.gain < SPECULAR.minGain);
  if (hardFail) {
    return { kind: "fail", scores };
  }
  if (flash.verdict === "retry") {
    return { kind: "retry", reason: flash.reason ?? "moved", scores };
  }
  if (geometry?.verdict === "retry") {
    return { kind: "retry", reason: geometry.reason ?? "pose-missed", scores };
  }
  if (risk >= FUSION.riskFail) {
    return { kind: "fail", scores };
  }
  return { kind: "pass", scores };
}

/** A Human Pass is reusable, so creating one takes a clearer pass than a single check. */
export function strictPass(stages: StageResults, verdict: LivenessVerdict): boolean {
  if (verdict.kind !== "pass") {
    return false;
  }
  const { flash, injection, geometry, pad, judge } = stages;
  const specular = flash.scores.specular;
  return (
    flash.scores.correlation >= ANCHOR_THRESHOLDS.minCorrelation &&
    flash.scores.gainSpread >= ANCHOR_THRESHOLDS.minGainSpread &&
    (!GATES.specular || (specular.measured && specular.gain >= SPECULAR.minGain)) &&
    (!GATES.pad || !ran(pad) || pad.scores.live >= FUSION.padStrict) &&
    injection.score < FUSION.strictInjection &&
    (!ran(geometry) || (geometry.scores.hit && geometry.scores.poseMs <= FUSION.strictPoseMs)) &&
    (!judge?.scores.ran || (judge.scores.live ?? 0) >= FUSION.judgeStrictLive) &&
    verdict.scores.risk < FUSION.strictRisk
  );
}

/** A pass the judge should look at: doubted, or missing a layer. */
export function borderline(stages: StageResults, verdict: LivenessVerdict): boolean {
  if (verdict.kind !== "pass") {
    return false;
  }
  return (
    verdict.scores.risk >= FUSION.judgeBorderlineRisk ||
    (GATES.pad && !ran(stages.pad)) ||
    (GATES.specular && !stages.flash.scores.specular.measured) ||
    stages.injection.score >= FUSION.strictInjection
  );
}
