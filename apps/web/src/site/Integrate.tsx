import { Section } from "./Section";
import { CodeBlock } from "../components/CodeBlock";
import { CopyField } from "../components/CopyField";
import { Tabs } from "../components/Tabs";
import { useOrigin } from "../hooks/useOrigin";
import { agentPrompt } from "../shared/constants";

const REACT = `"use client";
import { BotRepel } from "botrepel/react";

export function SignupForm() {
  return (
    <form action="/api/signup" method="post">
      <input name="email" type="email" required />
      <BotRepel siteKey={process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY!} action="signup" />
      <button type="submit">Sign Up</button>
    </form>
  );
}`;

const NEXT = `"use server";
import { verify } from "botrepel";

export async function signup(formData: FormData) {
  const result = await verify({
    secretKey: process.env.BOTREPEL_SECRET_KEY!,
    token: formData.get("botrepel-response") as string,
    expectedAction: "signup",
  });
  if (!result.success) {
    return { error: "Verification failed." };
  }
  // Create the account.
}`;

const NODE = `import { verify } from "botrepel";

const result = await verify({
  secretKey: process.env.BOTREPEL_SECRET_KEY,
  token: body["botrepel-response"],
  expectedAction: "payout",
  minAssurance: "liveness",
});

result.success;   // true
result.assurance; // "invisible" | "presence" | "liveness"
result.pseudonym; // stable per person on your site, with a Human Pass`;

const CURL = `curl https://botrepel.com/v1/siteverify \\
  -d secret=$BOTREPEL_SECRET_KEY \\
  -d response=$TOKEN

# Turnstile-compatible fields, plus assurance, pseudonym, and unpaid`;

const AGENT_STEPS = [
  { title: "Paste the prompt", body: "Your agent reads the install guide and runs the CLI." },
  { title: "Approve in your browser", body: "You sign in once, and the CLI creates a site for your domain." },
  {
    title: "Keys land in your env file",
    body: "The agent adds the widget and the server check. Keys never appear in chat.",
  },
] as const;

export function Integrate(): React.JSX.Element {
  const origin = useOrigin();
  return (
    <Section
      id="integrate"
      eyebrow="Integrate"
      title="Add the widget and verify the token"
      lede="Place one component in the form and call verify on the server. A coding agent can follow the install guide from one prompt."
    >
      <Tabs
        label="Integration"
        tabs={[
          {
            label: "Coding agent",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-6">
                  <div className="flex flex-col gap-3">
                    <p className="text-sm text-fg-muted">
                      Paste into Claude Code, Cursor, or Codex. The CLI names the public site key for the framework it
                      detects. Next.js uses NEXT_PUBLIC_, and Vite uses VITE_.
                    </p>
                    <CopyField value={agentPrompt(origin)} label="Copy prompt" kind="code" />
                  </div>
                  <ol data-stagger className="flex flex-col">
                    {AGENT_STEPS.map((step, index) => (
                      <li key={step.title} className="flex gap-4 border-t border-line py-4">
                        <span className="font-mono text-xs text-fg-subtle">0{index + 1}</span>
                        <div>
                          <p className="text-sm text-fg">{step.title}</p>
                          <p className="text-sm text-fg-muted">{step.body}</p>
                        </div>
                      </li>
                    ))}
                  </ol>
                </div>
                <CodeBlock
                  title="Terminal"
                  code={`$ npx botrepel init --domain example.com

Open:  ${origin}/device?user_code=…
Waiting for your approval in the browser…

Created site "example" (localhost, example.com).
Wrote NEXT_PUBLIC_BOTREPEL_SITE_KEY and BOTREPEL_SECRET_KEY to .env.local.`}
                />
              </div>
            ),
          },
          { label: "React", content: <CodeBlock title="SignupForm.tsx" code={REACT} /> },
          { label: "Next.js", content: <CodeBlock title="app/signup/actions.ts" code={NEXT} /> },
          { label: "Node", content: <CodeBlock title="server.ts" code={NODE} /> },
          { label: "cURL", content: <CodeBlock title="Terminal" code={CURL} /> },
        ]}
      />
    </Section>
  );
}
