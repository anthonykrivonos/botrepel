import { CodeBlock } from "../components/CodeBlock";
import { CopyField } from "../components/CopyField";
import { Tabs } from "../components/Tabs";
import { useOrigin } from "../hooks/useOrigin";
import { agentPrompt } from "../shared/constants";

interface SiteInstallProps {
  readonly siteKey: string;
}

const serverSnippet = `import { verify } from "botrepel";

const result = await verify({
  secretKey: process.env.BOTREPEL_SECRET_KEY,
  token: form.get("botrepel-response"),
  expectedAction: "signup",
});
if (!result.success) {
  return new Response("Verification failed", { status: 403 });
}`;

export function SiteInstall({ siteKey }: SiteInstallProps): React.JSX.Element {
  const origin = useOrigin();
  const clientSnippet = `import { BotRepel } from "botrepel/react";

<form method="post">
  {/* … */}
  <BotRepel siteKey="${siteKey}" action="signup" />
</form>`;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-lg">Install</h2>
      <Tabs
        label="Install method"
        tabs={[
          {
            label: "Coding agent",
            content: (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-fg-muted">
                  In your app's folder, paste this into Claude Code, Cursor, or Codex.
                </p>
                <CopyField value={agentPrompt(origin)} label="Copy prompt" kind="code" />
              </div>
            ),
          },
          {
            label: "Manual",
            content: (
              <div className="grid gap-4 lg:grid-cols-2">
                <CodeBlock title="Your form" code={clientSnippet} />
                <CodeBlock title="Your server" code={serverSnippet} />
              </div>
            ),
          },
        ]}
      />
    </section>
  );
}
