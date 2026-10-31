import { buttonClassName } from "../components/Button";
import { CopyButton } from "../components/CopyButton";
import { useOrigin } from "../hooks/useOrigin";
import { useReveal } from "../hooks/useReveal";
import { agentPrompt } from "../shared/constants";
import { FREE_CREDIT_MICROS, formatDollars } from "../shared/pricing";

export function ClosingCta(): React.JSX.Element {
  const origin = useOrigin();
  const ref = useReveal<HTMLElement>();
  return (
    <section ref={ref} className="relative overflow-hidden border-t border-line">
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(255_255_255/0.07),transparent_70%)]"
      />
      <div className="relative mx-auto flex max-w-6xl flex-col items-center gap-8 px-4 py-28 text-center sm:px-6 sm:py-36">
        <h2 className="max-w-4xl font-display text-[3.25rem] leading-[1] font-normal tracking-[-0.025em] sm:text-[5.5rem]">
          Make the internet human again.
        </h2>
        <p className="max-w-md text-lg text-fg-muted">
          Get {formatDollars(FREE_CREDIT_MICROS, 0)} of free checks without a card or minimums, and go live in an
          afternoon.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <a href="/login" className={buttonClassName("primary")}>
            Get Started
          </a>
          <CopyButton
            value={agentPrompt(origin)}
            className={buttonClassName("secondary", "md", "size-auto h-10 w-auto")}
          >
            Copy Agent Prompt
          </CopyButton>
        </div>
      </div>
    </section>
  );
}
