import type { DBAdapter } from "better-auth";
import type { Sql } from "./db";
import { offerChallenge } from "./human-pass";
import { randomId } from "./keys";
import { balanceOf } from "./ledger";
import { offerLiveness } from "./liveness/flow";
import { solves } from "./pow";
import { overLimit } from "./rate-limit";
import {
  asBoolean,
  asDate,
  domainsOf,
  fromRiskMilli,
  policiesOf,
  toRiskMilli,
  type ChallengeInsert,
  type ChallengeRecord,
  type SiteRecord,
} from "./records";
import { requiredAssurance, riskScore } from "./risk";
import { mintToken } from "./tokens";
import { strongestAssurance, type Assurance } from "../src/shared/assurance";
import { powBitsFor, type PowPuzzle } from "../src/shared/pow";
import { fail, succeed, type DomainResult } from "../src/shared/result";
import type { Signals } from "../src/shared/signals";
import { hostnameAllowed, policyFor } from "../src/shared/site";

/** A puzzle must be solved this soon; long enough for a slow phone at the highest difficulty. */
export const CHALLENGE_TTL_MS = 120_000;
/** Challenges per IP per site per minute before risk rises. */
const VELOCITY_LIMIT = { max: 30, windowSeconds: 60 } as const;

interface ChallengeSecret extends PowPuzzle {
  readonly highVelocity: boolean;
}

export interface StartedChallenge {
  readonly challengeId: string;
  readonly pow: PowPuzzle;
  readonly expiresAt: string;
}

export const FAILED_MESSAGE = "Verification failed. Try again.";

export async function startChallenge(
  adapter: DBAdapter,
  sql: Sql,
  site: SiteRecord,
  input: { action: string; hostname: string; ipHash: string; minAssurance?: Assurance },
  now = Date.now(),
): Promise<DomainResult<StartedChallenge>> {
  if (!hostnameAllowed(domainsOf(site), input.hostname)) {
    return fail(403, `${input.hostname} isn't an allowed domain for this site key.`);
  }
  const balance = await balanceOf(adapter, site.ownerId);
  const unpaid = !balance || Number(balance.micros) <= 0;
  if (unpaid && site.onUnpaid === "fail_closed") {
    return fail(503, "Verification is unavailable for this site right now.");
  }
  const highVelocity =
    (await overLimit(sql, { bucket: `challenge:${site.id}`, ...VELOCITY_LIMIT }, input.ipHash, now)) !== null;
  const risk = riskScore({ signals: {}, highVelocity });
  const secret: ChallengeSecret = { seed: randomId(22), bits: powBitsFor(risk), highVelocity };
  const challenge = await adapter.create<ChallengeInsert, { id: string }>({
    model: "challenge",
    data: {
      siteId: site.id,
      action: input.action,
      hostname: input.hostname,
      kind: "invisible",
      secret: JSON.stringify(secret),
      // Without credit, only the invisible tier is served (and only if the site chose to degrade).
      required: unpaid
        ? "invisible"
        : strongestAssurance(policyFor(policiesOf(site), input.action), input.minAssurance ?? "invisible"),
      riskMilli: toRiskMilli(risk),
      unpaid,
      expiresAt: new Date(now + CHALLENGE_TTL_MS),
      startedAt: null,
      flashAt: null,
      usedAt: null,
      createdAt: new Date(now),
    },
  });
  return succeed({
    challengeId: challenge.id,
    pow: { seed: secret.seed, bits: secret.bits },
    expiresAt: new Date(now + CHALLENGE_TTL_MS).toISOString(),
  });
}

/** Marks a challenge used, atomically, so one solution can't mint two tokens. */
async function claimChallenge(sql: Sql, challengeId: string, now: number): Promise<ChallengeRecord | null> {
  const [row] = await sql.all<Record<string, unknown>>(
    `UPDATE "challenge" SET "usedAt" = ?
     WHERE "id" = ? AND "kind" = 'invisible' AND "usedAt" IS NULL AND "expiresAt" > ? RETURNING *`,
    [new Date(now).toISOString(), challengeId, new Date(now).toISOString()],
  );
  if (!row) {
    return null;
  }
  return {
    ...(row as unknown as ChallengeRecord),
    risk: fromRiskMilli(row),
    unpaid: asBoolean(row.unpaid),
    expiresAt: asDate(row.expiresAt)!,
    startedAt: asDate(row.startedAt),
    createdAt: asDate(row.createdAt)!,
    usedAt: asDate(row.usedAt),
  };
}

export type InvisibleOutcome =
  | { readonly kind: "token"; readonly token: string; readonly assurance: Assurance }
  /** A flash check is always offered; a Human Pass too when presence is enough. */
  | {
      readonly kind: "stepUp";
      readonly required: Assurance;
      readonly livenessId: string;
      readonly presenceId?: string;
    };

export async function completeInvisible(
  adapter: DBAdapter,
  sql: Sql,
  input: { challengeId: string; nonce: string; signals: Signals },
  now = Date.now(),
): Promise<DomainResult<InvisibleOutcome>> {
  const challenge = await claimChallenge(sql, input.challengeId, now);
  if (!challenge) {
    return fail(410, "This check expired. Try again.");
  }
  const secret = JSON.parse(challenge.secret) as ChallengeSecret;
  if (!solves(secret, input.nonce)) {
    return fail(400, FAILED_MESSAGE);
  }
  const risk = riskScore({ signals: input.signals, highVelocity: secret.highVelocity, attempts: Number(input.nonce) });
  const required = challenge.unpaid ? "invisible" : requiredAssurance(challenge.required, risk);
  if (required !== "invisible") {
    const base = { ...challenge, required, risk };
    const livenessId = await offerLiveness(adapter, base, 1, now);
    const presenceId = required === "presence" ? await offerChallenge(adapter, base, "presence", now) : undefined;
    return succeed({ kind: "stepUp", required, livenessId, ...(presenceId ? { presenceId } : {}) });
  }
  const token = await mintToken(
    adapter,
    {
      siteId: challenge.siteId,
      action: challenge.action,
      hostname: challenge.hostname,
      assurance: "invisible",
      risk,
      unpaid: challenge.unpaid,
    },
    now,
  );
  return succeed({ kind: "token", token, assurance: "invisible" });
}
