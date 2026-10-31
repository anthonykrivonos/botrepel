/** Risk at or above these levels steps the challenge up, whatever the site's policy. */
export const PRESENCE_RISK = 0.5;
export const LIVENESS_RISK = 0.8;

/**
 * Additive weights, capped at 1. Signals are evidence of automation, never of humanity. A DevTools
 * connection alone stays below the step-up line, because developers testing their own forms have
 * DevTools open; with any other signal it tips over.
 */
export const RISK_WEIGHTS = {
  webdriver: 0.8,
  cdp: 0.4,
  headless: 0.6,
  zeroWindow: 0.4,
  offloaded: 0.3,
  velocity: 0.3,
} as const;
