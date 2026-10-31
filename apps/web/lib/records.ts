import type { Assurance } from "../src/shared/assurance";
import type { Policies } from "../src/shared/site";

/** One readonly definition per table row, as the adapter returns it. */
export interface SiteRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly siteKey: string;
  readonly secretHash: string;
  readonly secretPrefix: string;
  readonly previousSecretHash: string | null;
  readonly previousSecretExpiresAt: Date | null;
  readonly domains: string;
  readonly policies: string;
  readonly onUnpaid: "degrade" | "fail_closed";
  readonly createdAt: Date;
}

export interface ChallengeRecord {
  readonly id: string;
  readonly siteId: string;
  readonly action: string;
  readonly hostname: string;
  readonly kind: "invisible" | "liveness" | "presence" | "pass-anchor";
  readonly secret: string;
  readonly required: Assurance;
  readonly risk: number;
  readonly unpaid: boolean;
  readonly expiresAt: Date;
  readonly startedAt: Date | null;
  /** When the flash upload was claimed, for liveness challenges. */
  readonly flashAt: Date | null;
  readonly usedAt: Date | null;
  readonly createdAt: Date;
}

export interface TokenRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly siteId: string;
  readonly action: string;
  readonly hostname: string;
  readonly assurance: Assurance;
  readonly risk: number;
  readonly unpaid: boolean;
  readonly pseudonym: string | null;
  readonly passId: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly redeemedAt: Date | null;
}

export interface HumanPassRecord {
  readonly id: string;
  readonly credentialId: string;
  readonly publicKey: string;
  readonly counter: number;
  readonly aaguid: string;
  readonly backedUp: boolean;
  readonly status: "active" | "burned";
  readonly hour: number;
  readonly hourCount: number;
  readonly createdAt: Date;
}

export const domainsOf = (site: SiteRecord): string[] => JSON.parse(site.domains) as string[];
export const policiesOf = (site: SiteRecord): Policies => JSON.parse(site.policies) as Policies;

/** SQLite returns 0/1 and epoch numbers for raw queries; the adapter already converts its own reads. */
export const asBoolean = (value: unknown): boolean => value === true || value === 1 || value === "1" || value === "t";
export const asDate = (value: unknown): Date | null =>
  value == null ? null : value instanceof Date ? value : new Date(value as string | number);

/**
 * Risk is a float in [0, 1] in code but an integer in the database (Better Auth's numbers are
 * integers on Postgres), stored in thousandths.
 */
export const toRiskMilli = (risk: number): number => Math.round(Math.min(1, Math.max(0, risk)) * 1000);
export const fromRiskMilli = (row: Record<string, unknown>): number => Number(row.riskMilli ?? 0) / 1000;

/** A challenge as inserted: risk in thousandths. */
export type ChallengeInsert = Omit<ChallengeRecord, "id" | "risk"> & { readonly riskMilli: number };
