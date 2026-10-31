/**
 * How to wire BotRepel into each auth setup: the one source for `botrepel init`, install.md, and
 * the docs, so they never disagree.
 */

export type AuthLibrary = "better-auth" | "next-auth" | "auth0" | "clerk" | "supabase";
export type GuideId = AuthLibrary | "forms";

export interface GuideStep {
  readonly text: string;
  readonly code?: string;
  /** The file the code belongs in, as a hint. */
  readonly file?: string;
}

export interface Guide {
  readonly id: GuideId;
  readonly title: string;
  readonly steps: readonly GuideStep[];
}

export interface GuideContext {
  /** The expression for the public site key in this project, e.g. `process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!`. */
  readonly siteKey: string;
  /** Set only when not botrepel.com (local development, self-hosting). */
  readonly apiOrigin?: string;
  /** How to run the CLI here. Default `npx botrepel`. */
  readonly cli?: string;
}

/** Dependencies that identify each auth library, in the order guides are shown. */
const AUTH_PACKAGES: readonly [AuthLibrary, RegExp][] = [
  ["better-auth", /^better-auth$/],
  ["next-auth", /^(next-auth|@auth\/core|@auth\/nextjs)$/],
  ["auth0", /^(@auth0\/|auth0$)/],
  ["clerk", /^@clerk\//],
  ["supabase", /^@supabase\/(supabase-js|ssr|auth-helpers-)/],
];

export function authLibrariesOf(dependencies: Readonly<Record<string, string>>): AuthLibrary[] {
  const names = Object.keys(dependencies);
  return AUTH_PACKAGES.filter(([, pattern]) => names.some((name) => pattern.test(name))).map(([library]) => library);
}

export const GUIDE_IDS: readonly GuideId[] = ["better-auth", "next-auth", "auth0", "clerk", "supabase", "forms"];

export function guideFor(id: GuideId, context: GuideContext): Guide {
  const widgetProps = (action: string, spread = ""): string =>
    `siteKey={${context.siteKey}} action="${action}"${context.apiOrigin ? ` apiOrigin="${context.apiOrigin}"` : ""}${spread}`;
  const options = context.apiOrigin ? `{ apiOrigin: "${context.apiOrigin}" }` : "";
  const cli = context.cli ?? "npx botrepel";
  const api = context.apiOrigin ? ` --api ${context.apiOrigin}` : "";
  const optionLine = context.apiOrigin ? `\n  apiOrigin: "${context.apiOrigin}",` : "";

  switch (id) {
    case "better-auth":
      return {
        id,
        title: "Better Auth",
        steps: [
          {
            text: "Add the plugin to check email sign-up, sign-in, magic links, email OTPs, and password resets.",
            file: "auth.ts",
            code: `import { botrepel } from "botrepel/better-auth";

export const auth = betterAuth({
  // …
  plugins: [botrepel(${options})],
});`,
          },
          {
            text: 'Render the widget in each auth form and send its token with the call, using the matching action of "signup", "login", "magic-link", "email-otp", or "password-reset".',
            file: "a client component",
            code: `import { BotRepel, useBotRepel } from "botrepel/react";

const botrepel = useBotRepel();
// In the form:
<BotRepel ${widgetProps("login", " {...botrepel.props}")} />
// On submit:
const { error } = await authClient.signIn.email({ email, password, fetchOptions: { headers: botrepel.headers } });
if (error) botrepel.reset();`,
          },
          {
            text: 'If you call auth.api.* from a server action, pass the token along with headers: { "x-botrepel-response": token }.',
          },
        ],
      };
    case "next-auth":
      return {
        id,
        title: "Auth.js (NextAuth)",
        steps: [
          {
            text: "Wrap the route handlers so credentials and email (magic link) sign-ins need a token, while OAuth passes through.",
            file: "app/api/auth/[...nextauth]/route.ts",
            code: `import { withBotRepel } from "botrepel/next-auth";
import { handlers } from "@/auth";

export const { GET, POST } = withBotRepel(handlers${options ? `, ${options}` : ""});`,
          },
          {
            text: 'Render the widget in the sign-in form and pass the token to signIn, using the action "login" for credentials and "magic-link" for email.',
            file: "a client component",
            code: `import { BotRepel, useBotRepel } from "botrepel/react";

const botrepel = useBotRepel();
<BotRepel ${widgetProps("login", " {...botrepel.props}")} />
const result = await signIn("credentials", { email, password, "botrepel-response": botrepel.token, redirect: false });
if (result?.error) botrepel.reset(); // error === "BotRepel" when the check failed`,
          },
          {
            text: "Signing in from a server action skips the route handler, so verify there first:",
            code: `import { verifyToken } from "botrepel";

const check = await verifyToken(formData.get("botrepel-response") as string, { expectedAction: "login" });
if (!check.success) return { error: "Verification failed" };
await signIn("credentials", formData);`,
          },
        ],
      };
    case "auth0":
      return {
        id,
        title: "Auth0",
        steps: [
          {
            text: `Universal Login is hosted by Auth0, so the widget goes in a prompt partial and an Action checks the token. Partials need a custom domain and a page template, and you should first add the login domain to the site with ${cli} init${api} --domain login.example.com.`,
          },
          {
            text: "Print the partial for each prompt and set it as that prompt's form-content-end partial (Auth0 dashboard, or PUT /api/v2/prompts/{prompt}/partials):",
            code: `${cli} auth0-partial${api} --login-origin https://login.example.com --action signup  # signup-password
${cli} auth0-partial${api} --login-origin https://login.example.com --action login   # login-password`,
          },
          {
            text: "Add two Actions with the botrepel dependency and a BOTREPEL_SECRET_KEY secret:",
            code: `// Pre User Registration
const { botrepelPreUserRegistration } = require("botrepel/auth0");
exports.onExecutePreUserRegistration = (event, api) => botrepelPreUserRegistration(event, api${options ? `, ${options}` : ""});

// Post Login: checks password and passwordless logins; social logins and sessions pass through.
const { botrepelPostLogin } = require("botrepel/auth0");
exports.onExecutePostLogin = (event, api) => botrepelPostLogin(event, api${options ? `, ${options}` : ""});`,
          },
          {
            text: "Auth0 Bot Detection can't call BotRepel, so you can leave it on or off as you like. Password reset pages don't support partials.",
          },
        ],
      };
    case "clerk":
      return {
        id,
        title: "Clerk",
        steps: [
          {
            text: "Clerk's components talk to Clerk directly and accept no third-party token, so keep Clerk's bot protection for its sign-up. To use BotRepel, verify the token on your server before creating the account:",
            file: "app/api/sign-up/route.ts",
            code: `import { verifyRequest } from "botrepel";
import { clerkClient } from "@clerk/nextjs/server";

export async function POST(request: Request) {
  const check = await verifyRequest(request, { expectedAction: "signup" });
  if (!check.success) return new Response("Verification failed", { status: 403 });
  const { email, password } = await request.json();
  await (await clerkClient()).users.createUser({ emailAddress: [email], password });
  return new Response(null, { status: 201 });
}`,
          },
        ],
      };
    case "supabase":
      return {
        id,
        title: "Supabase Auth",
        steps: [
          {
            text: "Supabase Auth's CAPTCHA setting takes only hCaptcha or Turnstile, so send sign-ups through your server, verify the token, and then call Supabase from there:",
            file: "app/api/sign-up/route.ts",
            code: `import { verifyRequest } from "botrepel";

export async function POST(request: Request) {
  const check = await verifyRequest(request, { expectedAction: "signup" });
  if (!check.success) return new Response("Verification failed", { status: 403 });
  const { email, password } = await request.json();
  const { error } = await supabase.auth.signUp({ email, password }); // your server-side Supabase client
  return new Response(error?.message ?? null, { status: error ? 400 : 201 });
}`,
          },
        ],
      };
    case "forms":
      return {
        id,
        title: "Any form or custom auth",
        steps: [
          {
            text: "Render the widget inside the form. It adds a hidden botrepel-response field, so a native submission carries the token.",
            file: "the component that renders the form",
            code: `import { BotRepel } from "botrepel/react";

<BotRepel ${widgetProps("signup")} />`,
          },
          {
            text: "Verify before acting on the submission. You can use verifyRequest to read the field or the x-botrepel-response header, while verify takes the token itself.",
            file: "the route or server action that handles it",
            code: `import { verify } from "botrepel";

const result = await verify({
  secretKey: process.env.BOTREPEL_SECRET_KEY!,
  token: formData.get("botrepel-response") as string,
  expectedAction: "signup",${optionLine}
});
if (!result.success) {
  // Reject with 403 and keep the form's input.
}`,
          },
        ],
      };
  }
}

/** A guide as terminal text, numbered from `start`. */
export function guideText(guide: Guide, start = 1): string {
  return guide.steps
    .map((step, index) => {
      const body = step.code ? `\n\n${step.code.replace(/^/gm, "     ")}` : "";
      const file = step.file ? ` (${step.file})` : "";
      return `  ${start + index}. ${step.text}${file}${body}`;
    })
    .join("\n\n");
}

/** A guide as Markdown, for install.md. */
export function guideMarkdown(guide: Guide, heading = "###"): string {
  const steps = guide.steps
    .map((step) => {
      const file = step.file ? ` In \`${step.file}\`:` : "";
      const fence = step.code?.includes(" auth0-partial") ? "sh" : step.file?.endsWith(".ts") ? "ts" : "tsx";
      return `${step.text}${file}${step.code ? `\n\n\`\`\`${fence}\n${step.code}\n\`\`\`` : ""}`;
    })
    .join("\n\n");
  return `${heading} ${guide.title}\n\n${steps}`;
}
