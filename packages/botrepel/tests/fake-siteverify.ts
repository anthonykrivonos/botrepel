import type { SiteverifyResponse } from "@botrepel/protocol";

/**
 * A stand-in for POST /v1/siteverify: a token `pass:<action>[:<any>]` succeeds once for that action;
 * anything else fails. Records each secret it was called with.
 */
export function fakeSiteverify(): { fetch: typeof fetch; secrets: string[]; calls: () => number } {
  const used = new Set<string>();
  const secrets: string[] = [];
  const fake = async (_url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const { secret, response } = JSON.parse(String(init?.body)) as { secret: string; response: string };
    secrets.push(secret);
    const [kind, action] = response.split(":");
    const body: SiteverifyResponse =
      kind === "pass" && !used.has(response)
        ? { success: true, action, hostname: "app.example", assurance: "invisible", "error-codes": [] }
        : { success: false, "error-codes": ["timeout-or-duplicate"] };
    used.add(response);
    return Response.json(body);
  };
  return { fetch: fake as typeof fetch, secrets, calls: () => secrets.length };
}
