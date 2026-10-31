import { initTRPC, TRPCError } from "@trpc/server";
import type { DBAdapter } from "better-auth";
import { ZodError } from "zod";
import { NO_STORE_HEADERS, UNEXPECTED_ERROR_MESSAGE } from "../../src/shared/constants";
import type { DomainError, DomainResult, ErrorStatus, FieldErrors } from "../../src/shared/result";
import type { Auth } from "../auth";
import type { Caller } from "../caller";
import type { Sql } from "../db";
import type { SendEmail } from "../email";
import { noteRequest, requestNotes } from "../request-log";
import type { Payments } from "../stripe";

export interface RpcContext {
  readonly request: Request;
  readonly responseHeaders: Headers;
  readonly caller: Caller | null;
  readonly adapter: DBAdapter;
  readonly sql: Sql;
  readonly origin: string;
  readonly sendEmail: SendEmail | null;
  readonly loginMethods: Auth["loginMethods"];
  readonly payments: Payments | null;
}

const statusCodes = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  410: "NOT_FOUND",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  429: "TOO_MANY_REQUESTS",
  502: "BAD_GATEWAY",
  503: "SERVICE_UNAVAILABLE",
} as const satisfies Record<ErrorStatus, TRPCError["code"]>;

class RpcDomainError extends Error {
  public constructor(public readonly details: DomainError) {
    super(details.message);
  }
}

export function rpcResponseHeaders(errors: readonly TRPCError[]): Record<string, string> {
  const retryAfter = errors.reduce<number | undefined>((longest, error) => {
    const delay = error.cause instanceof RpcDomainError ? error.cause.details.retryAfter : undefined;
    return delay === undefined ? longest : Math.max(longest ?? 0, delay);
  }, undefined);
  return {
    ...NO_STORE_HEADERS,
    ...(retryAfter === undefined ? {} : { "Retry-After": String(retryAfter) }),
  };
}

/** Turns a domain failure into the matching tRPC error, keeping its fields for the form. */
export function unwrap<T>(result: DomainResult<T>): T {
  if (result.success) {
    return result.data;
  }
  throw new TRPCError({
    code: statusCodes[result.error.status],
    message: result.error.message,
    cause: new RpcDomainError(result.error),
  });
}

function validationFields(error: ZodError): FieldErrors {
  const fields: FieldErrors = {};
  for (const issue of error.issues) {
    fields[String(issue.path[0] ?? "form")] ??= issue.message;
  }
  return fields;
}

const t = initTRPC.context<RpcContext>().create({
  errorFormatter({ shape, error }) {
    const domain = error.cause instanceof RpcDomainError ? error.cause.details : null;
    const validation = error.cause instanceof ZodError ? error.cause : null;
    return {
      code: shape.code,
      message:
        error.code === "INTERNAL_SERVER_ERROR"
          ? UNEXPECTED_ERROR_MESSAGE
          : (validation?.issues[0]?.message ?? shape.message),
      data: {
        code: shape.data.code,
        httpStatus: domain?.status ?? shape.data.httpStatus,
        fields: domain?.fields ?? (validation ? validationFields(validation) : undefined),
        retryAfter: domain?.retryAfter,
        requestId: String(requestNotes().requestId ?? ""),
      },
    };
  },
});

export const router = t.router;

export const publicProcedure = t.procedure.use(({ path, next }) => {
  noteRequest({ rpcProcedure: path });
  return next();
});

export const memberProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.caller) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Sign in to continue." });
  }
  return next({ ctx: { ...ctx, caller: ctx.caller } });
});

/** Operators only: a verified address on ADMIN_EMAILS, signed in with the dashboard cookie. */
export const adminProcedure = memberProcedure.use(({ ctx, next }) => {
  if (!ctx.caller.admin) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This page is for BotRepel operators." });
  }
  return next();
});
