import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { bearer } from "better-auth/plugins/bearer";
import { deviceAuthorization } from "better-auth/plugins/device-authorization";
import { magicLink } from "better-auth/plugins/magic-link";
import { Database } from "bun:sqlite";
import { BunPostgresDialect } from "./bun-postgres-dialect";
import { hashKey, sqlFor, type Sql } from "./db";
import { emailSender, type EmailMessage, type SendEmail } from "./email";
import { authOrigin, isProduction, previewOrigins, readEnv, requireSecret, type EnvSource } from "./env";
import { serializeError } from "./errors";
import { grantFreeCredit } from "./ledger";
import { Logger } from "./logger";
import { runMigrations } from "./migrations";
import { overLimit, requestLimitSchema } from "./rate-limit";
import { appSchema } from "./schema";
import { SITE_NAME } from "../src/shared/constants";
import { CLI_CLIENT_ID, DEVICE_PAGE_PATH, MAGIC_LINK_EXPIRES_SECONDS, MagicLinkSchema } from "../src/shared/sign-in";

const AUTH_RATE_LIMIT = { windowSeconds: 60, max: 100 } as const;
const MAGIC_LINKS_PER_EMAIL = { bucket: "magic-link-email", max: 5, windowSeconds: 3600 } as const;
const LOCAL_TRUSTED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"];
const SQLITE_BUSY_TIMEOUT_MS = 5_000;
const LOCAL_DATABASE = new URL("../.data/botrepel.sqlite", import.meta.url);
/** How long a CLI sign-in code stays valid, and how often the CLI may poll. */
const DEVICE_CODE_EXPIRES = "10m";
const DEVICE_POLL_INTERVAL = "3s";

const logger = new Logger("auth");

/** Without `transaction: true`, Better Auth runs a transaction's operations one by one. */
export function databaseFor(source?: EnvSource): BetterAuthOptions["database"] {
  const env = readEnv(source);
  const url = env.DATABASE_URL;
  if (url && /^postgres(ql)?:\/\//.test(url)) {
    return { dialect: new BunPostgresDialect(url), type: "postgres", transaction: true };
  }
  if (env.VERCEL) {
    throw new Error("Set DATABASE_URL to a Postgres database; Vercel has no persistent disk for SQLite.");
  }
  const path = env.DATABASE_PATH ?? fileURLToPath(LOCAL_DATABASE);
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new Database(path, { create: true });
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS};`);
  return db;
}

const disabledPasswordPaths = [
  "/sign-up/email",
  "/sign-in/email",
  "/request-password-reset",
  "/reset-password",
  "/change-password",
];

export interface AuthDeps {
  readonly database?: BetterAuthOptions["database"];
  readonly sendEmail?: SendEmail | null;
}

function signInEmail(email: string, url: string): EmailMessage {
  return {
    to: email,
    subject: `Sign in to ${SITE_NAME}`,
    paragraphs: [`Use this link to sign in. It expires in ${MAGIC_LINK_EXPIRES_SECONDS / 60} minutes.`],
    action: { label: "Sign In", url },
  };
}

function welcomeEmail(email: string, origin: string): EmailMessage {
  return {
    to: email,
    subject: `Welcome to ${SITE_NAME}`,
    paragraphs: [
      "Your account is ready, and you can start by adding your first site.",
      "Run npx botrepel init in your project, or paste the setup prompt from the home page into your coding agent. It creates a site, writes the keys to your env file, and adds the widget.",
      `The docs cover the React widget, server verification, and error codes: ${origin}/docs`,
    ],
    action: { label: "Open Dashboard", url: `${origin}/dashboard` },
    idempotencyKey: `welcome:${email.toLowerCase()}`,
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- Better Auth infers plugin endpoints from this exact type.
export function authOptions(source?: EnvSource, deps: AuthDeps = {}) {
  const env = readEnv(source);
  const sendEmail = deps.sendEmail === undefined ? emailSender(env) : deps.sendEmail;
  const origin = authOrigin(env);
  if (!origin) {
    throw new Error("Set BETTER_AUTH_URL or SITE_URL to the site's public origin.");
  }
  const production = isProduction(env);
  const secret = requireSecret(env, "BETTER_AUTH_SECRET");
  const database = deps.database ?? databaseFor(source);
  let sql: Sql | null = null;

  const github =
    env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET }
      : undefined;
  const google =
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" as const }
      : undefined;

  const send = async (message: EmailMessage): Promise<void> => {
    if (!sendEmail) {
      throw new Error("Email delivery is not configured.");
    }
    try {
      await sendEmail(message);
    } catch (error) {
      logger.warn("Failed to send an auth email", { subject: message.subject, cause: serializeError(error) });
      throw error;
    }
  };

  return {
    appName: SITE_NAME,
    baseURL: origin,
    secret,
    basePath: "/api/auth",
    database,
    advanced: { database: { validateSchema: false } },
    trustedOrigins: production ? previewOrigins(env) : LOCAL_TRUSTED_ORIGINS,
    // Every OAuth failure returns to the login page as ?error=<code>, which the page puts in our words.
    onAPIError: { errorURL: `${origin}/login` },
    telemetry: { enabled: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-in/magic-link") {
          const input = MagicLinkSchema.safeParse(ctx.body);
          if (!input.success) {
            throw new APIError("BAD_REQUEST", { message: input.error.issues[0]?.message });
          }
          // Per address too: IP limits alone let anyone flood one inbox from many networks.
          const retryAfter = await overLimit(
            (sql ??= sqlFor(database)),
            MAGIC_LINKS_PER_EMAIL,
            hashKey(secret, input.data.email.toLowerCase()),
          );
          if (retryAfter !== null) {
            throw new APIError("TOO_MANY_REQUESTS", { message: "Too many sign-in emails. Try again later." });
          }
          ctx.body = input.data;
        }
      }),
    },
    socialProviders: {
      ...(github ? { github } : {}),
      ...(google ? { google } : {}),
    },
    databaseHooks: {
      session: {
        create: {
          // Sessions never keep the IP address.
          before: async (session) => ({ data: { ...session, ipAddress: null } }),
        },
      },
      user: {
        create: {
          // Outside production every sign-up gets the free credit, so local development and tests
          // just work. In production it comes with a GitHub or Google account (below): disposable
          // email addresses would otherwise farm it.
          after: async (user) => {
            if (!production) {
              await grantFreeCredit(database, user.id);
            }
            // A failed welcome never fails the sign-up; `send` already logged it.
            await send(welcomeEmail(user.email, origin)).catch(() => undefined);
          },
        },
      },
      account: {
        create: {
          // Granted once per user however many providers they link (the grant is idempotent).
          after: async (account) => {
            if (account.providerId === "github" || account.providerId === "google") {
              await grantFreeCredit(database, account.userId);
            }
          },
        },
      },
    },
    account: { accountLinking: { enabled: true, trustedProviders: ["github", "google"] } },
    // Deleting an account needs a session from the last day; sites, keys, credit, and tokens go with it.
    user: { deleteUser: { enabled: true } },
    session: { freshAge: 24 * 60 * 60 },
    disabledPaths: [...disabledPasswordPaths, ...(!sendEmail ? ["/sign-in/magic-link", "/magic-link/verify"] : [])],
    rateLimit: {
      enabled: production,
      window: AUTH_RATE_LIMIT.windowSeconds,
      max: AUTH_RATE_LIMIT.max,
      customStorage: {
        consume: async (key: string, rule: { window: number; max: number }) => {
          const limit = { bucket: `auth-${rule.window}s`, max: rule.max, windowSeconds: rule.window };
          const retryAfter = await overLimit((sql ??= sqlFor(database)), limit, hashKey(secret, key));
          return { allowed: retryAfter === null, retryAfter };
        },
      },
    },
    plugins: [
      magicLink({
        expiresIn: MAGIC_LINK_EXPIRES_SECONDS,
        storeToken: "hashed",
        sendMagicLink: async ({ email, url }) => send(signInEmail(email, url)),
      }),
      // The CLI signs in with the device flow and calls the API with the session token as a bearer.
      bearer(),
      deviceAuthorization({
        expiresIn: DEVICE_CODE_EXPIRES,
        interval: DEVICE_POLL_INTERVAL,
        verificationUri: DEVICE_PAGE_PATH,
        validateClient: (clientId) => clientId === CLI_CLIENT_ID,
      }),
      requestLimitSchema,
      appSchema,
    ],
  } satisfies BetterAuthOptions;
}

export function createAuth(source?: EnvSource, deps: AuthDeps = {}): Auth {
  const options = authOptions(source, deps);
  const auth = betterAuth(options);
  return Object.assign(auth, {
    loginMethods: {
      github: Boolean(options.socialProviders.github),
      google: Boolean(options.socialProviders.google),
      magicLink: !options.disabledPaths.includes("/sign-in/magic-link"),
    },
    migrate: async (): Promise<void> => {
      await (await getMigrations(options)).runMigrations();
      await runMigrations(sqlFor(options.database));
      await (await auth.$context).explicitSchemaCheck?.();
    },
  });
}

interface AuthAdditions {
  readonly loginMethods: { readonly github: boolean; readonly google: boolean; readonly magicLink: boolean };
  migrate(): Promise<void>;
}

export type Auth = ReturnType<typeof betterAuth<ReturnType<typeof authOptions>>> & AuthAdditions;
