import type { Io } from "./io";

export const CLI_CLIENT_ID = "botrepel-cli";
const GRANT_TYPE = "urn:ietf:params:oauth:grant-type:device_code";
/** RFC 8628: on slow_down, poll this much less often. */
const SLOW_DOWN_SECONDS = 5;

interface DeviceCode {
  readonly device_code: string;
  readonly user_code: string;
  readonly verification_uri: string;
  readonly verification_uri_complete?: string;
  readonly expires_in: number;
  readonly interval: number;
}

export class CliError extends Error {
  public constructor(
    message: string,
    public readonly exitCode = 1,
  ) {
    super(message);
  }
}

/**
 * RFC 8628 device authorization: print a URL and code, open the browser, and wait while the
 * person signs in and approves. Works for coding agents too, which relay the URL.
 */
export async function deviceLogin(io: Io, origin: string): Promise<string> {
  const response = await io.fetch(new URL("/api/auth/device/code", origin), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: CLI_CLIENT_ID }),
  });
  if (!response.ok) {
    throw new CliError(`Couldn't start sign-in (${response.status}). Is ${origin} reachable?`);
  }
  const code = (await response.json()) as DeviceCode;
  const url = new URL(code.verification_uri_complete ?? code.verification_uri, origin).toString();
  io.print("");
  io.print("Sign in to BotRepel to continue. New accounts get $5 of free usage.");
  io.print(`  Open:  ${url}`);
  // Hyphenated as the /device page shows it, so the person can match the two at a glance.
  io.print(`  Code:  ${code.user_code.replace(/^(.{4})(.+)$/, "$1-$2")}`);
  io.print("");
  io.print("Waiting for your approval in the browser…");
  io.openUrl(url);

  let interval = code.interval;
  const deadline = Date.now() + code.expires_in * 1000;
  while (Date.now() < deadline) {
    await io.sleep(interval * 1000);
    const poll = await io.fetch(new URL("/api/auth/device/token", origin), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grant_type: GRANT_TYPE, device_code: code.device_code, client_id: CLI_CLIENT_ID }),
    });
    const body = (await poll.json()) as { access_token?: string; error?: string };
    if (body.access_token) {
      return body.access_token;
    }
    if (body.error === "slow_down") {
      interval += SLOW_DOWN_SECONDS;
    } else if (body.error === "access_denied") {
      throw new CliError("Sign-in was denied in the browser.", 2);
    } else if (body.error === "expired_token") {
      break;
    } else if (body.error !== "authorization_pending") {
      throw new CliError(`Sign-in failed: ${body.error ?? poll.status}.`);
    }
  }
  throw new CliError("The sign-in code expired. Run the command again.", 3);
}
