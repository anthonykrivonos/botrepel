import { ASSURANCE_LABELS } from "../shared/assurance";
import { LIVENESS_RISK, PRESENCE_RISK, RISK_WEIGHTS } from "../shared/risk";
import { cn } from "../utils/cn";

const SIGNALS = [
  { name: "navigator.webdriver", weight: RISK_WEIGHTS.webdriver },
  { name: "DevTools protocol attached", weight: RISK_WEIGHTS.cdp },
] as const;

const risk = Math.min(
  1,
  SIGNALS.reduce((sum, signal) => sum + signal.weight, 0),
);
const required = risk >= LIVENESS_RISK ? "liveness" : risk >= PRESENCE_RISK ? "presence" : "invisible";

interface Row {
  readonly step: string;
  readonly detail: string;
  readonly value?: string;
  readonly tone?: "warn" | "danger";
}

const ROWS: readonly Row[] = [
  { step: "visit", detail: "An agent opens the form in automated Chrome" },
  ...SIGNALS.map((signal) => ({ step: "signal", detail: signal.name, value: `+${signal.weight.toFixed(2)}` })),
  {
    step: "risk",
    detail: `Steps up at ${PRESENCE_RISK.toFixed(2)} and ${LIVENESS_RISK.toFixed(2)}`,
    value: risk.toFixed(2),
  },
  { step: "step-up", detail: `${ASSURANCE_LABELS.invisible} → ${ASSURANCE_LABELS[required]}`, tone: "warn" },
  { step: "result", detail: "No live face reflects the sequence", value: "Not verified", tone: "danger" },
];

/** An agent's visit scored with the real weights and thresholds: why it gets stepped up, not waved through. */
export function FigAgentTrace(): React.JSX.Element {
  return (
    <ol data-stagger className="font-mono text-[13px]">
      {ROWS.map((row, index) => (
        <li
          key={`${row.step}-${index}`}
          className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-baseline gap-3 border-b border-line py-2.5 last:border-0"
        >
          <span className="text-fg-subtle">{row.step}</span>
          <span className={cn("min-w-0 wrap-anywhere text-fg-body", row.tone === "warn" && "text-warn")}>
            {row.detail}
          </span>
          <span className={cn("text-right text-fg", row.tone === "danger" && "text-danger")}>{row.value}</span>
        </li>
      ))}
    </ol>
  );
}
