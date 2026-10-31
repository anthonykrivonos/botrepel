import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { DEFAULT_API_ORIGIN } from "@botrepel/protocol";
import { loadToken, saveToken } from "./credentials";
import { detectProject, type Project } from "./detect";
import { CliError, deviceLogin } from "./device-login";
import { ensureIgnored, parseEnv, upsertEnv } from "./env-file";
import type { Guide } from "./guides";
import type { Io } from "./io";
import { guideContext, nextSteps, projectGuides } from "./snippets";

export interface InitOptions {
  readonly apiOrigin: string;
  readonly name?: string;
  /** Production domains; localhost is always added for development. */
  readonly domains: readonly string[];
  readonly rotateSecret: boolean;
  readonly install: boolean;
  readonly json: boolean;
}

interface SiteResponse {
  readonly site: {
    readonly id: string;
    readonly name: string;
    readonly siteKey: string;
    readonly secretPrefix: string;
    readonly domains: readonly string[];
  };
  readonly secretKey: string | null;
  readonly created: boolean;
}

export interface InitResult {
  readonly site: SiteResponse["site"];
  readonly created: boolean;
  readonly envFile: string;
  readonly wroteSecret: boolean;
  readonly secretMissing: boolean;
  readonly installed: boolean;
  readonly project: Project;
  /** What to wire up, for coding agents reading `--json`. */
  readonly guides: readonly Guide[];
}

async function api<T>(
  io: Io,
  origin: string,
  token: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; data: T }> {
  const response = await io.fetch(new URL(path, origin), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as T & { error?: string; fields?: Record<string, string> };
  if (response.status >= 400 && response.status !== 401) {
    const details = data.fields ? ` ${Object.values(data.fields).join(" ")}` : "";
    throw new CliError(`${data.error ?? `BotRepel answered ${response.status}`}${details}`);
  }
  return { status: response.status, data };
}

/** A saved token that still works, or a new one from the device flow. */
export async function signedIn(io: Io, origin: string): Promise<string> {
  const saved = await loadToken(io, origin);
  if (saved && (await api(io, origin, saved, "/v1/cli/sites")).status !== 401) {
    return saved;
  }
  const session = await deviceLogin(io, origin);
  // Trade the account session for a token that only works on the CLI's own endpoints.
  const exchanged = await io.fetch(new URL("/v1/cli/token", origin), {
    method: "POST",
    headers: { Authorization: `Bearer ${session}` },
  });
  if (!exchanged.ok) {
    throw new CliError(`Couldn't finish signing in (${exchanged.status}). Run the command again.`);
  }
  const { token } = (await exchanged.json()) as { token: string };
  await saveToken(io, origin, token);
  io.print("Signed in.");
  return token;
}

/**
 * `botrepel init`: sign in, create (or find) this project's site, write its keys to the env file,
 * install the package, and print what to wire up for the project's auth library. Safe to rerun.
 */
export async function init(io: Io, options: InitOptions): Promise<InitResult> {
  const project = await detectProject(io);
  const token = await signedIn(io, options.apiOrigin);
  const name = options.name ?? project.name;
  const { data } = await api<SiteResponse>(io, options.apiOrigin, token, "/v1/cli/sites", {
    name,
    domains: ["localhost", ...options.domains],
  });

  const siteKeyVar = `${project.publicPrefix}BOTREPEL_SITE_KEY`;
  const existing = parseEnv(await readFile(join(io.cwd, project.envFile), "utf8").catch(() => ""));
  const savedSecret = existing.get("BOTREPEL_SECRET_KEY");
  let secret = data.secretKey;
  // The site already existed: keep the secret this project has, or rotate only when asked, since
  // rotating starts a 24-hour countdown for every other deployment using the old one.
  if (!secret && options.rotateSecret) {
    secret = (await api<SiteResponse>(io, options.apiOrigin, token, `/v1/cli/sites/${data.site.id}/rotate`, {})).data
      .secretKey;
  }
  const keepsSecret = Boolean(savedSecret?.startsWith(data.site.secretPrefix));
  await upsertEnv(io.cwd, project.envFile, {
    [siteKeyVar]: data.site.siteKey,
    ...(secret ? { BOTREPEL_SECRET_KEY: secret } : {}),
  });
  const ignoredNow = await ensureIgnored(io.cwd, project.envFile);

  let installed = false;
  if (options.install && project.hasPackageJson) {
    const command = project.packageManager === "npm" ? ["install"] : ["add"];
    io.print(`Installing botrepel with ${project.packageManager}…`);
    installed = (await io.run(project.packageManager, [...command, "botrepel"])) === 0;
    if (!installed) {
      io.print(`Install failed. Run: ${project.packageManager} ${command.join(" ")} botrepel`);
    }
  }

  const secretMissing = !secret && !keepsSecret;
  const result: InitResult = {
    site: data.site,
    created: data.created,
    envFile: project.envFile,
    wroteSecret: Boolean(secret),
    secretMissing,
    installed,
    project,
    guides: projectGuides(project, guideContext(project, options.apiOrigin, DEFAULT_API_ORIGIN)),
  };
  if (options.json) {
    io.print(JSON.stringify(result));
    return result;
  }
  io.print("");
  io.print(`${data.created ? "Created" : "Using"} site "${data.site.name}" (${data.site.domains.join(", ")}).`);
  io.print(
    `Wrote ${siteKeyVar}${secret ? " and BOTREPEL_SECRET_KEY" : ""} to ${project.envFile}${ignoredNow ? " and added it to .gitignore" : ""}.`,
  );
  if (secretMissing) {
    io.print(
      `This project has no secret key for the site. Run again with --rotate-secret to issue a new one (the old one keeps working for 24 hours).`,
    );
  }
  if (options.domains.length === 0) {
    io.print(
      "Only localhost is allowed so far. Add your production domain with --domain example.com or in the dashboard.",
    );
  }
  io.print("");
  io.print(nextSteps(project, options.apiOrigin, DEFAULT_API_ORIGIN));
  return result;
}
