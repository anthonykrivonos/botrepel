import { useCallback, useEffect, useRef, useState } from "react";
import { LivenessStep } from "./LivenessStep";
import { PassOffer } from "./PassOffer";
import { solvePow } from "./pow-solver";
import { PresenceStep } from "./PresenceStep";
import { collectSignals } from "./signals";
import type { WidgetConfig } from "./widget-config";
import { WidgetFrame } from "./WidgetFrame";
import type { Assurance } from "../shared/assurance";
import { TOKEN_TTL_SECONDS } from "../shared/constants";
import type { HostToWidget, WidgetErrorCode, WidgetToHost } from "../shared/widget-protocol";

export type WidgetState =
  | { readonly kind: "idle" }
  | { readonly kind: "checking" }
  | { readonly kind: "liveness"; readonly livenessId: string }
  | { readonly kind: "presence"; readonly presenceId: string; readonly livenessId: string }
  | { readonly kind: "pass-offer"; readonly token: string; readonly anchorId: string }
  | { readonly kind: "verified" }
  | { readonly kind: "error"; readonly code: WidgetErrorCode; readonly message: string };

/** Tokens are refreshed a little before the server would reject them. */
const EXPIRY_MARGIN_SECONDS = 10;

interface WidgetAppProps {
  readonly config: WidgetConfig;
}

async function postJson<T>(
  path: string,
  body: unknown,
): Promise<{ ok: true; data: T } | { ok: false; status: number; error: string; code?: string }> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json()) as T & { error?: string; code?: string };
    return response.ok
      ? { ok: true, data }
      : { ok: false, status: response.status, error: data.error ?? "Verification failed.", code: data.code };
  } catch {
    return { ok: false, status: 0, error: "Couldn't reach BotRepel. Check your connection." };
  }
}

export function WidgetApp({ config }: WidgetAppProps): React.JSX.Element {
  const [state, setState] = useState<WidgetState>({ kind: "idle" });
  const running = useRef(false);

  const tell = useCallback(
    (message: WidgetToHost) => window.parent.postMessage(message, config.hostOrigin),
    [config.hostOrigin],
  );

  const fail = useCallback(
    (code: WidgetErrorCode, message: string) => {
      setState({ kind: "error", code, message });
      tell({ type: "botrepel:error", code, message });
    },
    [tell],
  );

  const run = useCallback(async () => {
    if (running.current) {
      return;
    }
    running.current = true;
    setState({ kind: "checking" });
    try {
      const start = await postJson<{ challengeId: string; pow: { seed: string; bits: number } }>(
        "/v1/challenge/start",
        {
          siteKey: config.siteKey,
          action: config.action,
          hostname: new URL(config.hostOrigin).hostname,
          ticket: document.querySelector<HTMLMetaElement>('meta[name="botrepel-ticket"]')?.content,
          ...(config.minAssurance ? { minAssurance: config.minAssurance } : {}),
        },
      );
      if (!start.ok && start.code === "ticket") {
        // The page's embed ticket lapsed (a form left open for hours): reload for a fresh one.
        window.location.reload();
        return;
      }
      if (!start.ok) {
        fail(start.status === 403 ? "domain" : start.status === 503 ? "unavailable" : "network", start.error);
        return;
      }
      const started = performance.now();
      const nonce = await solvePow(start.data.pow.seed, start.data.pow.bits);
      const outcome = await postJson<
        | { kind: "token"; token: string; assurance: Assurance }
        | { kind: "stepUp"; required: Assurance; livenessId: string; presenceId?: string }
      >("/v1/challenge/invisible", {
        challengeId: start.data.challengeId,
        nonce,
        signals: collectSignals(performance.now() - started),
      });
      if (!outcome.ok) {
        fail("failed", outcome.error);
        return;
      }
      if (outcome.data.kind === "stepUp") {
        // Presence offers the Human Pass first; liveness (or no pass) is the light check.
        const { livenessId, presenceId } = outcome.data;
        setState(presenceId ? { kind: "presence", presenceId, livenessId } : { kind: "liveness", livenessId });
        tell({ type: "botrepel:expand", expanded: true });
        return;
      }
      setState({ kind: "verified" });
      tell({ type: "botrepel:token", token: outcome.data.token, assurance: outcome.data.assurance });
    } finally {
      running.current = false;
    }
  }, [config, fail, tell]);

  // A verified token expires; tell the host and start over so the form never submits a dead one.
  useEffect(() => {
    if (state.kind !== "verified") {
      return;
    }
    const timer = setTimeout(
      () => {
        tell({ type: "botrepel:expired" });
        setState({ kind: "idle" });
        if (config.mode === "auto") {
          void run();
        }
      },
      (TOKEN_TTL_SECONDS - EXPIRY_MARGIN_SECONDS) * 1000,
    );
    return () => clearTimeout(timer);
  }, [state.kind, tell, run, config.mode]);

  useEffect(() => {
    const onMessage = (event: MessageEvent<HostToWidget>): void => {
      if (event.origin !== config.hostOrigin || event.source !== window.parent) {
        return;
      }
      if (event.data?.type === "botrepel:execute") {
        void run();
      } else if (event.data?.type === "botrepel:reset") {
        // A reset mid-check gives the host its page back.
        tell({ type: "botrepel:expand", expanded: false });
        setState({ kind: "idle" });
      }
    };
    window.addEventListener("message", onMessage);
    tell({ type: "botrepel:ready" });
    if (config.mode === "auto") {
      void run();
    }
    return () => window.removeEventListener("message", onMessage);
  }, [config, run, tell]);

  const finish = (token: string, assurance: Assurance): void => {
    tell({ type: "botrepel:expand", expanded: false });
    setState({ kind: "verified" });
    tell({ type: "botrepel:token", token, assurance });
  };

  if (state.kind === "presence") {
    return (
      <PresenceStep
        presenceId={state.presenceId}
        onToken={(token) => finish(token, "presence")}
        onLightCheck={() => setState({ kind: "liveness", livenessId: state.livenessId })}
      />
    );
  }
  if (state.kind === "pass-offer") {
    return <PassOffer anchorId={state.anchorId} onDone={() => finish(state.token, "liveness")} />;
  }
  if (state.kind === "liveness") {
    return (
      <LivenessStep
        livenessId={state.livenessId}
        onToken={(token, anchorId) =>
          anchorId ? setState({ kind: "pass-offer", token, anchorId }) : finish(token, "liveness")
        }
        onFail={(code, message) => {
          tell({ type: "botrepel:expand", expanded: false });
          fail(code, message);
        }}
      />
    );
  }
  return <WidgetFrame state={state} onRetry={() => void run()} />;
}
