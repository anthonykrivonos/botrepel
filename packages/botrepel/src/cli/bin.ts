import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { DEFAULT_API_ORIGIN } from "@botrepel/protocol";
import { auth0PartialHtml } from "../auth0";
import { forgetToken } from "./credentials";
import { CliError } from "./device-login";
import { init, signedIn } from "./init";
import type { Io } from "./io";

const HELP = `Usage: npx botrepel <command> [options]

Commands:
  init           Sign in, create a site for this project, write its keys, and install botrepel (default)
  login          Sign in to BotRepel
  logout         Forget this computer's BotRepel sign-in
  auth0-partial  Print the Universal Login partial for Auth0 (needs --login-origin and --action)

Options for init:
  --domain <host>     A production domain for the widget; repeat or separate with commas
  --name <name>       The site's name (default: package.json name)
  --rotate-secret     Issue a new secret key when this project has none
  --no-install        Don't install the botrepel package
  --json              Print a JSON summary instead of instructions
  --api <origin>      BotRepel server (default: $BOTREPEL_API_URL or ${DEFAULT_API_ORIGIN})

Options for auth0-partial:
  --login-origin <url>  Your Universal Login custom domain, e.g. https://login.example.com
  --action <action>     signup or login
  --site-key <key>      Default: BOTREPEL_SITE_KEY or NEXT_PUBLIC_BOTREPEL_SITE_KEY from the environment`;

function openUrl(url: string): void {
  const [command, ...args] =
    process.platform === "darwin"
      ? ["open", url]
      : process.platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];
  try {
    spawn(command!, args, { stdio: "ignore", detached: true })
      .on("error", () => undefined)
      .unref();
  } catch {
    // No browser here (SSH, CI, an agent's sandbox); the printed URL is enough.
  }
}

const io: Io = {
  fetch: globalThis.fetch,
  cwd: process.cwd(),
  home: homedir(),
  env: process.env,
  interactive: Boolean(process.stdout.isTTY),
  print: (line) => console.log(line),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  openUrl,
  run: (command, args) =>
    new Promise((resolve) => {
      const child = spawn(command, args, { cwd: process.cwd(), stdio: "inherit", shell: process.platform === "win32" });
      child.on("error", () => resolve(1));
      child.on("exit", (code) => resolve(code ?? 1));
    }),
};

function flagValues(args: readonly string[], name: string): string[] {
  const values: string[] = [];
  for (const [index, arg] of args.entries()) {
    if (arg === name && args[index + 1]) {
      values.push(...args[index + 1]!.split(","));
    } else if (arg.startsWith(`${name}=`)) {
      values.push(...arg.slice(name.length + 1).split(","));
    }
  }
  return values.map((value) => value.trim()).filter(Boolean);
}

async function main(args: readonly string[]): Promise<void> {
  const command = args[0] && !args[0].startsWith("-") ? args[0] : "init";
  if (args.includes("--help") || args.includes("-h") || command === "help") {
    io.print(HELP);
    return;
  }
  const apiOrigin = new URL(flagValues(args, "--api")[0] ?? io.env.BOTREPEL_API_URL ?? DEFAULT_API_ORIGIN).origin;
  switch (command) {
    case "init":
      await init(io, {
        apiOrigin,
        name: flagValues(args, "--name")[0],
        domains: flagValues(args, "--domain"),
        rotateSecret: args.includes("--rotate-secret"),
        install: !args.includes("--no-install"),
        json: args.includes("--json"),
      });
      return;
    case "login":
      await signedIn(io, apiOrigin);
      io.print("You're signed in.");
      return;
    case "auth0-partial": {
      const loginOrigin = flagValues(args, "--login-origin")[0];
      const action = flagValues(args, "--action")[0];
      const siteKey =
        flagValues(args, "--site-key")[0] ?? io.env.BOTREPEL_SITE_KEY ?? io.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY;
      if (!loginOrigin || !action || !siteKey) {
        throw new CliError(`auth0-partial needs --login-origin, --action, and a site key.\n\n${HELP}`);
      }
      io.print(auth0PartialHtml({ siteKey, loginOrigin, action, apiOrigin }));
      return;
    }
    case "logout":
      await forgetToken(io, apiOrigin);
      io.print("Signed out on this computer.");
      return;
    default:
      throw new CliError(`Unknown command "${command}".\n\n${HELP}`);
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(error instanceof CliError ? error.exitCode : 1);
});
