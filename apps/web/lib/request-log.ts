import { AsyncLocalStorage } from "node:async_hooks";
import type { LogAttributes } from "./logger";

/** Ids and short reasons only: never emails, names, query strings, or request bodies. */
const notes = new AsyncLocalStorage<LogAttributes>();
const diagnostics = new AsyncLocalStorage<{ exception?: unknown }>();

export function withRequestNotes<T>(work: () => Promise<T>): Promise<T> {
  return notes.run({}, () => diagnostics.run({}, work));
}

export function noteException(exception: unknown): void {
  const current = diagnostics.getStore();
  if (current) {
    current.exception = exception;
  }
}

export function requestException(): unknown {
  return diagnostics.getStore()?.exception;
}

/** Does nothing outside a request. */
export function noteRequest(attributes: LogAttributes): void {
  const current = notes.getStore();
  if (current) {
    Object.assign(current, attributes);
  }
}

export function requestNotes(): LogAttributes {
  return { ...notes.getStore() };
}

const MAX_ERROR_LENGTH = 300;

/** Reads a clone, so the caller still gets the body. */
export async function errorOf(response: Response): Promise<string | null> {
  if (response.status < 400 || !response.headers.get("content-type")?.includes("json")) {
    return null;
  }
  try {
    const body = (await response.clone().json()) as {
      error?: unknown;
      message?: unknown;
      code?: unknown;
      fields?: Record<string, unknown>;
    };
    const reason = [body.error, body.message, body.code].find((value) => typeof value === "string");
    if (typeof reason !== "string") {
      return null;
    }
    const details = body.fields && typeof body.fields === "object" ? Object.values(body.fields).join(" ") : "";
    return `${reason}${details ? ` ${details}` : ""}`.slice(0, MAX_ERROR_LENGTH);
  } catch {
    return null;
  }
}
