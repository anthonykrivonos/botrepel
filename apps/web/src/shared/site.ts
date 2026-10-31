import { z } from "zod";
import { ASSURANCES, type Assurance } from "./assurance";

export const SITE_KEY_PREFIX = "br_pk_";
export const SECRET_KEY_PREFIX = "br_sk_";
export const TOKEN_PREFIX = "br_tk_";
export const MAX_DOMAINS = 20;
export const MAX_ACTIONS = 20;

/** Actions name what is being protected (signup, login, comment); `*` is every other action. */
export const ActionSchema = z
  .string()
  .trim()
  .regex(/^(\*|[a-z0-9][a-z0-9_-]{0,31})$/, { error: "Use lowercase letters, numbers, - and _ (up to 32)." });

const HOSTNAME = /^(?=.{1,253}$)(\*\.)?([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

/** A bare hostname: no scheme, port, or path. `*.example.com` covers every subdomain; `localhost` any local port. */
export function normalizeDomain(input: string): string | null {
  let value = input.trim().toLowerCase();
  value = value
    .replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
    .replace(/[/?#].*$/, "")
    .replace(/:\d+$/, "")
    .replace(/\.$/, "");
  if (value === "127.0.0.1") {
    return "localhost";
  }
  return HOSTNAME.test(value) && (value === "localhost" || value.includes(".")) ? value : null;
}

export const DomainSchema = z.string().transform((value, context) => {
  const domain = normalizeDomain(value);
  if (!domain) {
    context.addIssue({ code: "custom", message: `${value || "That"} isn't a domain like acme.com.` });
    return z.NEVER;
  }
  return domain;
});

export const DomainsSchema = z
  .array(DomainSchema)
  .min(1, { error: "Add at least one domain." })
  .max(MAX_DOMAINS, { error: `Add up to ${MAX_DOMAINS} domains.` })
  .transform((domains) => [...new Set(domains)]);

export const AssuranceSchema = z.enum(ASSURANCES, { error: "Choose invisible, presence, or liveness." });

export const PoliciesSchema = z
  .record(ActionSchema, AssuranceSchema)
  .refine((policies) => Object.keys(policies).length <= MAX_ACTIONS, { error: `Set up to ${MAX_ACTIONS} actions.` });

export type Policies = Readonly<Record<string, Assurance>>;

export const DEFAULT_POLICIES: Policies = { "*": "invisible" };

export const SiteNameSchema = z
  .string()
  .trim()
  .min(1, { error: "Name the site." })
  .max(80, { error: "Use up to 80 characters." });

export const CreateSiteSchema = z.object({ name: SiteNameSchema, domains: DomainsSchema });

export const UpdateSiteSchema = z.object({
  siteId: z.string().min(1),
  name: SiteNameSchema.optional(),
  domains: DomainsSchema.optional(),
  policies: PoliciesSchema.optional(),
  onUnpaid: z.enum(["degrade", "fail_closed"]).optional(),
});

/** The policy for an action, falling back to `*`, then invisible. */
export function policyFor(policies: Policies, action: string): Assurance {
  return policies[action] ?? policies["*"] ?? "invisible";
}

/** Whether `hostname` (from the embedding page) is one of the site's domains. */
export function hostnameAllowed(domains: readonly string[], hostname: string): boolean {
  const host = hostname.toLowerCase() === "127.0.0.1" ? "localhost" : hostname.toLowerCase();
  return domains.some((domain) =>
    domain.startsWith("*.") ? host.endsWith(domain.slice(1)) && host !== domain.slice(2) : host === domain,
  );
}
