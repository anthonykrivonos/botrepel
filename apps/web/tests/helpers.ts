import { SQL } from "bun";
import { createApi, withRequestId, type ApiHandler, type ApiServices } from "../lib/api";
import { databaseFor } from "../lib/auth";
import { createAuth, type Auth, type AuthDeps } from "../lib/auth";
import type { EmailMessage } from "../lib/email";
import type { EnvSource } from "../lib/env";

export const BASE = "http://botrepel.test";

export interface CallOptions {
  readonly method?: string;
  readonly cookie?: string;
  readonly bearer?: string;
  readonly json?: unknown;
  readonly origin?: string | null;
  readonly headers?: Record<string, string>;
}

export interface TestApp {
  readonly auth: Auth;
  readonly api: ApiHandler;
  readonly outbox: EmailMessage[];
  migrate(): Promise<void>;
  call(path: string, options?: CallOptions): Promise<Response>;
  /** Signs in by magic link and returns the session cookie. */
  signIn(email: string): Promise<string>;
  /** A tRPC query (batched shape) as the given cookie. */
  query<T>(procedure: string, input?: unknown, cookie?: string): Promise<T>;
  mutation<T>(procedure: string, input: unknown, cookie?: string): Promise<T>;
}

/** The same server URL with another database name. */
function withDatabase(url: string, name: string): string {
  const parsed = new URL(url);
  parsed.pathname = `/${name}`;
  return parsed.toString();
}

export function cookiesFrom(response: Response): string {
  return response.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
}

/** In-memory SQLite (or TEST_DATABASE_URL Postgres) with an email outbox instead of a sender. */
export function createTestApp(
  deps: Omit<AuthDeps, "database" | "sendEmail"> = {},
  services: Omit<ApiServices, "sendEmail"> = {},
  env: EnvSource = {},
): TestApp {
  const outbox: EmailMessage[] = [];
  const sendEmail = async (message: EmailMessage): Promise<void> => {
    outbox.push(message);
  };
  // On Postgres every test app gets its own fresh database, so files never share accounts or balances.
  const server = process.env.TEST_DATABASE_URL;
  const databaseName = `botrepel_test_${crypto.randomUUID().replaceAll("-", "").slice(0, 16)}`;
  const databaseUrl = server ? withDatabase(server, databaseName) : null;
  const database = databaseFor(databaseUrl ? { DATABASE_URL: databaseUrl } : { DATABASE_PATH: ":memory:" });
  const auth = createAuth({ BETTER_AUTH_URL: BASE, ...env }, { ...deps, database, sendEmail });
  const api = withRequestId(createApi(auth, { ...services, sendEmail }));

  const call = (path: string, options: CallOptions = {}): Promise<Response> => {
    const headers = new Headers(options.headers);
    if (options.origin !== null) {
      headers.set("origin", options.origin ?? BASE);
    }
    if (options.cookie) {
      headers.set("cookie", options.cookie);
    }
    if (options.bearer) {
      headers.set("authorization", `Bearer ${options.bearer}`);
    }
    if (options.json !== undefined) {
      headers.set("content-type", "application/json");
    }
    return api(
      new Request(BASE + path, {
        method: options.method ?? (options.json === undefined ? "GET" : "POST"),
        headers,
        body: options.json === undefined ? undefined : JSON.stringify(options.json),
      }),
    );
  };

  const rpc = async <T>(procedure: string, input: unknown, cookie: string | undefined): Promise<T> => {
    const response = await call(`/api/trpc/${procedure}`, { json: input ?? null, cookie });
    const body = (await response.json()) as { result?: { data: T }; error?: { message: string } };
    if (!body.result) {
      throw new Error(`${procedure} failed (${response.status}): ${body.error?.message}`);
    }
    return body.result.data;
  };

  return {
    auth,
    api,
    outbox,
    migrate: async () => {
      if (server) {
        const admin = new SQL(server);
        await admin.unsafe(`CREATE DATABASE "${databaseName}"`);
        await admin.close();
      }
      await auth.migrate();
    },
    call,
    signIn: async (email) => {
      const sent = await call("/api/auth/sign-in/magic-link", { json: { email, callbackURL: "/dashboard" } });
      if (!sent.ok) {
        throw new Error(`Magic link failed: ${sent.status} ${await sent.text()}`);
      }
      const link = outbox.at(-1)?.action?.url;
      if (!link) {
        throw new Error("No magic link was sent.");
      }
      const verified = await call(new URL(link).pathname + new URL(link).search);
      return cookiesFrom(verified);
    },
    query: (procedure, input, cookie) => rpc(procedure, input, cookie),
    mutation: (procedure, input, cookie) => rpc(procedure, input, cookie),
  };
}
