import type { DBAdapter } from "better-auth";
import type { z } from "zod";
import { domainsOf, type SiteRecord } from "./records";
import { createSite, MAX_SITES_PER_ACCOUNT, rotateSecret, siteView, type SiteView } from "./sites";
import { fail, succeed, type DomainResult } from "../src/shared/result";
import type { CreateSiteSchema } from "../src/shared/site";
import { MAX_DOMAINS } from "../src/shared/site";

export interface CliSite {
  readonly site: SiteView;
  /** Only when the site was just created or its secret rotated. */
  readonly secretKey: string | null;
  readonly created: boolean;
}

/**
 * Idempotent for `botrepel init`: the account's site with this name, created if missing, with any
 * new domains added. Rerunning in the same project changes nothing and never reveals the secret.
 */
export async function ensureSite(
  adapter: DBAdapter,
  ownerId: string,
  input: z.output<typeof CreateSiteSchema>,
): Promise<DomainResult<CliSite>> {
  const existing = await adapter.findOne<SiteRecord>({
    model: "site",
    where: [
      { field: "ownerId", value: ownerId },
      { field: "name", value: input.name },
    ],
  });
  if (!existing) {
    try {
      const created = await createSite(adapter, ownerId, input);
      return created.success ? succeed({ ...created.data, created: true }) : created;
    } catch (error) {
      // A concurrent `init` created it first (the owner-and-name index is unique): use that one.
      const raced = await adapter.findOne<SiteRecord>({
        model: "site",
        where: [
          { field: "ownerId", value: ownerId },
          { field: "name", value: input.name },
        ],
      });
      if (!raced) {
        throw error;
      }
      return succeed({ site: siteView(raced), secretKey: null, created: false });
    }
  }
  const domains = [...new Set([...domainsOf(existing), ...input.domains])];
  if (domains.length > MAX_DOMAINS) {
    return fail(400, `A site can have up to ${MAX_DOMAINS} domains.`);
  }
  const updated =
    domains.length === domainsOf(existing).length
      ? existing
      : await adapter.update<SiteRecord>({
          model: "site",
          where: [{ field: "id", value: existing.id }],
          update: { domains: JSON.stringify(domains) },
        });
  return succeed({ site: siteView(updated ?? existing), secretKey: null, created: false });
}

export async function rotateForCli(
  adapter: DBAdapter,
  ownerId: string,
  siteId: string,
): Promise<DomainResult<CliSite>> {
  const rotated = await rotateSecret(adapter, ownerId, siteId);
  return rotated.success ? succeed({ ...rotated.data, created: false }) : rotated;
}

export { MAX_SITES_PER_ACCOUNT };
