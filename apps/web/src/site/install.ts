import botrepelPackage from "../../../../packages/botrepel/package.json";
import { GUIDE_IDS, guideFor, guideMarkdown } from "../../../../packages/botrepel/src/cli/guides";
import { SITE_NAME, SITE_ORIGIN, agentPrompt } from "../shared/constants";
import { FREE_CREDIT_MICROS, PRICE_MICROS, formatDollars } from "../shared/pricing";
import { absolute } from "../shared/utils";

/** A local server's checkout, so agents install the CLI and package from source instead of npm. */
export interface LocalPackages {
  /** The command that builds and packs the package. */
  readonly pack: string;
  readonly cli: string;
  readonly tarball: string;
}

/**
 * The page the agent prompt points to. Written for coding agents: exact commands with pinned
 * versions, what to edit, and what never to do. The CLI does the account and key work.
 */
export function installMarkdown(origin: string, local?: LocalPackages): string {
  const site = origin || SITE_ORIGIN;
  const custom = site !== SITE_ORIGIN;
  const cli = local ? `bun ${local.cli}` : `npx --yes botrepel@${botrepelPackage.version}`;
  const api = custom ? ` --api ${site}` : "";
  const run = local
    ? `This is a local ${SITE_NAME} server at ${site}, and its package isn't on npm. Run these from the
project root, in order:

\`\`\`sh
${local.pack}
${cli} init${api} --no-install --domain <production-domain>
\`\`\`

Then add the tarball with the project's package manager, for example \`npm install ${local.tarball}\`.`
    : `From the project root:

\`\`\`sh
${cli} init${api} --domain <production-domain>
\`\`\``;
  const installs = local
    ? "The package comes from the tarball above, so the CLI doesn't install it."
    : `It installs \`botrepel@${botrepelPackage.version}\`, the one package for the widget, server checks, and auth integrations.`;
  const context = {
    siteKey: "/* the site key variable the CLI printed */",
    apiOrigin: custom ? site : undefined,
    cli: local ? `bun ${local.cli}` : "npx botrepel",
  };
  const guides = GUIDE_IDS.map((id) => guideMarkdown(guideFor(id, context))).join("\n\n");
  return `# Install ${SITE_NAME}

${SITE_NAME} adds human verification to a web app's sign-up, login, and other forms. For most people,
the check is invisible, while others use one tap with a Human Pass or a camera check with a
two-second color sequence and a head roll. As the coding agent adding it to the project in the
current directory, follow these steps in order.

## 1. Run the CLI

${run}

- Use the app's production domain if you can find it (in its README, deployment config, or
  existing environment variables). You can omit \`--domain\` if you can't find it, and localhost is always allowed.
- The first run prints a sign-in URL and code, opens the browser, and **waits up to 10 minutes**
  while the person approves. **Show them the URL and code**, ask them to sign in and click Allow,
  and keep the command running. Signing in with GitHub or Google adds ${formatDollars(FREE_CREDIT_MICROS, 0)}
  of free usage to a new account.
- If your shell can't wait that long, run \`${cli} login${api}\` first, then \`init\`.
- The CLI writes \`BOTREPEL_SECRET_KEY\` and the public site key to the framework's env file and
  adds that file to \`.gitignore\`. ${installs}
- It detects the auth library (Better Auth, Auth.js, Auth0, Clerk, Supabase) and prints the steps
  for it, with this project's variable names. \`--json\` returns them as \`guides\`.
- Rerunning is safe. If it says the project has no secret key, rerun with \`--rotate-secret\`.

## 2. Wire it up

Follow the steps the CLI printed, starting with its auth library's section below, then "Any form" for other
forms bots abuse (contact, comments). Use the same \`action\` on the widget and the server. In
Next.js, the widget must be in a client component (\`"use client"\`).

${guides}

- Each token verifies **once**, within five minutes, so verify it exactly once per submission.
- \`result.assurance\` says whether the token proved \`invisible\`, \`presence\` (Human Pass), or \`liveness\`.
  Pass \`minAssurance\` to require more for sensitive actions.

## Rules

- Never expose \`BOTREPEL_SECRET_KEY\` to browser code, logs, or commits.
- Don't disable or bypass verification in production code paths. A test may mock \`verify\`.
- Don't ask the person for their BotRepel password, because there isn't one and they sign in in the browser.
- Add any new required environment variable to the project's example env file and deployment config,
  with a placeholder value, not the real secret.

## Finish

Run the app and submit a protected form once, checking that it succeeds with the widget and fails without it.
Tell the person what you changed, and that checks per action and usage are at ${absolute(site, "/dashboard")}.

Each verification costs ${formatDollars(PRICE_MICROS.invisible, 4)} for invisible, ${formatDollars(PRICE_MICROS.presence, 3)} for Human Pass,
or ${formatDollars(PRICE_MICROS.liveness, 2)} for liveness, and you're charged only when the server verifies a token.
`;
}

export function llmsText(origin: string): string {
  const site = origin || SITE_ORIGIN;
  return `# ${SITE_NAME}

> Make the internet human again. BotRepel provides human verification for websites, with an invisible check for most people, while others use one tap with a Human Pass or a camera check with a two-second color sequence and a head roll.

To add ${SITE_NAME} to your app, paste this into your coding agent:

"${agentPrompt(site)}"

## Docs

- [Install with a coding agent](${absolute(site, "/install.md")}): the CLI, the widget, server verification, and Better Auth, Auth.js, Auth0, Clerk, and Supabase setups
- [Docs](${absolute(site, "/docs")}): widget props, siteverify fields, error codes, assurance levels, and the security model
- [Dashboard](${absolute(site, "/dashboard")}): sites, keys, checks per action, usage

## API

- POST ${absolute(site, "/v1/siteverify")}: \`{ secret, response }\` (JSON or form). Turnstile-compatible fields, plus \`assurance\`, \`unpaid\`, and \`pseudonym\`.
`;
}
