import type { WidgetState } from "./WidgetApp";
import { LogoMark } from "../components/LogoMark";
import { cn } from "../utils/cn";

interface WidgetFrameProps {
  readonly state: WidgetState;
  readonly onRetry: () => void;
}

const LABELS: Readonly<Record<WidgetState["kind"], string>> = {
  idle: "Ready to verify",
  checking: "Checking you're human…",
  liveness: "Light check in progress…",
  presence: "Confirming you're human…",
  "pass-offer": "You're verified",
  verified: "You're verified",
  error: "Couldn't verify",
};

/** The compact box the host page shows: 300 × 64, status on the left, brand on the right. */
export function WidgetFrame({ state, onRetry }: WidgetFrameProps): React.JSX.Element {
  return (
    <div className="flex h-16 w-full items-center gap-3 rounded-card border border-line-strong bg-surface px-4 text-fg">
      <span
        aria-hidden="true"
        className={cn(
          "flex size-6 shrink-0 items-center justify-center rounded-full",
          state.kind === "verified" && "bg-ok-wash text-ok",
          state.kind === "error" && "bg-danger-wash text-danger",
          (state.kind === "idle" || state.kind === "checking" || state.kind === "liveness") &&
            "border border-line-strong",
        )}
      >
        {state.kind === "checking" && (
          <span className="size-3.5 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" />
        )}
        {state.kind === "verified" && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
        {state.kind === "error" && <span className="text-sm leading-none font-semibold">!</span>}
      </span>
      <div className="min-w-0 flex-1" role="status" aria-live="polite">
        <p className="truncate text-sm font-medium">{LABELS[state.kind]}</p>
        {state.kind === "error" && (
          <p className="truncate text-xs text-fg-subtle" title={state.message}>
            {state.code === "failed" || state.code === "network" ? (
              <button type="button" onClick={onRetry} className="underline underline-offset-2 hover:text-fg">
                Try Again
              </button>
            ) : (
              state.message
            )}
          </p>
        )}
      </div>
      <a
        href="https://botrepel.com"
        target="_blank"
        rel="noreferrer"
        className="shrink-0 text-fg-subtle hover:text-fg"
        aria-label="Protected by BotRepel"
        title="Protected by BotRepel"
      >
        <LogoMark className="h-5" />
      </a>
    </div>
  );
}
