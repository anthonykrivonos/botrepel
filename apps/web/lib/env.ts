import { z } from "zod";
import { LOOPBACK_HOSTS } from "../src/shared/constants";

export type EnvSource = Readonly<Record<string, string | undefined>>;

const DEFAULT_PORT = 3000;

/** Trimmed text; an empty or blank value counts as unset. */
const text = z.preprocess((value) => {
  if (typeof value !== "string") {
    return value;
  }
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

const wholeNumber = (name: string): z.ZodPreprocess<z.ZodOptional<z.ZodNumber>> =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : undefined),
    z
      .number({ error: `${name} must be a whole number.` })
      .int({ error: `${name} must be a whole number.` })
      .min(0, { error: `${name} must be zero or more.` })
      .optional(),
  );

/** `.env.example` documents each variable. */
export const EnvSchema = z.object({
  NODE_ENV: text,
  PORT: wholeNumber("PORT"),
  /** `0` turns off hot module reload in `bun run dev`; Bun's HMR rejects a tunnel's Host. */
  DEV_HMR: text,
  VERCEL: text,
  VERCEL_ENV: text,
  VERCEL_URL: text,
  /** A preview's stable branch alias, e.g. botrepel-git-feature-paraworks.vercel.app. */
  VERCEL_BRANCH_URL: text,
  VERCEL_PROJECT_PRODUCTION_URL: text,
  SITE_URL: text,
  SEO_NOINDEX: text,
  DATABASE_URL: text,
  DATABASE_PATH: text,
  /** `1` lets a non-production build migrate; production builds always do. */
  MIGRATE: text,
  BETTER_AUTH_URL: text,
  BETTER_AUTH_SECRET: text,
  GITHUB_CLIENT_ID: text,
  GITHUB_CLIENT_SECRET: text,
  GOOGLE_CLIENT_ID: text,
  GOOGLE_CLIENT_SECRET: text,
  RESEND_API_KEY: text,
  EMAIL_FROM: text,
  /** Signs proof-of-work puzzles and hashes IP addresses. */
  CHALLENGE_SECRET: text,
  /** Derives per-site Human Pass pseudonyms; rotating it changes every pseudonym. */
  PASS_PSEUDONYM_KEY: text,
  /** Vercel Cron sends it as a bearer token; the purge refuses anything else. */
  CRON_SECRET: text,
  /** Credit top-ups; without them the dashboard can't take payments. */
  STRIPE_SECRET_KEY: text,
  STRIPE_WEBHOOK_SECRET: text,
  /** The demo site's secret key, for the home page's live demo (`bun run demo:seed` makes one locally). */
  DEMO_SECRET_KEY: text,
  /** Light-check attempts per check, retries included; 3 when unset. */
  LIVENESS_MAX_ATTEMPTS: wholeNumber("LIVENESS_MAX_ATTEMPTS"),
  /** Comma-separated addresses that may open /admin pages once verified. */
  ADMIN_EMAILS: text,
});

export type Env = z.infer<typeof EnvSchema>;

/** Parsed on every call, so a script or test that sets a variable after import is still seen. */
export function readEnv(source: EnvSource = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((issue) => issue.message).join(" ")}`);
  }
  return parsed.data;
}

/** Reads only the two flags, so the logger can call it even when other variables are invalid. */
export function isProduction(source: EnvSource | Env = process.env): boolean {
  return source.NODE_ENV?.trim() === "production" || Boolean(source.VERCEL?.trim());
}

export type LoginMethods = Readonly<Record<"github" | "google" | "magicLink", boolean>>;

/** What sign-in offers; email works without Resend outside production because local development logs each message. */
export function configuredLoginMethods(env: Env = readEnv()): LoginMethods {
  return {
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    magicLink: Boolean(env.RESEND_API_KEY && env.EMAIL_FROM) || !isProduction(env),
  };
}

/** Local development gets fixed secrets so it runs without setup; production must set every one. */
const LOCAL_SECRETS = {
  CRON_SECRET: "botrepel-local-cron-secret-not-for-production",
  BETTER_AUTH_SECRET: "botrepel-local-auth-secret-not-for-production",
  CHALLENGE_SECRET: "botrepel-local-challenge-secret-not-for-production",
  PASS_PSEUDONYM_KEY: "botrepel-local-pseudonym-key-not-for-production",
} as const;

export function secretOf(env: Env, name: keyof typeof LOCAL_SECRETS): string | undefined {
  return env[name] ?? (isProduction(env) ? undefined : LOCAL_SECRETS[name]);
}

/** Like `secretOf`, for code that cannot run without the secret. */
export function requireSecret(env: Env, name: keyof typeof LOCAL_SECRETS): string {
  const secret = secretOf(env, name);
  if (!secret) {
    throw new Error(`Set ${name} to at least 32 random characters.`);
  }
  return secret;
}

const MIN_SECRET_LENGTH = 32;

/** What a production deployment can't run without; the production build fails on any of them. */
export function productionEnvProblems(env: Env): string[] {
  const problems: string[] = [];
  if (!env.SITE_URL?.startsWith("https://")) {
    problems.push("Set SITE_URL to the public https origin, for example https://botrepel.com.");
  }
  if (!env.DATABASE_URL || !/^postgres(ql)?:\/\//.test(env.DATABASE_URL)) {
    problems.push("Set DATABASE_URL to a Postgres connection string.");
  }
  for (const name of Object.keys(LOCAL_SECRETS) as (keyof typeof LOCAL_SECRETS)[]) {
    if ((env[name]?.length ?? 0) < MIN_SECRET_LENGTH) {
      problems.push(`Set ${name} to at least ${MIN_SECRET_LENGTH} random characters.`);
    }
  }
  if (Boolean(env.STRIPE_SECRET_KEY) !== Boolean(env.STRIPE_WEBHOOK_SECRET)) {
    problems.push("Set both STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET, or neither.");
  }
  const methods = configuredLoginMethods(env);
  if (!methods.github && !methods.google && !methods.magicLink) {
    problems.push("Configure a sign-in method: GitHub, Google, or RESEND_API_KEY with EMAIL_FROM.");
  }
  return problems;
}

export function adminEmails(env: Env): string[] {
  return (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isPreviewDeployment(env: Env): boolean {
  return env.VERCEL_ENV !== undefined && env.VERCEL_ENV !== "production";
}

export const isLoopbackHost = (hostname: string): boolean => (LOOPBACK_HOSTS as readonly string[]).includes(hostname);

const https = (host: string | undefined): string | undefined => (host ? `https://${host}` : undefined);

/** Previews keep the production origin, so their noindex pages never canonicalize to a throwaway host. */
export function canonicalOrigin(env: Env): string | undefined {
  return (
    env.SITE_URL ??
    https(env.VERCEL_PROJECT_PRODUCTION_URL) ??
    https(env.VERCEL_URL) ??
    (isProduction(env) ? undefined : `http://localhost:${env.PORT ?? DEFAULT_PORT}`)
  );
}

/**
 * Other origins a preview is opened at: sign-in runs on the deployment URL, but people follow the
 * branch alias. Production trusts only its own origin.
 */
export function previewOrigins(env: Env): string[] {
  if (!isPreviewDeployment(env)) {
    return [];
  }
  return [env.VERCEL_BRANCH_URL, env.VERCEL_URL].flatMap((host) => (host ? [`https://${host}`] : []));
}

/** A preview uses its own URL, so sign-in stays there and OAuth callbacks return to it. */
export function authOrigin(env: Env): string | undefined {
  if (env.BETTER_AUTH_URL) {
    return env.BETTER_AUTH_URL;
  }
  if (isPreviewDeployment(env) && env.VERCEL_URL) {
    return https(env.VERCEL_URL);
  }
  const production = env.VERCEL_ENV === "production" ? https(env.VERCEL_PROJECT_PRODUCTION_URL) : undefined;
  const origin = env.SITE_URL ?? production ?? https(env.VERCEL_URL);
  if (origin) {
    return origin;
  }
  return isProduction(env) ? undefined : `http://localhost:${env.PORT ?? DEFAULT_PORT}`;
}
