import { TOKEN_TTL_SECONDS } from "../shared/constants";
import { MAX_FLASH_UPLOAD_BYTES, SCHEDULE_MS } from "../shared/liveness";
import { POW_BASE_BITS, POW_MAX_BITS } from "../shared/pow";
import { PRICE_MICROS, FREE_CREDIT_MICROS, formatDollars, formatPerThousand } from "../shared/pricing";
import { LIVENESS_RISK, PRESENCE_RISK } from "../shared/risk";

/**
 * Figures shown on the site. A unit test checks the retention and attempt values against the
 * server constants, so a change in those files has to update this list.
 */
export const FACT_LIMITS = {
  lightCheckAttempts: 3,
  scoreRetentionDays: 180,
  reportRetentionDays: 90,
  expiredRetentionDays: 1,
  rateLimitRetentionHours: 2,
} as const;

export interface ProductFact {
  readonly value: string;
  readonly label: string;
}

export function productFacts(): readonly ProductFact[] {
  return [
    {
      value: `${formatPerThousand(PRICE_MICROS.invisible)} / 1,000`,
      label: "Invisible check, charged when siteverify succeeds",
    },
    {
      value: `${formatPerThousand(PRICE_MICROS.presence)} / 1,000`,
      label: "Human Pass, charged when siteverify succeeds",
    },
    {
      value: `${formatPerThousand(PRICE_MICROS.liveness)} / 1,000`,
      label: "Flash liveness, charged when siteverify succeeds",
    },
    {
      value: formatDollars(FREE_CREDIT_MICROS, 0),
      label: "Free credit for a new account that signs in with GitHub or Google",
    },
    {
      value: `${TOKEN_TTL_SECONDS / 60} minutes`,
      label: "How long a token stays valid. It can be verified once.",
    },
    {
      value: `${POW_BASE_BITS} to ${POW_MAX_BITS} bits`,
      label: "Proof-of-work difficulty. Risk raises it inside this range.",
    },
    {
      value: `${SCHEDULE_MS / 1000} seconds`,
      label: "Length of the light-check color sequence",
    },
    {
      value: String(FACT_LIMITS.lightCheckAttempts),
      label: "Light-check attempts before failure, unless LIVENESS_MAX_ATTEMPTS sets another count",
    },
    {
      value: String(PRESENCE_RISK),
      label: "Risk score at which a visit must reach a Human Pass",
    },
    {
      value: String(LIVENESS_RISK),
      label: "Risk score at which a visit must reach a light check",
    },
    {
      value: `${FACT_LIMITS.scoreRetentionDays} days`,
      label: "How long numeric light-check scores are kept",
    },
    {
      value: `${FACT_LIMITS.reportRetentionDays} days`,
      label: "How long abuse reports are kept",
    },
    {
      value: `${FACT_LIMITS.expiredRetentionDays} day`,
      label: "How long tokens and challenges stay after they expire",
    },
    {
      value: `${FACT_LIMITS.rateLimitRetentionHours} hours`,
      label: "How long rate-limit rows stay after the window ends",
    },
    {
      value: `${MAX_FLASH_UPLOAD_BYTES / (1024 * 1024)} MB`,
      label: "Largest light-check upload the server accepts",
    },
  ];
}
