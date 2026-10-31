import { NO_STORE_HEADERS } from "../src/shared/constants";

/** A JSON response that is never cached, plus any extra headers. */
export function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(body, { status, headers: { ...NO_STORE_HEADERS, ...headers } });
}

export function methodNotAllowed(allow: string): Response {
  return new Response(null, { status: 405, headers: { Allow: allow, ...NO_STORE_HEADERS } });
}
