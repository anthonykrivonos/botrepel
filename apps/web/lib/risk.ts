import type { Assurance } from "../src/shared/assurance";
import { strongestAssurance } from "../src/shared/assurance";
import { LIVENESS_RISK, PRESENCE_RISK, RISK_WEIGHTS } from "../src/shared/risk";
import type { Signals } from "../src/shared/signals";

/**
 * Hashes per millisecond no browser JavaScript reaches (about 1–5k is typical); faster means the
 * work was done elsewhere, e.g. native code or a GPU. A lucky early nonce proves nothing, so
 * only solutions with enough attempts to measure count.
 */
const MAX_JS_HASHES_PER_MS = 20_000;
const MIN_ATTEMPTS_TO_JUDGE = 10_000;

export interface RiskInputs {
  readonly signals: Signals;
  /** The caller exceeded the per-IP challenge rate for this site. */
  readonly highVelocity: boolean;
  /** The winning nonce: how many hashes the client tried. */
  readonly attempts?: number;
}

function offloaded(attempts: number | undefined, solveMs: number | undefined): boolean {
  if (attempts === undefined || solveMs === undefined || attempts < MIN_ATTEMPTS_TO_JUDGE) {
    return false;
  }
  return attempts / Math.max(1, solveMs) > MAX_JS_HASHES_PER_MS;
}

export function riskScore({ signals, highVelocity, attempts }: RiskInputs): number {
  const score =
    (signals.webdriver ? RISK_WEIGHTS.webdriver : 0) +
    (signals.cdp ? RISK_WEIGHTS.cdp : 0) +
    (signals.headless ? RISK_WEIGHTS.headless : 0) +
    (signals.zeroWindow ? RISK_WEIGHTS.zeroWindow : 0) +
    (offloaded(attempts, signals.solveMs) ? RISK_WEIGHTS.offloaded : 0) +
    (highVelocity ? RISK_WEIGHTS.velocity : 0);
  return Math.min(1, Math.round(score * 100) / 100);
}

/** The assurance a visit must reach: the site's policy, raised by risk. */
export function requiredAssurance(policy: Assurance, risk: number): Assurance {
  return strongestAssurance(
    policy,
    risk >= LIVENESS_RISK ? "liveness" : risk >= PRESENCE_RISK ? "presence" : "invisible",
  );
}
