import { FACT_LIMITS } from "./facts";
import { TOKEN_TTL_SECONDS } from "../shared/constants";
import { SCHEDULE_MS } from "../shared/liveness";
import { POW_BASE_BITS, POW_MAX_BITS } from "../shared/pow";
import { FREE_CREDIT_MICROS, PRICE_MICROS, formatDollars, formatPerThousand } from "../shared/pricing";
import { LIVENESS_RISK, PRESENCE_RISK } from "../shared/risk";

export const GUIDE_UPDATED = "2026-11-11";

export const PRICE_INVISIBLE = formatPerThousand(PRICE_MICROS.invisible);
export const PRICE_PRESENCE = formatPerThousand(PRICE_MICROS.presence);
export const PRICE_LIVENESS = formatPerThousand(PRICE_MICROS.liveness);
export const FREE_CREDIT = formatDollars(FREE_CREDIT_MICROS, 0);

/** Prices and token rules, taken from the same constants as the rest of the site. */
export const PRICE_SENTENCE = `BotRepel charges when siteverify succeeds: ${PRICE_INVISIBLE} per 1,000 invisible checks, ${PRICE_PRESENCE} per 1,000 Human Pass checks, and ${PRICE_LIVENESS} per 1,000 light checks.`;

export const TOKEN_SENTENCE = `A token expires after ${TOKEN_TTL_SECONDS / 60} minutes and can be verified once.`;

export const ASSURANCE_SENTENCE = `The invisible check is proof of work from ${POW_BASE_BITS} to ${POW_MAX_BITS} bits plus browser signals. A risk score of ${PRESENCE_RISK} requires a Human Pass. A risk score of ${LIVENESS_RISK} requires a light check. The light-check color sequence lasts ${SCHEDULE_MS / 1000} seconds, and the server allows ${FACT_LIMITS.lightCheckAttempts} attempts unless LIVENESS_MAX_ATTEMPTS sets another count. Frames are discarded at the end of the request.`;

export const CREDIT_SENTENCE = `New accounts that sign in with GitHub or Google receive ${FREE_CREDIT} of credit.`;
