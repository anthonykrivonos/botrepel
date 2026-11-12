import { AgentPromptHint } from "./AgentPromptHint";
import { HOME_HEADING } from "./content";
import { HeroDemo } from "./HeroDemo";
import { buttonClassName } from "../components/Button";
import { CopyField } from "../components/CopyField";
import { useOrigin } from "../hooks/useOrigin";
import { agentPrompt } from "../shared/constants";
import { FREE_CREDIT_MICROS, formatDollars } from "../shared/pricing";

export function Hero(): React.JSX.Element {
  const origin = useOrigin();
  return (
    <section className="relative">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-16 pb-16 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:pt-24 lg:pb-20">
        <div className="flex flex-col items-start gap-6">
          <h1 className="max-w-lg font-display text-display-sm font-normal text-fg sm:text-[4.5rem] sm:leading-[1.02]">
            Human verification for websites
          </h1>
          <p className="max-w-lg text-lg text-fg-body">{HOME_HEADING}</p>
          <p className="max-w-lg text-base text-fg-muted">
            Start with a background check, and choose stronger checks for actions that need more assurance.
          </p>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <a href="/login" className={buttonClassName("primary")}>
                Create an Account
              </a>
              <a href="#demo" className={buttonClassName("secondary")}>
                Try the Demo
              </a>
            </div>
            <p className="text-sm text-fg-muted">
              {formatDollars(FREE_CREDIT_MICROS, 0)} in free usage with GitHub or Google. No card required.
            </p>
          </div>
          <div className="mt-2 flex w-full max-w-lg flex-col gap-2">
            <AgentPromptHint />
            <CopyField value={agentPrompt(origin)} label="Copy prompt for your coding agent" kind="code" />
          </div>
        </div>
        <HeroDemo />
      </div>
    </section>
  );
}
