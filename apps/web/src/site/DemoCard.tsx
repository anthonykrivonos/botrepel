import { useEffect, useRef, useState } from "react";
import { TierPicker } from "./TierPicker";
import { BotRepel, type BotRepelHandle } from "../../../../packages/botrepel/src/react/BotRepel";
import { Button } from "../components/Button";
import { CodeBlock } from "../components/CodeBlock";
import { useOrigin } from "../hooks/useOrigin";
import type { Assurance } from "../shared/assurance";
import { DEMO_SITE_KEY_META } from "../shared/constants";
import type { SiteverifyResponse } from "../shared/siteverify";

const SITE_KEY = /^br_pk_[A-Za-z0-9]{16}$/;

type DemoKey =
  | { readonly status: "ready"; readonly siteKey: string }
  | { readonly status: "loading" }
  | { readonly status: "unavailable" };

/**
 * The build inlines PUBLIC_DEMO_SITE_KEY when it is set.
 * Bun leaves a `process` reference when it is unset, and that throws in the browser.
 */
function inlinedDemoSiteKey(): string | undefined {
  try {
    const value = process.env.PUBLIC_DEMO_SITE_KEY?.trim();
    return value && SITE_KEY.test(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

/** The public key from the build, or from the meta tag the build writes into the home page. */
function publishedDemoSiteKey(): string | undefined {
  const inlined = inlinedDemoSiteKey();
  if (inlined) {
    return inlined;
  }
  if (typeof document === "undefined") {
    return undefined;
  }
  const content = document.querySelector(`meta[name="${DEMO_SITE_KEY_META}"]`)?.getAttribute("content")?.trim();
  return content && SITE_KEY.test(content) ? content : undefined;
}

function initialDemoKey(): DemoKey {
  const siteKey = publishedDemoSiteKey();
  return siteKey ? { status: "ready", siteKey } : { status: "loading" };
}

const HINTS: Readonly<Record<Assurance, string>> = {
  invisible: "Proof of work and browser signals usually let you pass without a click.",
  presence: "After your first light check, you can use Face ID, Touch ID, or a fingerprint to pass with one tap.",
  liveness:
    "Your screen shows a two-second color sequence while the camera watches it reflect, and then you roll your head. The frames are discarded while numeric scores are kept.",
};

type Status =
  | { readonly kind: "ready" }
  | { readonly kind: "running" }
  | { readonly kind: "verified"; readonly response: SiteverifyResponse }
  | { readonly kind: "error"; readonly message: string };

/** The real widget on BotRepel's demo site, and the real siteverify response for its token. Browser-only. */
export function DemoCard(): React.JSX.Element {
  const origin = useOrigin();
  const widget = useRef<BotRepelHandle>(null);
  const [tier, setTier] = useState<Assurance>("liveness");
  const [status, setStatus] = useState<Status>({ kind: "ready" });
  const [demoKey, setDemoKey] = useState<DemoKey>(initialDemoKey);

  useEffect(() => {
    if (demoKey.status !== "loading") {
      return;
    }
    const controller = new AbortController();
    void (async (): Promise<void> => {
      try {
        const response = await fetch("/api/demo", { signal: controller.signal });
        if (!response.ok) {
          setDemoKey({ status: "unavailable" });
          return;
        }
        const body = (await response.json()) as { siteKey?: unknown };
        if (typeof body.siteKey === "string" && SITE_KEY.test(body.siteKey)) {
          setDemoKey({ status: "ready", siteKey: body.siteKey });
          return;
        }
        setDemoKey({ status: "unavailable" });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setDemoKey({ status: "unavailable" });
      }
    })();
    return () => controller.abort();
  }, [demoKey.status]);

  if (demoKey.status !== "ready") {
    return demoKey.status === "unavailable" ? (
      <p className="text-sm text-fg-muted">The live demo isn't available on this server right now.</p>
    ) : (
      <p className="min-h-10 text-sm text-fg-muted" aria-busy="true">
        Loading the demo.
      </p>
    );
  }

  const siteKey = demoKey.siteKey;

  const verify = async (token: string): Promise<void> => {
    try {
      const response = await fetch("/api/demo/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await response.json()) as SiteverifyResponse & { error?: string };
      setStatus(body.error ? { kind: "error", message: body.error } : { kind: "verified", response: body });
    } catch {
      setStatus({ kind: "error", message: "We couldn't reach the demo server. Try again." });
    }
  };

  const choose = (next: Assurance): void => {
    setTier(next);
    setStatus({ kind: "ready" });
  };

  return (
    <div className="@container flex flex-col gap-4">
      <TierPicker value={tier} onChange={choose} disabled={status.kind === "running"} />
      <p className="min-h-10 text-sm text-fg-muted">{HINTS[tier]}</p>
      <div className="flex flex-col rounded-card border border-line-strong bg-surface @sm:flex-row @sm:items-center">
        {/* The shared outline replaces the compact frame's border; expanded checks stay full-screen. */}
        <BotRepel
          key={tier}
          ref={widget}
          siteKey={siteKey}
          action="demo"
          minAssurance={tier}
          mode="execute"
          theme="dark"
          apiOrigin={origin}
          className="min-w-0 flex-1 [&_dialog:not(:modal)]:w-full [&_dialog:not(:modal)_iframe]:w-full! [&_dialog:not(:modal)_iframe]:[clip-path:inset(1px_round_9px)]"
          onVerify={(token) => void verify(token)}
          onError={(_code, message) => setStatus({ kind: "error", message })}
        />
        <div className="border-t border-line-strong p-2 @sm:border-t-0 @sm:border-l @sm:py-0">
          <Button
            variant="ghost"
            className="w-full text-fg @sm:w-auto"
            disabled={status.kind === "running"}
            onClick={() => {
              setStatus({ kind: "running" });
              widget.current?.reset();
              widget.current?.execute();
            }}
          >
            {status.kind === "running"
              ? "Checking…"
              : status.kind === "verified" || status.kind === "error"
                ? "Run Again"
                : "Run Check"}
          </Button>
        </div>
      </div>
      {status.kind === "error" && (
        <p role="alert" className="text-sm text-danger">
          {status.message}
        </p>
      )}
      {status.kind === "verified" && (
        <CodeBlock
          title="Your server receives"
          code={JSON.stringify(status.response, null, 2)}
          className="[&_pre]:max-h-56"
        />
      )}
    </div>
  );
}
