import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import type { DBAdapter } from "better-auth";
import type { Sql } from "./db";
import { hourOf } from "./ledger";
import {
  asBoolean,
  asDate,
  fromRiskMilli,
  toRiskMilli,
  type ChallengeInsert,
  type ChallengeRecord,
  type HumanPassRecord,
  type SiteRecord,
} from "./records";
import { mintToken } from "./tokens";
import { SITE_NAME } from "../src/shared/constants";
import { fail, succeed, type DomainResult } from "../src/shared/result";

/** How long a strict flash pass lets someone create a Human Pass, and a presence offer stays open. */
export const ANCHOR_TTL_MS = 5 * 60_000;
export const PRESENCE_TTL_MS = 5 * 60_000;
/** One pass can vouch this many times an hour; a farm reusing one pass hits it fast. */
export const ASSERTIONS_PER_HOUR = 10;
/** A pass younger than this only counts on visits with no risk at all. */
export const FRESH_PASS_MS = 60 * 60_000;
/** A pass is burned when this many established owners report it within the window. */
export const BURN_REPORTS = 3;
export const BURN_WINDOW_MS = 30 * 24 * 60 * 60_000;
/** Reports count only from sites at least this old, so a throwaway site can't burn honest passes. */
export const REPORTER_MIN_AGE_MS = 7 * 24 * 60 * 60_000;
/** …and only from owners whose account is this old, unless they've paid. */
export const REPORTER_ACCOUNT_AGE_MS = 30 * 24 * 60 * 60_000;

export interface Relying {
  readonly origin: string;
  readonly rpID: string;
  /** Derives per-site pseudonyms. */
  readonly pseudonymKey: string;
}

export const relyingParty = (origin: string, pseudonymKey: string): Relying => ({
  origin,
  rpID: new URL(origin).hostname,
  pseudonymKey,
});

/** Stable per pass and site, unlinkable across sites without the key. */
export function pseudonymOf(key: string, credentialId: string, siteId: string): string {
  return new Bun.CryptoHasher("sha256", key).update(`${credentialId}|${siteId}`).digest("base64url").slice(0, 22);
}

const iso = (ms: number): string => new Date(ms).toISOString();

async function openChallenge(
  sql: Sql,
  id: string,
  kind: ChallengeRecord["kind"],
  now: number,
): Promise<ChallengeRecord | null> {
  const [row] = await sql.all<Record<string, unknown>>(
    `SELECT * FROM "challenge" WHERE "id" = ? AND "kind" = ? AND "usedAt" IS NULL AND "expiresAt" > ?`,
    [id, kind, iso(now)],
  );
  return row ? toChallenge(row) : null;
}

/** Marks a challenge used, atomically; returns it only to the first caller. */
async function claim(
  sql: Sql,
  id: string,
  kind: ChallengeRecord["kind"],
  now: number,
): Promise<ChallengeRecord | null> {
  const [row] = await sql.all<Record<string, unknown>>(
    `UPDATE "challenge" SET "usedAt" = ? WHERE "id" = ? AND "kind" = ? AND "usedAt" IS NULL AND "expiresAt" > ? RETURNING *`,
    [iso(now), id, kind, iso(now)],
  );
  return row ? toChallenge(row) : null;
}

const toChallenge = (row: Record<string, unknown>): ChallengeRecord => ({
  ...(row as unknown as ChallengeRecord),
  risk: fromRiskMilli(row),
  unpaid: asBoolean(row.unpaid),
  expiresAt: asDate(row.expiresAt)!,
  startedAt: asDate(row.startedAt),
  createdAt: asDate(row.createdAt)!,
  usedAt: asDate(row.usedAt),
});

/** Offers a challenge of `kind` tied to the same site, action, and risk. */
export async function offerChallenge(
  adapter: DBAdapter,
  base: Pick<ChallengeRecord, "siteId" | "action" | "hostname" | "required" | "risk">,
  kind: "presence" | "pass-anchor",
  now = Date.now(),
): Promise<string> {
  const challenge = await adapter.create<ChallengeInsert, { id: string }>({
    model: "challenge",
    data: {
      siteId: base.siteId,
      action: base.action,
      hostname: base.hostname,
      required: base.required,
      riskMilli: toRiskMilli(base.risk),
      kind,
      secret: "{}",
      unpaid: false,
      expiresAt: new Date(now + (kind === "presence" ? PRESENCE_TTL_MS : ANCHOR_TTL_MS)),
      startedAt: null,
      flashAt: null,
      usedAt: null,
      createdAt: new Date(now),
    },
  });
  return challenge.id;
}

async function storeWebAuthnChallenge(sql: Sql, id: string, challenge: string): Promise<void> {
  await sql.all(`UPDATE "challenge" SET "secret" = ? WHERE "id" = ?`, [JSON.stringify({ webauthn: challenge }), id]);
}

/** Registration options for a new pass; requires an unused anchor from a strict flash pass. */
export async function registrationOptions(
  sql: Sql,
  relying: Relying,
  anchorId: string,
  now = Date.now(),
): Promise<DomainResult<PublicKeyCredentialCreationOptionsJSON>> {
  if (!(await openChallenge(sql, anchorId, "pass-anchor", now))) {
    return fail(403, "Pass the light check first, then create your Human Pass.");
  }
  const options = await generateRegistrationOptions({
    rpName: `${SITE_NAME} Human Pass`,
    rpID: relying.rpID,
    // Nothing about the person: a random handle and a fixed label.
    userName: "Human Pass",
    userDisplayName: "Human Pass",
    attestationType: "direct",
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  await storeWebAuthnChallenge(sql, anchorId, options.challenge);
  return succeed(options);
}

export async function registerPass(
  adapter: DBAdapter,
  sql: Sql,
  relying: Relying,
  input: { anchorId: string; response: RegistrationResponseJSON },
  now = Date.now(),
): Promise<DomainResult<{ created: true }>> {
  const anchor = await claim(sql, input.anchorId, "pass-anchor", now);
  const expected = anchor ? (JSON.parse(anchor.secret) as { webauthn?: string }).webauthn : undefined;
  if (!anchor || !expected) {
    return fail(403, "Pass the light check first, then create your Human Pass.");
  }
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: input.response,
      expectedChallenge: expected,
      expectedOrigin: relying.origin,
      expectedRPID: relying.rpID,
      requireUserVerification: true,
    });
  } catch {
    return fail(400, "The passkey couldn't be verified. Try again.");
  }
  if (!verification.verified) {
    return fail(400, "The passkey couldn't be verified. Try again.");
  }
  const { credential, aaguid, credentialBackedUp } = verification.registrationInfo;
  await adapter.create({
    model: "humanPass",
    data: {
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64url"),
      counter: credential.counter,
      aaguid,
      backedUp: credentialBackedUp,
      status: "active",
      hour: hourOf(now),
      hourCount: 0,
      createdAt: new Date(now),
    },
  });
  return succeed({ created: true });
}

export async function presenceOptions(
  sql: Sql,
  relying: Relying,
  presenceId: string,
  now = Date.now(),
): Promise<DomainResult<PublicKeyCredentialRequestOptionsJSON>> {
  if (!(await openChallenge(sql, presenceId, "presence", now))) {
    return fail(410, "This check expired. Try again.");
  }
  // Discoverable credentials: the browser offers whichever pass this person has; no list leaks.
  const options = await generateAuthenticationOptions({ rpID: relying.rpID, userVerification: "required" });
  await storeWebAuthnChallenge(sql, presenceId, options.challenge);
  return succeed(options);
}

/** Counts one assertion against the pass's hourly quota, atomically; false when it's used up. */
async function takeQuota(sql: Sql, passId: string, now: number): Promise<boolean> {
  const hour = hourOf(now);
  const rows = await sql.all(
    `UPDATE "humanPass" SET
       "hourCount" = CASE WHEN "hour" = ? THEN "hourCount" + 1 ELSE 1 END,
       "hour" = ?
     WHERE "id" = ? AND ("hour" <> ? OR "hourCount" < ?) RETURNING "id"`,
    [hour, hour, passId, hour, ASSERTIONS_PER_HOUR],
  );
  return rows.length > 0;
}

export async function verifyPresence(
  adapter: DBAdapter,
  sql: Sql,
  relying: Relying,
  input: { presenceId: string; response: AuthenticationResponseJSON },
  now = Date.now(),
): Promise<DomainResult<{ token: string; assurance: "presence" }>> {
  const challenge = await claim(sql, input.presenceId, "presence", now);
  const expected = challenge ? (JSON.parse(challenge.secret) as { webauthn?: string }).webauthn : undefined;
  if (!challenge || !expected) {
    return fail(410, "This check expired. Try again.");
  }
  const pass = await adapter.findOne<HumanPassRecord>({
    model: "humanPass",
    where: [{ field: "credentialId", value: input.response.id }],
  });
  if (!pass || pass.status !== "active") {
    return fail(403, "That Human Pass can't be used. Take the light check instead.");
  }
  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: input.response,
      expectedChallenge: expected,
      expectedOrigin: relying.origin,
      expectedRPID: relying.rpID,
      requireUserVerification: true,
      credential: {
        id: pass.credentialId,
        publicKey: new Uint8Array(Buffer.from(pass.publicKey, "base64url")),
        counter: Number(pass.counter),
      },
    });
  } catch {
    // Includes a signature counter that went backwards: a cloned authenticator.
    return fail(403, "That Human Pass couldn't be verified. Take the light check instead.");
  }
  if (!verification.verified) {
    return fail(403, "That Human Pass couldn't be verified. Take the light check instead.");
  }
  const fresh = now - new Date(pass.createdAt).getTime() < FRESH_PASS_MS;
  if (fresh && challenge.risk > 0) {
    return fail(403, "This Human Pass is too new for this check. Take the light check instead.");
  }
  if (!(await takeQuota(sql, pass.id, now))) {
    return fail(429, "This Human Pass has been used a lot this hour. Take the light check instead.");
  }
  // Compare-and-swap: two assertions racing with the same counter can't both count.
  const advanced = await sql.all(
    `UPDATE "humanPass" SET "counter" = ? WHERE "id" = ? AND "counter" = ? RETURNING "id"`,
    [verification.authenticationInfo.newCounter, pass.id, Number(pass.counter)],
  );
  if (!advanced.length) {
    return fail(409, "That Human Pass was just used. Try again.");
  }
  const token = await mintToken(
    adapter,
    {
      siteId: challenge.siteId,
      action: challenge.action,
      hostname: challenge.hostname,
      assurance: "presence",
      risk: challenge.risk,
      unpaid: false,
      pseudonym: pseudonymOf(relying.pseudonymKey, pass.credentialId, challenge.siteId),
      passId: pass.id,
    },
    now,
  );
  return succeed({ token, assurance: "presence" });
}

/**
 * A site reports the person behind a pseudonym. One site can't burn a pass; several established
 * sites within a month do. Returns whether the pass is now burned.
 */
export async function reportPass(
  adapter: DBAdapter,
  sql: Sql,
  input: { site: SiteRecord; pseudonym: string; reason: string },
  now = Date.now(),
): Promise<DomainResult<{ burned: boolean }>> {
  const [token] = await sql.all<{ passId: string | null }>(
    `SELECT "passId" FROM "verificationToken" WHERE "siteId" = ? AND "pseudonym" = ? AND "passId" IS NOT NULL
     ORDER BY "createdAt" DESC LIMIT 1`,
    [input.site.id, input.pseudonym],
  );
  if (!token?.passId) {
    return fail(404, "No Human Pass with that pseudonym verified on this site.");
  }
  const [existing] = await sql.all(`SELECT "id" FROM "humanPassReport" WHERE "passId" = ? AND "siteId" = ?`, [
    token.passId,
    input.site.id,
  ]);
  if (!existing) {
    await adapter.create({
      model: "humanPassReport",
      data: { passId: token.passId, siteId: input.site.id, reason: input.reason, createdAt: new Date(now) },
    });
  }
  const [count] = await sql.all<{ reporters: number }>(
    // Distinct owners, not sites: one account with many sites is one voice. An owner counts only
    // once established (an account a month old, or one that has paid), so throwaway accounts can't burn passes.
    `SELECT COUNT(DISTINCT s."ownerId") AS "reporters"
     FROM "humanPassReport" r
     JOIN "site" s ON s."id" = r."siteId"
     JOIN "user" u ON u."id" = s."ownerId"
     WHERE r."passId" = ? AND r."createdAt" > ? AND s."createdAt" < ?
       AND (u."createdAt" < ? OR EXISTS (
         SELECT 1 FROM "ledgerEntry" l WHERE l."userId" = s."ownerId" AND l."kind" = 'topup'))`,
    [token.passId, iso(now - BURN_WINDOW_MS), iso(now - REPORTER_MIN_AGE_MS), iso(now - REPORTER_ACCOUNT_AGE_MS)],
  );
  const burned = Number(count?.reporters ?? 0) >= BURN_REPORTS;
  if (burned) {
    await sql.all(`UPDATE "humanPass" SET "status" = 'burned' WHERE "id" = ?`, [token.passId]);
  }
  return succeed({ burned });
}
