import { PriceScale } from "./PriceScale";
import { Section } from "./Section";
import { Badge } from "../components/Badge";
import { glassClassName } from "../components/Glass";
import { ASSURANCES, ASSURANCE_LABELS, type Assurance } from "../shared/assurance";
import { FREE_CREDIT_MICROS, PRICE_MICROS, formatDollars, formatPerThousand } from "../shared/pricing";
import { cn } from "../utils/cn";

const PROVES: Readonly<Record<Assurance, string>> = {
  invisible: "Proof of work and browser signals. Used for signups, logins, and forms.",
  presence: "A passkey on the visitor's device. Used for posts, votes, and reviews.",
  liveness: "A live face in front of the screen. Used for payouts and account recovery.",
};

export function Pricing(): React.JSX.Element {
  return (
    <Section
      id="pricing"
      eyebrow="Pricing"
      title="Pay per successful verification"
      lede="You are charged when your server verifies a token. The price follows the check that token proved."
      aside={<Badge tone="ok">{formatDollars(FREE_CREDIT_MICROS, 0)} free to start</Badge>}
    >
      <ul data-stagger className="grid gap-4 md:grid-cols-3">
        {ASSURANCES.map((level, index) => (
          <li key={level}>
            <div
              className={glassClassName(
                cn(
                  "flex h-full flex-col gap-6 transition-[translate,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_24px_60px_-30px_rgb(255_255_255/0.18)]",
                  level === "presence" && "border-white/16 border-t-white/32",
                ),
              )}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-base">{ASSURANCE_LABELS[level]}</h3>
                <span className="font-mono text-xs text-fg-subtle">0{index + 1}</span>
              </div>
              <p className="flex items-baseline gap-2">
                <span className="font-display text-6xl leading-none tracking-[-0.02em] text-fg">
                  {formatPerThousand(PRICE_MICROS[level])}
                </span>
                <span className="text-sm text-fg-subtle">per 1,000 checks</span>
              </p>
              <p className="text-sm text-fg-muted">{PROVES[level]}</p>
              <p className="mt-auto border-t border-line pt-4 font-mono text-xs text-fg-subtle">
                Free credit covers {Math.floor(FREE_CREDIT_MICROS / PRICE_MICROS[level]).toLocaleString("en-US")} checks
              </p>
            </div>
          </li>
        ))}
      </ul>
      <figure className={glassClassName("mt-4 p-5 sm:p-6")}>
        <PriceScale />
        <figcaption className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-fg-subtle">
          FIG. 5 · Dollars per 1,000 checks, log scale.
        </figcaption>
      </figure>
    </Section>
  );
}
