import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { z } from "zod";
import { createAuth, type Auth } from "./auth";
import type { Caller } from "./caller";
import { completeInvisible, startChallenge } from "./challenges";
import { ensureSite, rotateForCli } from "./cli-sites";
import { cliTokenOwner, issueCliToken } from "./cli-tokens";
import { adapterOf, clientIp, hashKey, sqlFor } from "./db";
import { emailSender, type SendEmail } from "./email";
import { embedderHost, issueEmbedTicket, readEmbedTicket } from "./embed-ticket";
import { adminEmails, authOrigin, isProduction, readEnv, requireSecret, secretOf } from "./env";
import { serializeError } from "./errors";
import { json, methodNotAllowed } from "./http";
import {
  presenceOptions,
  registerPass,
  registrationOptions,
  relyingParty,
  reportPass,
  verifyPresence,
} from "./human-pass";
import { sameSecret } from "./keys";
import { adjust, refundedMicros, topUp } from "./ledger";
import type { LivenessAnalyzer } from "./liveness/analyzer";
import { defaultAnalyzer } from "./liveness/compose";
import { issueArc, startLiveness, submitFlash, submitPose } from "./liveness/flow";
import { realClock, scheduleStream } from "./liveness/stream";
import { Logger, type LogAttributes } from "./logger";
import { purgeExpired } from "./purge";
import { overLimit, type Limit } from "./rate-limit";
import { domainsOf } from "./records";
import { boundedBytes, boundedJson, RequestBodyError } from "./request-body";
import { errorOf, noteRequest, requestNotes, withRequestNotes } from "./request-log";
import { listSites, siteByKey, siteBySecret } from "./sites";
import { siteverify } from "./siteverify";
import { MICROS_PER_CENT, stripePayments, verifyWebhook, type Payments, type StripeEvent } from "./stripe";
import { rpcResponseHeaders, type RpcContext } from "./trpc/core";
import { appRouter } from "./trpc/router";
import { widgetHeaders, widgetShell } from "./widget-page";
import { UNEXPECTED_ERROR_MESSAGE } from "../src/shared/constants";
import { MAX_FLASH_UPLOAD_BYTES, MAX_POSE_UPLOAD_BYTES } from "../src/shared/liveness";
import type { DomainResult } from "../src/shared/result";
import { CreateSiteSchema, hostnameAllowed } from "../src/shared/site";
import { validate } from "../src/shared/validation";
import { APP_VERSION } from "../src/shared/version";
import {
  FeedbackSchema,
  InvisibleSubmitSchema,
  LivenessStartSchema,
  PassRegisterSchema,
  PresenceSchema,
  StartChallengeSchema,
} from "../src/shared/widget-protocol";

export type ApiHandler = (request: Request) => Promise<Response>;
type RouteHandler = (request: Request, match: RegExpMatchArray) => Promise<Response>;

/** The first route whose pattern matches owns the path; other methods get 405 listing its methods. */
interface Route {
  readonly pattern: RegExp;
  readonly methods?: Partial<Record<string, RouteHandler>>;
  /** Handles every method itself. */
  readonly any?: RouteHandler;
}

export interface ApiServices {
  readonly sendEmail: SendEmail | null;
  /** Judges flash-check captures; the composed stages unless a test replaces them. */
  readonly liveness?: LivenessAnalyzer;
  /** Paces the schedule stream; tests pass an instant one. */
  readonly sleep?: (ms: number) => Promise<void>;
  /** Stripe top-ups; null when the server has no Stripe keys. */
  readonly payments?: Payments | null;
  readonly stripeWebhookSecret?: string | null;
}

/** Dashboard and auth bodies are small; liveness uploads get their own limit. */
const JSON_BODY_LIMIT = 256 * 1024;
const RPC_MAX_BATCH_SIZE = 10;
/** Widget calls per network per minute, across sites, before refusing outright. */
const WIDGET_RATE_LIMIT = { bucket: "widget", max: 180, windowSeconds: 60 } as const;
/** Server-to-server and account limits; generous for real traffic, fatal to brute force and floods. */
const LIMITS = {
  siteverifyPerIp: { bucket: "siteverify-ip", max: 1200, windowSeconds: 60 },
  siteverifyPerSecret: { bucket: "siteverify-secret", max: 6000, windowSeconds: 60 },
  feedbackPerSite: { bucket: "feedback", max: 200, windowSeconds: 3600 },
  cliPerCaller: { bucket: "cli", max: 60, windowSeconds: 60 },
  rpcPerCaller: { bucket: "rpc", max: 300, windowSeconds: 60 },
  /** The pose upload is the one that answers pass or fail, so probing it is bounded tightly. */
  livenessPosePerIp: { bucket: "liveness-pose", max: 12, windowSeconds: 60 },
} as const;

const logger = new Logger("api");

const safeHostname = (url: string): string | null => {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
};

export function createApi(auth: Auth, services: ApiServices): ApiHandler {
  const sql = sqlFor(auth.options.database);
  const origin = auth.options.baseURL;
  const challengeSecret = requireSecret(readEnv(), "CHALLENGE_SECRET");
  const relying = relyingParty(origin, requireSecret(readEnv(), "PASS_PSEUDONYM_KEY"));
  const ipHash = (request: Request): string => hashKey(challengeSecret, clientIp(request));
  const analyzer = services.liveness ?? defaultAnalyzer();
  const clock = services.sleep ? { ...realClock, sleep: services.sleep } : realClock;

  /** A domain result as REST JSON: the data, or `{ error, fields }` with its status. */
  const reply = <T>(result: DomainResult<T>): Response =>
    result.success
      ? json(result.data)
      : json(
          { error: result.error.message, ...(result.error.fields ? { fields: result.error.fields } : {}) },
          result.error.status,
          result.error.retryAfter ? { "Retry-After": String(result.error.retryAfter) } : {},
        );

  /** Widget endpoints are called by our own iframe, so they refuse other origins and throttle per IP. */
  async function widgetGuard(request: Request): Promise<Response | null> {
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== origin && !auth.options.trustedOrigins?.includes(requestOrigin)) {
      return json({ error: "Cross-site request refused." }, 403);
    }
    // Fails closed: when the counter can't be written, refusing is safer than unlimited checks.
    const retryAfter = await overLimit(sql, WIDGET_RATE_LIMIT, ipHash(request), Date.now(), "closed");
    return retryAfter === null ? null : tooMany(retryAfter);
  }

  const tooMany = (retryAfter: number): Response =>
    json({ error: "Too many requests. Wait a moment." }, 429, { "Retry-After": String(retryAfter) });

  /** The first limit exceeded, as a 429; null when all pass. */
  async function limited(checks: readonly [Limit, string][]): Promise<Response | null> {
    for (const [limit, key] of checks) {
      const retryAfter = await overLimit(sql, limit, key);
      if (retryAfter !== null) {
        return tooMany(retryAfter);
      }
    }
    return null;
  }

  async function challengeStart(request: Request): Promise<Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const input = validate(StartChallengeSchema, await boundedJson(request, JSON_BODY_LIMIT));
    if (!input.success) {
      return json({ error: "Check the arguments.", fields: input.error }, 400);
    }
    const adapter = await adapterOf(auth);
    const site = await siteByKey(adapter, input.data.siteKey);
    if (!site) {
      return json({ error: "Unknown site key." }, 404);
    }
    noteRequest({ siteId: site.id, action: input.data.action });
    // The hostname comes from the signed ticket the challenge page carried, not from the widget's report.
    const ticket = input.data.ticket ? readEmbedTicket(challengeSecret, input.data.ticket, site.id) : null;
    if (!ticket && (input.data.ticket || isProduction(readEnv()))) {
      return json({ error: "Reload the page to verify.", code: "ticket" }, 403);
    }
    const hostname = ticket?.hostname ?? input.data.hostname;
    const result = await startChallenge(adapter, sql, site, { ...input.data, hostname, ipHash: ipHash(request) });
    return reply(result);
  }

  async function challengeInvisible(request: Request): Promise<Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const input = validate(InvisibleSubmitSchema, await boundedJson(request, JSON_BODY_LIMIT));
    if (!input.success) {
      return json({ error: "Check the arguments.", fields: input.error }, 400);
    }
    const result = await completeInvisible(await adapterOf(auth), sql, input.data);
    if (result.success) {
      noteRequest({ outcome: result.data.kind });
    }
    return reply(result);
  }

  async function livenessStart(request: Request): Promise<Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const input = validate(LivenessStartSchema, await boundedJson(request, JSON_BODY_LIMIT));
    if (!input.success) {
      return json({ error: "Check the arguments.", fields: input.error }, 400);
    }
    const { livenessId } = input.data;
    const result = await startLiveness(sql, livenessId);
    if (!result.success) {
      return reply(result);
    }
    // The schedule leaves just in time, one step at a time, then the pose prompt.
    return new Response(
      scheduleStream(result.data, () => issueArc(sql, livenessId), request.signal, clock),
      {
        headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
      },
    );
  }

  /** The liveness id of an upload, which rides in the query string. */
  const uploadId = (request: Request): string | null => {
    const livenessId = new URL(request.url).searchParams.get("id") ?? "";
    return livenessId && livenessId.length <= 64 ? livenessId : null;
  };

  /** The flash capture is a gzipped binary body. The answer is the same whatever it showed. */
  async function livenessSubmit(request: Request): Promise<Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const livenessId = uploadId(request);
    if (!livenessId) {
      return json({ error: "Check the arguments." }, 400);
    }
    const body = await boundedBytes(request, MAX_FLASH_UPLOAD_BYTES);
    return reply(await submitFlash(await adapterOf(auth), sql, analyzer, { livenessId, body }));
  }

  /** The pose capture settles the check. */
  async function livenessPose(request: Request): Promise<Response> {
    const refused = (await widgetGuard(request)) ?? (await limited([[LIMITS.livenessPosePerIp, ipHash(request)]]));
    if (refused) {
      return refused;
    }
    const livenessId = uploadId(request);
    if (!livenessId) {
      return json({ error: "Check the arguments." }, 400);
    }
    const body = await boundedBytes(request, MAX_POSE_UPLOAD_BYTES);
    const result = await submitPose(await adapterOf(auth), sql, analyzer, { livenessId, body });
    if (result.success) {
      noteRequest({ outcome: result.data.kind });
    }
    return reply(result);
  }

  /** Parses a widget JSON body against `schema`, or answers 400. */
  async function widgetInput<S extends Parameters<typeof validate>[0]>(
    request: Request,
    schema: S,
  ): Promise<{ data: z.output<S> } | Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const input = validate(schema, await boundedJson(request, JSON_BODY_LIMIT));
    return input.success ? { data: input.data } : json({ error: "Check the arguments.", fields: input.error }, 400);
  }

  async function presenceOptionsRoute(request: Request): Promise<Response> {
    const input = await widgetInput(request, PresenceSchema.pick({ presenceId: true }));
    return input instanceof Response ? input : reply(await presenceOptions(sql, relying, input.data.presenceId));
  }

  async function presenceVerifyRoute(request: Request): Promise<Response> {
    const input = await widgetInput(request, PresenceSchema);
    if (input instanceof Response) {
      return input;
    }
    const result = await verifyPresence(await adapterOf(auth), sql, relying, input.data);
    noteRequest({ outcome: result.success ? "token" : "refused" });
    return reply(result);
  }

  async function passOptionsRoute(request: Request): Promise<Response> {
    const input = await widgetInput(request, PassRegisterSchema.pick({ anchorId: true }));
    return input instanceof Response ? input : reply(await registrationOptions(sql, relying, input.data.anchorId));
  }

  async function passRegisterRoute(request: Request): Promise<Response> {
    const input = await widgetInput(request, PassRegisterSchema);
    return input instanceof Response
      ? input
      : reply(await registerPass(await adapterOf(auth), sql, relying, input.data));
  }

  /** Server to server: a site reports the person behind a pseudonym for abuse. */
  async function feedbackRoute(request: Request): Promise<Response> {
    const input = validate(FeedbackSchema, await boundedJson(request, JSON_BODY_LIMIT));
    if (!input.success) {
      return json({ error: "Check the arguments.", fields: input.error }, 400);
    }
    const adapter = await adapterOf(auth);
    const site = await siteBySecret(adapter, input.data.secret);
    if (!site) {
      return json({ error: "Unknown secret key." }, 401);
    }
    const throttled = await limited([[LIMITS.feedbackPerSite, site.id]]);
    if (throttled) {
      return throttled;
    }
    return reply(await reportPass(adapter, sql, { site, pseudonym: input.data.pseudonym, reason: input.data.reason }));
  }

  /** Stripe tells us a checkout was paid; the credit is posted once per session, however often Stripe retries. */
  async function stripeWebhook(request: Request): Promise<Response> {
    if (!services.stripeWebhookSecret) {
      return json({ error: "Payments aren't set up on this server." }, 503);
    }
    const payload = new TextDecoder().decode(await boundedBytes(request, JSON_BODY_LIMIT));
    const event = verifyWebhook(payload, request.headers.get("stripe-signature"), services.stripeWebhookSecret);
    if (!event) {
      return json({ error: "Bad signature." }, 400);
    }
    noteRequest({ stripeEvent: event.type, stripeEventId: event.id });
    const change = await creditChange(event);
    if (!change) {
      return json({ received: true });
    }
    const owner = await (
      await adapterOf(auth)
    ).findOne({ model: "user", where: [{ field: "id", value: change.userId }] });
    if (!owner) {
      // Paid after deleting the account: nothing to credit. Refunds for this are handled by hand.
      logger.warn("Payment event for a deleted account", { stripeEventId: event.id });
      return json({ received: true });
    }
    if (change.kind === "topup") {
      await topUp(auth.options.database, change.userId, change.amountMicros, change.key);
    } else if (change.amountMicros !== 0) {
      await adjust(auth.options.database, change.userId, change.amountMicros, change.key);
    }
    return json({ received: true });
  }

  /** What a Stripe event does to an account's credit, if anything. Only USD moves credit. */
  async function creditChange(
    event: StripeEvent,
  ): Promise<{ kind: "topup" | "adjust"; userId: string; amountMicros: number; key: string } | null> {
    const object = event.data.object as {
      id?: string;
      client_reference_id?: string;
      amount_total?: number;
      amount_refunded?: number;
      amount?: number;
      charge?: string;
      currency?: string;
      payment_status?: string;
      metadata?: { userId?: string };
    };
    if (!object.id || object.currency !== "usd") {
      return null;
    }
    switch (event.type) {
      // A card pays at once; a bank debit completes later with async_payment_succeeded.
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (object.payment_status !== "paid" || !object.client_reference_id) {
          return null;
        }
        const amountMicros = Number(object.amount_total ?? 0) * MICROS_PER_CENT;
        return { kind: "topup", userId: object.client_reference_id, amountMicros, key: `topup:${object.id}` };
      }
      // `amount_refunded` is the running total, so each partial refund takes back only what's new.
      case "charge.refunded": {
        const userId = object.metadata?.userId;
        if (!userId) {
          return null;
        }
        const total = Number(object.amount_refunded ?? 0) * MICROS_PER_CENT;
        const amountMicros = -(total - (await refundedMicros(sql, userId, object.id)));
        return { kind: "adjust", userId, amountMicros: Math.min(0, amountMicros), key: `refund:${object.id}:${total}` };
      }
      case "charge.dispute.created":
      case "charge.dispute.funds_reinstated": {
        const userId = object.charge && services.payments ? await services.payments.chargeOwner(object.charge) : null;
        if (!userId) {
          logger.warn("A dispute for a charge with no account", { stripeEventId: event.id });
          return null;
        }
        const reinstated = event.type === "charge.dispute.funds_reinstated";
        const amountMicros = Number(object.amount ?? 0) * MICROS_PER_CENT * (reinstated ? 1 : -1);
        return { kind: "adjust", userId, amountMicros, key: `${reinstated ? "reinstated" : "dispute"}:${object.id}` };
      }
      default:
        return null;
    }
  }

  /** Vercel Cron, hourly: deletes everything past its retention. */
  async function purgeRoute(request: Request): Promise<Response> {
    const secret = secretOf(readEnv(), "CRON_SECRET");
    const given = request.headers.get("authorization")?.replace(/^Bearer\s+/, "") ?? "";
    if (!secret || !sameSecret(given, secret)) {
      return json({ error: "Unauthorized." }, 401);
    }
    const deleted = await purgeExpired(sql);
    logger.info("Purged expired records", deleted);
    return json({ deleted });
  }

  /** For uptime checks and the deploy smoke test: the function runs and the database answers. */
  async function readyRoute(): Promise<Response> {
    try {
      await sql.all("SELECT 1", []);
      return json({ ready: true, version: APP_VERSION });
    } catch (error) {
      logger.error("Readiness check failed", { cause: serializeError(error) });
      return json({ ready: false }, 503);
    }
  }

  /** Server to server: JSON or a form body, like Turnstile's siteverify. */
  async function siteverifyRoute(request: Request): Promise<Response> {
    const type = request.headers.get("content-type")?.toLowerCase() ?? "";
    const bytes = await boundedBytes(request, JSON_BODY_LIMIT);
    const text = new TextDecoder().decode(bytes);
    let body: Record<string, unknown> = {};
    try {
      body = type.startsWith("application/json")
        ? (JSON.parse(text) as Record<string, unknown>)
        : Object.fromEntries(new URLSearchParams(text));
    } catch {
      return json({ success: false, "error-codes": ["bad-request"] }, 400);
    }
    // Per network, and per secret, so neither guessing tokens nor guessing secrets scales.
    const throttled = await limited([
      [LIMITS.siteverifyPerIp, ipHash(request)],
      [LIMITS.siteverifyPerSecret, hashKey(challengeSecret, String(body.secret ?? ""))],
    ]);
    if (throttled) {
      return throttled;
    }
    const result = await siteverify(
      { adapter: await adapterOf(auth), sql, database: auth.options.database, sendEmail: services.sendEmail, origin },
      body,
    );
    noteRequest({ verified: result.success, ...(result.success ? { assurance: result.assurance } : {}) });
    return json(result, result.success ? 200 : 400);
  }

  /** The home page's live demo: siteverify for BotRepel's own demo site, so visitors see a real response. */
  async function demoVerify(request: Request): Promise<Response> {
    const refused = await widgetGuard(request);
    if (refused) {
      return refused;
    }
    const secret = readEnv().DEMO_SECRET_KEY;
    if (!secret) {
      return json({ error: "The demo isn't set up on this server." }, 503);
    }
    let token: unknown;
    try {
      token = (
        JSON.parse(new TextDecoder().decode(await boundedBytes(request, JSON_BODY_LIMIT))) as { token?: unknown }
      ).token;
    } catch {
      return json({ error: "Send the widget token as JSON." }, 400);
    }
    const result = await siteverify(
      { adapter: await adapterOf(auth), sql, database: auth.options.database, sendEmail: services.sendEmail, origin },
      { secret, response: token },
    );
    return json(result, result.success ? 200 : 400);
  }

  /** /v1/cli/* takes only a scoped CLI token (`br_cli_…`); sessions and cookies don't count here. */
  async function bearerCaller(request: Request): Promise<Caller | Response> {
    const header = request.headers.get("authorization") ?? "";
    if (!header.startsWith("Bearer ")) {
      return json({ error: "Sign in with `npx botrepel login`." }, 401, { "WWW-Authenticate": "Bearer" });
    }
    const userId = await cliTokenOwner(sql, header.slice("Bearer ".length).trim());
    if (!userId) {
      return json({ error: "Your CLI sign-in expired. Run `npx botrepel login`." }, 401, {
        "WWW-Authenticate": "Bearer",
      });
    }
    noteRequest({ userId });
    return (await limited([[LIMITS.cliPerCaller, userId]])) ?? { userId, via: "bearer", admin: false };
  }

  /**
   * The device flow ends with a full session token; the CLI trades it here for a scoped CLI token,
   * and the session is revoked, so nothing account-wide is left on the developer's disk.
   */
  async function cliTokenExchange(request: Request): Promise<Response> {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session || !request.headers.get("authorization")?.startsWith("Bearer ")) {
      return json({ error: "Sign in again with `npx botrepel login`." }, 401);
    }
    const token = await issueCliToken(await adapterOf(auth), session.user.id);
    await sql.all(`DELETE FROM "session" WHERE "id" = ?`, [session.session.id]);
    return json({ token }, 201);
  }

  async function cliSitesList(request: Request): Promise<Response> {
    const caller = await bearerCaller(request);
    return caller instanceof Response ? caller : json({ sites: await listSites(await adapterOf(auth), caller.userId) });
  }

  async function cliSitesEnsure(request: Request): Promise<Response> {
    const caller = await bearerCaller(request);
    if (caller instanceof Response) {
      return caller;
    }
    const input = validate(CreateSiteSchema, await boundedJson(request, JSON_BODY_LIMIT));
    if (!input.success) {
      return json({ error: "Check the arguments.", fields: input.error }, 400);
    }
    const result = await ensureSite(await adapterOf(auth), caller.userId, input.data);
    return result.success ? json(result.data, result.data.created ? 201 : 200) : reply(result);
  }

  async function cliSitesRotate(request: Request, match: RegExpMatchArray): Promise<Response> {
    const caller = await bearerCaller(request);
    return caller instanceof Response
      ? caller
      : reply(await rotateForCli(await adapterOf(auth), caller.userId, match[1]!));
  }

  async function widgetPage(request: Request, match: RegExpMatchArray): Promise<Response> {
    const site = await siteByKey(await adapterOf(auth), match[1]!);
    if (!site) {
      return new Response("Unknown site key.", {
        status: 404,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    // The Referer names the framing page; the query's origin is only a fallback when the page sends none.
    const queried = new URL(request.url).searchParams.get("origin");
    const host = embedderHost(request) ?? (queried ? safeHostname(queried) : null);
    if (!host || !hostnameAllowed(domainsOf(site), host)) {
      return new Response("This page isn't allowed to show this widget.", {
        status: 403,
        headers: { ...widgetHeaders(site), "Content-Type": "text/plain; charset=utf-8" },
      });
    }
    const ticket = issueEmbedTicket(challengeSecret, site.id, host);
    const page = (await widgetShell()).replace("</head>", `<meta name="botrepel-ticket" content="${ticket}"></head>`);
    return new Response(request.method === "HEAD" ? null : page, { headers: widgetHeaders(site) });
  }

  /** The session cookie, or the CLI's `Authorization: Bearer` session token (Better Auth's bearer plugin). */
  async function callerOf(request: Request): Promise<Caller | null> {
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session) {
      return null;
    }
    noteRequest({ userId: session.user.id });
    const via = request.headers.get("authorization")?.startsWith("Bearer ") ? "bearer" : "session";
    return {
      userId: session.user.id,
      via,
      admin:
        via === "session" &&
        session.user.emailVerified &&
        adminEmails(readEnv()).includes(session.user.email.toLowerCase()),
    };
  }

  /** tRPC is for the dashboard only: same-origin JSON, so a cross-site form can't act with the cookie. */
  function sameOriginJson(request: Request): Response | null {
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
      return json({ error: "Send a JSON body with Content-Type: application/json." }, 415);
    }
    const requestOrigin = request.headers.get("origin");
    if (requestOrigin && requestOrigin !== origin && !auth.options.trustedOrigins?.includes(requestOrigin)) {
      return json({ error: "Cross-site request refused." }, 403);
    }
    return null;
  }

  async function rpc(request: Request): Promise<Response> {
    const refused = sameOriginJson(request) ?? (await limited([[LIMITS.rpcPerCaller, ipHash(request)]]));
    if (refused) {
      return refused;
    }
    const req = new Request(request, { body: await boundedBytes(request, JSON_BODY_LIMIT) });
    return fetchRequestHandler({
      endpoint: "/api/trpc",
      req,
      router: appRouter,
      allowMethodOverride: true,
      maxBatchSize: RPC_MAX_BATCH_SIZE,
      createContext: async ({ resHeaders }): Promise<RpcContext> => ({
        request,
        responseHeaders: resHeaders,
        caller: await callerOf(request),
        adapter: await adapterOf(auth),
        sql,
        origin,
        sendEmail: services.sendEmail,
        loginMethods: auth.loginMethods,
        payments: services.payments ?? null,
      }),
      responseMeta: ({ errors }) => ({ headers: rpcResponseHeaders(errors) }),
      onError: ({ error, path: procedure }) => {
        if (error.code === "INTERNAL_SERVER_ERROR") {
          logger.error("Unexpected RPC failure", { procedure, cause: serializeError(error.cause ?? error) });
        }
      },
    });
  }

  async function authHandler(request: Request): Promise<Response> {
    const body = request.body ? await boundedBytes(request, JSON_BODY_LIMIT) : null;
    return auth.handler(body ? new Request(request, { body }) : request);
  }

  const routes: readonly Route[] = [
    { pattern: /^\/api\/version$/, methods: { GET: async () => json({ version: APP_VERSION }) } },
    { pattern: /^\/api\/ready$/, methods: { GET: readyRoute } },
    { pattern: /^\/api\/auth(?:\/.*)?$/, any: authHandler },
    { pattern: /^\/api\/trpc(?:\/.*)?$/, methods: { POST: rpc } },
    { pattern: /^\/v1\/challenge\/start$/, methods: { POST: challengeStart } },
    { pattern: /^\/v1\/challenge\/invisible$/, methods: { POST: challengeInvisible } },
    { pattern: /^\/v1\/liveness\/start$/, methods: { POST: livenessStart } },
    { pattern: /^\/v1\/liveness\/submit$/, methods: { POST: livenessSubmit } },
    { pattern: /^\/v1\/liveness\/pose$/, methods: { POST: livenessPose } },
    { pattern: /^\/v1\/presence\/options$/, methods: { POST: presenceOptionsRoute } },
    { pattern: /^\/v1\/presence\/verify$/, methods: { POST: presenceVerifyRoute } },
    { pattern: /^\/v1\/pass\/register\/options$/, methods: { POST: passOptionsRoute } },
    { pattern: /^\/v1\/pass\/register\/verify$/, methods: { POST: passRegisterRoute } },
    { pattern: /^\/v1\/feedback$/, methods: { POST: feedbackRoute } },
    { pattern: /^\/v1\/siteverify$/, methods: { POST: siteverifyRoute } },
    { pattern: /^\/api\/demo\/verify$/, methods: { POST: demoVerify } },
    { pattern: /^\/v1\/stripe\/webhook$/, methods: { POST: stripeWebhook } },
    { pattern: /^\/api\/cron\/purge$/, methods: { GET: purgeRoute } },
    { pattern: /^\/v1\/cli\/token$/, methods: { POST: cliTokenExchange } },
    { pattern: /^\/v1\/cli\/sites$/, methods: { GET: cliSitesList, POST: cliSitesEnsure } },
    { pattern: /^\/v1\/cli\/sites\/([^/]+)\/rotate$/, methods: { POST: cliSitesRotate } },
    { pattern: /^\/w\/(br_pk_[A-Za-z0-9]{16})$/, methods: { GET: widgetPage, HEAD: widgetPage } },
  ];

  return async (request) => {
    const pathname = new URL(request.url).pathname.replace(/\/+$/, "") || "/";
    for (const route of routes) {
      const match = pathname.match(route.pattern);
      if (!match) {
        continue;
      }
      if (route.any) {
        return route.any(request, match);
      }
      const handler = route.methods?.[request.method];
      return handler ? handler(request, match) : methodNotAllowed(Object.keys(route.methods ?? {}).join(", "));
    }
    return json({ error: "Not found." }, 404);
  };
}

/** One summary line per request, `METHOD /path STATUS`, and a request id on every response. */
export function withRequestId(handler: ApiHandler): ApiHandler {
  return (request) =>
    withRequestNotes(async () => {
      const requestId = crypto.randomUUID();
      noteRequest({ requestId });
      const started = performance.now();
      const { pathname } = new URL(request.url);
      const line = (status: number, error: string | null): LogAttributes => ({
        method: request.method,
        path: pathname,
        status,
        ms: Math.round(performance.now() - started),
        ...requestNotes(),
        ...(error ? { error } : {}),
      });
      let response: Response;
      try {
        response = await handler(request);
      } catch (error) {
        if (error instanceof RequestBodyError) {
          response = json({ error: error.message }, error.status);
        } else if (error instanceof URIError) {
          response = json({ error: "The URL is not encoded correctly." }, 400);
        } else {
          logger.error(`${request.method} ${pathname} 500`, { ...line(500, null), cause: serializeError(error) });
          return json({ error: UNEXPECTED_ERROR_MESSAGE, requestId }, 500, { "x-request-id": requestId });
        }
      }
      try {
        response.headers.set("x-request-id", requestId);
      } catch {
        // Fetch and redirect responses can have immutable headers.
      }
      const attributes = line(response.status, await errorOf(response));
      const message = `${request.method} ${pathname} ${response.status}`;
      if (response.status >= 500) {
        logger.error(message, attributes);
      } else if (response.status >= 400) {
        logger.warn(message, attributes);
      } else {
        logger.info(message, attributes);
      }
      return response;
    });
}

/** Builds auth and the API from the environment. */
export function apiFromEnv(): { auth: Auth; api: ApiHandler } {
  const env = readEnv();
  if (!authOrigin(env)) {
    throw new Error("Set SITE_URL or BETTER_AUTH_URL.");
  }
  const sendEmail = emailSender(env);
  const auth = createAuth(undefined, { sendEmail });
  const payments = env.STRIPE_SECRET_KEY ? stripePayments(env.STRIPE_SECRET_KEY) : null;
  return {
    auth,
    api: createApi(auth, { sendEmail, payments, stripeWebhookSecret: env.STRIPE_WEBHOOK_SECRET ?? null }),
  };
}

let api: ApiHandler | undefined;

/** The process-wide handler, built on first use; a failure while building is retried on the next request. */
export function handleApi(request: Request): Promise<Response> {
  if (!api) {
    try {
      api = withRequestId(apiFromEnv().api);
    } catch (error) {
      logger.error("Could not start the API", { cause: serializeError(error) });
      return Promise.resolve(json({ error: UNEXPECTED_ERROR_MESSAGE }, 500));
    }
  }
  return api(request);
}
