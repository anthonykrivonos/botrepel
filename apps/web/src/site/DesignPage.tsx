import { useState } from "react";
import { DesignSection as Section } from "./DesignSection";
import { Badge, type BadgeTone } from "../components/Badge";
import { Button, type ButtonVariant } from "../components/Button";
import { Card } from "../components/Card";
import { CodeBlock } from "../components/CodeBlock";
import { CopyField } from "../components/CopyField";
import { Dialog } from "../components/Dialog";
import { Field } from "../components/Field";
import { Glass } from "../components/Glass";
import { Input } from "../components/Input";
import { Nav } from "../components/Nav";
import { Tabs } from "../components/Tabs";
import { cn } from "../utils/cn";

/** Spelled out in full so Tailwind sees every class. */
const SURFACES: Readonly<Record<string, string>> = {
  canvas: "bg-canvas",
  well: "bg-well",
  surface: "bg-surface",
  "surface-raised": "bg-surface-raised",
};
const TEXT: Readonly<Record<string, string>> = {
  fg: "text-fg",
  "fg-body": "text-fg-body",
  "fg-muted": "text-fg-muted",
  "fg-subtle": "text-fg-subtle",
  "fg-disabled": "text-fg-disabled",
};
const STATES: Readonly<Record<string, string>> = {
  ok: "bg-ok-wash text-ok",
  warn: "bg-warn-wash text-warn",
  danger: "bg-danger-wash text-danger",
  info: "bg-info-wash text-info",
};
const VARIANTS: readonly ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const TONES: readonly BadgeTone[] = ["neutral", "ok", "warn", "danger", "info"];

const SAMPLE = `import { BotRepel } from "botrepel/react";

<BotRepel siteKey={process.env.NEXT_PUBLIC_BOTREPEL_SITE_KEY} action="signup" />`;

/** Every token and primitive in one place, for design review (noindex). */
export function DesignPage(): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
        <h1 className="mb-2 font-display text-display-sm font-normal">Design system</h1>
        <p className="mb-10 text-fg-muted">Dark first. Color means state. Precision over decoration.</p>

        <Section title="Type">
          <p className="font-display text-display font-normal text-fg">Display serif</p>
          <p className="text-xl text-fg">Heading, Inter 24/32</p>
          <p className="text-lg">Large body, Inter 18/28</p>
          <p>Body, Inter 16/24, the default for prose and controls.</p>
          <p className="text-sm text-fg-muted">Small, Inter 14/20, for secondary text.</p>
          <p className="font-mono text-sm">Geist Mono for code and keys: br_pk_7f3a9c</p>
        </Section>

        <Section title="Color">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {Object.entries(SURFACES).map(([name, className]) => (
              <div key={name} className="flex flex-col gap-2">
                <div className={cn("h-16 rounded-card border border-line", className)} />
                <p className="font-mono text-xs text-fg-subtle">{name}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {Object.entries(TEXT).map(([name, className]) => (
              <p key={name} className={cn("font-mono text-sm", className)}>
                {name}
              </p>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {Object.entries(STATES).map(([name, className]) => (
              <div key={name} className={cn("rounded-control px-3 py-2 font-mono text-xs", className)}>
                {name}
              </div>
            ))}
          </div>
        </Section>

        <Section title="Buttons and badges">
          <div className="flex flex-wrap items-center gap-3">
            {VARIANTS.map((variant) => (
              <Button key={variant} variant={variant}>
                {variant[0]!.toUpperCase() + variant.slice(1)}
              </Button>
            ))}
            <Button disabled>Disabled</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {TONES.map((tone) => (
              <Badge key={tone} tone={tone}>
                {tone}
              </Badge>
            ))}
          </div>
        </Section>

        <Section title="Forms">
          <div className="grid max-w-md gap-4">
            <Field label="Site name" hint="Shown only in your dashboard.">
              {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} placeholder="Acme signup" />}
            </Field>
            <Field label="Allowed domain" error="Enter a domain like acme.com.">
              {({ id, describedBy, invalid }) => (
                <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} defaultValue="acme" />
              )}
            </Field>
            <CopyField value="br_sk_live_9f2c4e7a1b6d8e03c5a7f912" label="Copy secret key" />
            <CopyField value="bun add botrepel" label="Copy install command" kind="code" />
          </div>
        </Section>

        <Section title="Surfaces">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <h3 className="mb-2">Card</h3>
              <p className="text-sm text-fg-muted">Gradient hairline border on surface.</p>
            </Card>
            <CodeBlock title="app/signup/page.tsx" code={SAMPLE} />
          </div>
          <div className="relative overflow-hidden rounded-card border border-line glow-info p-10">
            <div aria-hidden className="absolute inset-0 dot-field" />
            <Glass className="relative mx-auto max-w-sm">
              <h3 className="mb-2">Glass</h3>
              <p className="text-sm text-fg-muted">Frosted surface over glows and scrolling content.</p>
            </Glass>
          </div>
          <Tabs
            label="Install method"
            tabs={[
              { label: "Agent", content: <p className="text-sm text-fg-muted">Paste one prompt.</p> },
              { label: "Manual", content: <p className="text-sm text-fg-muted">Run npx botrepel init.</p> },
            ]}
          />
          <div>
            <Button variant="secondary" onClick={() => setOpen(true)}>
              Open dialog
            </Button>
            <Dialog open={open} title="Rotate secret key" onClose={() => setOpen(false)}>
              <p className="mb-6 text-sm text-fg-muted">The current key keeps working for 24 hours.</p>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => setOpen(false)}>
                  Rotate
                </Button>
              </div>
            </Dialog>
          </div>
        </Section>
      </main>
    </>
  );
}
