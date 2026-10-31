import type { DBAdapter } from "better-auth";
import type { z } from "zod";
import { sha256 } from "./db";
import { newSecretKey, newSiteKey } from "./keys";
import { domainsOf, policiesOf, type SiteRecord } from "./records";
import { fail, succeed, type DomainResult } from "../src/shared/result";
import { DEFAULT_POLICIES, type CreateSiteSchema, type Policies, type UpdateSiteSchema } from "../src/shared/site";

/** The old secret keeps working this long after a rotation, so deploys can catch up. */
export const ROTATION_GRACE_MS = 24 * 60 * 60 * 1000;
export const MAX_SITES_PER_ACCOUNT = 50;

/** What the dashboard and CLI see: never a secret or its hash. */
export interface SiteView {
  readonly id: string;
  readonly name: string;
  readonly siteKey: string;
  readonly secretPrefix: string;
  readonly domains: readonly string[];
  readonly policies: Policies;
  readonly onUnpaid: "degrade" | "fail_closed";
  readonly createdAt: string;
}

export function siteView(site: SiteRecord): SiteView {
  return {
    id: site.id,
    name: site.name,
    siteKey: site.siteKey,
    secretPrefix: site.secretPrefix,
    domains: domainsOf(site),
    policies: policiesOf(site),
    onUnpaid: site.onUnpaid,
    createdAt: new Date(site.createdAt).toISOString(),
  };
}

const NOT_FOUND = "That site doesn't exist.";

export async function listSites(adapter: DBAdapter, ownerId: string): Promise<SiteView[]> {
  const sites = await adapter.findMany<SiteRecord>({
    model: "site",
    where: [{ field: "ownerId", value: ownerId }],
    sortBy: { field: "createdAt", direction: "asc" },
    limit: MAX_SITES_PER_ACCOUNT,
  });
  return sites.map(siteView);
}

export async function ownedSite(adapter: DBAdapter, ownerId: string, siteId: string): Promise<SiteRecord | null> {
  const site = await adapter.findOne<SiteRecord>({ model: "site", where: [{ field: "id", value: siteId }] });
  return site?.ownerId === ownerId ? site : null;
}

/** The secret is returned only here and on rotation; it is never readable again. */
export async function createSite(
  adapter: DBAdapter,
  ownerId: string,
  input: z.output<typeof CreateSiteSchema>,
): Promise<DomainResult<{ site: SiteView; secretKey: string }>> {
  const count = await adapter.count({ model: "site", where: [{ field: "ownerId", value: ownerId }] });
  if (count >= MAX_SITES_PER_ACCOUNT) {
    return fail(409, `An account can have up to ${MAX_SITES_PER_ACCOUNT} sites.`);
  }
  const secret = newSecretKey();
  const site = await adapter.create<Omit<SiteRecord, "id">, SiteRecord>({
    model: "site",
    data: {
      ownerId,
      name: input.name,
      siteKey: newSiteKey(),
      secretHash: secret.hash,
      secretPrefix: secret.prefix,
      previousSecretHash: null,
      previousSecretExpiresAt: null,
      domains: JSON.stringify(input.domains),
      policies: JSON.stringify(DEFAULT_POLICIES),
      onUnpaid: "degrade",
      createdAt: new Date(),
    },
  });
  return succeed({ site: siteView(site), secretKey: secret.secret });
}

export async function updateSite(
  adapter: DBAdapter,
  ownerId: string,
  input: z.output<typeof UpdateSiteSchema>,
): Promise<DomainResult<SiteView>> {
  const site = await ownedSite(adapter, ownerId, input.siteId);
  if (!site) {
    return fail(404, NOT_FOUND);
  }
  const updated = await adapter.update<SiteRecord>({
    model: "site",
    where: [{ field: "id", value: site.id }],
    update: {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.domains === undefined ? {} : { domains: JSON.stringify(input.domains) }),
      ...(input.policies === undefined ? {} : { policies: JSON.stringify({ "*": "invisible", ...input.policies }) }),
      ...(input.onUnpaid === undefined ? {} : { onUnpaid: input.onUnpaid }),
    },
  });
  return updated ? succeed(siteView(updated)) : fail(404, NOT_FOUND);
}

export async function rotateSecret(
  adapter: DBAdapter,
  ownerId: string,
  siteId: string,
  now = Date.now(),
): Promise<DomainResult<{ site: SiteView; secretKey: string }>> {
  const site = await ownedSite(adapter, ownerId, siteId);
  if (!site) {
    return fail(404, NOT_FOUND);
  }
  const secret = newSecretKey();
  const updated = await adapter.update<SiteRecord>({
    model: "site",
    where: [{ field: "id", value: site.id }],
    update: {
      secretHash: secret.hash,
      secretPrefix: secret.prefix,
      previousSecretHash: site.secretHash,
      previousSecretExpiresAt: new Date(now + ROTATION_GRACE_MS),
    },
  });
  return updated ? succeed({ site: siteView(updated), secretKey: secret.secret }) : fail(404, NOT_FOUND);
}

export async function deleteSite(adapter: DBAdapter, ownerId: string, siteId: string): Promise<DomainResult<null>> {
  const site = await ownedSite(adapter, ownerId, siteId);
  if (!site) {
    return fail(404, NOT_FOUND);
  }
  await adapter.delete({ model: "site", where: [{ field: "id", value: site.id }] });
  return succeed(null);
}

export async function siteByKey(adapter: DBAdapter, siteKey: string): Promise<SiteRecord | null> {
  return adapter.findOne<SiteRecord>({ model: "site", where: [{ field: "siteKey", value: siteKey }] });
}

/** The current secret, or the previous one within its grace period. */
export async function siteBySecret(adapter: DBAdapter, secret: string, now = Date.now()): Promise<SiteRecord | null> {
  const hash = sha256(secret);
  const current = await adapter.findOne<SiteRecord>({ model: "site", where: [{ field: "secretHash", value: hash }] });
  if (current) {
    return current;
  }
  const previous = await adapter.findOne<SiteRecord>({
    model: "site",
    where: [{ field: "previousSecretHash", value: hash }],
  });
  return previous?.previousSecretExpiresAt && new Date(previous.previousSecretExpiresAt).getTime() > now
    ? previous
    : null;
}
